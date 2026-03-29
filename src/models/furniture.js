import { state, TYPE_CONFIG } from '../config/state.js';
import { buildingPolygon } from '../utils/geo.js';
import { buildTreePolygon } from './trees.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { toast, updateStats } from '../ui/toolbar.js';
import { selectFeature } from '../tools/selection.js';

export function generateFurnitureParts(baseId, lng, lat, rot, fType) {
  const parts = [];

  const addCircle = (rM, base, h, col) => {
    const id = state.nextId++;
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: baseId, type: 'furniture', color: col, fillColor: col, base_height: base, height: h },
      geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng, lat, rM)] }
    });
  };

  const addOffBox = (dlngM, dlatM, w, l, rotOff, base, h, col) => {
    const rad = rot * Math.PI / 180;
    const dx = dlngM * Math.cos(rad) - dlatM * Math.sin(rad);
    const dy = dlngM * Math.sin(rad) + dlatM * Math.cos(rad);
    const dlat = dy / 111320;
    const dlng = dx / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    const id = state.nextId++;
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: baseId, type: 'furniture', color: col, fillColor: col, base_height: base, height: h },
      geometry: { type: 'Polygon', coordinates: [buildingPolygon(lng + dlng, lat + dlat, w, l, rot + rotOff)] }
    });
  };

  parts.push({
    type: 'Feature', id: baseId,
    properties: {
      id: baseId, type: 'furniture', name: `Mobiliario ${baseId}`, color: '#374151', fillColor: '#4b5563',
      base_height: 0, height: 0.5, center_lng: lng, center_lat: lat, rotation: rot, furniture_type: fType
    },
    geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng, lat, 0.4)] }
  });

  const poleCol = '#6b7280';
  const darkCol = '#1f2937';

  if (fType === 'semaforo') {
    parts[0].properties.height = 0.8;
    addCircle(0.12, 0.8, 5.0, poleCol);
    addOffBox(0, 0, 0.4, 0.4, 0, 3.5, 5.0, darkCol);
    addOffBox(0, 0.22, 0.2, 0.05, 0, 4.5, 4.8, '#ef4444');
    addOffBox(0, 0.22, 0.2, 0.05, 0, 4.1, 4.4, '#eab308');
    addOffBox(0, 0.22, 0.2, 0.05, 0, 3.7, 4.0, '#22c55e');
    addOffBox(0.22, 0, 0.05, 0.2, 0, 2.5, 3.0, darkCol);
    addOffBox(0.24, 0, 0.02, 0.15, 0, 2.55, 2.7, '#22c55e');
  } else if (fType === 'semaforo_brazo') {
    parts[0].properties.height = 0.8;
    addCircle(0.15, 0.8, 6.2, poleCol);
    addOffBox(-2.25, 0, 4.5, 0.15, 0, 6.0, 6.2, poleCol);
    addOffBox(-4.2, 0, 0.4, 0.4, 0, 4.6, 6.0, darkCol);
    addOffBox(-4.2, 0.22, 0.2, 0.05, 0, 5.5, 5.8, '#ef4444');
    addOffBox(-4.2, 0.22, 0.2, 0.05, 0, 5.1, 5.4, '#eab308');
    addOffBox(-4.2, 0.22, 0.2, 0.05, 0, 4.7, 5.0, '#22c55e');
    addOffBox(-0.35, 0, 0.4, 0.4, 0, 3.5, 4.9, darkCol);
    addOffBox(-0.35, 0.22, 0.2, 0.05, 0, 4.4, 4.7, '#ef4444');
    addOffBox(-0.35, 0.22, 0.2, 0.05, 0, 4.0, 4.3, '#eab308');
    addOffBox(-0.35, 0.22, 0.2, 0.05, 0, 3.6, 3.9, '#22c55e');
    addOffBox(0.25, 0, 0.25, 0.3, 0, 1.5, 2.2, darkCol);
  } else if (fType === 'farol') {
    parts[0].geometry.coordinates = [buildTreePolygon(lng, lat, 0.3)];
    parts[0].properties.height = 0.6;
    addCircle(0.08, 0.6, 4.0, darkCol);
    addCircle(0.12, 3.9, 4.1, darkCol);
    addCircle(0.25, 4.1, 4.3, darkCol);
    addCircle(0.3, 4.3, 4.8, '#fef08a');
    addCircle(0.35, 4.8, 5.0, darkCol);
  } else if (fType === 'luminaria') {
    parts[0].geometry.coordinates = [buildTreePolygon(lng, lat, 0.2)];
    addCircle(0.1, 0.5, 6.0, poleCol);
    addOffBox(0, 1.0, 0.15, 2.0, 0, 5.8, 6.0, poleCol);
    addOffBox(0, 1.6, 0.2, 0.5, 0, 5.7, 5.8, '#fef08a');
  } else if (fType === 'disco') {
    parts[0].geometry.coordinates = [buildTreePolygon(lng, lat, 0.2)];
    addCircle(0.08, 0.5, 5.5, poleCol);
    addCircle(0.6, 5.5, 5.6, poleCol);
    addCircle(0.5, 5.4, 5.5, '#fef08a');
  }

  return parts;
}

export function finishFurniture(lng, lat) {
  const fType = document.getElementById('furnitureType')?.value || 'semaforo';
  const rot = parseFloat(document.getElementById('furnitureRot')?.value || 0);
  const baseId = state.nextId++;
  const parts = generateFurnitureParts(baseId, lng, lat, rot, fType);
  state.features.push(...parts);
  pushHistory(); refreshMap(); updateStats();
  selectFeature(baseId);
}
