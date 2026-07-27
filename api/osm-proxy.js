/**
 * Vercel Serverless Function — Proxy OSM Overpass API
 * Intenta mirrors en paralelo con Promise.any, fallback secuencial.
 * ESM syntax para evitar compilación ESM→CJS de Vercel.
 */

const OVERPASS_MIRRORS = (process.env.OSM_OVERPASS_MIRRORS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const OSM_USER_AGENT = process.env.OSM_USER_AGENT || 'UrbanPlan3D/1.0';
const OSM_REFERER = process.env.APP_URL || '';
const OSM_TIMEOUT = Math.min(parseInt(process.env.OSM_PROXY_TIMEOUT_MS) || 15000, 25000);

export const config = {
  maxDuration: 30,
};

/**
 * Lee y parsea el body del request con timeout de 3s.
 */
function readBody(req) {
  if (req.body) return Promise.resolve(req.body);

  return new Promise((resolve, reject) => {
    const chunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('readBody timeout'));
      }
    }, 3000);

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

/**
 * Intenta un solo mirror de Overpass.
 */
function tryMirror(mirror, encoded, userAgent, referer, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  return fetch(mirror, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
      'Referer': referer,
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
}

/**
 * Lanza todos los mirrors en paralelo y usa el primero que responda.
 * Si Promise.any no está disponible, usa fallback secuencial.
 */
function raceMirrors(mirrors, encoded, userAgent, referer, timeout) {
  const attempts = mirrors.map((m) => tryMirror(m, encoded, userAgent, referer, timeout));

  if (typeof Promise.any === 'function') {
    return Promise.any(attempts);
  }

  // Fallback secuencial para runtimes sin Promise.any
  return attempts.reduce(
    (prev, attempt) =>
      prev.catch(() => attempt),
    Promise.reject(new Error('no mirrors attempted'))
  );
}

export default async function handler(req, res) {
  try {
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

    const json = await raceMirrors(
      OVERPASS_MIRRORS,
      encoded,
      OSM_USER_AGENT,
      OSM_REFERER,
      OSM_TIMEOUT
    );

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(json);
  } catch (err) {
    console.error('[osm-proxy] Error:', err.message);
    const detail = err.errors
      ? err.errors.map((e) => e.message).join(' | ')
      : err.message;
    return res.status(502).json({ error: 'Todos los mirrors de Overpass fallaron', detail });
  }
}
