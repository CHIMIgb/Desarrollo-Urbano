import { state } from '../config/state.js';
import { pushHistory as _storePushHistory } from '../config/store.js';
import { refreshMap } from '../map/core.js';
import { updateEditHandles } from './selection.js';
import { updateLiveMeasure, updateDrawPreview, finishLine, finishPolygon, finishRadius } from './drawing.js';
import { placeBuilding } from '../models/buildings.js';
import { finishTree } from '../models/trees.js';
import { finishFurniture } from '../models/furniture.js';
import { catmullRom, catmullRomClosed, lineLength, polygonArea, polygonPerimeter, getFeatureCenter } from '../utils/geo.js';
import { buildMeasureHTML } from '../ui/properties.js';

// Re-exportar pushHistory desde el Store para que todos los módulos
// que actualmente importan de aquí sigan funcionando sin cambios.
export function pushHistory() {
  _storePushHistory();
}

export function handleMouseMove(e) {
  const { lng, lat } = e.lngLat;
  const coordDisplay = document.getElementById('coordDisplay');
  if (coordDisplay) coordDisplay.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  
  if (state.drawPoints.length > 0) updateLiveMeasure(lng, lat);

  if (state.draggingVertexIdx !== null && state.draggingVertexIdx !== undefined) {
    const f = state.features.find(x => x.properties.id === state.selectedIds[0]);
    if (f && f.properties.raw_pts) {
      f.properties.raw_pts[state.draggingVertexIdx] = [lng, lat];
      if (['road', 'path', 'sidewalk', 'railway'].includes(f.properties.type)) {
        f.geometry.coordinates = f.properties.curved && f.properties.raw_pts.length > 2 ? catmullRom(f.properties.raw_pts) : [...f.properties.raw_pts];
        f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));
      } else {
        const curved = f.properties.curved;
        const closed = curved && f.properties.raw_pts.length > 2 ? catmullRomClosed(f.properties.raw_pts) : [...f.properties.raw_pts, f.properties.raw_pts[0]];
        f.geometry.coordinates = [closed];
        f.properties.area_m2 = Math.round(polygonArea(closed));
        f.properties.perimeter_m = Math.round(polygonPerimeter(closed));
      }
      refreshMap(); updateEditHandles();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    }
    return;
  }

  if (state.draggingFeatureId && state.tool === 'move') {
    state.isDragging = true;
    const dlng = lng - state.lastDragPos.lng;
    const dlat = lat - state.lastDragPos.lat;
    const toMove = state.selectedIds.includes(state.draggingFeatureId) ? state.selectedIds : [state.draggingFeatureId];
    toMove.forEach(id => translateFeature(id, dlng, dlat));
    state.lastDragPos = { lng, lat };
    refreshMap(); updateEditHandles();
  }
}

export function handleMouseUp() {
  if (state.draggingVertexIdx !== null && state.draggingVertexIdx !== undefined) {
    state.draggingVertexIdx = null; state.map.getCanvas().style.cursor = ''; pushHistory();
  }
  if (state.draggingFeatureId) {
    state.draggingFeatureId = null;
    state.map.getCanvas().style.cursor = state.tool === 'move' ? 'grab' : '';
    if (state.isDragging) pushHistory();
  }
}

export function handleMapClick(e) {
  if (state.tool === 'move' || state.tool === 'delete' || state.tool === 'select') return;
  const { lng, lat } = e.lngLat;

  if (['house', 'building'].includes(state.tool)) {
    placeBuilding(state.tool, lng, lat); return;
  } else if (state.tool === 'tree') {
    const treeType = document.getElementById('treeType')?.value;
    finishTree(lng, lat, treeType); return;
  } else if (state.tool === 'furniture') {
    const furnitureType = document.getElementById('furnitureType')?.value;
    const furnitureRot = document.getElementById('furnitureRot')?.value;
    finishFurniture(lng, lat, furnitureType, furnitureRot); return;
  } else if (state.tool === 'radius') {
    finishRadius(lng, lat); return;
  } else {
    // Check click-to-close
    if (state.drawPoints.length > 0) {
      const p = e.point;
      if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool) && state.drawPoints.length >= 3) {
        const firstP = state.map.project(state.drawPoints[0]);
        if (Math.hypot(p.x - firstP.x, p.y - firstP.y) < 20) { finishPolygon(state.tool); return; }
      } else if (['road', 'railway', 'path', 'sidewalk'].includes(state.tool) && state.drawPoints.length >= 2) {
        const lastP = state.map.project(state.drawPoints[state.drawPoints.length - 1]);
        if (Math.hypot(p.x - lastP.x, p.y - lastP.y) < 20) { finishLine(); return; }
      }
    }

    state.drawPoints.push([lng, lat]);
    updateDrawPreview();
    if (state.drawPoints.length === 1) {
      const hint = document.getElementById('drawHint');
      if (hint) hint.classList.remove('hidden');
      const hintText = document.getElementById('drawHintText');
        ['road', 'railway', 'path', 'sidewalk'].includes(state.tool)
          ? 'Traza con clic Izquierdo · Clic DERECHO para terminar'
          : 'Traza con clic Izquierdo · Clic DERECHO para cerrar';
      
      const lineContainer = document.getElementById('lineCurvedContainer');
      const polyContainer = document.getElementById('polyCurvedContainer');
      if (['road', 'railway', 'path', 'sidewalk'].includes(state.tool)) {
        if (lineContainer) lineContainer.classList.remove('hidden');
      } else if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool)) {
        if (polyContainer) polyContainer.classList.remove('hidden');
      }
    }
  }
}

export function handleMapDblClick(e) {
  e.preventDefault();
}

export function translateFeature(id, dlng, dlat) {
  const feats = state.features.filter(x => x.properties.id === id || x.properties.parent_id === id);
  feats.forEach(f => {
    if (f.properties.center_lng != null) {
      f.properties.center_lng += dlng;
      f.properties.center_lat += dlat;
    }
    if (f.properties.raw_pts) {
      f.properties.raw_pts = f.properties.raw_pts.map(c => [c[0] + dlng, c[1] + dlat]);
    }
    const movePts = pts => pts.map(c => [c[0] + dlng, c[1] + dlat]);
    if (f.geometry.type === 'Point') f.geometry.coordinates = movePts([f.geometry.coordinates])[0];
    else if (f.geometry.type === 'LineString') f.geometry.coordinates = movePts(f.geometry.coordinates);
    else if (f.geometry.type === 'Polygon') f.geometry.coordinates = f.geometry.coordinates.map(movePts);
  });
}

// Re-exportar getFeatureCenter desde geo.js para compatibilidad
// con módulos que lo importan desde aquí (ej: properties.js)
export { getFeatureCenter };
