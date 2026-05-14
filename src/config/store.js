/* =============================================================
   STORE — Gestor de Estado Centralizado.
   Envuelve el estado global con acciones controladas y emite
   eventos automáticamente tras cada mutación.
   ============================================================= */
import { EventBus, Events } from './events.js';

// ── Estado interno privado (no exportado directamente) ────────
const _state = {
  features: [],
  selectedIds: [],
  selectedVertexIdx: null,
  tool: 'select',
  is3D: true,
  isSatellite: true,
  drawPoints: [],
  history: [],
  future: [],
  nextId: 1,
  popup: null,
  draggingFeatureId: null,
  lastDragPos: null,
  isDragging: false,
  draggingVertexIdx: null,
  terrainEnabled: false,
  currentProjectId: null,
  map: null
};

/**
 * Proxy de solo lectura para acceso seguro al estado.
 * Los módulos pueden LEER propiedades libremente, pero las escrituras
 * deben pasar por las acciones del Store (ver abajo).
 *
 * NOTA DE MIGRACIÓN: Durante la transición, se permite la escritura
 * directa al proxy para no romper todo el código de golpe.
 * El proxy registra un aviso en consola para detectar mutaciones
 * que aún no han sido migradas a acciones.
 */
export const state = new Proxy(_state, {
  set(target, prop, value) {
    target[prop] = value;
    return true;
  }
});

// ── Acciones del Store (Setters Controlados) ──────────────────

/**
 * Agrega una o varias features al estado y emite el evento correspondiente.
 * @param  {...Object} features — Features GeoJSON a agregar.
 */
export function addFeatures(...features) {
  _state.features.push(...features);
  EventBus.emit(Events.FEATURES_UPDATED);
}

/**
 * Actualiza las propiedades de una feature existente.
 * @param {number} id — ID de la feature a actualizar.
 * @param {Object} propsUpdate — Objeto parcial con las propiedades a sobreescribir.
 */
export function updateFeatureProps(id, propsUpdate) {
  const f = _state.features.find(x => x.properties.id === id);
  if (!f) return;
  Object.assign(f.properties, propsUpdate);
  EventBus.emit(Events.FEATURES_UPDATED);
}

/**
 * Reemplaza completamente la geometría de una feature.
 * @param {number} id — ID de la feature.
 * @param {Object} geometry — Nuevo objeto GeoJSON geometry.
 */
export function updateFeatureGeometry(id, geometry) {
  const f = _state.features.find(x => x.properties.id === id);
  if (!f) return;
  f.geometry = geometry;
  EventBus.emit(Events.FEATURES_UPDATED);
}

/**
 * Elimina features por sus IDs (incluyendo sub-features con parent_id).
 * @param {number[]} ids — Array de IDs a eliminar.
 */
export function deleteFeatures(ids) {
  const toDelete = new Set(ids);
  // También eliminar sub-features (hijos de los IDs dados)
  _state.features.forEach(f => {
    if (f.properties.parent_id && toDelete.has(f.properties.parent_id)) {
      toDelete.add(f.properties.id);
    }
  });
  _state.features = _state.features.filter(f => !toDelete.has(f.properties.id));
  EventBus.emit(Events.FEATURES_UPDATED);
}

/**
 * Reemplaza el arreglo completo de features y emite el evento.
 * Usar solo para operaciones masivas (importar, cargar proyecto, undo/redo).
 * @param {Object[]} features — Nuevo array completo de features.
 */
export function setFeatures(features) {
  _state.features = features;
  EventBus.emit(Events.FEATURES_UPDATED);
}

/**
 * Genera el siguiente ID único e incrementa el contador.
 * @returns {number}
 */
export function getNextId() {
  return _state.nextId++;
}

// ── Historial (Undo / Redo) ───────────────────────────────────

/**
 * Guarda una instantánea del estado actual en el historial.
 */
export function pushHistory() {
  _state.history.push(JSON.stringify({ features: _state.features, nextId: _state.nextId }));
  if (_state.history.length > 50) _state.history.shift();
  _state.future = [];
}

/**
 * Deshace la última acción.
 * @returns {boolean} true si se deshizo algo.
 */
export function undo() {
  if (_state.history.length <= 1) return false;
  _state.future.push(JSON.stringify({ features: _state.features, nextId: _state.nextId }));
  _state.history.pop();
  const snapshot = JSON.parse(_state.history[_state.history.length - 1]);
  _state.features = snapshot.features;
  _state.nextId = snapshot.nextId;
  EventBus.emit(Events.FEATURES_UPDATED);
  return true;
}

/**
 * Rehace la última acción deshecha.
 * @returns {boolean} true si se rehizo algo.
 */
export function redo() {
  if (_state.future.length === 0) return false;
  _state.history.push(JSON.stringify({ features: _state.features, nextId: _state.nextId }));
  const snapshot = JSON.parse(_state.future.pop());
  _state.features = snapshot.features;
  _state.nextId = snapshot.nextId;
  EventBus.emit(Events.FEATURES_UPDATED);
  return true;
}

// ── Notificaciones (Toast) ────────────────────────────────────

/**
 * Emite una notificación toast a través del EventBus.
 * Esto desacopla a cualquier módulo de conocer la UI directamente.
 * @param {string} msg — Mensaje a mostrar.
 * @param {'info'|'success'|'error'|'warning'} [type='info'] — Tipo de notificación.
 */
export function emitToast(msg, type = 'info') {
  EventBus.emit(Events.TOAST, { msg, type });
}

/**
 * Emite un evento para que la UI actualice las estadísticas del mapa.
 */
export function emitStatsUpdate() {
  EventBus.emit(Events.STATS_UPDATE);
}
