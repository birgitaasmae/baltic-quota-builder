const ESTONIA_API_BASE = "https://andmed.stat.ee/api/v1/et/stat";
const LATVIA_API_BASE = "https://api.stat.gov.lv/api/v2";
const LITHUANIA_PROXY_URL = "https://baltic-quota-builder.vercel.app/api/lithuania-population";
const OPEN_ENDED_AGE_KEY = "100+";

const ESTONIA_REGION_QUERY_CODES = ["37", "784", "39", "44", "49", "51", "57", "59", "65", "67", "70", "74", "78", "82", "84", "86"];
const ESTONIA_REGION_CODES = ["784", "37_NO_TALLINN", "39", "44", "49", "51", "57", "59", "65", "67", "70", "74", "78", "82", "84", "86"];
const ESTONIA_BIG_CITY_CODES = ["795", "625", "511", "322"];
const LATVIA_REGION_CODES = ["LV00A", "LV00C", "LV00B", "LV009", "LV005"];
const LATVIA_CAPITAL_CODE = "LV0001000";
const LATVIA_STATE_CITY_CODES = ["LV0002000", "LV0003000", "LV0031010", "LV0004000", "LV0005000", "LV0040010", "LV0006000", "LV0054010", "LV0007000"];
const LITHUANIA_REGION_CODES = ["10", "02", "03", "06", "05", "01", "04", "09", "08", "07"];

function exactAgeCode(age) {
  return `Y${age}`;
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
  for (const dim of dims) {
    dimIndex[dim] = dataset.dimension[dim].category.index || {};
  }
  return { dims, values, strides, dimIndex };
}

function lookupValue(parsed, coords) {
  let index = 0;
  for (let i = 0; i < parsed.dims.length; i++) {
    const dim = parsed.dims[i];
    const position = parsed.dimIndex[dim][coords[dim]];
    if (position === undefined) return null;
    index += position * parsed.strides[i];
  }
  return parsed.values[index] ?? null;
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
  if (!response.ok) throw new Error(`Latvia ${tableId} returned ${response.status}`);
  return response.json();
}

async function latviaMetadata(tableId) {
  const response = await fetch(`${LATVIA_API_BASE}/tables/${tableId}/metadata?lang=en`);
  if (!response.ok) throw new Error(`Latvia ${tableId} metadata returned ${response.status}`);
  return response.json();
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

function assertNear(actual, expected, tolerance, label) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  }
}

function assertPositive(value, label) {
  if (!(value > 0)) throw new Error(`${label}: expected positive value, got ${value}`);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function largestRemainder(proportions, total) {
  const raw = proportions.map(value => value * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((subtotal, value) => subtotal + value, 0);
  const fractions = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < remainder; i++) floors[fractions[i].index]++;
  return floors;
}

function assertQuotaSum(populations, sampleSize, label) {
  const total = sum(populations);
  const quotas = largestRemainder(populations.map(value => value / total), sampleSize);
  assertEqual(sum(quotas), sampleSize, label);
}

function educationRowsForCalculation(rows) {
  return rows.filter(row => !/\b(other|unknown|not stated|not specified)\b/i.test(row.label || "") && row.population > 0);
}

function estoniaEducationAgeGroups(minAge, maxAge) {
  return [
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
    { code: "16", from: 85, to: 100 }
  ].filter(group => group.to >= minAge && group.from <= maxAge);
}

function latviaGroupedAges(minAge, maxAge) {
  return [
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
    { code: "Y_GE85", from: 85, to: 100 }
  ].filter(group => group.to >= minAge && group.from <= maxAge);
}

async function checkEstoniaRv0240() {
  const year = "2025";
  const minAge = 18;
  const maxAge = 74;
  const ageCodes = [];
  for (let age = minAge; age <= maxAge; age++) ageCodes.push(String(age));
  const areaCodes = ["00", ...ESTONIA_REGION_QUERY_CODES];
  const data = await pxWebPostSelection(ESTONIA_API_BASE, "RV0240", [
    { code: "Sugu", selection: { filter: "item", values: ["2", "3"] } },
    { code: "Elukoht", selection: { filter: "item", values: areaCodes } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Vanus", selection: { filter: "item", values: ageCodes } }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = (sex, area, age) => lookupValue(parsed, { Sugu: sex, Elukoht: area, Aasta: year, Vanus: String(age) }) || 0;

  const national = { M: 0, F: 0 };
  const rawRegions = new Map();
  for (let age = minAge; age <= maxAge; age++) {
    national.M += valueFor("2", "00", age);
    national.F += valueFor("3", "00", age);
    for (const area of ESTONIA_REGION_QUERY_CODES) {
      rawRegions.set(`M|${area}|${age}`, valueFor("2", area, age));
      rawRegions.set(`F|${area}|${age}`, valueFor("3", area, age));
    }
  }

  let regionalTotal = 0;
  for (const sex of ["M", "F"]) {
    for (let age = minAge; age <= maxAge; age++) {
      for (const area of ESTONIA_REGION_CODES) {
        const value = area === "37_NO_TALLINN"
          ? Math.max(0, (rawRegions.get(`${sex}|37|${age}`) || 0) - (rawRegions.get(`${sex}|784|${age}`) || 0))
          : rawRegions.get(`${sex}|${area}|${age}`) || 0;
        regionalTotal += value;
      }
    }
  }

  const total = national.M + national.F;
  assertPositive(total, "Estonia RV0240 national 18-74 total");
  assertEqual(regionalTotal, total, "Estonia RV0240 counties + Tallinn equal national total");
  return `Estonia RV0240 ${year} ages ${minAge}-${maxAge}: total ${total}`;
}

async function checkEstoniaSettlementNationalityEducation() {
  const year = "2025";
  const minAge = 18;
  const maxAge = 74;
  const sexes = ["2", "3"];
  const exactAgeCodes = [];
  for (let age = minAge; age <= maxAge; age++) exactAgeCodes.push(String(age));

  const settlementData = await pxWebPostSelection(ESTONIA_API_BASE, "RV0240", [
    { code: "Sugu", selection: { filter: "item", values: sexes } },
    { code: "Elukoht", selection: { filter: "item", values: ["784", "795", "625", "511", "322", "H2", "H3", "H4"] } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Vanus", selection: { filter: "item", values: exactAgeCodes } }
  ]);
  const settlementParsed = parseJsonStat(settlementData);
  const settlementValue = code => {
    let total = 0;
    for (const sex of sexes) {
      for (const age of exactAgeCodes) {
        total += lookupValue(settlementParsed, { Sugu: sex, Elukoht: code, Aasta: year, Vanus: age }) || 0;
      }
    }
    return total;
  };
  const estoniaSettlementRows = [
    settlementValue("784"),
    sum(ESTONIA_BIG_CITY_CODES.map(settlementValue)),
    Math.max(0, settlementValue("H2") + settlementValue("H3") - settlementValue("784") - sum(ESTONIA_BIG_CITY_CODES.map(settlementValue))),
    settlementValue("H4")
  ];
  assertPositive(sum(estoniaSettlementRows), "Estonia RV0240 settlement total");
  assertQuotaSum(estoniaSettlementRows, 1000, "Estonia settlement quotas sum to sample size");

  const nationalityAgeGroups = [
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
    { code: "16", from: 70, to: 74 }
  ];
  const nationalityData = await pxWebPostSelection(ESTONIA_API_BASE, "RV022U", [
    { code: "Rahvus", selection: { filter: "item", values: ["1", "2", "3"] } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Sugu", selection: { filter: "item", values: sexes } },
    { code: "Vanuserühm", selection: { filter: "item", values: nationalityAgeGroups.map(group => group.code) } }
  ]);
  const nationalityParsed = parseJsonStat(nationalityData);
  const nationalityValue = code => {
    let total = 0;
    for (const sex of sexes) {
      for (const ageGroup of nationalityAgeGroups) {
        total += lookupValue(nationalityParsed, { Rahvus: code, Aasta: year, Sugu: sex, "Vanuserühm": ageGroup.code }) || 0;
      }
    }
    return total;
  };
  const estonian = nationalityValue("2");
  const russian = nationalityValue("3");
  const nationalityTotal = nationalityValue("1");
  assertPositive(nationalityTotal, "Estonia RV022U nationality total");
  assertEqual(estonian + russian <= nationalityTotal, true, "Estonia nationality named groups do not exceed total");
  assertQuotaSum([estonian, russian, nationalityTotal - estonian - russian], 1000, "Estonia nationality quotas sum to sample size");

  const educationAgeGroups = estoniaEducationAgeGroups(minAge, maxAge);
  const educationData = await pxWebPostSelection(ESTONIA_API_BASE, "RV0231U", [
    { code: "Maakond", selection: { filter: "item", values: ["1"] } },
    { code: "Haridustase", selection: { filter: "item", values: ["2", "7", "11", "16"] } },
    { code: "Aasta", selection: { filter: "item", values: [year] } },
    { code: "Sugu", selection: { filter: "item", values: sexes } },
    { code: "Vanuserühm", selection: { filter: "item", values: educationAgeGroups.map(group => group.code) } }
  ]);
  const educationParsed = parseJsonStat(educationData);
  const educationValue = code => {
    let total = 0;
    for (const sex of sexes) {
      for (const ageGroup of educationAgeGroups) {
        total += lookupValue(educationParsed, { Maakond: "1", Haridustase: code, Aasta: year, Sugu: sex, "Vanuserühm": ageGroup.code }) || 0;
      }
    }
    return total;
  };
  const rawEducationRows = [
    { label: "Basic or lower", population: educationValue("2") },
    { label: "Secondary", population: educationValue("7") },
    { label: "Higher", population: educationValue("11") },
    { label: "Other or unknown", population: educationValue("16") }
  ];
  const calculatedEducationRows = educationRowsForCalculation(rawEducationRows);
  assertEqual(calculatedEducationRows.some(row => /other|unknown/i.test(row.label)), false, "Estonia education excludes other or unknown");
  assertPositive(sum(calculatedEducationRows.map(row => row.population)), "Estonia RV0231U education calculated total");
  assertQuotaSum(calculatedEducationRows.map(row => row.population), 1000, "Estonia education quotas sum to sample size after exclusion");
  return `Estonia settlement, nationality, education source checks passed for ${year}`;
}

async function checkLatviaIrd041() {
  const year = "2025";
  const minAge = 18;
  const maxAge = 54;
  const ageCodes = [];
  for (let age = minAge; age <= maxAge; age++) ageCodes.push(exactAgeCode(age));
  const areaCodes = ["LV", ...LATVIA_REGION_CODES];
  const data = await latviaPostSelection("IRD041", [
    { variableCode: "ContentsCode", valueCodes: ["IRD041"] },
    { variableCode: "TIME", valueCodes: [year] },
    { variableCode: "AREA", valueCodes: areaCodes },
    { variableCode: "SEX", valueCodes: ["M", "F"] },
    { variableCode: "AGE", valueCodes: ageCodes }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = (area, sex, age) => lookupValue(parsed, {
    AREA: area,
    AGE: exactAgeCode(age),
    SEX: sex,
    ContentsCode: "IRD041",
    TIME: year
  }) || 0;

  let national = 0;
  const sexTotals = { M: 0, F: 0 };
  const regionTotals = new Map(LATVIA_REGION_CODES.map(code => [code, 0]));
  for (let age = minAge; age <= maxAge; age++) {
    for (const sex of ["M", "F"]) {
      const value = valueFor("LV", sex, age);
      national += value;
      sexTotals[sex] += value;
      for (const region of LATVIA_REGION_CODES) {
        regionTotals.set(region, regionTotals.get(region) + valueFor(region, sex, age));
      }
    }
  }

  assertEqual(national, 854003, "Latvia IRD041 2025 ages 18-54 national total");
  assertEqual(sexTotals.M, 431717, "Latvia IRD041 2025 ages 18-54 male total");
  assertEqual(sexTotals.F, 422286, "Latvia IRD041 2025 ages 18-54 female total");
  assertEqual(sum([...regionTotals.values()]), national, "Latvia IRD041 region totals equal national total");
  assertEqual(regionTotals.get("LV00A"), 405095, "Latvia IRD041 Riga statistical region 18-54");
  assertQuotaSum([sexTotals.M, sexTotals.F], 500, "Latvia sex quotas sum to sample size");
  assertQuotaSum([...regionTotals.values()], 500, "Latvia regional quotas sum to sample size");
  return `Latvia IRD041 ${year} ages ${minAge}-${maxAge}: total ${national}`;
}

async function checkLatviaIrd041With100Plus() {
  const year = "2026";
  const ageCodes = [];
  for (let age = 0; age <= 99; age++) ageCodes.push(exactAgeCode(age));
  ageCodes.push("Y_GE100");
  const data = await latviaPostSelection("IRD041", [
    { variableCode: "ContentsCode", valueCodes: ["IRD041"] },
    { variableCode: "TIME", valueCodes: [year] },
    { variableCode: "AREA", valueCodes: ["LV"] },
    { variableCode: "SEX", valueCodes: ["M", "F"] },
    { variableCode: "AGE", valueCodes: ageCodes }
  ]);
  const parsed = parseJsonStat(data);
  const valueFor = (sex, ageCode) => lookupValue(parsed, {
    AREA: "LV",
    AGE: ageCode,
    SEX: sex,
    ContentsCode: "IRD041",
    TIME: year
  }) || 0;
  const rows = new Map();
  for (const sex of ["M", "F"]) {
    for (let age = 0; age <= 99; age++) rows.set(`${sex}|${age}`, valueFor(sex, exactAgeCode(age)));
    rows.set(`${sex}|${OPEN_ENDED_AGE_KEY}`, valueFor(sex, "Y_GE100"));
  }
  const male = [...rows.entries()].filter(([key]) => key.startsWith("M|")).reduce((total, [, value]) => total + value, 0);
  const female = [...rows.entries()].filter(([key]) => key.startsWith("F|")).reduce((total, [, value]) => total + value, 0);
  const total = male + female;
  const children = ["M", "F"].reduce((subtotal, sex) => subtotal + Array.from({ length: 15 }, (_, age) => rows.get(`${sex}|${age}`) || 0).reduce((a, b) => a + b, 0), 0);
  const working = ["M", "F"].reduce((subtotal, sex) => subtotal + Array.from({ length: 50 }, (_, offset) => rows.get(`${sex}|${offset + 15}`) || 0).reduce((a, b) => a + b, 0), 0);
  const seniors = total - children - working;
  assertEqual(total, 1845096, "Latvia IRD041 2026 total including 100+");
  assertEqual(male, 856599, "Latvia IRD041 2026 male including 100+");
  assertEqual(female, 988497, "Latvia IRD041 2026 female including 100+");
  assertEqual(rows.get(`M|${OPEN_ENDED_AGE_KEY}`), 31, "Latvia IRD041 2026 male 100+");
  assertEqual(rows.get(`F|${OPEN_ENDED_AGE_KEY}`), 226, "Latvia IRD041 2026 female 100+");
  assertEqual(children, 273963, "Latvia IRD041 2026 ages 0-14");
  assertEqual(working, 1158166, "Latvia IRD041 2026 ages 15-64");
  assertEqual(seniors, 412967, "Latvia IRD041 2026 ages 65+ including 100+");
  return `Latvia IRD041 ${year} includes official 100+ bucket and matches infographic totals`;
}

async function checkLatviaSettlementNationalityEducation() {
  const year = "2025";
  const minAge = 18;
  const maxAge = 74;
  const ageGroups = latviaGroupedAges(minAge, maxAge);

  const metadata = await latviaMetadata("IRD081");
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
  assertPositive(municipalityTownCodes.length, "Latvia IRD081 municipality-town code count");
  assertPositive(ruralCodes.length, "Latvia IRD081 rural code count");

  const settlementAreaCodes = [LATVIA_CAPITAL_CODE, ...LATVIA_STATE_CITY_CODES, ...municipalityTownCodes, ...ruralCodes];
  const settlementData = await latviaPostSelection("IRD081", [
    { variableCode: "SEX", valueCodes: ["T"] },
    { variableCode: "AgeGroup", valueCodes: ageGroups.map(group => group.code) },
    { variableCode: "AREA", valueCodes: settlementAreaCodes },
    { variableCode: "ContentsCode", valueCodes: ["IRD081"] },
    { variableCode: "TIME", valueCodes: [year] }
  ]);
  const settlementParsed = parseJsonStat(settlementData);
  const settlementValue = code => sum(ageGroups.map(ageGroup => lookupValue(settlementParsed, {
    SEX: "T",
    AgeGroup: ageGroup.code,
    AREA: code,
    ContentsCode: "IRD081",
    TIME: year
  }) || 0));
  const latviaSettlementRows = [
    settlementValue(LATVIA_CAPITAL_CODE),
    sum(LATVIA_STATE_CITY_CODES.map(settlementValue)),
    sum(municipalityTownCodes.map(settlementValue)),
    sum(ruralCodes.map(settlementValue))
  ];
  assertPositive(sum(latviaSettlementRows), "Latvia IRD081 settlement total");
  assertQuotaSum(latviaSettlementRows, 1000, "Latvia settlement quotas sum to sample size");

  const nationalityData = await latviaPostSelection("IRE040", [
    { variableCode: "ETHNICITY", valueCodes: ["TOTAL", "E_LAT", "E_RUS"] },
    { variableCode: "AgeGroup", valueCodes: ageGroups.map(group => group.code) },
    { variableCode: "ContentsCode", valueCodes: ["IRE040"] },
    { variableCode: "TIME", valueCodes: [year] }
  ]);
  const nationalityParsed = parseJsonStat(nationalityData);
  const nationalityValue = code => sum(ageGroups.map(ageGroup => lookupValue(nationalityParsed, {
    ETHNICITY: code,
    AgeGroup: ageGroup.code,
    ContentsCode: "IRE040",
    TIME: year
  }) || 0));
  const latvian = nationalityValue("E_LAT");
  const russian = nationalityValue("E_RUS");
  const nationalityTotal = nationalityValue("TOTAL");
  assertPositive(nationalityTotal, "Latvia IRE040 nationality total");
  assertEqual(latvian + russian <= nationalityTotal, true, "Latvia nationality named groups do not exceed total");
  assertQuotaSum([latvian, russian, nationalityTotal - latvian - russian], 1000, "Latvia nationality quotas sum to sample size");

  const educationData = await latviaPostSelection("IZT010", [
    { variableCode: "EDUCATION_LEVEL", valueCodes: ["ED0", "ED1", "ED2", "ED3", "ED4", "ED5", "ED6", "ED7", "ED8"] },
    { variableCode: "AgeGroup", valueCodes: ageGroups.map(group => group.code) },
    { variableCode: "SEX", valueCodes: ["T"] },
    { variableCode: "ContentsCode", valueCodes: ["IZT010"] },
    { variableCode: "TIME", valueCodes: [year] }
  ]);
  const educationParsed = parseJsonStat(educationData);
  const educationValue = code => sum(ageGroups.map(ageGroup => lookupValue(educationParsed, {
    EDUCATION_LEVEL: code,
    AgeGroup: ageGroup.code,
    SEX: "T",
    ContentsCode: "IZT010",
    TIME: year
  }) || 0));
  const calculatedEducationRows = educationRowsForCalculation([
    { label: "Basic or lower", population: sum(["ED0", "ED1", "ED2"].map(educationValue)) },
    { label: "Secondary", population: sum(["ED3", "ED4"].map(educationValue)) },
    { label: "Higher", population: sum(["ED5", "ED6", "ED7", "ED8"].map(educationValue)) }
  ]);
  assertPositive(sum(calculatedEducationRows.map(row => row.population)), "Latvia IZT010 education calculated total");
  assertQuotaSum(calculatedEducationRows.map(row => row.population), 1000, "Latvia education quotas sum to sample size");
  return `Latvia settlement, nationality, education source checks passed for ${year}`;
}

async function checkLithuaniaProxy() {
  const year = "2026";
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${year}&minAge=18&maxAge=74`);
  if (!response.ok) throw new Error(`Lithuania proxy returned ${response.status}`);
  const data = await response.json();
  if (data.flow !== "S3R167_M3010202") throw new Error(`Lithuania population flow mismatch: ${data.flow}`);
  if (data.urbanRuralFlow !== "S3R167_M3010206") throw new Error(`Lithuania urban/rural flow mismatch: ${data.urbanRuralFlow}`);
  if (data.cityTownFlow !== "S3R167_M3010210_1") throw new Error(`Lithuania city/town flow mismatch: ${data.cityTownFlow}`);

  const nationalRows = data.rows.filter(row => row.regionCode === "00" && row.ageFrom >= 18 && row.ageTo <= 74);
  const regionRows = code => data.rows.filter(row => row.regionCode === code && row.ageFrom >= 18 && row.ageTo <= 74);
  const nationalTotal = sum(nationalRows.map(row => row.population));
  const maleTotal = sum(nationalRows.filter(row => row.sex === "M").map(row => row.population));
  const femaleTotal = sum(nationalRows.filter(row => row.sex === "F").map(row => row.population));
  const regionalTotals = LITHUANIA_REGION_CODES.map(code => sum(regionRows(code).map(row => row.population)));

  assertEqual(nationalTotal, 2122137, "Lithuania S3R167_M3010202 2026 ages 18-74 national total");
  assertEqual(maleTotal, 1041975, "Lithuania S3R167_M3010202 2026 ages 18-74 male total");
  assertEqual(femaleTotal, 1080162, "Lithuania S3R167_M3010202 2026 ages 18-74 female total");
  assertEqual(sum(regionalTotals), nationalTotal, "Lithuania counties equal national total");

  const expectedRegions = [653458, 427481, 252253, 195371, 149466, 96496, 97269, 90214, 94219, 65910];
  expectedRegions.forEach((expected, index) => {
    assertEqual(regionalTotals[index], expected, `Lithuania region ${LITHUANIA_REGION_CODES[index]} 18-74`);
  });

  const settlement = new Map(data.settlementRows.map(row => [row.label, row.population]));
  assertEqual(settlement.get("Capital (Vilnius)"), 464347, "Lithuania settlement Capital (Vilnius), official age coverage");
  assertEqual(settlement.get("Big cities (Kaunas, Klaipeda, Siauliai, Panevezys)"), 498887, "Lithuania settlement big cities excluding Vilnius");
  assertEqual(settlement.get("Other cities"), 546114, "Lithuania settlement other cities");
  assertEqual(settlement.get("Rural area"), 704883, "Lithuania settlement rural area");
  assertNear(sum([...settlement.values()]), 2214231, 0, "Lithuania settlement total for official age coverage");
  assertEqual(
    settlement.get("Capital (Vilnius)") + settlement.get("Big cities (Kaunas, Klaipeda, Siauliai, Panevezys)"),
    963234,
    "Lithuania Vilnius plus other big cities"
  );
  assertQuotaSum(regionalTotals, 3000, "Lithuania regional quotas sum to sample size");
  assertQuotaSum([...settlement.values()], 3000, "Lithuania settlement quotas sum to sample size");

  const nationalityRows = data.nationalityRows || [];
  assertPositive(sum(nationalityRows.map(row => row.population)), "Lithuania nationality proxy total");
  assertQuotaSum(nationalityRows.map(row => row.population), 3000, "Lithuania nationality quotas sum to sample size");

  return `Lithuania proxy ${year} ages 18-74: population total ${nationalTotal}; settlement coverage total ${sum([...settlement.values()])}`;
}

async function checkLithuaniaEducationLatestAvailable() {
  const year = "2025";
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${year}&minAge=18&maxAge=74`);
  if (!response.ok) throw new Error(`Lithuania proxy education check returned ${response.status}`);
  const data = await response.json();
  const educationRows = educationRowsForCalculation(data.educationRows || []);
  assertEqual(educationRows.some(row => /other|unknown/i.test(row.label)), false, "Lithuania education excludes other or unknown");
  assertPositive(sum(educationRows.map(row => row.population)), "Lithuania education proxy calculated total");
  assertQuotaSum(educationRows.map(row => row.population), 3000, "Lithuania education quotas sum to sample size after exclusion");
  return `Lithuania education proxy ${year}: latest available education rows checked after exclusion`;
}

async function checkLithuaniaOlderAgeEdge() {
  const year = "2026";
  const response = await fetch(`${LITHUANIA_PROXY_URL}?year=${year}&minAge=85&maxAge=99`);
  if (!response.ok) throw new Error(`Lithuania proxy older-age check returned ${response.status}`);
  const data = await response.json();
  const nationalOlderRows = data.rows.filter(row => row.regionCode === "00" && row.ageFrom === 85 && row.ageTo === 99);
  assertEqual(nationalOlderRows.length, 2, "Lithuania 85+ national rows are represented once per sex");
  assertPositive(sum(nationalOlderRows.map(row => row.population)), "Lithuania 85+ national population");

  const invalidResponse = await fetch(`${LITHUANIA_PROXY_URL}?year=${year}&minAge=85&maxAge=100`);
  assertEqual(invalidResponse.status, 400, "Lithuania proxy rejects maxAge above 99");
  return "Lithuania proxy older-age edge: 85+ handled explicitly and maxAge > 99 rejected";
}

async function main() {
  const checks = [
    checkEstoniaRv0240,
    checkEstoniaSettlementNationalityEducation,
    checkLatviaIrd041,
    checkLatviaIrd041With100Plus,
    checkLatviaSettlementNationalityEducation,
    checkLithuaniaProxy,
    checkLithuaniaEducationLatestAvailable,
    checkLithuaniaOlderAgeEdge
  ];
  for (const check of checks) {
    const message = await check();
    console.log(`PASS ${message}`);
  }
}

main().catch(error => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
