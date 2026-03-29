import { state } from '../config/state.js';
import { showPropsPanel, showMultiPropsPanel } from '../ui/properties.js'; // Will create this later
import { pushHistory } from './interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from '../ui/toolbar.js';

export function selectFeature(id, lngLat, isMulti = false) {
  if (isMulti) {
    if (state.selectedIds.includes(id)) state.selectedIds = state.selectedIds.filter(x => x !== id);
    else state.selectedIds.push(id);
  } else {
    state.selectedIds = [id];
  }
  updateSelectionUI(lngLat);
}

export function updateSelectionUI(lngLat) {
  if (!state.map) return;
  state.map.setFilter('highlight-polygons', ['in', ['get', 'id'], ['literal', state.selectedIds.length ? state.selectedIds : ['']]]);
  if (state.selectedIds.length === 1) {
    const feat = state.features.find(f => f.properties.id === state.selectedIds[0]);
    if (feat) showPropsPanel(feat, lngLat);
  } else if (state.selectedIds.length > 1) {
    showMultiPropsPanel();
  } else {
    const ps = document.getElementById('propsSection');
    if (ps) ps.style.display = 'none';
    state.popup?.remove(); state.popup = null;
  }
  updateEditHandles();
}

export function updateEditHandles() {
  if (!state.map) return;
  const feats = [];
  if (state.selectedIds.length === 1 && ['select', 'move'].includes(state.tool)) {
    const f = state.features.find(x => x.properties.id === state.selectedIds[0]);
    if (f && f.properties.raw_pts && !['house', 'building'].includes(f.properties.type)) {
      f.properties.raw_pts.forEach((pt, idx) => {
        feats.push({ type: 'Feature', properties: { fid: f.properties.id, idx }, geometry: { type: 'Point', coordinates: pt } });
      });
    }
  }
  state.map.getSource('edit-handles')?.setData({ type: 'FeatureCollection', features: feats });
}

export function deleteSelection() {
  if (!state.selectedIds.length) return;
  pushHistory();
  const toDelete = new Set([...state.selectedIds]);
  
  state.features.forEach(f => {
    if (f.properties.parent_id && toDelete.has(f.properties.parent_id)) toDelete.add(f.properties.id);
  });
  state.features = state.features.filter(f => !toDelete.has(f.properties.id));
  state.selectedIds = []; updateSelectionUI();
  refreshMap(); toast('Objeto(s) eliminado(s)', 'error');
}
