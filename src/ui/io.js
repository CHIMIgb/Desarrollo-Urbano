import { state } from '../config/state.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { updateStats, toast } from './toolbar.js';

export function initIOEvents() {
  // EXPORTAR CON AUDITORÍA
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
    } catch (e) { console.warn('Error registrando auditoría de exportación', e); }

    toast('Proyecto exportado y registrado', 'success');
  });

  // IMPORTAR CON AUDITORÍA
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
          
          pushHistory(); refreshMap(); updateStats();
          
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

          toast('Proyecto importado con éxito', 'success');
        } else toast('Archivo inválido', 'error');
      } catch (err) { toast('Error al procesar el archivo', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // GUARDAR EN BASE DE DATOS
  document.getElementById('btnSave')?.addEventListener('click', async () => {
    const saveData = {
      name: document.getElementById('projectName')?.textContent || 'Mi Proyecto Urbano',
      features: state.features,
      nextId: state.nextId,
      projectId: state.currentProjectId
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
        toast('Proyecto guardado en la nube', 'success');
      } else {
        toast('Error al guardar: ' + data.error, 'error');
      }
    } catch (err) {
      toast('Error de conexión al guardar', 'error');
    }
  });
}

// CARGAR DEL SERVIDOR
export async function loadSavedState() {
  const token = localStorage.getItem('urbanplan_token');
  if (!token) return;

  try {
    const response = await fetch('/api/projects/load', {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('API de proyectos no encontrada. ¿Reiniciaste el servidor?');
      }
      return;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('La respuesta no es JSON. Recibido:', contentType);
      return;
    }

    const data = await response.json();
    
    if (data.project) {
      state.features = data.project.features;
      state.nextId = data.project.nextId;
      state.currentProjectId = data.project.id;
      
      const nameDisplay = document.getElementById('projectName');
      if (nameDisplay && data.project.name) nameDisplay.textContent = data.project.name;
      
      refreshMap();
      updateStats();
      toast('Proyecto cargado desde la nube', 'info');
    }
  } catch (e) { 
    console.error('Error loading saved state from DB', e); 
    toast('Error al cargar proyecto remoto', 'error');
  }
}
