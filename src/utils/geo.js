// ── HELPERS GEO ──────────────────────────────────────────────
export function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function lineLength(coords) {
  let t = 0;
  for (let i = 0; i < coords.length - 1; i++)
    t += haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  return t;
}

export function polygonArea(coords) {
  // Shoelace in local meters
  if (coords.length < 3) return 0;
  const cLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const mLat = 111320, mLng = 111320 * Math.cos(cLat * Math.PI / 180);
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    area += (coords[j][0] * mLng + coords[i][0] * mLng) * (coords[j][1] * mLat - coords[i][1] * mLat);
  }
  return Math.abs(area / 2);
}

export function polygonPerimeter(coords) { return lineLength(coords); }

// Bounding box dims of a polygon (lat/lon → meters)
export function polygonBBox(coords) {
  const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
  const cLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const mLng = 111320 * Math.cos(cLat * Math.PI / 180), mLat = 111320;
  const w = (Math.max(...lngs) - Math.min(...lngs)) * mLng;
  const h = (Math.max(...lats) - Math.min(...lats)) * mLat;
  return { width: w, length: h };
}

// Rotated rectangle polygon from center + dims + bearing
export function buildingPolygon(cLng, cLat, widthM, lengthM, rotDeg) {
  const r = Math.PI / 180;
  // Half-dimensions in local offset meters
  const hw = widthM / 2;
  const hl = lengthM / 2;
  const a = rotDeg * r, cos = Math.cos(a), sin = Math.sin(a);
  // Unrotated corners in meters (origin at 0,0)
  const raw = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
  // Factors to convert meters back to degrees at this latitude
  const mLat = 111320;
  const mLng = 111320 * Math.cos(cLat * r);

  const pts = raw.map(([x, y]) => {
    // 1. Rotate in meters space
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    // 2. Convert to geographic degrees
    return [cLng + (rx / mLng), cLat + (ry / mLat)];
  });
  pts.push(pts[0]);
  return pts;
}

// Catmull-Rom spline smoothing
export function catmullRom(pts, steps = 10) {
  if (pts.length < 2) return pts;
  const ext = [pts[0], ...pts, pts[pts.length - 1]];
  const result = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    for (let t = 0; t < steps; t++) {
      const tt = t / steps, t2 = tt * tt, t3 = t2 * tt;
      result.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * tt + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * tt + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// Catmull-Rom closed spline smoothing
export function catmullRomClosed(pts, steps = 10) {
  if (pts.length < 3) return [...pts, pts[0]];
  const ext = [pts[pts.length - 1], ...pts, pts[0], pts[1]];
  const result = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    for (let t = 0; t < steps; t++) {
      const tt = t / steps, t2 = tt * tt, t3 = t2 * tt;
      result.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * tt + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * tt + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  result.push(result[0]); // Explicitly close it
  return result;
}

// Format helpers
export function fmtLen(m) {
  if (m == null || isNaN(m)) return '—';
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return (Math.round(m * 10) / 10).toLocaleString() + ' m';
}

export function fmtArea(m2) {
  if (m2 == null || isNaN(m2)) return '—';
  if (m2 >= 10000) return (m2 / 10000).toFixed(2) + ' ha';
  return (Math.round(m2 * 10) / 10).toLocaleString() + ' m²';
}

export function fmtVol(m3) {
  if (m3 == null || isNaN(m3)) return '—';
  return (Math.round(m3 * 10) / 10).toLocaleString() + ' m³';
}
