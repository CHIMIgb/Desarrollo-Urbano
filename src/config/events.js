/* =============================================================
   EVENT BUS — Sistema Pub/Sub para desacoplar módulos.
   Elimina dependencias circulares entre map/ y ui/.
   ============================================================= */

import { logger } from '../utils/logger.js';

/**
 * Catálogo de eventos estándar del sistema.
 * Usar estas constantes en lugar de strings sueltos para evitar typos.
 */
export const Events = {
  // ── Mapa ────────────────────────────────────────────────
  MAP_READY:            'map:ready',
  MAP_REFRESHED:        'map:refreshed',

  // ── Estado ──────────────────────────────────────────────
  STATE_CHANGED:        'state:changed',
  FEATURES_UPDATED:     'state:features_updated',

  // ── Notificaciones ──────────────────────────────────────
  TOAST:                'ui:toast',

  // ── Estadísticas ────────────────────────────────────────
  STATS_UPDATE:         'ui:stats_update',
};

/**
 * Bus de eventos ligero basado en un mapa de listeners.
 * API mínima: on(), off(), emit().
 */
class EventBusImpl {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Suscribirse a un evento.
   * @param {string} event — Nombre del evento (usar constantes de `Events`).
   * @param {Function} handler — Callback que recibe el payload.
   * @returns {Function} Función para desuscribirse (útil para cleanup).
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);

    // Devolver función de desuscripción
    return () => this.off(event, handler);
  }

  /**
   * Desuscribirse de un evento.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const set = this._listeners.get(event);
    if (set) set.delete(handler);
  }

  /**
   * Emitir un evento con datos opcionales.
   * @param {string} event — Nombre del evento.
   * @param {*} [payload] — Datos que reciben los listeners.
   */
  emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        logger.error(`[EventBus] Error en handler de "${event}":`, err);
      }
    }
  }
}

/** Instancia singleton global del bus de eventos. */
export const EventBus = new EventBusImpl();
