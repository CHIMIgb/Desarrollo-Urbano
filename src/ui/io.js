import { state } from '../config/state.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from './toolbar.js';
import { calculateCurrentMetrics } from './stats.js';
import { getFeatureCenter } from '../utils/geo.js';

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
    } catch (e) { console.warn('Error registrando auditoria de exportacion', e); }

    toast('Proyecto exportado y registrado', 'success');
  });

  // IMPORTAR CON AUDITORIA
  document.getElementById('fileImport')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
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

          // Registrar en AUDIT LOG
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

          toast('Proyecto importado con exito', 'success');
        } else toast('Archivo invalido', 'error');
      } catch (err) { toast('Error al procesar el archivo', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // GUARDAR EN BASE DE DATOS
  document.getElementById('btnSave')?.addEventListener('click', async () => {
    const btnSave = document.getElementById('btnSave');
    const originalBtnHTML = btnSave.innerHTML;
    
    btnSave.disabled = true;
    btnSave.innerHTML = '<span class="spinner-container"><span class="spinner"></span><span>Guardando...</span></span>';
    toast('Guardando proyecto...', 'info');

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
    
    console.log('[DEBUG] Enviando datos de guardado:', saveData);

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
        toast('Proyecto guardado en la nube', 'success');
      } else {
        toast('Error al guardar: ' + data.error, 'error');
      }
    } catch (err) {
      toast('Error de conexion al guardar', 'error');
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = originalBtnHTML;
    }
  });
}

// CARGAR ULTIMO PROYECTO DEL SERVIDOR AL INICIAR
export async function loadSavedState() {
  const token = localStorage.getItem('urbanplan_token');
  if (!token) return;
  const dismissToast = toast('Cargando entorno 3D...', 'loading', 0);
  try {
    const response = await fetch('/api/projects/latest', {
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
    console.error('Error loading initial state', e);
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
    console.error('Error listing projects', e);
    return [];
  }
}

export async function loadProjectById(id) {
  const token = localStorage.getItem('urbanplan_token');
  if (!token) return;
  const dismissToast = toast('Cargando proyecto...', 'loading', 0);
  try {
    const response = await fetch(`/api/projects/${id}`, {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      dismissToast();
      toast('Error al cargar proyecto', 'error');
      return;
    }
    const data = await response.json();
    dismissToast();
    if (data.project) {
      applyProjectData(data.project);
      toast('Proyecto cargado', 'success');
    }
  } catch (e) { 
    dismissToast();
    toast('Error de conexion', 'error'); 
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
