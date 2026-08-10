const FLOW_ID = "S3R167_M3010202";
const SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${FLOW_ID}/.`;
const NATIONALITY_FLOW_ID = "S3R167_M3010215_1";
const NATIONALITY_SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${NATIONALITY_FLOW_ID}/.`;

const NATIONAL_REGION_CODE = "00";
const COUNTY_LABELS = new Map([
  ["10", "Vilnius region"],
  ["02", "Kaunas region"],
  ["03", "Klaip\u0117da region"],
  ["06", "\u0160iauliai region"],
  ["05", "Panev\u0117\u017eys region"],
  ["01", "Alytus region"],
  ["04", "Marijampol\u0117 region"],
  ["09", "Utena region"],
  ["08", "Tel\u0161iai region"],
  ["07", "Taurag\u0117 region"]
]);

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

export default async function handler(request, response) {
  const year = String(request.query.year || "2024");

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

  try {
    const [sourceResponse, nationalityResponse] = await Promise.all([
      fetch(`${SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`),
      fetch(`${NATIONALITY_SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`)
    ]);
    if (!sourceResponse.ok) {
      response.status(sourceResponse.status).json({ error: `Lithuania OSP returned ${sourceResponse.status}` });
      return;
    }
    if (!nationalityResponse.ok) {
      response.status(nationalityResponse.status).json({ error: `Lithuania OSP nationality flow returned ${nationalityResponse.status}` });
      return;
    }

    const xml = await sourceResponse.text();
    const nationalityXml = await nationalityResponse.text();
    const rows = parseLithuaniaXml(xml, year);
    const nationalityRows = parseLithuaniaNationalityXml(nationalityXml, year);
    if (!rows.length) {
      response.status(404).json({ error: "No Lithuania population rows found for this year" });
      return;
    }

    response.status(200).json({
      source: "State Data Agency of Lithuania / Official Statistics Portal",
      flow: FLOW_ID,
      nationalityFlow: NATIONALITY_FLOW_ID,
      regionalLevel: "counties",
      year,
      rows,
      nationalityRows
    });
  } catch (error) {
    response.status(502).json({ error: error.message });
  }
}
