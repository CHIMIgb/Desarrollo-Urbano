import { state } from '../config/state.js';
import { EventBus, Events } from '../config/events.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from './toolbar.js';
import { markClean, markDirty, isDirty } from './toolbar.js';
import { calculateCurrentMetrics } from './stats.js';
import { getFeatureCenter } from '../utils/geo.js';
import { logger } from '../utils/logger.js';

// ── Autosave ──────────────────────────────────────────────────
let _lastSavedAt = null;
let _autosaveTimer = null;
const AUTOSAVE_DELAY = 30000; // 30 segundos después del último cambio

function updateSaveIndicator() {
  const el = document.getElementById('saveStatus');
  if (!el || !_lastSavedAt) { if (el) el.textContent = ''; return; }
  const diff = Math.floor((Date.now() - _lastSavedAt) / 1000);
  if (diff < 10) el.textContent = 'Guardado';
  else if (diff < 60) el.textContent = `Guardado hace ${diff}s`;
  else el.textContent = `Guardado hace ${Math.floor(diff / 60)} min`;
}

function scheduleAutosave() {
  if (_autosaveTimer) clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => { if (isDirty()) doAutosave(); }, AUTOSAVE_DELAY);
}

async function doAutosave() {
  if (!state.currentProjectId || !isDirty()) return;
  let mapView = null;
  if (state.map) {
    const c = state.map.getCenter();
    mapView = { center: [c.lng, c.lat], zoom: state.map.getZoom(), pitch: state.map.getPitch(), bearing: state.map.getBearing() };
  }
  const saveData = {
    name: document.getElementById('projectName')?.textContent || 'Proyecto',
    features: state.features,
    nextId: state.nextId,
    projectId: state.currentProjectId,
    mapView,
    metrics: calculateCurrentMetrics()
  };
  try {
    const res = await fetch('/api/projects/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('urbanplan_token') },
      body: JSON.stringify(saveData)
    });
    if (res.ok) { markClean(); _lastSavedAt = Date.now(); updateSaveIndicator(); }
  } catch (e) { logger.warn('[Autosave] Error guardando automáticamente', e); }
}

// Actualizar indicador cada 15s
setInterval(updateSaveIndicator, 15000);

// Suscribirse a cambios para programar autosave
EventBus.on(Events.FEATURES_UPDATED, scheduleAutosave);

function handleFileImport(file) {
  const reader = new FileReader();
  reader.onload = async event => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.features && data.nextId) {
        state.features = data.features;
        state.nextId = data.nextId;
        const nameDisplay = document.getElementById('projectName');
        if (nameDisplay && data.projectName) nameDisplay.textContent = data.projectName;

        pushHistory(); refreshMap();

        await fetch('/api/projects/audit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': localStorage.getItem('urbanplan_token')
          },
          body: JSON.stringify({
            action_type: 'IMPORT',
            projectId: state.currentProjectId,
            details: { filename: file.name, featureCount: state.features.length }
          })
        });

        toast('Proyecto importado correctamente', 'success');
      } else toast('Formato de archivo no reconocido', 'error');
    } catch (err) {
      logger.warn('[IO] Error leyendo archivo importado:', err.message);
      toast('No se pudo leer el archivo', 'error');
    }
  };
  reader.readAsText(file);
}

export function initIOEvents() {
  // EXPORTAR CON AUDITORIA
  document.getElementById('btnExport')?.addEventListener('click', async () => {
    const data = JSON.stringify({
      features: state.features,
      nextId: state.nextId,
      projectName: document.getElementById('projectName')?.textContent || 'Proyecto'
    }, null, 2);

    // 1. Descarga del archivo
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `proyecto_urbano_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // 2. Registro en AUDIT LOG
    try {
      await fetch('/api/projects/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('urbanplan_token')
        },
        body: JSON.stringify({
          action_type: 'EXPORT',
          projectId: state.currentProjectId,
          details: { filename: a.download, featureCount: state.features.length }
        })
      });
    } catch (e) { logger.warn('[Export] Error registrando auditoría', e); }

    toast('Exportado y registrado en bitácora', 'success');
  });

  // IMPORTAR CON AUDITORIA
  document.getElementById('fileImport')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    handleFileImport(file);
    e.target.value = '';
  });

  // DRAG-AND-DROP sobre el mapa
  const mapEl = document.getElementById('map');
  if (mapEl) {
    mapEl.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      mapEl.classList.add('drag-over');
    });
    mapEl.addEventListener('dragleave', () => {
      mapEl.classList.remove('drag-over');
    });
    mapEl.addEventListener('drop', e => {
      e.preventDefault();
      mapEl.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.json')) {
        handleFileImport(file);
      } else {
        toast('Solo se permiten archivos .json', 'error');
      }
    });
  }

  // GUARDAR EN BASE DE DATOS
  document.getElementById('btnSave')?.addEventListener('click', async () => {
    const btnSave = document.getElementById('btnSave');
    const originalBtnHTML = btnSave.innerHTML;
    
    btnSave.disabled = true;
    btnSave.classList.add('loading');
    btnSave.innerHTML = '<span class="spinner-container"><span class="spinner"></span><span>Guardando...</span></span>';

    // Capturar vista actual del mapa
    let mapView = null;
    if (state.map) {
      const center = state.map.getCenter();
      mapView = {
        center: [center.lng, center.lat],
        zoom: state.map.getZoom(),
        pitch: state.map.getPitch(),
        bearing: state.map.getBearing()
      };
    }

    const saveData = {
      name: document.getElementById('projectName')?.textContent || 'Mi Proyecto Urbano',
      features: state.features,
      nextId: state.nextId,
      projectId: state.currentProjectId,
      mapView,
      metrics: calculateCurrentMetrics()
    };

    try {
      const response = await fetch('/api/projects/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': localStorage.getItem('urbanplan_token')
        },
        body: JSON.stringify(saveData)
      });
      const data = await response.json();
      if (response.ok) {
        state.currentProjectId = data.projectId;
        markClean();
        _lastSavedAt = Date.now();
        updateSaveIndicator();
        toast('Proyecto sincronizado', 'success');
      } else {
        toast('No se pudo guardar el proyecto', 'error');
      }
    } catch (err) {
      logger.warn('[IO] Error guardando proyecto:', err.message);
      toast('Sin conexión al servidor', 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.classList.remove('loading');
      btnSave.innerHTML = originalBtnHTML;
    }
  });
}

// CARGAR ULTIMO PROYECTO DEL SERVIDOR AL INICIAR
export async function loadSavedState() {
  const token = localStorage.getItem('urbanplan_token');
  if (!token) return;
  const dismissToast = toast('Inicializando entorno geoespacial...', 'loading', 0);
  try {
    const response = await fetch('/api/projects/load', {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      dismissToast();
      return;
    }
    const data = await response.json();
    dismissToast();
    if (data.project) applyProjectData(data.project);
  } catch (e) {
    dismissToast();
      logger.error('[IO] Error cargando estado inicial', e);
    toast('Error al cargar el proyecto', 'error');
  }
}

// LISTAR PROYECTOS
export async function listUserProjects() {
  const token = localStorage.getItem('urbanplan_token');
  if (!token) return [];
  try {
    const response = await fetch('/api/projects/all', {
      headers: { 'Authorization': token }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.projects || [];
  } catch (e) {
    logger.error('[IO] Error listando proyectos', e);
    toast('Error al cargar proyectos', 'error');
    return [];
  }
}

export async function loadProjectById(id) {
  const token = localStorage.getItem('urbanplan_token');
  if (!token) return;
  const dismissToast = toast('Cargando datos del proyecto...', 'loading', 0);
  try {
    const response = await fetch(`/api/projects/${id}`, {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      dismissToast();
      toast('No se pudo cargar el proyecto', 'error');
      return;
    }
    const data = await response.json();
    dismissToast();
    if (data.project) {
      applyProjectData(data.project);
      toast('Proyecto cargado correctamente', 'success');
    }
  } catch (e) {
    logger.warn('[IO] Error cargando proyecto:', e.message);
    dismissToast();
    toast('Sin conexión al servidor', 'error');
  }
}

// NUEVO PROYECTO
export function createNewProject() {
  state.features = [];
  state.nextId = 1;
  state.currentProjectId = null;
  state.history = [];
  state.future = [];

  const nameDisplay = document.getElementById('projectName');
  if (nameDisplay) nameDisplay.textContent = 'Nuevo Proyecto Urbano';

  refreshMap();
  
  toast('Nuevo proyecto iniciado', 'info');
}

function applyProjectData(project) {
  state.features = project.features || [];
  state.nextId = project.nextId || 1;
  state.currentProjectId = project.id;
  state.history = [JSON.stringify(state.features)];
  state.future = [];

  const nameDisplay = document.getElementById('projectName');
  if (nameDisplay && project.name) nameDisplay.textContent = project.name;

  // Restaurar vista del mapa guardada (volar a la ubicacion exacta del proyecto)
  if (project.mapView && state.map) {
    const { center, zoom, pitch, bearing } = project.mapView;
    if (center && zoom != null) {
      state.map.flyTo({
        center,
        zoom,
        pitch: pitch ?? 65,
        bearing: bearing ?? 0,
        duration: 1200,
        essential: true
      });
    }
  } else if (state.features.length > 0 && state.map) {
    // Si no hay vista guardada, volar al centro de la primera feature
    const firstF = state.features[0];
    const center = firstF.properties.center_lng != null
      ? { lng: firstF.properties.center_lng, lat: firstF.properties.center_lat }
      : getFeatureCenter(firstF);
      
    if (center) {
      state.map.flyTo({
        center,
        zoom: 16,
        pitch: 60,
        bearing: 0,
        duration: 1500,
        essential: true
      });
    }
  }

  refreshMap();
}
