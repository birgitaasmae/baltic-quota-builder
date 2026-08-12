const FLOW_ID = "S3R167_M3010202";
const SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${FLOW_ID}/.`;
const NATIONALITY_FLOW_ID = "S3R167_M3010215_1";
const NATIONALITY_SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${NATIONALITY_FLOW_ID}/.`;
const EDUCATION_FLOW_ID = "S3R143_M3110116";
const EDUCATION_SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${EDUCATION_FLOW_ID}/.`;
const URBAN_RURAL_FLOW_ID = "S3R167_M3010206";
const URBAN_RURAL_SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${URBAN_RURAL_FLOW_ID}/.`;
const CITY_TOWN_FLOW_ID = "S3R167_M3010210_1";
const CITY_TOWN_SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${CITY_TOWN_FLOW_ID}/.`;
const POPULATION_SOURCE_TITLE = "Resident population by sex and age at the beginning of the year";
const NATIONALITY_SOURCE_TITLE = "Resident population by ethnicity at the beginning of the year";
const EDUCATION_SOURCE_TITLE = "Population aged 15 and older by educational attainment";
const SETTLEMENT_URBAN_RURAL_SOURCE_TITLE = "Resident population by urban and rural residence at the beginning of the year";
const SETTLEMENT_CITY_SOURCE_TITLE = "Resident population in cities and towns at the beginning of the year";

const NATIONAL_REGION_CODE = "00";
const COUNTY_LABELS = new Map([
  ["10", "Vilnius region"],
  ["02", "Kaunas region"],
  ["03", "Klaipeda region"],
  ["06", "Siauliai region"],
  ["05", "Panevezys region"],
  ["01", "Alytus region"],
  ["04", "Marijampole region"],
  ["09", "Utena region"],
  ["08", "Telsiai region"],
  ["07", "Taurage region"]
]);

const CAPITAL_CITY_CODE = "Vilnius";
const BIG_CITY_CODES = new Set(["Kaunas", "Klaipeda", "Siauliai", "Panevezys"]);
const SETTLEMENT_AGE_GROUPS = [
  { cityCode: "g000g004", ruralCodes: ["g000g004"], from: 0, to: 4 },
  { cityCode: "g005g009", ruralCodes: ["g005g009"], from: 5, to: 9 },
  { cityCode: "g010g014", ruralCodes: ["g010g014"], from: 10, to: 14 },
  { cityCode: "g015g019", ruralCodes: ["g015g019"], from: 15, to: 19 },
  { cityCode: "g020g024", ruralCodes: ["g020g024"], from: 20, to: 24 },
  { cityCode: "g025g029", ruralCodes: ["g025g029"], from: 25, to: 29 },
  { cityCode: "g030g034", ruralCodes: ["g030g034"], from: 30, to: 34 },
  { cityCode: "g035g039", ruralCodes: ["g035g039"], from: 35, to: 39 },
  { cityCode: "g040g044", ruralCodes: ["g040g044"], from: 40, to: 44 },
  { cityCode: "g045g049", ruralCodes: ["g045g049"], from: 45, to: 49 },
  { cityCode: "g050g054", ruralCodes: ["g050g054"], from: 50, to: 54 },
  { cityCode: "g055g059", ruralCodes: ["g055g059"], from: 55, to: 59 },
  { cityCode: "g060g064", ruralCodes: ["g060g064"], from: 60, to: 64 },
  { cityCode: "g065g069", ruralCodes: ["g065g069"], from: 65, to: 69 },
  { cityCode: "g070g074", ruralCodes: ["g070g074"], from: 70, to: 74 },
  { cityCode: "g075", ruralCodes: ["g075g079", "g080g084", "g085"], from: 75, to: 99 }
];

function readKeyValue(block, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<g:Value id="${escaped}" value="([^"]*)"`));
  return match?.[1] || null;
}

function parseLithuaniaXml(xml, year) {
  const rows = [];
  const obsPattern = /<g:Obs><g:ObsKey>([\s\S]*?)<\/g:ObsKey><g:ObsValue value="([^"]*)"/g;
  let match;

  while ((match = obsPattern.exec(xml)) !== null) {
    const keyBlock = match[1];
    if (readKeyValue(keyBlock, "MATVNT") !== "asmenys") continue;
    if (readKeyValue(keyBlock, "LAIKOTARPIS") !== year) continue;

    const sexCode = readKeyValue(keyBlock, "Lytis");
    const ageCode = readKeyValue(keyBlock, "Demogr_amziusM1411");
    const regionCode = readKeyValue(keyBlock, "savivaldybesRegdb");
    const age = ageCode === "g085" ? 85 : Number(ageCode);
    const population = Number(match[2]);

    if (!Number.isInteger(age) || age < 0 || age > 85) continue;
    if (sexCode !== "1" && sexCode !== "2") continue;
    if (regionCode !== NATIONAL_REGION_CODE && !COUNTY_LABELS.has(regionCode)) continue;
    if (!Number.isFinite(population) || population <= 0) continue;

    rows.push({
      sex: sexCode === "1" ? "M" : "F",
      ageFrom: age,
      ageTo: ageCode === "g085" ? 99 : age,
      regionCode,
      regionLabel: regionCode === NATIONAL_REGION_CODE ? "Republic of Lithuania" : COUNTY_LABELS.get(regionCode),
      population
    });
  }

  return rows;
}

function parseLithuaniaNationalityXml(xml, year) {
  let total = 0;
  let lithuanian = 0;
  let russian = 0;
  const obsPattern = /<g:Obs><g:ObsKey>([\s\S]*?)<\/g:ObsKey><g:ObsValue value="([^"]*)"/g;
  let match;

  while ((match = obsPattern.exec(xml)) !== null) {
    const keyBlock = match[1];
    if (readKeyValue(keyBlock, "MATVNT") !== "asmenys") continue;
    if (readKeyValue(keyBlock, "LAIKOTARPIS") !== year) continue;

    const code = readKeyValue(keyBlock, "tautybeM3010215");
    const population = Number(match[2]);
    if (!Number.isFinite(population) || population <= 0) continue;

    if (code === "TOT") total = population;
    if (code === "Lietuvis") lithuanian = population;
    if (code === "Rusas") russian = population;
  }

  return [
    { label: "Lithuanian", population: lithuanian },
    { label: "Russian", population: russian },
    { label: "Other", population: Math.max(0, total - lithuanian - russian) }
  ];
}

function parseLithuaniaEducationXml(xml, year) {
  let total = 0;
  const values = new Map();
  const obsPattern = /<g:Obs><g:ObsKey>([\s\S]*?)<\/g:ObsKey><g:ObsValue value="([^"]*)"/g;
  let match;

  while ((match = obsPattern.exec(xml)) !== null) {
    const keyBlock = match[1];
    if (readKeyValue(keyBlock, "Lytis") !== "0") continue;
    if (readKeyValue(keyBlock, "Vietove") !== "0") continue;
    if (readKeyValue(keyBlock, "amziusM3030902") !== "15_ir_daugiau") continue;
    if (readKeyValue(keyBlock, "MATVNT") !== "tukst") continue;
    if (readKeyValue(keyBlock, "LAIKOTARPIS") !== year) continue;

    const code = readKeyValue(keyBlock, "issilavinimasM3031301");
    const population = Number(match[2]) * 1000;
    if (!code || !Number.isFinite(population) || population <= 0) continue;

    if (code === "0") total = population;
    else values.set(code, population);
  }

  const basic = (values.get("5") || 0) + (values.get("4") || 0);
  const secondary = (values.get("3") || 0) + (values.get("2s") || 0);
  const higher = values.get("1") || 0;

  return [
    { label: "Basic or lower", population: basic },
    { label: "Secondary", population: secondary },
    { label: "Higher", population: higher },
    { label: "Other or unknown", population: Math.max(0, total - basic - secondary - higher) }
  ].filter(row => row.population > 0);
}

function getSettlementAgeGroups(minAge, maxAge) {
  return SETTLEMENT_AGE_GROUPS.filter(group => group.to >= minAge && group.from <= maxAge);
}

function describeSettlementAgeCoverage(ageGroups) {
  if (!ageGroups.length) return "no age groups";
  const from = ageGroups[0].from;
  const to = ageGroups[ageGroups.length - 1].to;
  return `${from}-${to === 99 ? "75+" : to}`;
}

function parseLithuaniaSettlementXml(urbanRuralXml, cityTownXml, year, minAge, maxAge) {
  const ageGroups = getSettlementAgeGroups(minAge, maxAge);
  const cityAgeCodes = new Set(ageGroups.map(group => group.cityCode));
  const ruralAgeCodes = new Set(ageGroups.flatMap(group => group.ruralCodes));
  let rural = 0;
  const urbanRuralPattern = /<g:Obs><g:ObsKey>([\s\S]*?)<\/g:ObsKey><g:ObsValue value="([^"]*)"/g;
  let urbanRuralMatch;
  while ((urbanRuralMatch = urbanRuralPattern.exec(urbanRuralXml)) !== null) {
    const keyBlock = urbanRuralMatch[1];
    if (readKeyValue(keyBlock, "Vietove") !== "2") continue;
    if (!ruralAgeCodes.has(readKeyValue(keyBlock, "Demogr_amziaus_grM1412"))) continue;
    if (readKeyValue(keyBlock, "Lytis") !== "0") continue;
    if (readKeyValue(keyBlock, "MATVNT") !== "asmenys") continue;
    if (readKeyValue(keyBlock, "LAIKOTARPIS") !== year) continue;
    rural += Number(urbanRuralMatch[2]) || 0;
  }

  let cityTotal = 0;
  let capital = 0;
  let bigCities = 0;
  const cityTownPattern = /<g:Obs><g:ObsKey>([\s\S]*?)<\/g:ObsKey><g:ObsValue value="([^"]*)"/g;
  let cityTownMatch;
  while ((cityTownMatch = cityTownPattern.exec(cityTownXml)) !== null) {
    const keyBlock = cityTownMatch[1];
    if (!cityAgeCodes.has(readKeyValue(keyBlock, "Demogr_M3010210"))) continue;
    if (readKeyValue(keyBlock, "MATVNT") !== "asmenys") continue;
    if (readKeyValue(keyBlock, "LAIKOTARPIS") !== year) continue;

    const code = readKeyValue(keyBlock, "miestasM3010210_1");
    const population = Number(cityTownMatch[2]);
    if (!Number.isFinite(population) || population <= 0) continue;
    if (code !== "TOTAL") cityTotal += population;
    if (code === CAPITAL_CITY_CODE) capital += population;
    if (BIG_CITY_CODES.has(code)) bigCities += population;
  }

  return [
    { label: "Capital (Vilnius)", population: capital },
    { label: "Big cities (Kaunas, Klaipeda, Siauliai, Panevezys)", population: bigCities },
    { label: "Other cities", population: Math.max(0, cityTotal - capital - bigCities) },
    { label: "Rural area", population: rural }
  ].filter(row => row.population > 0);
}

export default async function handler(request, response) {
  const year = String(request.query.year || "2024");
  const minAge = Number(request.query.minAge ?? 0);
  const maxAge = Number(request.query.maxAge ?? 99);

  response.setHeader("Access-Control-Allow-Origin", "https://birgitaasmae.github.io");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (!/^\d{4}$/.test(year)) {
    response.status(400).json({ error: "Invalid year" });
    return;
  }
  if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 0 || maxAge > 99 || minAge > maxAge) {
    response.status(400).json({ error: "Invalid age range" });
    return;
  }

  try {
    const [sourceResponse, nationalityResponse, educationResponse] = await Promise.all([
      fetch(`${SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`),
      fetch(`${NATIONALITY_SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`),
      fetch(`${EDUCATION_SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`)
    ]);
    if (!sourceResponse.ok) {
      response.status(sourceResponse.status).json({ error: `Lithuania OSP returned ${sourceResponse.status}` });
      return;
    }
    if (!nationalityResponse.ok) {
      response.status(nationalityResponse.status).json({ error: `Lithuania OSP nationality flow returned ${nationalityResponse.status}` });
      return;
    }
    if (!educationResponse.ok) {
      response.status(educationResponse.status).json({ error: `Lithuania OSP education flow returned ${educationResponse.status}` });
      return;
    }

    const xml = await sourceResponse.text();
    const nationalityXml = await nationalityResponse.text();
    const educationXml = await educationResponse.text();
    const rows = parseLithuaniaXml(xml, year);
    const nationalityRows = parseLithuaniaNationalityXml(nationalityXml, year);
    const educationRows = parseLithuaniaEducationXml(educationXml, year);
    let settlementRows = [];
    const [urbanRuralResult, cityTownResult] = await Promise.allSettled([
      fetch(`${URBAN_RURAL_SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`),
      fetch(`${CITY_TOWN_SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`)
    ]);
    if (urbanRuralResult.status === "fulfilled" && cityTownResult.status === "fulfilled" && urbanRuralResult.value.ok && cityTownResult.value.ok) {
      const urbanRuralXml = await urbanRuralResult.value.text();
      const cityTownXml = await cityTownResult.value.text();
      settlementRows = parseLithuaniaSettlementXml(urbanRuralXml, cityTownXml, year, minAge, maxAge);
    }
    if (!rows.length) {
      response.status(404).json({ error: "No Lithuania population rows found for this year" });
      return;
    }

    response.status(200).json({
      source: "State Data Agency of Lithuania / Official Statistics Portal",
      flow: FLOW_ID,
      nationalityFlow: NATIONALITY_FLOW_ID,
      educationFlow: EDUCATION_FLOW_ID,
      urbanRuralFlow: URBAN_RURAL_FLOW_ID,
      cityTownFlow: CITY_TOWN_FLOW_ID,
      regionalLevel: "counties",
      year,
      rows,
      nationalityRows,
      educationRows,
      settlementRows,
      populationSourceNote: `State Data Agency of Lithuania / Official Statistics Portal: ${POPULATION_SOURCE_TITLE}, SDMX flow ${FLOW_ID}.`,
      nationalitySourceNote: `State Data Agency of Lithuania / Official Statistics Portal: ${NATIONALITY_SOURCE_TITLE}, SDMX flow ${NATIONALITY_FLOW_ID}. Whole-country ethnicity distribution.`,
      educationSourceNote: `State Data Agency of Lithuania / Official Statistics Portal: ${EDUCATION_SOURCE_TITLE}, SDMX flow ${EDUCATION_FLOW_ID}. Whole-country population aged 15+.`,
      settlementSourceNote: `State Data Agency of Lithuania / Official Statistics Portal: ${SETTLEMENT_URBAN_RURAL_SOURCE_TITLE}, SDMX flow ${URBAN_RURAL_FLOW_ID}; ${SETTLEMENT_CITY_SOURCE_TITLE}, SDMX flow ${CITY_TOWN_FLOW_ID}. Official age groups covering ages ${describeSettlementAgeCoverage(getSettlementAgeGroups(minAge, maxAge))}; settlement formula follows the Estonian quota builder pattern; city/town flow is not split by sex.`
    });
  } catch (error) {
    response.status(502).json({ error: error.message });
  }
}
