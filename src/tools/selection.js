import { state } from '../config/state.js';
import { showPropsPanel, showMultiPropsPanel } from '../ui/properties.js'; // Will create this later
import { pushHistory } from './interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from '../ui/toolbar.js';
import { updateGlobalStats } from '../ui/stats.js';

export function getGroupIds(ids) {
  const gids = new Set();
  ids.forEach(id => {
    const f = state.features.find(x => x.properties.id === id);
    if (f?.properties.groupId) gids.add(f.properties.groupId);
  });
  if (gids.size === 0) return ids;
  const allIds = new Set(ids);
  state.features.forEach(f => {
    if (f.properties.groupId && gids.has(f.properties.groupId)) allIds.add(f.properties.id);
  });
  return [...allIds];
}

export function selectFeature(id, lngLat, isMulti = false) {
  const idsToTarget = getGroupIds([id]);
  if (isMulti) {
    const alreadySelected = idsToTarget.every(tid => state.selectedIds.includes(tid));
    if (alreadySelected) state.selectedIds = state.selectedIds.filter(x => !idsToTarget.includes(x));
    else state.selectedIds = [...new Set([...state.selectedIds, ...idsToTarget])];
  } else {
    state.selectedIds = idsToTarget;
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
    if (ps) ps.classList.add('hidden');
    clearEdgeHighlight();
    state.popup?.remove(); state.popup = null;
  }
  updateEditHandles();
  updateGlobalStats();
}

export function updateEditHandles() {
  if (!state.map) return;
  const feats = [];
  if (state.selectedIds.length === 1 && ['select', 'move'].includes(state.tool)) {
    const f = state.features.find(x => x.properties.id === state.selectedIds[0]);
    if (f && f.properties.raw_pts && !['house', 'building'].includes(f.properties.type)) {
      f.properties.raw_pts.forEach((pt, idx) => {
        const isSelected = (state.selectedVertexIdx === idx);
        feats.push({ type: 'Feature', properties: { fid: f.properties.id, idx, isSelected }, geometry: { type: 'Point', coordinates: pt } });
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

export function groupSelectedFeatures() {
  if (state.selectedIds.length < 2) return;
  pushHistory();
  const gid = `group_${Date.now()}`;
  state.features.forEach(f => {
    if (state.selectedIds.includes(f.properties.id)) {
      f.properties.groupId = gid;
    }
  });
  toast('Objetos agrupados', 'success');
  updateSelectionUI();
}

export function ungroupSelectedFeatures() {
  if (!state.selectedIds.length) return;
  pushHistory();
  const groupsToUngroup = new Set();
  state.features.forEach(f => {
    if (state.selectedIds.includes(f.properties.id) && f.properties.groupId) {
      groupsToUngroup.add(f.properties.groupId);
    }
  });

  state.features.forEach(f => {
    if (groupsToUngroup.has(f.properties.groupId)) {
      delete f.properties.groupId;
    }
  });

  toast('Objetos desagrupados', 'info');
  updateSelectionUI();
}

/**
 * Highlights a single edge of a feature on the map.
 * @param {object} feat — GeoJSON feature with properties.raw_pts
 * @param {number} edgeIdx — 0-based index of the edge (pair of consecutive vertices)
 * @param {boolean} closed — whether the polygon is closed (last edge = closing edge)
 */
export function highlightEdge(feat, edgeIdx, closed = true) {
  if (!state.map || !feat?.properties?.raw_pts) return;
  const pts = feat.properties.raw_pts;
  if (edgeIdx < 0 || edgeIdx >= pts.length) return;

  let from, to;
  if (closed && edgeIdx === pts.length - 1) {
    from = pts[pts.length - 1];
    to = pts[0];
  } else {
    from = pts[edgeIdx];
    to = pts[edgeIdx + 1];
  }
  if (!from || !to) return;

  const feature = {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [from, to] }
  };
  state.map.getSource('edge-highlight')?.setData({ type: 'FeatureCollection', features: [feature] });
}

/** Clears the edge highlight from the map. */
export function clearEdgeHighlight() {
  state.map?.getSource('edge-highlight')?.setData({ type: 'FeatureCollection', features: [] });
}
