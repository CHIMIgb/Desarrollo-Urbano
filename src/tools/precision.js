/* =============================================================
   PRECISION ENGINE — Edición de Grado de Ingeniería
   Cálculos de transformación precisa para vértices y features.
   ============================================================= */
import { state } from '../config/state.js';
import { haversine, getFeatureCenter } from '../utils/geo.js';
import {
  catmullRom,
  catmullRomClosed,
  lineLength,
  polygonArea,
  polygonPerimeter,
} from '../utils/geo.js';
import { refreshMap } from '../map/core.js';
import { pushHistory, translateFeature } from './interaction.js';
import { updateEditHandles } from './selection.js';

// ── Conversión de Coordenadas ─────────────────────────────────

/**
 * Convierte un desplazamiento en metros (dx=Este, dy=Norte) a grados geográficos
 * en la latitud dada. Precisión válida hasta ~100km de desplazamiento.
 */
function metersToDegreesAtLat(dxMeters, dyMeters, lat) {
  const mLat = 111320;
  const mLng = 111320 * Math.cos((lat * Math.PI) / 180);
  return { dlng: dxMeters / mLng, dlat: dyMeters / mLat };
}

/**
 * Convierte coordenadas polares (distancia + rumbo) a cartesianas en metros.
 * Convención de rumbo: 0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste.
 */
function polarToCartesian(distanceM, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  return {
    dx: distanceM * Math.sin(rad),
    dy: distanceM * Math.cos(rad),
  };
}

/**
 * Calcula el rumbo (bearing) entre dos puntos geográficos.
 * @returns {number} Grados de 0 a 360 (0° = Norte, 90° = Este)
 */
export function bearingBetween(lng1, lat1, lng2, lat2) {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1R = (lat1 * Math.PI) / 180;
  const lat2R = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ── Recalcular Geometría ──────────────────────────────────────

/**
 * Reconstruye geometry.coordinates a partir de raw_pts (igual que interaction.js).
 * Recalcula métricas derivadas (longitud, área, perímetro).
 */
export function recalculateGeometry(f) {
  if (!f || !f.properties.raw_pts) return;

  if (['road', 'path', 'sidewalk', 'railway'].includes(f.properties.type)) {
    f.geometry.coordinates =
      f.properties.curved && f.properties.raw_pts.length > 2
        ? catmullRom(f.properties.raw_pts)
        : [...f.properties.raw_pts];
    f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));
  } else {
    const curved = f.properties.curved;
    const closed =
      curved && f.properties.raw_pts.length > 2
        ? catmullRomClosed(f.properties.raw_pts)
        : [...f.properties.raw_pts, f.properties.raw_pts[0]];
    f.geometry.coordinates = [closed];
    f.properties.area_m2 = Math.round(polygonArea(closed));
    f.properties.perimeter_m = Math.round(polygonPerimeter(closed));
  }
}

// ── Operaciones sobre Vértices ────────────────────────────────

/**
 * Mueve un vértice de una feature por coordenadas polares (distancia + rumbo).
 * @param {number} featureId — ID de la feature en state.features
 * @param {number} vertexIdx — Índice del vértice en raw_pts
 * @param {number} distanceM — Distancia en metros (ej: 15.5)
 * @param {number} bearingDeg — Ángulo en grados 0°=N, 90°=E (ej: 90)
 * @returns {boolean} true si la operación fue exitosa
 */
export function moveVertexByPolar(featureId, vertexIdx, distanceM, bearingDeg) {
  const f = state.features.find((x) => x.properties.id === featureId);
  if (!f || !f.properties.raw_pts || !f.properties.raw_pts[vertexIdx]) return false;

  pushHistory();
  const currentPos = f.properties.raw_pts[vertexIdx];
  const { dx, dy } = polarToCartesian(distanceM, bearingDeg);
  const { dlng, dlat } = metersToDegreesAtLat(dx, dy, currentPos[1]);

  f.properties.raw_pts[vertexIdx] = [currentPos[0] + dlng, currentPos[1] + dlat];

  recalculateGeometry(f);
  refreshMap();
  updateEditHandles();
  return true;
}

/**
 * Mueve un vértice a una coordenada geográfica exacta.
 * @param {number} featureId — ID de la feature
 * @param {number} vertexIdx — Índice del vértice en raw_pts
 * @param {number} lng — Longitud exacta
 * @param {number} lat — Latitud exacta
 * @returns {boolean} true si la operación fue exitosa
 */
export function moveVertexToCoord(featureId, vertexIdx, lng, lat) {
  const f = state.features.find((x) => x.properties.id === featureId);
  if (!f || !f.properties.raw_pts || !f.properties.raw_pts[vertexIdx]) return false;

  pushHistory();
  f.properties.raw_pts[vertexIdx] = [lng, lat];

  recalculateGeometry(f);
  refreshMap();
  updateEditHandles();
  return true;
}

// ── Operaciones sobre Features Completas ──────────────────────

/**
 * Desplaza un elemento completo por coordenadas polares.
 * Mueve el feature y todos sus sub-features (parent_id).
 * @param {number} featureId — ID de la feature principal
 * @param {number} distanceM — Distancia en metros
 * @param {number} bearingDeg — Ángulo rumbo (0°=N, 90°=E)
 * @returns {boolean} true si la operación fue exitosa
 */
export function moveFeatureByPolar(featureId, distanceM, bearingDeg) {
  const f = state.features.find((x) => x.properties.id === featureId);
  if (!f) return false;

  const center = getFeatureCenter(f);
  if (!center) return false;

  pushHistory();
  const { dx, dy } = polarToCartesian(distanceM, bearingDeg);
  const { dlng, dlat } = metersToDegreesAtLat(dx, dy, center.lat);

  translateFeature(featureId, dlng, dlat);
  refreshMap();
  updateEditHandles();
  return true;
}

/**
 * Mueve un elemento completo a una coordenada exacta (centrando su centroide).
 * @param {number} featureId — ID de la feature principal
 * @param {number} lng — Longitud objetivo
 * @param {number} lat — Latitud objetivo
 * @returns {boolean} true si la operación fue exitosa
 */
export function moveFeatureToCoord(featureId, lng, lat) {
  const f = state.features.find((x) => x.properties.id === featureId);
  if (!f) return false;

  const center = getFeatureCenter(f);
  if (!center) return false;

  pushHistory();
  const dlng = lng - center.lng;
  const dlat = lat - center.lat;

  translateFeature(featureId, dlng, dlat);
  refreshMap();
  updateEditHandles();
  return true;
}

// ── Información de Vértice ────────────────────────────────────

/**
 * Calcula información geométrica detallada de un vértice seleccionado.
 * @param {number} featureId — ID de la feature
 * @param {number} vertexIdx — Índice del vértice
 * @returns {Object|null} { lng, lat, distPrev, distNext, bearingFromPrev, bearingToNext, interiorAngle }
 */
export function getVertexInfo(featureId, vertexIdx) {
  const f = state.features.find((x) => x.properties.id === featureId);
  if (!f || !f.properties.raw_pts) return null;

  const pts = f.properties.raw_pts;
  const n = pts.length;
  if (vertexIdx < 0 || vertexIdx >= n) return null;

  const curr = pts[vertexIdx];
  const isLine = ['road', 'path', 'sidewalk', 'railway'].includes(f.properties.type);

  // Obtener vértices adyacentes (manejo de extremos)
  let prev = null,
    next = null;
  if (vertexIdx > 0) prev = pts[vertexIdx - 1];
  else if (!isLine && n > 2) prev = pts[n - 1]; // Cerrar polígono

  if (vertexIdx < n - 1) next = pts[vertexIdx + 1];
  else if (!isLine && n > 2) next = pts[0]; // Cerrar polígono

  const info = {
    lng: curr[0],
    lat: curr[1],
    distPrev: null,
    distNext: null,
    bearingFromPrev: null,
    bearingToNext: null,
    interiorAngle: null,
  };

  if (prev) {
    info.distPrev = haversine(prev[0], prev[1], curr[0], curr[1]);
    info.bearingFromPrev = bearingBetween(prev[0], prev[1], curr[0], curr[1]);
  }

  if (next) {
    info.distNext = haversine(curr[0], curr[1], next[0], next[1]);
    info.bearingToNext = bearingBetween(curr[0], curr[1], next[0], next[1]);
  }

  // Ángulo interior (ángulo entre los dos segmentos adyacentes)
  if (prev && next) {
    const bearIn = bearingBetween(prev[0], prev[1], curr[0], curr[1]);
    const bearOut = bearingBetween(curr[0], curr[1], next[0], next[1]);
    let angle = bearOut - bearIn;
    if (angle < 0) angle += 360;
    info.interiorAngle = 180 - Math.abs(angle - 180);
  }

  return info;
}
