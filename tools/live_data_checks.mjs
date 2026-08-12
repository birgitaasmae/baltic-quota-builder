const ESTONIA_API_BASE = "https://andmed.stat.ee/api/v1/et/stat";
const LATVIA_API_BASE = "https://api.stat.gov.lv/api/v2";
const LITHUANIA_PROXY_URL = "https://baltic-quota-builder.vercel.app/api/lithuania-population";

const ESTONIA_REGION_QUERY_CODES = ["37", "784", "39", "44", "49", "51", "57", "59", "65", "67", "70", "74", "78", "82", "84", "86"];
const ESTONIA_REGION_CODES = ["784", "37_NO_TALLINN", "39", "44", "49", "51", "57", "59", "65", "67", "70", "74", "78", "82", "84", "86"];
const LATVIA_REGION_CODES = ["LV00A", "LV00C", "LV00B", "LV009", "LV005"];
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

  return `Lithuania proxy ${year} ages 18-74: population total ${nationalTotal}; settlement coverage total ${sum([...settlement.values()])}`;
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
    checkLatviaIrd041,
    checkLithuaniaProxy,
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
