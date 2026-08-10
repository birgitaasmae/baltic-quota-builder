const FLOW_ID = "S3R167_M3010202";
const SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${FLOW_ID}/.`;

const NATIONAL_REGION_CODE = "00";
const COUNTY_LABELS = new Map([
  ["10", "Vilnius region"],
  ["02", "Kaunas region"],
  ["03", "Klaipėda region"],
  ["06", "Šiauliai region"],
  ["05", "Panevėžys region"],
  ["01", "Alytus region"],
  ["04", "Marijampolė region"],
  ["09", "Utena region"],
  ["08", "Telšiai region"],
  ["07", "Tauragė region"]
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
    const sourceResponse = await fetch(`${SOURCE_URL}?startPeriod=${year}&endPeriod=${year}`);
    if (!sourceResponse.ok) {
      response.status(sourceResponse.status).json({ error: `Lithuania OSP returned ${sourceResponse.status}` });
      return;
    }

    const xml = await sourceResponse.text();
    const rows = parseLithuaniaXml(xml, year);
    if (!rows.length) {
      response.status(404).json({ error: "No Lithuania population rows found for this year" });
      return;
    }

    response.status(200).json({
      source: "State Data Agency of Lithuania / Official Statistics Portal",
      flow: FLOW_ID,
      regionalLevel: "counties",
      year,
      rows
    });
  } catch (error) {
    response.status(502).json({ error: error.message });
  }
}
