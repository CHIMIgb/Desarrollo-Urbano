import { state } from '../config/state.js';
import { EventBus, Events } from '../config/events.js';
import { undo, redo, emitToast } from '../config/store.js';
import { clearDrawing } from '../tools/drawing.js';
import { createNewProject, listUserProjects, loadProjectById } from './io.js';
import { importOSMContext } from '../tools/osm.js';
import { notify, confirmDialog } from './notifications.js';
import { escapeHTML } from '../utils/sanitize.js';
import { trapFocus, releaseFocus } from '../utils/focusTrap.js';
import { requireAuth } from './auth.js';

// Re-exportar para compatibilidad con módulos que importan { toast } de aquí
export const toast = notify;

// Exponer toast globalmente para globalErrors.js
window.__toastFromToolbar = notify;

// La función updateStats ha sido consolidada en stats.js (updateGlobalStats)
export function setTool(tool) {
  state.tool = tool;
  clearDrawing();
  document.querySelectorAll('.tool-btn').forEach((b) => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  const activeBtn = document.querySelector(`[data-tool="${tool}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.setAttribute('aria-pressed', 'true');
  }

  ['treeOptionsBar', 'furnitureOptionsBar'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const barMap = {
    tree: 'treeOptionsBar',
    furniture: 'furnitureOptionsBar',
  };

  const targetBarId = barMap[tool];
  const targetBar = document.getElementById(targetBarId);
  if (targetBar) targetBar.classList.remove('hidden');

  if (state.map) {
    state.map.getCanvas().style.cursor =
      tool === 'select' || tool === 'move' || tool === 'delete' ? '' : 'crosshair';
  }
}

export function initToolbarEvents() {
  document.getElementById('terrainExaggeration')?.addEventListener('input', function () {
    const v = parseFloat(this.value);
    document.getElementById('terrainExVal').textContent = v.toFixed(1) + 'x';
    if (state.map) state.map.setTerrain({ source: 'terrain', exaggeration: v });
  });

  document.getElementById('cameraPitch')?.addEventListener('input', function () {
    const v = parseInt(this.value);
    document.getElementById('cameraPitchVal').textContent = v + '°';
    if (state.map) state.map.setPitch(v);
  });

  document.getElementById('cameraBearing')?.addEventListener('input', function () {
    const v = parseInt(this.value);
    document.getElementById('cameraBearingVal').textContent = v + '°';
    if (state.map) state.map.setBearing(v);
  });

  document.getElementById('furnitureRot')?.addEventListener('input', function () {
    const v = parseInt(this.value);
    document.getElementById('furnitureRotVal').textContent = v + '°';
  });

  document.getElementById('layersList')?.addEventListener('change', updateLayersVisibility);

  document.querySelectorAll('.tool-btn[data-tool]').forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  document.getElementById('btnUndo')?.addEventListener('click', () => {
    if (undo()) {
      import('../map/core.js').then((m) => m.refreshMap());
      toast('Acción revertida', 'info');
    }
  });

  document.getElementById('btnRedo')?.addEventListener('click', () => {
    if (redo()) {
      import('../map/core.js').then((m) => m.refreshMap());
      toast('Acción re-aplicada', 'info');
    }
  });

  document.getElementById('tool-3d')?.addEventListener('click', () => {
    if (!state.map) return;
    const is3D = state.map.getPitch() > 10;
    state.map.easeTo({
      pitch: is3D ? 0 : 65,
      duration: 1000,
    });
    toast(is3D ? 'Proyección 2D activada' : 'Proyección 3D activada', 'info');
  });

  document.getElementById('tool-satellite')?.addEventListener('click', () => {
    state.isSatellite = !state.isSatellite;
    if (state.map) {
      import('../map/core.js').then((m) => state.map.setStyle(m.buildStyle(), { diff: false }));
    }
    toast(state.isSatellite ? 'Capa satelital activa' : 'Capa cartográfica activa', 'info');
  });

  document.getElementById('tool-terrain-toggle')?.addEventListener('click', () => {
    if (!state.map) return;
    const terrainExSlider = document.getElementById('terrainExaggeration');
    // state.terrainEnabled: undefined/true = activo, false = inactivo
    if (state.terrainEnabled === false) {
      // Activar relieve
      import('../map/core.js').then((m) => m.addTerrainSource());
      state.terrainEnabled = true;
      document.getElementById('tool-terrain-toggle')?.classList.add('active');
      if (terrainExSlider) terrainExSlider.disabled = false;
      toast('Modelo de elevación activado', 'info');
    } else {
      // Desactivar relieve
      state.map.setTerrain(null);
      state.terrainEnabled = false;
      document.getElementById('tool-terrain-toggle')?.classList.remove('active');
      if (terrainExSlider) terrainExSlider.disabled = true;
      toast('Modelo de elevación desactivado', 'info');
    }
  });

  // Panel derecho colapsable
  document.getElementById('panelToggleBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('propsPanel');
    if (!panel) return;
    const isCollapsed = panel.classList.toggle('collapsed');
    const btn = document.getElementById('panelToggleBtn');
    if (btn) {
      btn.title = isCollapsed ? 'Expandir panel' : 'Colapsar panel';
      btn.setAttribute(
        'aria-label',
        isCollapsed ? 'Expandir panel de propiedades' : 'Colapsar panel de propiedades'
      );
    }
    // Redimensionar mapa después de la transición
    setTimeout(() => {
      state.map?.resize();
    }, 350);
  });

  // Panel resize handle — drag para redimensionar
  const resizeHandle = document.getElementById('panelResizeHandle');
  const panel = document.getElementById('propsPanel');
  if (resizeHandle && panel) {
    let startX, startW;
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      startX = e.clientX;
      startW = panel.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const dx = startX - ev.clientX;
        const newW = Math.min(Math.max(startW + dx, 220), 450);
        panel.style.width = newW + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        state.map?.resize();
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // Zoom-to-fit: ajustar vista a todas las features
  document.getElementById('tool-fit-all')?.addEventListener('click', () => {
    if (!state.map || state.features.length === 0) {
      toast('No hay elementos en el proyecto', 'info');
      return;
    }
    const coords = [];
    state.features.forEach((f) => {
      const g = f.geometry;
      if (g.type === 'Point') coords.push(g.coordinates);
      else if (g.type === 'LineString') coords.push(...g.coordinates);
      else if (g.type === 'Polygon') coords.push(...g.coordinates[0]);
    });
    if (coords.length === 0) return;
    const bounds = coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    state.map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 18 });
    toast('Vista ajustada al proyecto', 'info');
  });

  document.getElementById('btnNew')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog(
      'Crear nuevo proyecto urbanístico',
      'Se descartarán los cambios no sincronizados.'
    );
    if (confirmed) {
      createNewProject();
    }
  });

  document.getElementById('btnOpenProjects')?.addEventListener('click', async () => {
    try {
      await requireAuth();
    } catch {
      return;
    }
    const modal = document.getElementById('projectsModal');
    if (modal) {
      modal.classList.remove('hidden');
      trapFocus(modal);
      const list = document.getElementById('projectsList');
      if (list) {
        list.innerHTML = '<p class="loading-text">Cargando proyectos...</p>';
        const projects = await listUserProjects();
        renderProjectsList(projects);
      }
    }
  });

  document.getElementById('btnImportOSM')?.addEventListener('click', () => {
    importOSMContext();
  });

  const btnCloseModal = document.getElementById('btnCloseProjectsModal');
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', () => {
      document.getElementById('projectsModal').classList.add('hidden');
      releaseFocus();
    });
  }
}

function renderProjectsList(projects) {
  const list = document.getElementById('projectsList');
  if (!list) return;

  if (projects.length === 0) {
    list.innerHTML = '<p class="empty-text">Sin proyectos en la nube. Crea uno nuevo.</p>';
    return;
  }

  list.innerHTML = '';
  projects.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'project-item';
    const date = new Date(p.updated_at).toLocaleDateString();

    item.innerHTML = `
      <div class="project-info">
        <div class="project-name-item">${escapeHTML(p.name)}</div>
        <div class="project-date-item">Actualizado: ${date}</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-id="${p.id}">Cargar</button>
    `;

    item.querySelector('button').addEventListener('click', () => {
      loadProjectById(p.id);
      document.getElementById('projectsModal').classList.add('hidden');
    });

    list.appendChild(item);
  });
}

function updateLayersVisibility() {
  if (!state.map) return;
  const getVis = (id) => {
    const el = document.querySelector(`input[data-layer="${id}"]`);
    if (el) {
      el.setAttribute('aria-checked', el.checked ? 'true' : 'false');
      return el.checked;
    }
    return true;
  };

  const t = {
    house: getVis('house'),
    building: getVis('building'),
    custom_building: getVis('custom_building'),
    road: getVis('road'),
    park: getVis('park'),
    zone: getVis('zone'),
    terrain: getVis('terrain'),
    water: getVis('water'),
    tree: getVis('tree'),
    railway: getVis('railway'),
    radius: getVis('radius'),
    furniture: getVis('furniture'),
    path: getVis('path'),
    sidewalk: getVis('sidewalk'),
  };

  const bldTypes = [];
  if (t.house) bldTypes.push('house');
  if (t.building) bldTypes.push('building');
  if (t.custom_building) bldTypes.push('custom_building');

  ['layer-buildings', 'layer-buildings-outline'].forEach((id) => {
    if (state.map.getLayer(id)) {
      if (bldTypes.length === 0) state.map.setLayoutProperty(id, 'visibility', 'none');
      else {
        state.map.setLayoutProperty(id, 'visibility', 'visible');
        state.map.setFilter(id, ['match', ['get', 'type'], bldTypes, true, false]);
      }
    }
  });

  const znTypes = [];
  ['park', 'zone', 'terrain', 'water', 'radius'].forEach((type) => {
    if (t[type]) znTypes.push(type);
  });

  ['layer-zones-fill', 'layer-zones-line'].forEach((id) => {
    if (state.map.getLayer(id)) {
      if (znTypes.length === 0) state.map.setLayoutProperty(id, 'visibility', 'none');
      else {
        state.map.setLayoutProperty(id, 'visibility', 'visible');
        state.map.setFilter(id, ['match', ['get', 'type'], znTypes, true, false]);
      }
    }
  });

  if (state.map.getLayer('layer-furniture'))
    state.map.setLayoutProperty('layer-furniture', 'visibility', t.furniture ? 'visible' : 'none');
  if (state.map.getLayer('layer-trees-3d'))
    state.map.setLayoutProperty('layer-trees-3d', 'visibility', t.tree ? 'visible' : 'none');

  const rVis = t.road ? 'visible' : 'none';
  if (state.map.getLayer('layer-roads'))
    state.map.setLayoutProperty('layer-roads', 'visibility', rVis);
  for (let i = 1; i <= 9; i++) {
    if (state.map.getLayer(`layer-roads-div-${i}`))
      state.map.setLayoutProperty(`layer-roads-div-${i}`, 'visibility', rVis);
  }

  const pVis = t.path ? 'visible' : t.sidewalk ? 'visible' : 'none';
  if (state.map.getLayer('layer-paths')) {
    state.map.setLayoutProperty(
      'layer-paths',
      'visibility',
      t.path || t.sidewalk ? 'visible' : 'none'
    );
    state.map.setFilter('layer-paths', [
      'match',
      ['get', 'type'],
      [t.path ? 'path' : '', t.sidewalk ? 'sidewalk' : ''].filter((x) => x),
      true,
      false,
    ]);
  }

  const railVis = t.railway ? 'visible' : 'none';
  if (state.map.getLayer('layer-railways'))
    state.map.setLayoutProperty('layer-railways', 'visibility', railVis);
  if (state.map.getLayer('layer-railways-dash'))
    state.map.setLayoutProperty('layer-railways-dash', 'visibility', railVis);
}

// ── Suscripciones al EventBus ──────────────────────────────────
// Estos listeners permiten que map/core.js emita eventos sin conocer este módulo.

EventBus.on(Events.TOAST, ({ msg, type }) => toast(msg, type));

EventBus.on(Events.STATS_UPDATE, () => {
  // Ahora stats.js es la única fuente de verdad para todas las estadísticas (incluyendo los contadores simples)
  import('./stats.js').then((m) => m.updateGlobalStats());
});

// ── Dirty State + Undo/Redo Disabled ──────────────────────────
let _isDirty = false;
const _originalTitle = document.title;

export function markDirty() {
  if (_isDirty) return;
  _isDirty = true;
  document.title = '• ' + _originalTitle;
  document.getElementById('projectName')?.classList.add('dirty');
}

export function markClean() {
  _isDirty = false;
  document.title = _originalTitle;
  document.getElementById('projectName')?.classList.remove('dirty');
}

export function isDirty() {
  return _isDirty;
}

function updateUndoRedoState() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  if (btnUndo) {
    const canUndo = state.history.length > 1;
    btnUndo.disabled = !canUndo;
    btnUndo.classList.toggle('disabled', !canUndo);
  }
  if (btnRedo) {
    const canRedo = state.future.length > 0;
    btnRedo.disabled = !canRedo;
    btnRedo.classList.toggle('disabled', !canRedo);
  }
}

// Marcar dirty cuando cambian las features
EventBus.on(Events.FEATURES_UPDATED, () => {
  markDirty();
  updateUndoRedoState();
});

// Actualizar undo/redo al inicio
EventBus.on(Events.MAP_READY, () => {
  updateUndoRedoState();
});

// beforeunload — advertir si hay cambios sin guardar
window.addEventListener('beforeunload', (e) => {
  if (_isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Exponer para que io.js pueda limpiar el dirty state
export { markClean as _markClean };
