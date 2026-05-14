/* =============================================================
   ZONES MODEL — Reconstrucción de geometría poligonal para zonas.
   Extraído de ui/properties.js para separar lógica de negocio de la UI.
   ============================================================= */
import { catmullRomClosed, polygonArea, polygonPerimeter } from '../utils/geo.js';

/**
 * Reconstruye la geometría de una feature poligonal (park, zone, terrain, water, custom_building)
 * a partir de sus raw_pts y la configuración de curvas/profundidad.
 * 
 * @param {Object} feature — La feature GeoJSON completa.
 * @param {Object} [overrides] — Propiedades opcionales a sobreescribir.
 * @param {boolean} [overrides.curved] — Si aplicar suavizado Catmull-Rom cerrado.
 * @param {number} [overrides.depth_m] — Profundidad para cuerpos de agua.
 * @returns {Object} feature — La misma feature mutada con la geometría recalculada.
 */
export function rebuildPolygonGeometry(feature, overrides = {}) {
  const f = feature;
  if (!f || !f.properties.raw_pts) return f;

  if (overrides.curved !== undefined) f.properties.curved = overrides.curved;

  const coords = f.properties.curved && f.properties.raw_pts.length > 2
    ? catmullRomClosed(f.properties.raw_pts)
    : [...f.properties.raw_pts, f.properties.raw_pts[0]];

  f.geometry.coordinates = [coords];
  f.properties.area_m2 = Math.round(polygonArea(coords));
  f.properties.perimeter_m = Math.round(polygonPerimeter(coords));

  // Recalcular volumen para cuerpos de agua
  if (f.properties.type === 'water') {
    if (overrides.depth_m !== undefined) f.properties.depth_m = overrides.depth_m;
    f.properties.volume_m3 = Math.round(f.properties.area_m2 * (f.properties.depth_m || 2));
  }

  return f;
}

/**
 * Reconstruye la geometría de una isócrona circular (radius).
 * 
 * @param {Object} feature — La feature GeoJSON.
 * @param {Object} center — Centro { lng, lat }.
 * @param {number} radius_m — Radio en metros.
 * @returns {Object} feature — Feature mutada.
 */
export function rebuildRadiusGeometry(feature, center, radius_m) {
  const f = feature;
  if (!f || !center) return f;

  f.properties.radius_m = radius_m;
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const ang = (i / 32) * Math.PI * 2;
    const dlat = (radius_m * Math.cos(ang)) / 111320;
    const dlng = (radius_m * Math.sin(ang)) / (40075000 * Math.cos(center.lat * Math.PI / 180) / 360);
    pts.push([center.lng + dlng, center.lat + dlat]);
  }
  f.geometry.coordinates = [pts];
  f.properties.raw_pts = [...pts];
  f.properties.area_m2 = Math.round(Math.PI * radius_m * radius_m);

  return f;
}
