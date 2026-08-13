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
const ESTONIA_NATIONALITY_TABLE_ID = "RV022U";
const ESTONIA_EDUCATION_TABLE_ID = "RV0231U";
const LATVIA_TABLE_ID = "IRD041";
const LATVIA_NATIONALITY_TABLE_ID = "IRE010";
const LATVIA_NATIONALITY_AGE_TABLE_ID = "IRE040";
const LATVIA_EDUCATION_TABLE_ID = "IZT010";
const LITHUANIA_FLOW_ID = "S3R167_M3010202";
const LITHUANIA_POPULATION_SOURCE_TITLE = "Resident population by sex and age at the beginning of the year";
const LITHUANIA_NATIONALITY_SOURCE_TITLE = "Resident population by ethnicity at the beginning of the year";
const LITHUANIA_EDUCATION_SOURCE_TITLE = "Population aged 15 and older by educational attainment";
const LITHUANIA_SETTLEMENT_URBAN_RURAL_SOURCE_TITLE = "Resident population by urban and rural residence at the beginning of the year";
const LITHUANIA_SETTLEMENT_CITY_SOURCE_TITLE = "Resident population in cities and towns at the beginning of the year";

const ESTONIA_REGION_CODES = [
  "784", "37_NO_TALLINN", "39", "44", "49", "51", "57", "59", "65", "67", "70", "74", "78", "82", "84", "86"
];

const ESTONIA_REGION_QUERY_CODES = [
  "37", "784", "39", "44", "49", "51", "57", "59", "65", "67", "70", "74", "78", "82", "84", "86"
];

const ESTONIA_SETTLEMENT_CODES = ["784", "795", "625", "511", "322", "H2", "H3", "H4"];
const ESTONIA_BIG_CITY_CODES = ["795", "625", "511", "322"];

const ESTONIA_REGION_LABELS = {
  784: "Tallinn",
  "37_NO_TALLINN": "Harju maakond (without Tallinn)",
  39: "Hiiu maakond",
  44: "Ida-Viru maakond",
  49: "J\u00f5geva maakond",
  51: "J\u00e4rva maakond",
  57: "L\u00e4\u00e4ne maakond",
  59: "L\u00e4\u00e4ne-Viru maakond",
  65: "P\u00f5lva maakond",
  67: "P\u00e4rnu maakond",
  70: "Rapla maakond",
  74: "Saare maakond",
  78: "Tartu maakond",
  82: "Valga maakond",
  84: "Viljandi maakond",
  86: "V\u00f5ru maakond"
};

const LATVIA_REGION_CODES = [
  "LV00A", "LV00C", "LV00B", "LV009", "LV005"
];

const LATVIA_SETTLEMENT_TABLE_ID = "IRD081";
const LATVIA_CAPITAL_CODE = "LV0001000";
const LATVIA_STATE_CITY_CODES = [
  "LV0002000", "LV0003000", "LV0031010", "LV0004000", "LV0005000", "LV0040010", "LV0006000", "LV0054010", "LV0007000"
];

const LATVIA_REGION_LABELS = {
  LV00A: "Riga statistical region",
  LV00C: "Vidzeme statistical region",
  LV00B: "Kurzeme statistical region",
  LV009: "Zemgale statistical region",
  LV005: "Latgale statistical region"
};

const LITHUANIA_REGION_CODES = [
  "10", "02", "03", "06", "05", "01", "04", "09", "08", "07"
];

const state = {
  rowsForExport: [],
  latestPopulationData: null,
  latestRegionalData: null,
  latestGeoLabels: {},
  latviaSettlementCodes: null
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
  settlementLevel: document.querySelector("#settlementLevelSelect"),
  educationLevel: document.querySelector("#educationLevelSelect"),
  build: document.querySelector("#buildButton"),
  status: document.querySelector("#statusText"),
  summary: document.querySelector("#summaryPanel"),
  populationBase: document.querySelector("#populationBase"),
  selectedSample: document.querySelector("#selectedSample"),
  estimatedMargin: document.querySelector("#estimatedMargin"),
  results: document.querySelector("#results"),
  sexTable: document.querySelector("#sexTable"),
  sexMeta: document.querySelector("#sexMeta"),
  ageTable: document.querySelector("#ageTable"),
  ageMeta: document.querySelector("#ageMeta"),
  regionSection: document.querySelector("#regionSection"),
  regionTable: document.querySelector("#regionTable"),
  regionMeta: document.querySelector("#regionMeta"),
  settlementSection: document.querySelector("#settlementSection"),
  settlementTable: document.querySelector("#settlementTable"),
  settlementMeta: document.querySelector("#settlementMeta"),
  nationalitySection: document.querySelector("#nationalitySection"),
  nationalityTable: document.querySelector("#nationalityTable"),
  nationalityMeta: document.querySelector("#nationalityMeta"),
  educationSection: document.querySelector("#educationSection"),
  educationTable: document.querySelector("#educationTable"),
  educationMeta: document.querySelector("#educationMeta"),
  crossSection: document.querySelector("#crossSection"),
  crossTable: document.querySelector("#crossTable"),
  crossMeta: document.querySelector("#crossMeta"),
  copy: document.querySelector("#copyButton"),
  download: document.querySelector("#downloadButton"),
  excel: document.querySelector("#excelButton")
};

function ethnicityRows(nativeLabel, russianLabel, otherLabel, nativePopulation, russianPopulation, totalPopulation) {
  const native = Number(nativePopulation) || 0;
  const russian = Number(russianPopulation) || 0;
  const total = Number(totalPopulation) || native + russian;
  return [
    { label: nativeLabel, population: native },
    { label: russianLabel, population: russian },
    { label: otherLabel, population: Math.max(0, total - native - russian) }
  ];
}

function educationRows(basicPopulation, secondaryPopulation, higherPopulation, otherPopulation = 0) {
  const rows = [
    { label: "Basic or lower", population: Number(basicPopulation) || 0 },
    { label: "Secondary", population: Number(secondaryPopulation) || 0 },
    { label: "Higher", population: Number(higherPopulation) || 0 }
  ];
  const other = Number(otherPopulation) || 0;
  if (other > 0) rows.push({ label: "Other or unknown", population: other });
  return rows;
}

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

async function fetchLatviaMetadata(tableId) {
  const response = await fetch(`${LATVIA_API_BASE}/tables/${tableId}/metadata?lang=en`);
  if (!response.ok) throw new Error(`Latvia CSB metadata returned ${response.status}`);
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
  let start = minAge;
  if (minAge < 25) {
    const end = Math.min(24, maxAge);
    const members = ages.filter(age => age.from >= start && age.to <= end);
    bands.push({
      code: `Y${start}-${end}`,
      from: start,
      to: end,
      label: start === end ? String(start) : `${start}-${end}`,
      members
    });
    start = 25;
  }

  for (; start <= maxAge; start += grouping) {
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

function getLithuaniaAgeBands(minAge, maxAge, grouping) {
  const exactMaxAge = Math.min(maxAge, 84);
  const exactBands = minAge <= exactMaxAge ? getAgeBands(minAge, exactMaxAge, grouping) : [];
  if (maxAge < 85) return exactBands;
  return [
    ...exactBands,
    { code: "Y_GE85", from: 85, to: 99, label: "85+", key: "85+" }
  ];
}

function getLatviaSettlementAgeGroups(minAge, maxAge) {
  const groups = [
    { code: "Y0-4", from: 0, to: 4 },
    { code: "Y5-9", from: 5, to: 9 },
    { code: "Y10-14", from: 10, to: 14 },
    { code: "Y15-19", from: 15, to: 19 },
    { code: "Y20-24", from: 20, to: 24 },
    { code: "Y25-29", from: 25, to: 29 },
    { code: "Y30-34", from: 30, to: 34 },
    { code: "Y35-39", from: 35, to: 39 },
    { code: "Y40-44", from: 40, to: 44 },
    { code: "Y45-49", from: 45, to: 49 },
    { code: "Y50-54", from: 50, to: 54 },
    { code: "Y55-59", from: 55, to: 59 },
    { code: "Y60-64", from: 60, to: 64 },
    { code: "Y65-69", from: 65, to: 69 },
    { code: "Y70-74", from: 70, to: 74 },
    { code: "Y75-79", from: 75, to: 79 },
    { code: "Y80-84", from: 80, to: 84 },
    { code: "Y_GE85", from: 85, to: 99 }
  ];
  return groups.filter(group => group.to >= minAge && group.from <= maxAge);
}

function getEstoniaNationalityAgeGroups(minAge, maxAge) {
  const groups = [
    { code: "2", from: 0, to: 4 },
    { code: "3", from: 5, to: 9 },
    { code: "4", from: 10, to: 14 },
    { code: "5", from: 15, to: 19 },
    { code: "6", from: 20, to: 24 },
    { code: "7", from: 25, to: 29 },
    { code: "8", from: 30, to: 34 },
    { code: "9", from: 35, to: 39 },
    { code: "10", from: 40, to: 44 },
    { code: "11", from: 45, to: 49 },
    { code: "12", from: 50, to: 54 },
    { code: "13", from: 55, to: 59 },
    { code: "14", from: 60, to: 64 },
    { code: "15", from: 65, to: 69 },
    { code: "16", from: 70, to: 74 },
    { code: "17", from: 75, to: 79 },
    { code: "18", from: 80, to: 84 },
    { code: "23", from: 85, to: 99 }
  ];
  return groups.filter(group => group.to >= minAge && group.from <= maxAge);
}

function getEstoniaEducationAgeGroups(minAge, maxAge) {
  const groups = [
    { code: "2", from: 15, to: 19 },
    { code: "3", from: 20, to: 24 },
    { code: "4", from: 25, to: 29 },
    { code: "5", from: 30, to: 34 },
    { code: "6", from: 35, to: 39 },
    { code: "7", from: 40, to: 44 },
    { code: "8", from: 45, to: 49 },
    { code: "9", from: 50, to: 54 },
    { code: "10", from: 55, to: 59 },
    { code: "11", from: 60, to: 64 },
    { code: "12", from: 65, to: 69 },
    { code: "13", from: 70, to: 74 },
    { code: "14", from: 75, to: 79 },
    { code: "15", from: 80, to: 84 },
    { code: "16", from: 85, to: 99 }
  ];
  return groups.filter(group => group.to >= minAge && group.from <= maxAge);
}

function describeAgeGroupCoverage(groups) {
  if (!groups.length) return "no age groups";
  const from = groups[0].from;
  const to = groups[groups.length - 1].to;
  return `${from}-${to === 99 ? "85+" : to}`;
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
  const areaCodes = ["00", ...ESTONIA_REGION_QUERY_CODES];

  const data = await pxWebPostSelection(ESTONIA_API_BASE, ESTONIA_TABLE_ID, [
    { code: "Sugu", selection: { filter: "item", values: ["2", "3"] } },
    { code: "Elukoht", selection: { filter: "item", values: areaCodes } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Vanus", selection: { filter: "item", values: ageCodes } }
  ]);
  const parsed = parseJsonStat(data);
  const national = new Map();
  const rawRegional = new Map();
  const regional = new Map();
  const labels = { ...(parsed.dimLabels.Elukoht || {}), ...ESTONIA_REGION_LABELS };
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
          else rawRegional.set(`${sex}|${age}|${area}`, value);
        }
      }
    }
  }
  for (const area of ESTONIA_REGION_CODES) {
    for (const sex of ["M", "F"]) {
      for (let age = minAge; age <= maxAge; age++) {
        const key = `${sex}|${age}`;
        const value = area === "37_NO_TALLINN"
          ? Math.max(0, (rawRegional.get(`${key}|37`) || 0) - (rawRegional.get(`${key}|784`) || 0))
          : rawRegional.get(`${key}|${area}`) || 0;
        if (value > 0) regional.set(`${key}|${area}`, value);
      }
    }
  }
  return {
    national,
    regional,
    labels,
    regionOrder: ESTONIA_REGION_CODES,
    nationalRegionCode: "00",
    sourceNote: "Statistics Estonia table RV0240"
  };
}

async function fetchEstoniaNationality(year, minAge, maxAge, sexes) {
  const ageGroupCode = "Vanuser\u00fchm";
  const ageGroups = getEstoniaNationalityAgeGroups(minAge, maxAge);
  if (!ageGroups.length) throw new Error("No Estonia nationality age groups found for this selection.");
  const sexCodes = sexes.length === 2 ? ["1"] : sexes.map(sex => sex === "M" ? "2" : "3");
  const data = await pxWebPostSelection(ESTONIA_API_BASE, ESTONIA_NATIONALITY_TABLE_ID, [
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: ageGroupCode, selection: { filter: "item", values: ageGroups.map(group => group.code) } },
    { code: "Maakond", selection: { filter: "item", values: ["1"] } },
    { code: "Sugu", selection: { filter: "item", values: sexCodes } },
    { code: "Rahvus", selection: { filter: "item", values: ["1", "2", "3"] } }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = code => {
    let total = 0;
    for (const ageGroup of ageGroups) {
      for (const sexCode of sexCodes) {
        total += lookupValue(parsed, {
          Aasta: year,
          [ageGroupCode]: ageGroup.code,
          Maakond: "1",
          Sugu: sexCode,
          Rahvus: code
        }) || 0;
      }
    }
    return total;
  };
  return {
    rows: ethnicityRows("Estonian", "Russian", "Other", valueFor("2"), valueFor("3"), valueFor("1")),
    sourceNote: `Statistics Estonia table RV022U. Official age groups covering ages ${describeAgeGroupCoverage(ageGroups)}.`
  };
}

async function fetchEstoniaSettlement(year, minAge, maxAge, sexes) {
  const ageCodes = [];
  for (let age = minAge; age <= maxAge; age++) ageCodes.push(String(age));
  const sexCodes = sexes.length === 2 ? ["1"] : sexes.map(sex => sex === "M" ? "2" : "3");
  const data = await pxWebPostSelection(ESTONIA_API_BASE, ESTONIA_TABLE_ID, [
    { code: "Sugu", selection: { filter: "item", values: sexCodes } },
    { code: "Elukoht", selection: { filter: "item", values: ESTONIA_SETTLEMENT_CODES } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Vanus", selection: { filter: "item", values: ageCodes } }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = code => {
    let total = 0;
    for (const sexCode of sexCodes) {
      for (const ageCode of ageCodes) {
        total += lookupValue(parsed, {
          Sugu: sexCode,
          Elukoht: code,
          Aasta: year,
          Vanus: ageCode
        }) || 0;
      }
    }
    return total;
  };
  const sumCodes = codes => codes.reduce((sum, code) => sum + valueFor(code), 0);
  return {
    rows: [
      { label: "Capital (Tallinn)", population: valueFor("784") },
      { label: "Big cities (Tartu, P\u00e4rnu, Narva, Kohtla-J\u00e4rve)", population: sumCodes(ESTONIA_BIG_CITY_CODES) },
      { label: "Other cities", population: Math.max(0, valueFor("H2") + valueFor("H3") - valueFor("784") - sumCodes(ESTONIA_BIG_CITY_CODES)) },
      { label: "Rural area", population: valueFor("H4") }
    ],
    sourceNote: `Statistics Estonia table RV0240. Exact ages ${minAge}-${maxAge}; same settlement formula as the Estonian quota builder: capital, big cities, other cities, rural.`
  };
}

async function fetchEstoniaEducation(year, minAge, maxAge, sexes) {
  const ageGroupCode = "Vanuser\u00fchm";
  const ageGroups = getEstoniaEducationAgeGroups(minAge, maxAge);
  if (!ageGroups.length) throw new Error("No Estonia education age groups found for this selection.");
  const sexCodes = sexes.length === 2 ? ["1"] : sexes.map(sex => sex === "M" ? "2" : "3");
  const data = await pxWebPostSelection(ESTONIA_API_BASE, ESTONIA_EDUCATION_TABLE_ID, [
    { code: "Maakond", selection: { filter: "item", values: ["1"] } },
    { code: "Haridustase", selection: { filter: "item", values: ["2", "7", "11", "16"] } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Sugu", selection: { filter: "item", values: sexCodes } },
    { code: ageGroupCode, selection: { filter: "item", values: ageGroups.map(group => group.code) } }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = code => {
    let total = 0;
    for (const sexCode of sexCodes) {
      for (const ageGroup of ageGroups) {
        total += lookupValue(parsed, {
          Maakond: "1",
          Haridustase: code,
          Aasta: year,
          Sugu: sexCode,
          [ageGroupCode]: ageGroup.code
        }) || 0;
      }
    }
    return total;
  };
  return {
    rows: educationRows(valueFor("2"), valueFor("7"), valueFor("11"), valueFor("16")),
    sourceNote: `Statistics Estonia table RV0231U. Official age groups covering ages ${describeAgeGroupCoverage(ageGroups)}.`
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
  const labels = { ...(parsed.dimLabels.AREA || {}), ...LATVIA_REGION_LABELS };

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
    regionOrder: LATVIA_REGION_CODES,
    nationalRegionCode: "LV",
    sourceNote: "Central Statistics Bureau of Latvia table IRD041"
  };
}

async function fetchLatviaNationality(year, minAge, maxAge) {
  const ageGroups = getLatviaSettlementAgeGroups(minAge, maxAge);
  if (!ageGroups.length) throw new Error("No Latvia nationality age groups found for this selection.");
  const data = await latviaPostSelection(LATVIA_NATIONALITY_AGE_TABLE_ID, [
    { variableCode: "ETHNICITY", valueCodes: ["TOTAL", "E_LAT", "E_RUS"] },
    { variableCode: "AgeGroup", valueCodes: ageGroups.map(group => group.code) },
    { variableCode: "ContentsCode", valueCodes: [LATVIA_NATIONALITY_AGE_TABLE_ID] },
    { variableCode: "TIME", valueCodes: [year] }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = code => ageGroups.reduce((sum, ageGroup) => sum + (lookupValue(parsed, {
    ETHNICITY: code,
    AgeGroup: ageGroup.code,
    ContentsCode: LATVIA_NATIONALITY_AGE_TABLE_ID,
    TIME: year
  }) || 0), 0);
  return {
    rows: ethnicityRows("Latvian", "Russian", "Other", valueFor("E_LAT"), valueFor("E_RUS"), valueFor("TOTAL")),
    sourceNote: `Central Statistics Bureau of Latvia table IRE040. Official age groups covering ages ${describeAgeGroupCoverage(ageGroups)}.`
  };
}

async function getLatviaSettlementCodes() {
  if (state.latviaSettlementCodes) return state.latviaSettlementCodes;
  const metadata = await fetchLatviaMetadata(LATVIA_SETTLEMENT_TABLE_ID);
  const labels = metadata.dimension.AREA.category.label || {};
  const municipalityTownCodes = Object.entries(labels)
    .filter(([code, label]) => (
      /^LV\d/.test(code) &&
      label.startsWith("..") &&
      !label.startsWith("...") &&
      !label.includes("(") &&
      !/rural territory|neighbourhood|unknown/i.test(label) &&
      code !== LATVIA_CAPITAL_CODE &&
      !LATVIA_STATE_CITY_CODES.includes(code)
    ))
    .map(([code]) => code);
  const ruralCodes = Object.entries(labels)
    .filter(([, label]) => /rural territory$/i.test(label))
    .map(([code]) => code);
  state.latviaSettlementCodes = { municipalityTownCodes, ruralCodes };
  return state.latviaSettlementCodes;
}

async function fetchLatviaSettlement(year, minAge, maxAge, sexes) {
  const { municipalityTownCodes, ruralCodes } = await getLatviaSettlementCodes();
  const ageGroups = getLatviaSettlementAgeGroups(minAge, maxAge);
  if (!ageGroups.length) throw new Error("No Latvia settlement age groups found for this selection.");
  const ageGroupCodes = ageGroups.map(group => group.code);
  const sexCodes = sexes.length === 2 ? ["T"] : sexes;
  const areaCodes = [LATVIA_CAPITAL_CODE, ...LATVIA_STATE_CITY_CODES, ...municipalityTownCodes, ...ruralCodes];
  const data = await latviaPostSelection(LATVIA_SETTLEMENT_TABLE_ID, [
    { variableCode: "SEX", valueCodes: sexCodes },
    { variableCode: "AgeGroup", valueCodes: ageGroupCodes },
    { variableCode: "AREA", valueCodes: areaCodes },
    { variableCode: "ContentsCode", valueCodes: [LATVIA_SETTLEMENT_TABLE_ID] },
    { variableCode: "TIME", valueCodes: [year] }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = code => {
    let total = 0;
    for (const sexCode of sexCodes) {
      for (const ageGroupCode of ageGroupCodes) {
        total += lookupValue(parsed, {
          SEX: sexCode,
          AgeGroup: ageGroupCode,
          AREA: code,
          ContentsCode: LATVIA_SETTLEMENT_TABLE_ID,
          TIME: year
        }) || 0;
      }
    }
    return total;
  };
  const sumCodes = codes => codes.reduce((sum, code) => sum + valueFor(code), 0);
  return {
    rows: [
      { label: "Capital (Riga)", population: valueFor(LATVIA_CAPITAL_CODE) },
      { label: "Big cities (state cities outside Riga)", population: sumCodes(LATVIA_STATE_CITY_CODES) },
      { label: "Other cities", population: sumCodes(municipalityTownCodes) },
      { label: "Rural area", population: sumCodes(ruralCodes) }
    ],
    sourceNote: `Central Statistics Bureau of Latvia table IRD081. Official age groups covering ages ${describeAgeGroupCoverage(ageGroups)}.`
  };
}

async function fetchLatviaEducation(year, minAge, maxAge, sexes) {
  const ageGroups = getLatviaSettlementAgeGroups(Math.max(15, minAge), maxAge);
  if (!ageGroups.length) throw new Error("No Latvia education age groups found for this selection.");
  const sexCodes = sexes.length === 2 ? ["T"] : sexes;
  const data = await latviaPostSelection(LATVIA_EDUCATION_TABLE_ID, [
    { variableCode: "EDUCATION_LEVEL", valueCodes: ["TOTAL", "ED0", "ED1", "ED2", "ED3", "ED4", "ED5", "ED6", "ED7", "ED8"] },
    { variableCode: "AgeGroup", valueCodes: ageGroups.map(group => group.code) },
    { variableCode: "SEX", valueCodes: sexCodes },
    { variableCode: "ContentsCode", valueCodes: [LATVIA_EDUCATION_TABLE_ID] },
    { variableCode: "TIME", valueCodes: [year] }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = code => {
    let total = 0;
    for (const sexCode of sexCodes) {
      for (const ageGroup of ageGroups) {
        total += lookupValue(parsed, {
          EDUCATION_LEVEL: code,
          AgeGroup: ageGroup.code,
          SEX: sexCode,
          ContentsCode: LATVIA_EDUCATION_TABLE_ID,
          TIME: year
        }) || 0;
      }
    }
    return total;
  };
  const basic = ["ED0", "ED1", "ED2"].reduce((sum, code) => sum + (valueFor(code) || 0), 0);
  const secondary = ["ED3", "ED4"].reduce((sum, code) => sum + (valueFor(code) || 0), 0);
  const higher = ["ED5", "ED6", "ED7", "ED8"].reduce((sum, code) => sum + (valueFor(code) || 0), 0);
  return {
    rows: educationRows(basic, secondary, higher),
    sourceNote: `Central Statistics Bureau of Latvia table IZT010. Official age groups covering ages ${describeAgeGroupCoverage(ageGroups)}.`
  };
}

async function fetchLithuaniaPopulation(year, minAge, maxAge, grouping) {
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${encodeURIComponent(year)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Lithuania proxy returned ${response.status}`);
  }
  const data = await response.json();
  const national = new Map();
  const regional = new Map();
  const labels = {};

  for (const row of data.rows) {
    const ageKey = row.ageFrom === 85 && row.ageTo === 99 ? "85+" : String(row.ageFrom);
    if (row.regionCode === "00") {
      national.set(`${row.sex}|${ageKey}`, (national.get(`${row.sex}|${ageKey}`) || 0) + row.population);
    } else if (row.regionCode) {
      regional.set(`${row.sex}|${ageKey}|${row.regionCode}`, (regional.get(`${row.sex}|${ageKey}|${row.regionCode}`) || 0) + row.population);
      labels[row.regionCode] = row.regionLabel || row.regionCode;
    }
  }

  return {
    national,
    regional,
    labels,
    regionOrder: LITHUANIA_REGION_CODES,
    nationalRegionCode: "00",
    ageBands: getLithuaniaAgeBands(minAge, maxAge, grouping),
    sourceNote: `${data.populationSourceNote || `State Data Agency of Lithuania / Official Statistics Portal: ${LITHUANIA_POPULATION_SOURCE_TITLE}, SDMX flow S3R167_M3010202.`}${maxAge >= 85 ? " Official age groups covering ages 85+." : ""}`
  };
}

async function fetchLithuaniaNationality(year) {
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${encodeURIComponent(year)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Lithuania proxy returned ${response.status}`);
  }
  const data = await response.json();
  if (!data.nationalityRows?.length) throw new Error("No Lithuania nationality rows found for this year.");
  return {
    rows: data.nationalityRows,
    sourceNote: data.nationalitySourceNote || `State Data Agency of Lithuania / Official Statistics Portal: ${LITHUANIA_NATIONALITY_SOURCE_TITLE}, SDMX flow S3R167_M3010215_1. Whole-country ethnicity distribution.`
  };
}

async function fetchLithuaniaEducation(year) {
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${encodeURIComponent(year)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Lithuania proxy returned ${response.status}`);
  }
  const data = await response.json();
  if (!data.educationRows?.length) throw new Error("No Lithuania education rows found for this year.");
  return {
    rows: data.educationRows,
    sourceNote: data.educationSourceNote || `State Data Agency of Lithuania / Official Statistics Portal: ${LITHUANIA_EDUCATION_SOURCE_TITLE}. Whole-country education distribution.`
  };
}

async function fetchLithuaniaSettlement(year, minAge, maxAge) {
  const params = new URLSearchParams({
    year: String(year),
    minAge: String(minAge),
    maxAge: String(maxAge)
  });
  const response = await fetch(`${LITHUANIA_PROXY_URL}?${params.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Lithuania proxy returned ${response.status}`);
  }
  const data = await response.json();
  if (!data.settlementRows?.length) throw new Error("No Lithuania settlement rows found for this year.");
  return {
    rows: data.settlementRows,
    sourceNote: data.settlementSourceNote || `State Data Agency of Lithuania / Official Statistics Portal: ${LITHUANIA_SETTLEMENT_URBAN_RURAL_SOURCE_TITLE}; ${LITHUANIA_SETTLEMENT_CITY_SOURCE_TITLE}.`
  };
}

async function fetchPopulation(country, year, minAge, maxAge, grouping) {
  if (country === "EE") return fetchEstoniaPopulation(year, minAge, maxAge);
  if (country === "LV") return fetchLatviaPopulation(year, minAge, maxAge);
  return fetchLithuaniaPopulation(year, minAge, maxAge, grouping);
}

async function fetchNationality(country, year, minAge, maxAge, sexes) {
  if (country === "EE") return fetchEstoniaNationality(year, minAge, maxAge, sexes);
  if (country === "LV") return fetchLatviaNationality(year, minAge, maxAge);
  return fetchLithuaniaNationality(year);
}

async function fetchEducation(country, year, minAge, maxAge, sexes) {
  if (country === "EE") return fetchEstoniaEducation(year, minAge, maxAge, sexes);
  if (country === "LV") return fetchLatviaEducation(year, minAge, maxAge, sexes);
  return fetchLithuaniaEducation(year);
}

async function fetchSettlement(country, year, minAge, maxAge, sexes) {
  if (country === "EE") return fetchEstoniaSettlement(year, minAge, maxAge, sexes);
  if (country === "LV") return fetchLatviaSettlement(year, minAge, maxAge, sexes);
  return fetchLithuaniaSettlement(year, minAge, maxAge);
}

function aggregateNational(map, sexes, bands) {
  let total = 0;
  for (const sex of sexes) {
    for (const band of bands) {
      const members = band.members || [band];
      for (const member of members) {
        if (member.key) {
          total += map.get(`${sex}|${member.key}`) || 0;
        } else {
          for (let age = member.from; age <= member.to; age++) {
            total += map.get(`${sex}|${age}`) || 0;
          }
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
        if (member.key) {
          total += map.get(`${sex}|${member.key}|${geo}`) || 0;
        } else {
          for (let age = member.from; age <= member.to; age++) {
            total += map.get(`${sex}|${age}|${geo}`) || 0;
          }
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

function renderNotice(target, message) {
  target.innerHTML = `<p>${message}</p>`;
}

function ageCoverageMatchesSelection(coverage, minAge, maxAge) {
  if (/^\d+\+$/.test(coverage)) return false;

  const rangeMatch = coverage.match(/^(\d+)-(\d+)$/);
  if (!rangeMatch) return false;
  return Number(rangeMatch[1]) === minAge && Number(rangeMatch[2]) === maxAge;
}

function formatMetaHtml(text, minAge, maxAge) {
  let html = escapeHtml(text);
  html = html.replace(/Official age groups covering ages ([^.;]+)/g, (match, coverage) => {
    if (ageCoverageMatchesSelection(coverage, minAge, maxAge)) return match;
    return `<strong>${match}</strong>`;
  });
  html = html.replace(/Whole-country population aged 15\+/g, "<strong>Whole-country population aged 15+</strong>");
  html = html.replace(/Whole-country ethnicity distribution/g, "<strong>Whole-country ethnicity distribution</strong>");
  return html;
}

function setMeta(target, text, minAge, maxAge) {
  target.innerHTML = formatMetaHtml(text, minAge, maxAge);
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

function formatRegionLabel(country, labels, code) {
  const label = labels[code] || code;
  if (country === "EE" || country === "LT") return label;
  return `${label} (${code})`;
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
  const settlementLevel = Number(els.settlementLevel.value);
  const educationLevel = Number(els.educationLevel.value);
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
    let ageBands = getAgeBands(minAge, maxAge, grouping);
    const population = await fetchPopulation(country, year, minAge, maxAge, grouping);
    ageBands = population.ageBands || ageBands;
    const [nationalityResult, educationResult, settlementResult] = await Promise.allSettled([
      fetchNationality(country, year, minAge, maxAge, sexes),
      educationLevel > 0 ? fetchEducation(country, year, minAge, maxAge, sexes) : Promise.resolve(null),
      settlementLevel > 0 ? fetchSettlement(country, year, minAge, maxAge, sexes) : Promise.resolve(null)
    ]);
    const nationality = nationalityResult.status === "fulfilled" ? nationalityResult.value : null;
    const education = educationResult.status === "fulfilled" ? educationResult.value : null;
    const settlement = settlementResult.status === "fulfilled" ? settlementResult.value : null;
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
    setMeta(els.sexMeta, `${COUNTRY_NAMES[country]}, ${year}. Source: ${population.sourceNote}; selected ages ${minAge}-${maxAge}.`, minAge, maxAge);
    addExportRows("Sex Distribution", ["Sex", "Population", "%", "Quota"], sexRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);

    const ageLabels = ageBands.map(band => band.label);
    const agePopulations = ageBands.map(band => aggregateNational(national, sexes, [band]));
    const ageRows = buildQuotaRows(ageLabels, agePopulations, sampleSize);
    renderTable(els.ageTable, ["Age Group", "Population", "%", "Quota"], ageRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);
    setMeta(els.ageMeta, `${COUNTRY_NAMES[country]}, ${year}. Ages ${minAge}-${maxAge}; ${grouping}-year display grouping. Source: ${population.sourceNote}.`, minAge, maxAge);
    addExportRows("Age Distribution", ["Age Group", "Population", "%", "Quota"], ageRows, ["Total", fmt(totalPopulation), "100.0%", sampleSize]);

    if (regionLevel > 0 && population.regional.size) {
      const regionCodes = (population.regionOrder || Object.keys(population.labels))
        .filter(code => code !== population.nationalRegionCode);
      const regionPopulations = regionCodes.map(code => aggregateRegional(population.regional, sexes, ageBands, code));
      const nonZero = regionCodes
        .map((code, index) => ({ code, population: regionPopulations[index] }))
        .filter(row => row.population > 0);
      if (nonZero.length) {
        const regionalTotal = nonZero.reduce((sum, row) => sum + row.population, 0);
        const regionRows = buildQuotaRows(
          nonZero.map(row => formatRegionLabel(country, population.labels, row.code)),
          nonZero.map(row => row.population),
          sampleSize
        );
        renderTable(els.regionTable, ["Region", "Population", "%", "Quota"], regionRows, ["Total", fmt(regionalTotal), "100.0%", sampleSize]);
        setMeta(els.regionMeta, `${COUNTRY_NAMES[country]}, ${year}. Source: ${population.sourceNote}; selected ages ${minAge}-${maxAge}.`, minAge, maxAge);
        addExportRows("Regional Distribution", ["Region", "Population", "%", "Quota"], regionRows, ["Total", fmt(regionalTotal), "100.0%", sampleSize]);
        els.regionSection.hidden = false;
      } else {
        els.regionSection.hidden = true;
      }
    } else {
      els.regionSection.hidden = true;
    }

    if (settlementLevel <= 0) {
      els.settlementSection.hidden = true;
    } else if (settlement?.rows?.length) {
      const visibleSettlementRows = settlement.rows.filter(row => row.population > 0);
      const settlementRowsForTable = buildQuotaRows(
        visibleSettlementRows.map(row => row.label),
        visibleSettlementRows.map(row => row.population),
        sampleSize
      );
      const settlementTotal = visibleSettlementRows.reduce((sum, row) => sum + row.population, 0);
      renderTable(els.settlementTable, ["Type of Settlement", "Population", "%", "Quota"], settlementRowsForTable, ["Total", fmt(settlementTotal), "100.0%", sampleSize]);
      setMeta(els.settlementMeta, `${COUNTRY_NAMES[country]}, ${year}. Source: ${settlement.sourceNote}`, minAge, maxAge);
      addExportRows("Type of Settlement Distribution", ["Type of Settlement", "Population", "%", "Quota"], settlementRowsForTable, ["Total", fmt(settlementTotal), "100.0%", sampleSize]);
      els.settlementSection.hidden = false;
    } else {
      renderNotice(els.settlementTable, "Type of settlement data is not available from the local statistics source for this selection right now.");
      els.settlementMeta.textContent = `${COUNTRY_NAMES[country]}, ${year}. Region quotas are still shown separately above.`;
      els.settlementSection.hidden = false;
    }

    if (nationality?.rows?.length) {
      const nationalityRows = buildQuotaRows(
        nationality.rows.map(row => row.label),
        nationality.rows.map(row => row.population),
        sampleSize
      );
      const nationalityTotal = nationality.rows.reduce((sum, row) => sum + row.population, 0);
      renderTable(els.nationalityTable, ["Nationality", "Population", "%", "Quota"], nationalityRows, ["Total", fmt(nationalityTotal), "100.0%", sampleSize]);
      setMeta(els.nationalityMeta, `${COUNTRY_NAMES[country]}, ${year}. Source: ${nationality.sourceNote}`, minAge, maxAge);
      addExportRows("Nationality Distribution", ["Nationality", "Population", "%", "Quota"], nationalityRows, ["Total", fmt(nationalityTotal), "100.0%", sampleSize]);
      els.nationalitySection.hidden = false;
    } else {
      els.nationalitySection.hidden = true;
    }

    if (educationLevel <= 0) {
      els.educationSection.hidden = true;
    } else if (education?.rows?.length) {
      const educationRowsForTable = buildQuotaRows(
        education.rows.map(row => row.label),
        education.rows.map(row => row.population),
        sampleSize
      );
      const educationTotal = education.rows.reduce((sum, row) => sum + row.population, 0);
      renderTable(els.educationTable, ["Education", "Population", "%", "Quota"], educationRowsForTable, ["Total", fmt(educationTotal), "100.0%", sampleSize]);
      setMeta(els.educationMeta, `${COUNTRY_NAMES[country]}, ${year}. Source: ${education.sourceNote}`, minAge, maxAge);
      addExportRows("Education Distribution", ["Education", "Population", "%", "Quota"], educationRowsForTable, ["Total", fmt(educationTotal), "100.0%", sampleSize]);
      els.educationSection.hidden = false;
    } else {
      renderNotice(els.educationTable, "Education data is not available from the local statistics source for this selection right now.");
      els.educationMeta.textContent = `${COUNTRY_NAMES[country]}, ${year}. Other quota tables are still shown.`;
      els.educationSection.hidden = false;
    }

    if (sexes.length === 2) {
      const crossPopulations = ageBands.flatMap(band => sexes.map(sex => aggregateNational(national, [sex], [band])));
      const crossQuotas = largestRemainder(crossPopulations.map(value => value / totalPopulation), sampleSize);
      const crossRows = ageBands.map((band, bandIndex) => {
        const cells = [band.label];
        sexes.forEach((sex, sexIndex) => {
          const index = bandIndex * sexes.length + sexIndex;
          const population = crossPopulations[index];
          cells.push(fmt(population), pct(population / totalPopulation), crossQuotas[index]);
        });
        return cells;
      });
      const crossHeaders = ["Age Group", ...sexes.flatMap(sex => {
        const label = sex === "M" ? "Male" : "Female";
        return [`${label} Population`, `${label} %`, `${label} Quota`];
      })];
      const crossFooter = ["Total"];
      sexes.forEach((sex, sexIndex) => {
        const population = ageBands.reduce((sum, _band, bandIndex) => sum + crossPopulations[bandIndex * sexes.length + sexIndex], 0);
        const quota = ageBands.reduce((sum, _band, bandIndex) => sum + crossQuotas[bandIndex * sexes.length + sexIndex], 0);
        crossFooter.push(fmt(population), pct(population / totalPopulation), quota);
      });
      renderTable(els.crossTable, crossHeaders, crossRows, crossFooter);
      setMeta(els.crossMeta, `${COUNTRY_NAMES[country]}, ${year}. Source: ${population.sourceNote}; selected ages ${minAge}-${maxAge} shown as a sex by age cross table.`, minAge, maxAge);
      addExportRows("Sex x Age Cross Table", crossHeaders, crossRows, crossFooter);
      els.crossSection.hidden = false;
    } else {
      els.crossSection.hidden = true;
    }

    els.results.hidden = false;
    els.copy.disabled = false;
    els.download.disabled = false;
    els.excel.disabled = false;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function downloadExcel() {
  const rows = state.rowsForExport.map(row => (
    `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`
  )).join("");
  const workbook = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; }
      td { border: 1px solid #cccccc; padding: 6px 8px; }
      tr:nth-child(1) td, tr td:first-child:only-child { font-weight: bold; }
    </style>
  </head>
  <body>
    <table>${rows}</table>
  </body>
</html>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${els.country.value.toLowerCase()}-${els.year.value}-quotas.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

els.build.addEventListener("click", buildQuotas);
els.copy.addEventListener("click", copyTsv);
els.download.addEventListener("click", downloadCsv);
els.excel.addEventListener("click", downloadExcel);
