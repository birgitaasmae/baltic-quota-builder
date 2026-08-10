const API_BASE = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/";

const COUNTRY_NAMES = {
  LV: "Latvia",
  LT: "Lithuania"
};

const AGE_BANDS_5 = [
  "Y_LT5", "Y5-9", "Y10-14", "Y15-19", "Y20-24", "Y25-29", "Y30-34",
  "Y35-39", "Y40-44", "Y45-49", "Y50-54", "Y55-59", "Y60-64",
  "Y65-69", "Y70-74", "Y75-79", "Y80-84", "Y85-89", "Y_GE90"
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
  quickSample: document.querySelector("#quickSample"),
  standardSample: document.querySelector("#standardSample"),
  robustSample: document.querySelector("#robustSample"),
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

function buildApiUrl(dataset, params) {
  const parts = ["format=JSON", "lang=en"];
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(item)}`);
    } else {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  }
  return `${API_BASE}${dataset}?${parts.join("&")}`;
}

async function apiFetch(dataset, params) {
  const response = await fetch(buildApiUrl(dataset, params));
  if (!response.ok) throw new Error(`Eurostat returned ${response.status}`);
  return response.json();
}

function parseJsonStat(data) {
  const dims = data.id;
  const sizes = data.size;
  const values = data.value || [];
  const strides = new Array(dims.length);
  strides[dims.length - 1] = 1;
  for (let i = dims.length - 2; i >= 0; i--) strides[i] = strides[i + 1] * sizes[i + 1];

  const dimIndex = {};
  const dimLabels = {};
  for (const dim of dims) {
    const category = data.dimension[dim].category;
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
  return age === 0 ? "Y_LT1" : `Y${age}`;
}

function bandRange(code) {
  if (code === "Y_LT1") return [0, 0];
  if (code === "Y_LT5") return [0, 4];
  if (code === "Y_GE90") return [90, 99];
  const match = code.match(/^Y(\d+)-(\d+)$/);
  if (match) return [Number(match[1]), Number(match[2])];
  const single = code.match(/^Y(\d+)$/);
  return single ? [Number(single[1]), Number(single[1])] : null;
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

function getRegionalBands(minAge, maxAge) {
  return AGE_BANDS_5.map(code => {
    const [from, to] = bandRange(code);
    return { code, from, to, label: humanAgeBand(code) };
  }).filter(band => band.to >= minAge && band.from <= maxAge);
}

function humanAgeBand(code) {
  const range = bandRange(code);
  return range ? `${range[0]}-${range[1]}` : code.replace(/^Y/, "");
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

function sampleForMargin(population, margin) {
  const z = 1.96;
  const p = 0.5;
  const n0 = (z * z * p * (1 - p)) / (margin * margin);
  return Math.ceil(n0 / (1 + ((n0 - 1) / population)));
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

async function fetchNationalPopulation(country, year) {
  const ageCodes = [];
  for (let age = 0; age <= 99; age++) ageCodes.push(exactAgeCode(age));

  const data = await apiFetch("demo_pjan", {
    sex: ["M", "F"],
    age: ageCodes,
    geo: country,
    unit: "NR",
    time: year
  });
  const parsed = parseJsonStat(data);
  const result = new Map();

  for (const sex of ["M", "F"]) {
    for (let age = 0; age <= 99; age++) {
      const value = lookupValue(parsed, {
        freq: "A",
        unit: "NR",
        sex,
        age: exactAgeCode(age),
        geo: country,
        time: year
      });
      if (value > 0) result.set(`${sex}|${age}`, value);
    }
  }
  return result;
}

async function fetchRegionalPopulation(country, year, level) {
  if (level === 0) return { labels: {}, data: new Map() };
  const geoLength = 2 + level;
  const catalogData = await apiFetch("demo_r_pjangrp3", {
    sex: "T",
    age: "TOTAL",
    unit: "NR",
    time: year
  });
  const catalog = parseJsonStat(catalogData).dimLabels.geo || {};
  const geos = Object.keys(catalog).filter(code =>
    code.startsWith(country) && code.length === geoLength && !/\(NUTS\s/.test(catalog[code])
  );
  const labels = {};
  for (const geo of geos) labels[geo] = catalog[geo] || geo;

  if (!geos.length) return { labels, data: new Map() };

  const data = await apiFetch("demo_r_pjangrp3", {
    sex: ["M", "F"],
    age: AGE_BANDS_5,
    geo: geos,
    unit: "NR",
    time: year
  });
  const parsed = parseJsonStat(data);
  const result = new Map();
  for (const geo of geos) {
    for (const sex of ["M", "F"]) {
      for (const age of AGE_BANDS_5) {
        const value = lookupValue(parsed, { freq: "A", unit: "NR", sex, age, geo, time: year });
        if (value > 0) result.set(`${sex}|${age}|${geo}`, value);
      }
    }
  }

  return { labels, data: result };
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
      for (const [key, value] of map.entries()) {
        const [keySex, keyAge, keyGeo] = key.split("|");
        if (keySex !== sex) continue;
        if (geo && keyGeo !== geo) continue;
        const range = bandRange(keyAge);
        if (!range) continue;
        if (range[1] >= band.from && range[0] <= band.to) total += value;
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

function updateSampleSuggestions(population) {
  const quick = sampleForMargin(population, 0.05);
  const standard = Math.max(600, sampleForMargin(population, 0.04));
  const robust = Math.max(1000, sampleForMargin(population, 0.03));
  els.quickSample.textContent = fmt(quick);
  els.standardSample.textContent = fmt(standard);
  els.robustSample.textContent = fmt(robust);
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
    const national = await fetchNationalPopulation(country, year);
    state.latestPopulationData = national;
    const totalPopulation = aggregateNational(national, sexes, ageBands);
    if (!totalPopulation) throw new Error("No population data found for this selection.");

    updateSampleSuggestions(totalPopulation);
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
    els.ageMeta.textContent = `${COUNTRY_NAMES[country]}, ${year}. Ages ${minAge}-${maxAge}; ${grouping}-year display grouping.`;
    addExportRows("Age Distribution", ["Age Group", "Population", "%", "Quota"], ageRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);

    if (regionLevel > 0) {
      const regionalBands = getRegionalBands(minAge, maxAge);
      const regional = await fetchRegionalPopulation(country, year, regionLevel);
      state.latestRegionalData = regional.data;
      state.latestGeoLabels = regional.labels;
      const regionCodes = Object.keys(regional.labels);
      const regionPopulations = regionCodes.map(code => aggregateRegional(regional.data, sexes, regionalBands, code));
      const nonZero = regionCodes
        .map((code, index) => ({ code, population: regionPopulations[index] }))
        .filter(row => row.population > 0);
      if (nonZero.length) {
        const regionalTotal = nonZero.reduce((sum, row) => sum + row.population, 0);
        const regionRows = buildQuotaRows(
          nonZero.map(row => `${regional.labels[row.code]} (${row.code})`),
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
    els.status.textContent = `Built quotas for ${COUNTRY_NAMES[country]} from Eurostat population data.`;
  } catch (error) {
    els.status.textContent = error.message;
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
