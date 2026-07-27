/**
 * Vercel Serverless Function — Proxy OSM Overpass API
 * Todas las URLs y configuración se leen desde variables de entorno.
 */

const OVERPASS_MIRRORS = (process.env.OSM_OVERPASS_MIRRORS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const OSM_USER_AGENT = process.env.OSM_USER_AGENT || 'UrbanPlan3D/1.0';
const OSM_REFERER = process.env.APP_URL || '';
const OSM_TIMEOUT = parseInt(process.env.OSM_PROXY_TIMEOUT_MS) || 55000;

/**
 * Lee y parsea el body del request manualmente.
 * Vercel serverless no parsea automáticamente application/x-www-form-urlencoded,
 * así que lo hacemos como fallback cuando req.body es undefined.
 */
async function readBody(req) {
  if (req.body) return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const params = new URLSearchParams(raw);
    const result = {};
    for (const [key, value] of params) result[key] = value;
    return result;
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!OVERPASS_MIRRORS.length) {
    return res.status(500).json({ error: 'OSM_OVERPASS_MIRRORS no configurado' });
  }

  const body = await readBody(req);
  const query = body.data;
  if (!query) {
    return res.status(400).json({ error: 'Missing "data" field' });
  }

  let lastError;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OSM_TIMEOUT);

      const overpassRes = await fetch(mirror, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': OSM_USER_AGENT,
          'Referer': OSM_REFERER,
          'Accept': 'application/json, */*',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if ([406, 429, 502, 503, 504].includes(overpassRes.status)) {
        lastError = `Overpass ${overpassRes.status} from ${mirror}`;
        continue;
      }

      if (!overpassRes.ok) {
        const errBody = await overpassRes.text().catch(() => '');
        return res.status(overpassRes.status).json({
          error: `Overpass responded ${overpassRes.status}`,
          detail: errBody.slice(0, 200),
        });
      }

      const json = await overpassRes.json();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      return res.status(200).json(json);
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(502).json({ error: 'All Overpass mirrors failed', detail: lastError });
};
