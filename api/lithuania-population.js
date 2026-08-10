const FLOW_ID = "S3R167_M3010222";
const SOURCE_URL = `https://osp-rs.stat.gov.lt/rest_xml/data/LSD,${FLOW_ID}/.`;

const AGE_BANDS = new Map([
  ["g000g004", [0, 4]],
  ["g005g009", [5, 9]],
  ["g010g014", [10, 14]],
  ["g015g019", [15, 19]],
  ["g020g024", [20, 24]],
  ["g025g029", [25, 29]],
  ["g030g034", [30, 34]],
  ["g035g039", [35, 39]],
  ["g040g044", [40, 44]],
  ["g045g049", [45, 49]],
  ["g050g054", [50, 54]],
  ["g055g059", [55, 59]],
  ["g060g064", [60, 64]],
  ["g065g069", [65, 69]],
  ["g070g074", [70, 74]],
  ["g075g079", [75, 79]],
  ["g080g084", [80, 84]],
  ["g085", [85, 99]]
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
    if (readKeyValue(keyBlock, "salisM301022") !== "TOT_gimimo") continue;
    if (readKeyValue(keyBlock, "indeksas_M3010216") !== "0") continue;
    if (readKeyValue(keyBlock, "MATVNT") !== "asmenys") continue;
    if (readKeyValue(keyBlock, "LAIKOTARPIS") !== year) continue;

    const sexCode = readKeyValue(keyBlock, "Lytis");
    const ageCode = readKeyValue(keyBlock, "Demogr_amziaus_grM1412");
    const range = AGE_BANDS.get(ageCode);
    const population = Number(match[2]);

    if (!range || !Number.isFinite(population) || population <= 0) continue;
    if (sexCode !== "1" && sexCode !== "2") continue;

    rows.push({
      sex: sexCode === "1" ? "M" : "F",
      ageFrom: range[0],
      ageTo: range[1],
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
      year,
      rows
    });
  } catch (error) {
    response.status(502).json({ error: error.message });
  }
}
