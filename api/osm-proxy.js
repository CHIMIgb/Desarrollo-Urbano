/**
 * Vercel Serverless Function — Proxy OSM Overpass API
 * Usa mirrors en paralelo para máxima velocidad.
 */

const OVERPASS_MIRRORS = (process.env.OSM_OVERPASS_MIRRORS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const OSM_USER_AGENT = process.env.OSM_USER_AGENT || 'UrbanPlan3D/1.0';
const OSM_REFERER = process.env.APP_URL || '';
const OSM_TIMEOUT = Math.min(parseInt(process.env.OSM_PROXY_TIMEOUT_MS) || 12000, 25000);

module.exports.config = {
  maxDuration: 30,
};

/**
 * Lee y parsea el body del request con timeout de 2s.
 * En Vercel serverless el stream puede colgar — si no llega el body
 * en 2 segundos, fallamos rápido.
 */
function readBody(req) {
  if (req.body) return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('readBody timeout — body no recibido en 2s'));
      }
    }, 2000);

    req.on('data', (chunk) => chunks.push(chunk));

    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        const params = new URLSearchParams(raw);
        const result = {};
        for (const [key, value] of params) result[key] = value;
        resolve(result);
      }
    });

    req.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
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

  let query;
  try {
    const body = await readBody(req);
    query = body.data;
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!query) {
    return res.status(400).json({ error: 'Missing "data" field' });
  }

  const encoded = `data=${encodeURIComponent(query)}`;

  const attempts = OVERPASS_MIRRORS.map((mirror) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OSM_TIMEOUT);

    return fetch(mirror, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': OSM_USER_AGENT,
        'Referer': OSM_REFERER,
        'Accept': 'application/json, */*',
      },
      body: encoded,
      signal: controller.signal,
    })
      .then(async (res) => {
        clearTimeout(timer);
        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`${res.status}: ${errBody.slice(0, 100)}`);
        }
        return res.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        throw new Error(`${mirror} — ${err.message}`);
      });
  });

  try {
    const json = await Promise.any(attempts);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(json);
  } catch (aggErr) {
    const reasons = aggErr.errors ? aggErr.errors.map((e) => e.message).join(' | ') : aggErr.message;
    return res.status(502).json({ error: 'Todos los mirrors de Overpass fallaron', detail: reasons });
  }
};
