import { state } from '../config/state.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { updateStats, toast } from './toolbar.js';

export function initIOEvents() {
  document.getElementById('btnExport')?.addEventListener('click', () => {
    const data = JSON.stringify({ 
      features: state.features, 
      nextId: state.nextId,
      projectName: document.getElementById('projectName')?.textContent || 'Proyecto'
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `proyecto_urbano_${new Date().getTime()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Proyecto exportado', 'success');
  });

  document.getElementById('fileImport')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.features && data.nextId) {
          state.features = data.features; state.nextId = data.nextId;
          const nameDisplay = document.getElementById('projectName');
          if (nameDisplay && data.projectName) nameDisplay.textContent = data.projectName;
          pushHistory(); refreshMap(); updateStats();
          toast('Proyecto importado con éxito', 'success');
        } else toast('Archivo inválido', 'error');
      } catch (err) { toast('Error al leer el archivo', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btnSave')?.addEventListener('click', () => {
    const saveData = {
      features: state.features,
      nextId: state.nextId,
      projectName: document.getElementById('projectName')?.textContent || 'Proyecto',
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('urbanplan_v3_modular', JSON.stringify(saveData));
    toast('Proyecto guardado localmente', 'success');
  });
}

export function loadSavedState() {
  try {
    const raw = localStorage.getItem('urbanplan_v3_modular');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.features) state.features = data.features;
    if (data.nextId) state.nextId = data.nextId;
    const nameDisplay = document.getElementById('projectName');
    if (nameDisplay && data.projectName) nameDisplay.textContent = data.projectName;
    refreshMap();
    updateStats();
    toast('Sesión restaurada', 'info');
  } catch (e) { console.error('Error loading saved state', e); }
}
