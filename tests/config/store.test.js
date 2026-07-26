import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  state,
  addFeatures,
  updateFeatureProps,
  updateFeatureGeometry,
  deleteFeatures,
  setFeatures,
  getNextId,
  pushHistory,
  undo,
  redo,
} from '../../src/config/store.js';
import { EventBus, Events } from '../../src/config/events.js';

describe('Store', () => {
  beforeEach(() => {
    state.features = [];
    state.history = [];
    state.future = [];
    state.nextId = 1;
    state.selectedIds = [];
    EventBus._listeners.clear();
  });

  describe('addFeatures()', () => {
    it('debería agregar features al estado', () => {
      const f = { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } };
      addFeatures(f);

      expect(state.features).toHaveLength(1);
      expect(state.features[0].properties.id).toBe(1);
    });

    it('debería emitir FEATURES_UPDATED', () => {
      const handler = vi.fn();
      EventBus.on(Events.FEATURES_UPDATED, handler);
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });

      expect(handler).toHaveBeenCalledOnce();
    });

    it('debería agregar múltiples features de una vez', () => {
      addFeatures(
        { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', properties: { id: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } }
      );

      expect(state.features).toHaveLength(2);
    });
  });

  describe('updateFeatureProps()', () => {
    it('debería actualizar propiedades de una feature existente', () => {
      addFeatures({ type: 'Feature', properties: { id: 1, name: 'old' }, geometry: { type: 'Point', coordinates: [0, 0] } });
      updateFeatureProps(1, { name: 'new' });

      expect(state.features[0].properties.name).toBe('new');
    });

    it('debería ignorar IDs inexistentes', () => {
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });
      updateFeatureProps(999, { name: 'x' });

      expect(state.features[0].properties.name).toBeUndefined();
    });
  });

  describe('deleteFeatures()', () => {
    it('debería eliminar features por ID', () => {
      addFeatures(
        { type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', properties: { id: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } }
      );
      deleteFeatures([1]);

      expect(state.features).toHaveLength(1);
      expect(state.features[0].properties.id).toBe(2);
    });

    it('debería eliminar sub-features (parent_id)', () => {
      addFeatures(
        { type: 'Feature', properties: { id: 1, type: 'building' }, geometry: { type: 'Point', coordinates: [0, 0] } },
        { type: 'Feature', properties: { id: 2, parent_id: 1, type: 'window' }, geometry: { type: 'Point', coordinates: [0, 0] } }
      );
      deleteFeatures([1]);

      expect(state.features).toHaveLength(0);
    });
  });

  describe('setFeatures()', () => {
    it('debería reemplazar todas las features', () => {
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });
      setFeatures([{ type: 'Feature', properties: { id: 99 }, geometry: { type: 'Point', coordinates: [5, 5] } }]);

      expect(state.features).toHaveLength(1);
      expect(state.features[0].properties.id).toBe(99);
    });
  });

  describe('getNextId()', () => {
    it('debería devolver IDs incrementales', () => {
      expect(getNextId()).toBe(1);
      expect(getNextId()).toBe(2);
      expect(getNextId()).toBe(3);
    });
  });

  describe('Undo / Redo', () => {
    it('pushHistory debería guardar snapshot y limpiar future', () => {
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });
      pushHistory();
      addFeatures({ type: 'Feature', properties: { id: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } });

      expect(state.history).toHaveLength(1);
      expect(state.future).toHaveLength(0);
    });

    it('undo debería restaurar el snapshot anterior', () => {
      pushHistory(); // snapshot: []
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });
      pushHistory(); // snapshot: [id:1]
      addFeatures({ type: 'Feature', properties: { id: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } });
      pushHistory(); // snapshot: [id:1, id:2]
      addFeatures({ type: 'Feature', properties: { id: 3 }, geometry: { type: 'Point', coordinates: [2, 2] } });

      // undo pop+restore: pops last entry, restores from the one before it
      const result = undo();
      expect(result).toBe(true);
      expect(state.features).toHaveLength(1);
      expect(state.features[0].properties.id).toBe(1);
    });

    it('undo debería devolver false si no hay historial', () => {
      expect(undo()).toBe(false);
    });

    it('redo debería restaurar el snapshot deshecho', () => {
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });
      pushHistory(); // snapshot: [id:1]
      addFeatures({ type: 'Feature', properties: { id: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } });
      pushHistory(); // snapshot: [id:1, id:2]
      addFeatures({ type: 'Feature', properties: { id: 3 }, geometry: { type: 'Point', coordinates: [2, 2] } });
      undo(); // restore [id:1, id:2], future has [id:1,id:2,id:3]

      const result = redo();
      expect(result).toBe(true);
      expect(state.features).toHaveLength(3);
    });

    it('redo debería devolver false si no hay future', () => {
      expect(redo()).toBe(false);
    });

    it('nuevos pushHistory deberían limpiar el future', () => {
      addFeatures({ type: 'Feature', properties: { id: 1 }, geometry: { type: 'Point', coordinates: [0, 0] } });
      pushHistory(); // snapshot: [id:1]
      addFeatures({ type: 'Feature', properties: { id: 2 }, geometry: { type: 'Point', coordinates: [1, 1] } });
      pushHistory(); // snapshot: [id:1, id:2]
      addFeatures({ type: 'Feature', properties: { id: 3 }, geometry: { type: 'Point', coordinates: [2, 2] } });
      undo(); // restore [id:1, id:2], future has entry
      expect(state.future).toHaveLength(1);

      addFeatures({ type: 'Feature', properties: { id: 4 }, geometry: { type: 'Point', coordinates: [3, 3] } });
      pushHistory(); // clears future
      expect(state.future).toHaveLength(0);
    });

    it('debería limitar el historial a 50 entradas', () => {
      for (let i = 0; i < 55; i++) {
        pushHistory();
        addFeatures({ type: 'Feature', properties: { id: i }, geometry: { type: 'Point', coordinates: [0, 0] } });
      }

      expect(state.history.length).toBeLessThanOrEqual(50);
    });
  });
});
