/* =============================================================
   ROADS MODEL — Generación y reconstrucción de geometría vial.
   Extraído de ui/properties.js para separar lógica de negocio de la UI.
   ============================================================= */
import { catmullRom, lineLength } from '../utils/geo.js';

/**
 * Reconstruye la geometría de una feature de tipo línea (road, path, sidewalk, railway)
 * a partir de sus raw_pts y la configuración de curvas.
 * 
 * @param {Object} feature — La feature GeoJSON completa.
 * @param {Object} [overrides] — Propiedades opcionales a sobreescribir.
 * @param {number} [overrides.widthM] — Nuevo ancho en metros.
 * @param {number} [overrides.lanes] — Nuevo número de carriles.
 * @param {boolean} [overrides.curved] — Si aplicar suavizado Catmull-Rom.
 * @returns {Object} feature — La misma feature mutada con la geometría recalculada.
 */
export function rebuildLineGeometry(feature, overrides = {}) {
  const f = feature;
  if (!f || !f.properties.raw_pts) return f;

  if (overrides.widthM !== undefined) f.properties.widthM = overrides.widthM;
  if (overrides.lanes !== undefined) f.properties.lanes = overrides.lanes;
  if (overrides.curved !== undefined) f.properties.curved = overrides.curved;

  f.geometry.coordinates = f.properties.curved && f.properties.raw_pts.length > 2
    ? catmullRom(f.properties.raw_pts)
    : [...f.properties.raw_pts];
  f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));

  return f;
}
