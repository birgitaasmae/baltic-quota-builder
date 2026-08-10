const LATVIA_API_BASE = "https://api.stat.gov.lv/api/v2";
const ESTONIA_API_BASE = "https://andmed.stat.ee/api/v1/et/stat";
const LITHUANIA_PROXY_URL = location.hostname.endsWith("github.io")
  ? "https://baltic-quota-builder.vercel.app/api/lithuania-population"
  : "/api/lithuania-population";

const COUNTRY_NAMES = {
  EE: "Estonia",
  LV: "Latvia",
  LT: "Lithuania"
};

const ESTONIA_TABLE_ID = "RV0240";
const LATVIA_TABLE_ID = "IRD041";
const LITHUANIA_FLOW_ID = "S3R167_M3010222";

const ESTONIA_REGION_CODES = [
  "H6", "H10", "H14", "H18", "H22"
];

const LATVIA_REGION_CODES = [
  "LV00A", "LV00C", "LV00B", "LV009", "LV005"
];

const state = {
  rowsForExport: [],
  latestPopulationData: null,
  latestRegionalData: null,
  latestGeoLabels: {}
};

const els = {
  country: document.querySelector("#countrySelect"),
  year: document.querySelector("#yearSelect"),
  sampleSize: document.querySelector("#sampleSizeInput"),
  minAge: document.querySelector("#minAgeInput"),
  maxAge: document.querySelector("#maxAgeInput"),
  grouping: document.querySelector("#ageGroupingSelect"),
  sexFilter: document.querySelector("#sexFilterSelect"),
  regionLevel: document.querySelector("#regionLevelSelect"),
  build: document.querySelector("#buildButton"),
  status: document.querySelector("#statusText"),
  summary: document.querySelector("#summaryPanel"),
  populationBase: document.querySelector("#populationBase"),
  selectedSample: document.querySelector("#selectedSample"),
  estimatedMargin: document.querySelector("#estimatedMargin"),
  results: document.querySelector("#results"),
  sexTable: document.querySelector("#sexTable"),
  ageTable: document.querySelector("#ageTable"),
  ageMeta: document.querySelector("#ageMeta"),
  regionSection: document.querySelector("#regionSection"),
  regionTable: document.querySelector("#regionTable"),
  crossSection: document.querySelector("#crossSection"),
  crossTable: document.querySelector("#crossTable"),
  copy: document.querySelector("#copyButton"),
  download: document.querySelector("#downloadButton")
};

async function pxWebPostSelection(baseUrl, tableId, query) {
  const response = await fetch(`${baseUrl}/${tableId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, response: { format: "json-stat2" } })
  });
  if (!response.ok) throw new Error(`${tableId} returned ${response.status}`);
  return response.json();
}

async function latviaPostSelection(tableId, selection) {
  const response = await fetch(`${LATVIA_API_BASE}/tables/${tableId}/data?lang=en&outputFormat=json-stat2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ selection })
  });
  if (!response.ok) throw new Error(`Latvia CSB returned ${response.status}`);
  return response.json();
}

function parseJsonStat(data) {
  const dataset = data.dataset || data;
  const dims = dataset.id;
  const sizes = dataset.size;
  const values = dataset.value || [];
  const strides = new Array(dims.length);
  strides[dims.length - 1] = 1;
  for (let i = dims.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * sizes[i + 1];

  const dimIndex = {};
  const dimLabels = {};
  for (const dim of dims) {
    const category = dataset.dimension[dim].category;
    dimIndex[dim] = category.index || {};
    dimLabels[dim] = category.label || {};
  }
  return { dims, sizes, values, strides, dimIndex, dimLabels };
}

function lookupValue(parsed, coords) {
  let index = 0;
  for (let i = 0; i < parsed.dims.length; i++) {
    const dim = parsed.dims[i];
    const position = parsed.dimIndex[dim][coords[dim]];
    if (position === undefined) return null;
    index += position * parsed.strides[i];
  }
  const value = parsed.values[index];
  return value === undefined || value === null ? null : value;
}

function exactAgeCode(age) {
  return `Y${age}`;
}

function getAgeBands(minAge, maxAge, grouping) {
  const ages = [];
  for (let age = minAge; age <= maxAge; age++) {
    ages.push({ code: exactAgeCode(age), from: age, to: age, label: String(age) });
  }
  if (grouping === 1) return ages;

  const bands = [];
  for (let start = minAge; start <= maxAge; start += grouping) {
    const end = Math.min(start + grouping - 1, maxAge);
    const members = ages.filter(age => age.from >= start && age.to <= end);
    bands.push({
      code: `Y${start}-${end}`,
      from: start,
      to: end,
      label: start === end ? String(start) : `${start}-${end}`,
      members
    });
  }
  return bands;
}

function fmt(number) {
  return Math.round(number).toLocaleString("en");
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function marginOfError(sampleSize, population) {
  if (!sampleSize || !population) return 0;
  const z = 1.96;
  const p = 0.5;
  const raw = z * Math.sqrt((p * (1 - p)) / sampleSize);
  const fpc = Math.sqrt((population - sampleSize) / Math.max(population - 1, 1));
  return raw * fpc;
}

function largestRemainder(proportions, total) {
  const raw = proportions.map(value => value * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((sum, value) => sum + value, 0);
  const fractions = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i++) floors[fractions[i].index]++;
  return floors;
}

async function fetchEstoniaPopulation(year, minAge, maxAge) {
  const ageCodes = [];
  for (let age = minAge; age <= maxAge; age++) ageCodes.push(String(age));
  const areaCodes = ["00", ...ESTONIA_REGION_CODES];

  const data = await pxWebPostSelection(ESTONIA_API_BASE, ESTONIA_TABLE_ID, [
    { code: "Sugu", selection: { filter: "item", values: ["2", "3"] } },
    { code: "Elukoht", selection: { filter: "item", values: areaCodes } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Vanus", selection: { filter: "item", values: ageCodes } }
  ]);
  const parsed = parseJsonStat(data);
  const national = new Map();
  const regional = new Map();
  const labels = parsed.dimLabels.Elukoht || {};
  const sexCodeByKey = { M: "2", F: "3" };

  for (const area of areaCodes) {
    for (const sex of ["M", "F"]) {
      for (let age = minAge; age <= maxAge; age++) {
        const value = lookupValue(parsed, {
          Sugu: sexCodeByKey[sex],
          Elukoht: area,
          Aasta: year,
          Vanus: String(age)
        });
        if (value > 0) {
          if (area === "00") national.set(`${sex}|${age}`, value);
          else regional.set(`${sex}|${age}|${area}`, value);
        }
      }
    }
  }
  return {
    national,
    regional,
    labels,
    nationalRegionCode: "00",
    sourceNote: "Statistics Estonia table RV0240"
  };
}

async function fetchLatviaPopulation(year, minAge, maxAge) {
  const ageCodes = [];
  for (let age = minAge; age <= maxAge; age++) ageCodes.push(exactAgeCode(age));
  const areaCodes = ["LV", ...LATVIA_REGION_CODES];

  const data = await latviaPostSelection(LATVIA_TABLE_ID, [
    { variableCode: "ContentsCode", valueCodes: [LATVIA_TABLE_ID] },
    { variableCode: "TIME", valueCodes: [year] },
    { variableCode: "AREA", valueCodes: areaCodes },
    { variableCode: "SEX", valueCodes: ["M", "F"] },
    { variableCode: "AGE", valueCodes: ageCodes }
  ]);
  const parsed = parseJsonStat(data);
  const national = new Map();
  const regional = new Map();
  const labels = parsed.dimLabels.AREA || {};

  for (const area of areaCodes) {
    for (const sex of ["M", "F"]) {
      for (let age = minAge; age <= maxAge; age++) {
        const value = lookupValue(parsed, {
          AREA: area,
          AGE: exactAgeCode(age),
          SEX: sex,
          ContentsCode: LATVIA_TABLE_ID,
          TIME: year
        });
        if (value > 0) {
          if (area === "LV") national.set(`${sex}|${age}`, value);
          else regional.set(`${sex}|${age}|${area}`, value);
        }
      }
    }
  }
  return {
    national,
    regional,
    labels,
    nationalRegionCode: "LV",
    sourceNote: "Central Statistics Bureau of Latvia table IRD041"
  };
}

async function fetchLithuaniaPopulation(year) {
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${encodeURIComponent(year)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Lithuania proxy returned ${response.status}`);
  }
  const data = await response.json();
  const national = new Map();

  for (const row of data.rows) {
    const perAge = row.population / (row.ageTo - row.ageFrom + 1);
    for (let age = row.ageFrom; age <= row.ageTo; age++) {
      national.set(`${row.sex}|${age}`, (national.get(`${row.sex}|${age}`) || 0) + perAge);
    }
  }

  return {
    national,
    regional: new Map(),
    labels: {},
    nationalRegionCode: null,
    sourceNote: "State Data Agency of Lithuania / Official Statistics Portal SDMX flow S3R167_M3010222. Lithuania is published in 5-year age bands, so partial age ranges are prorated within bands."
  };
}

async function fetchPopulation(country, year, minAge, maxAge) {
  if (country === "EE") return fetchEstoniaPopulation(year, minAge, maxAge);
  if (country === "LV") return fetchLatviaPopulation(year, minAge, maxAge);
  return fetchLithuaniaPopulation(year);
}

function aggregateNational(map, sexes, bands) {
  let total = 0;
  for (const sex of sexes) {
    for (const band of bands) {
      const members = band.members || [band];
      for (const member of members) {
        for (let age = member.from; age <= member.to; age++) {
          total += map.get(`${sex}|${age}`) || 0;
        }
      }
    }
  }
  return total;
}

function aggregateRegional(map, sexes, bands, geo = null) {
  let total = 0;
  for (const sex of sexes) {
    for (const band of bands) {
      const members = band.members || [band];
      for (const member of members) {
        for (let age = member.from; age <= member.to; age++) {
          total += map.get(`${sex}|${age}|${geo}`) || 0;
        }
      }
    }
  }
  return total;
}

function renderTable(target, headers, rows, footer = null) {
  let html = "<table><thead><tr>";
  html += headers.map(header => `<th>${header}</th>`).join("");
  html += "</tr></thead><tbody>";
  html += rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("");
  html += "</tbody>";
  if (footer) html += `<tfoot><tr>${footer.map(cell => `<td>${cell}</td>`).join("")}</tr></tfoot>`;
  html += "</table>";
  target.innerHTML = html;
}

function addExportRows(section, headers, rows, footer = null) {
  state.rowsForExport.push([section]);
  state.rowsForExport.push(headers);
  state.rowsForExport.push(...rows);
  if (footer) state.rowsForExport.push(footer);
  state.rowsForExport.push([]);
}

function buildQuotaRows(labels, populations, sampleSize) {
  const total = populations.reduce((sum, value) => sum + value, 0);
  const proportions = populations.map(value => value / total);
  const quotas = largestRemainder(proportions, sampleSize);
  return labels.map((label, index) => [
    label,
    fmt(populations[index]),
    pct(proportions[index]),
    quotas[index]
  ]);
}

function setBusy(isBusy) {
  els.build.disabled = isBusy;
  els.status.textContent = isBusy ? "Fetching population data..." : "Ready.";
}

async function buildQuotas() {
  const country = els.country.value;
  const year = els.year.value;
  const sampleSize = Number(els.sampleSize.value);
  const minAge = Number(els.minAge.value);
  const maxAge = Number(els.maxAge.value);
  const grouping = Number(els.grouping.value);
  const regionLevel = Number(els.regionLevel.value);
  const sexes = els.sexFilter.value === "MF" ? ["M", "F"] : [els.sexFilter.value];

  if (minAge > maxAge) {
    els.status.textContent = "Maximum age must be at least minimum age.";
    return;
  }
  if (sampleSize < 10) {
    els.status.textContent = "Sample size must be at least 10.";
    return;
  }

  setBusy(true);
  state.rowsForExport = [];

  try {
    const ageBands = getAgeBands(minAge, maxAge, grouping);
    const population = await fetchPopulation(country, year, minAge, maxAge);
    const national = population.national;
    state.latestPopulationData = national;
    state.latestRegionalData = population.regional;
    state.latestGeoLabels = population.labels;
    const totalPopulation = aggregateNational(national, sexes, ageBands);
    if (!totalPopulation) throw new Error("No population data found for this selection.");

    els.summary.hidden = false;
    els.populationBase.textContent = fmt(totalPopulation);
    els.selectedSample.textContent = fmt(sampleSize);
    els.estimatedMargin.textContent = `${(marginOfError(sampleSize, totalPopulation) * 100).toFixed(1)}%`;

    const sexLabels = sexes.map(sex => sex === "M" ? "Male" : "Female");
    const sexPopulations = sexes.map(sex => aggregateNational(national, [sex], ageBands));
    const sexRows = buildQuotaRows(sexLabels, sexPopulations, sampleSize);
    renderTable(els.sexTable, ["Sex", "Population", "%", "Quota"], sexRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);
    addExportRows("Sex Distribution", ["Sex", "Population", "%", "Quota"], sexRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);

    const ageLabels = ageBands.map(band => band.label);
    const agePopulations = ageBands.map(band => aggregateNational(national, sexes, [band]));
    const ageRows = buildQuotaRows(ageLabels, agePopulations, sampleSize);
    renderTable(els.ageTable, ["Age Group", "Population", "%", "Quota"], ageRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);
    els.ageMeta.textContent = `${COUNTRY_NAMES[country]}, ${year}. Ages ${minAge}-${maxAge}; ${grouping}-year display grouping. Source: ${population.sourceNote}.`;
    addExportRows("Age Distribution", ["Age Group", "Population", "%", "Quota"], ageRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);

    if (regionLevel > 0 && population.regional.size) {
      const regionCodes = Object.keys(population.labels).filter(code => code !== population.nationalRegionCode);
      const regionPopulations = regionCodes.map(code => aggregateRegional(population.regional, sexes, ageBands, code));
      const nonZero = regionCodes
        .map((code, index) => ({ code, population: regionPopulations[index] }))
        .filter(row => row.population > 0);
      if (nonZero.length) {
        const regionalTotal = nonZero.reduce((sum, row) => sum + row.population, 0);
        const regionRows = buildQuotaRows(
          nonZero.map(row => `${population.labels[row.code]} (${row.code})`),
          nonZero.map(row => row.population),
          sampleSize
        );
        renderTable(els.regionTable, ["Region", "Population", "%", "Quota"], regionRows, ["Total", fmt(regionalTotal), "100.0%", sampleSize]);
        addExportRows("Regional Distribution", ["Region", "Population", "%", "Quota"], regionRows, ["Total", fmt(regionalTotal), "100.0%", sampleSize]);
        els.regionSection.hidden = false;
      } else {
        els.regionSection.hidden = true;
      }
    } else {
      els.regionSection.hidden = true;
    }

    if (sexes.length === 2) {
      const crossed = [];
      const labels = [];
      for (const sex of sexes) {
        for (const band of ageBands) {
          labels.push(`${sex === "M" ? "Male" : "Female"} ${band.label}`);
          crossed.push(aggregateNational(national, [sex], [band]));
        }
      }
      const crossRows = buildQuotaRows(labels, crossed, sampleSize);
      renderTable(els.crossTable, ["Cell", "Population", "%", "Quota"], crossRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);
      addExportRows("Sex x Age Interlocked Quotas", ["Cell", "Population", "%", "Quota"], crossRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);
      els.crossSection.hidden = false;
    } else {
      els.crossSection.hidden = true;
    }

    els.results.hidden = false;
    els.copy.disabled = false;
    els.download.disabled = false;
    els.status.textContent = `Built quotas for ${COUNTRY_NAMES[country]} from local statistics bureau data.`;
  } catch (error) {
    if (country === "LT" && /fetch|proxy/i.test(error.message)) {
      els.status.textContent = "Lithuania uses the local Official Statistics Portal SDMX source through the Baltic proxy. The proxy is not reachable yet or returned an error.";
    } else {
      els.status.textContent = error.message;
    }
  } finally {
    els.build.disabled = false;
  }
}

function exportText(separator) {
  return state.rowsForExport
    .map(row => row.map(value => String(value).replaceAll(separator, " ")).join(separator))
    .join("\n");
}

async function copyTsv() {
  await navigator.clipboard.writeText(exportText("\t"));
  els.status.textContent = "Copied quota tables as TSV.";
}

function downloadCsv() {
  const blob = new Blob([exportText(",")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${els.country.value.toLowerCase()}-${els.year.value}-quotas.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

els.build.addEventListener("click", buildQuotas);
els.copy.addEventListener("click", copyTsv);
els.download.addEventListener("click", downloadCsv);
