const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

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

  const query = req.body?.data;
  if (!query) {
    return res.status(400).json({ error: 'Missing "data" field' });
  }

  let lastError;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const overpassRes = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (overpassRes.status === 429 || overpassRes.status === 504) {
        lastError = `Overpass ${overpassRes.status} from ${mirror}`;
        continue;
      }

      if (!overpassRes.ok) {
        return res.status(overpassRes.status).json({
          error: `Overpass responded ${overpassRes.status}`,
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
