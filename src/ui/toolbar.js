import { state } from '../config/state.js';
import { clearDrawing } from '../tools/drawing.js';
import { createNewProject, listUserProjects, loadProjectById } from './io.js';

export function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 400); }, 3000);
}

export function updateStats() {
  const cnt = { house: 0, building: 0, road: 0, park: 0, zone: 0, terrain: 0, path: 0, sidewalk: 0 };
  state.features.forEach(f => { cnt[f.properties.type] = (cnt[f.properties.type] || 0) + 1; });
  const sh = document.getElementById('stat-houses');
  const sb = document.getElementById('stat-buildings');
  const sr = document.getElementById('stat-roads');
  const sp = document.getElementById('stat-parks');
  if (sh) sh.textContent = cnt.house;
  if (sb) sb.textContent = cnt.building;
  if (sr) sr.textContent = cnt.road;
  if (sp) sp.textContent = cnt.park + cnt.zone + cnt.terrain + cnt.path + cnt.sidewalk;
}

export function setTool(tool) {
  state.tool = tool; 
  clearDrawing();
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');

  ['treeOptionsBar', 'furnitureOptionsBar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  
  const barMap = {
    tree: 'treeOptionsBar',
    furniture: 'furnitureOptionsBar'
  };
  
  const targetBarId = barMap[tool];
  const targetBar = document.getElementById(targetBarId);
  if (targetBar) targetBar.style.display = 'flex';
  
  if (state.map) {
    state.map.getCanvas().style.cursor = (tool === 'select' || tool === 'move' || tool === 'delete') ? '' : 'crosshair';
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

  document.getElementById('layersList')?.addEventListener('change', updateLayersVisibility);
  
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });
  
  document.getElementById('btnUndo')?.addEventListener('click', () => {
    if (state.history.length > 1) {
      state.future.push(JSON.stringify(state.features));
      const last = state.history.pop();
      state.features = JSON.parse(state.history[state.history.length - 1]);
      import('../map/core.js').then(m => m.refreshMap());
      toast('Deshecho', 'info');
    }
  });

  document.getElementById('btnRedo')?.addEventListener('click', () => {
    if (state.future.length > 0) {
      state.history.push(JSON.stringify(state.features));
      state.features = JSON.parse(state.future.pop());
      import('../map/core.js').then(m => m.refreshMap());
      toast('Rehecho', 'info');
    }
  });

  document.getElementById('tool-3d')?.addEventListener('click', () => {
    if (!state.map) return;
    const is3D = state.map.getPitch() > 10;
    state.map.easeTo({
      pitch: is3D ? 0 : 65,
      duration: 1000
    });
    toast(is3D ? 'Vista 2D' : 'Vista 3D', 'info');
  });

  document.getElementById('tool-satellite')?.addEventListener('click', () => {
    state.isSatellite = !state.isSatellite;
    if (state.map) {
      import('../map/core.js').then(m => state.map.setStyle(m.buildStyle(), { diff: false }));
    }
    toast(state.isSatellite ? 'Vista Satélite' : 'Vista Mapa', 'info');
  });

  document.getElementById('tool-terrain-toggle')?.addEventListener('click', () => {
    if (!state.map) return;
    // state.terrainEnabled: undefined/true = activo, false = inactivo
    if (state.terrainEnabled === false) {
      // Activar relieve
      import('../map/core.js').then(m => m.addTerrainSource());
      state.terrainEnabled = true;
      document.getElementById('tool-terrain-toggle')?.classList.add('active');
      toast('Relieve 3D activado', 'info');
    } else {
      // Desactivar relieve
      state.map.setTerrain(null);
      state.terrainEnabled = false;
      document.getElementById('tool-terrain-toggle')?.classList.remove('active');
      toast('Relieve 3D desactivado', 'info');
    }
  });

  document.getElementById('btnNew')?.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres crear un nuevo proyecto? Se perderán los cambios no guardados en la nube.')) {
      createNewProject();
    }
  });

  document.getElementById('btnOpenProjects')?.addEventListener('click', async () => {
    const modal = document.getElementById('projectsModal');
    if (modal) {
      modal.style.display = 'flex';
      const list = document.getElementById('projectsList');
      if (list) {
        list.innerHTML = '<p style="text-align:center; padding:20px;">Cargando...</p>';
        const projects = await listUserProjects();
        renderProjectsList(projects);
      }
    }
  });
}

function renderProjectsList(projects) {
  const list = document.getElementById('projectsList');
  if (!list) return;
  
  if (projects.length === 0) {
    list.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-secondary);">No tienes proyectos guardados.</p>';
    return;
  }

  list.innerHTML = '';
  projects.forEach(p => {
    const item = document.createElement('div');
    item.className = 'project-item';
    const date = new Date(p.updated_at).toLocaleDateString();
    
    item.innerHTML = `
      <div class="project-info">
        <div class="project-name-item">${p.name}</div>
        <div class="project-date-item">Actualizado: ${date}</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-id="${p.id}">Cargar</button>
    `;
    
    item.querySelector('button').addEventListener('click', () => {
      loadProjectById(p.id);
      document.getElementById('projectsModal').style.display = 'none';
    });
    
    list.appendChild(item);
  });
}

function updateLayersVisibility() {
  if (!state.map) return;
  const getVis = (id) => {
    const el = document.querySelector(`input[data-layer="${id}"]`);
    return el ? el.checked : true;
  };
  
  const t = {
    house: getVis('house'), building: getVis('building'), custom_building: getVis('custom_building'),
    road: getVis('road'), park: getVis('park'), zone: getVis('zone'), terrain: getVis('terrain'),
    water: getVis('water'), tree: getVis('tree'), railway: getVis('railway'), radius: getVis('radius'),
    furniture: getVis('furniture'), path: getVis('path'), sidewalk: getVis('sidewalk')
  };

  const bldTypes = [];
  if (t.house) bldTypes.push('house');
  if (t.building) bldTypes.push('building');
  if (t.custom_building) bldTypes.push('custom_building');

  ['layer-buildings', 'layer-buildings-outline'].forEach(id => {
    if (state.map.getLayer(id)) {
      if (bldTypes.length === 0) state.map.setLayoutProperty(id, 'visibility', 'none');
      else {
        state.map.setLayoutProperty(id, 'visibility', 'visible');
        state.map.setFilter(id, ['match', ['get', 'type'], bldTypes, true, false]);
      }
    }
  });

  const znTypes = [];
  ['park', 'zone', 'terrain', 'water', 'radius'].forEach(type => { if (t[type]) znTypes.push(type); });

  ['layer-zones-fill', 'layer-zones-line'].forEach(id => {
    if (state.map.getLayer(id)) {
      if (znTypes.length === 0) state.map.setLayoutProperty(id, 'visibility', 'none');
      else {
        state.map.setLayoutProperty(id, 'visibility', 'visible');
        state.map.setFilter(id, ['match', ['get', 'type'], znTypes, true, false]);
      }
    }
  });

  if (state.map.getLayer('layer-furniture')) state.map.setLayoutProperty('layer-furniture', 'visibility', t.furniture ? 'visible' : 'none');
  if (state.map.getLayer('layer-trees-3d')) state.map.setLayoutProperty('layer-trees-3d', 'visibility', t.tree ? 'visible' : 'none');

  const rVis = t.road ? 'visible' : 'none';
  if (state.map.getLayer('layer-roads')) state.map.setLayoutProperty('layer-roads', 'visibility', rVis);
  for (let i = 1; i <= 9; i++) {
    if (state.map.getLayer(`layer-roads-div-${i}`)) state.map.setLayoutProperty(`layer-roads-div-${i}`, 'visibility', rVis);
  }
  
  const pVis = t.path ? 'visible' : (t.sidewalk ? 'visible' : 'none');
  if (state.map.getLayer('layer-paths')) {
     state.map.setLayoutProperty('layer-paths', 'visibility', (t.path || t.sidewalk) ? 'visible' : 'none');
     state.map.setFilter('layer-paths', ['match', ['get', 'type'], [t.path ? 'path' : '', t.sidewalk ? 'sidewalk' : ''].filter(x => x), true, false]);
  }

  const railVis = t.railway ? 'visible' : 'none';
  if (state.map.getLayer('layer-railways')) state.map.setLayoutProperty('layer-railways', 'visibility', railVis);
  if (state.map.getLayer('layer-railways-dash')) state.map.setLayoutProperty('layer-railways-dash', 'visibility', railVis);
}
