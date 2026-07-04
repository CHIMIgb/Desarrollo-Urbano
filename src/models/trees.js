import { state, TYPE_CONFIG } from '../config/state.js';
import { getNextId, addFeatures } from '../config/store.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from '../ui/toolbar.js';
import { selectFeature } from '../tools/selection.js';

export function buildTreePolygon(lng, lat, radiusM) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const dlat = (radiusM * Math.cos(ang)) / 111320;
    const dlng = (radiusM * Math.sin(ang)) / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    pts.push([lng + dlng, lat + dlat]);
  }
  return [...pts, pts[0]];
}

export function finishTree(lng, lat, treeType) {
  treeType = treeType || 'pino';
  let totalH = 8; 

  totalH = totalH * (0.85 + Math.random() * 0.3);

  const trunkId = getNextId();
  const cfg = TYPE_CONFIG['tree'];
  const parts = [];

  const tc = '#451a03'; const tf = '#78350f'; 
  const cc = cfg.color; const cf = cfg.fillColor; 

  const addPart = (rM, base, h, colC, colF) => {
    const id = getNextId();
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: trunkId, type: 'tree', color: colC, fillColor: colF, base_height: base, height: Math.round(h * 10) / 10 },
      geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng, lat, rM)] }
    });
  };
  const addOffPart = (dlngM, dlatM, rM, base, h, colC, colF) => {
    const dlat = dlatM / 111320;
    const dlng = dlngM / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    const id = getNextId();
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: trunkId, type: 'tree', color: colC, fillColor: colF, base_height: base, height: Math.round(h * 10) / 10 },
      geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng + dlng, lat + dlat, rM)] }
    });
  };

  parts.push({
    type: 'Feature', id: trunkId,
    properties: {
      id: trunkId, type: 'tree', name: `Árbol ${treeType} ${trunkId}`, color: tc, fillColor: tf,
      base_height: 0, height: Math.round(totalH * 0.2 * 10) / 10, center_lng: lng, center_lat: lat, tree_type: treeType
    },
    geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng, lat, totalH * 0.05)] }
  });

  if (treeType === 'pino') {
    const rMax = totalH * 0.35;
    parts[0].properties.height = totalH * 0.2;
    addPart(rMax, totalH * 0.2, totalH * 0.5, cc, cf);
    addPart(rMax * 0.7, totalH * 0.5, totalH * 0.75, cc, cf);
    addPart(rMax * 0.4, totalH * 0.75, totalH, cc, cf);
  } else if (treeType === 'abeto') {
    const rMax = totalH * 0.25;
    parts[0].properties.height = totalH * 0.1;
    const steps = 6;
    const stepH = (totalH * 0.9) / steps;
    for (let i = 0; i < steps; i++) {
      const base = totalH * 0.1 + (i * stepH);
      const r = rMax * (1 - (i / steps) * 0.75);
      addPart(r, base, base + stepH * 1.4, cc, cf); 
    }
  } else if (treeType === 'roble') {
    parts[0].properties.height = totalH * 0.4;
    const rM = totalH * 0.3;
    addPart(rM, totalH * 0.3, totalH, cc, cf);
    addOffPart(rM * 0.7, 0, rM * 0.7, totalH * 0.4, totalH * 0.8, cc, cf);
    addOffPart(-rM * 0.7, 0, rM * 0.7, totalH * 0.4, totalH * 0.8, cc, cf);
    addOffPart(0, rM * 0.7, rM * 0.7, totalH * 0.4, totalH * 0.8, cc, cf);
    addOffPart(0, -rM * 0.7, rM * 0.7, totalH * 0.4, totalH * 0.8, cc, cf);
  } else if (treeType === 'ovalado') {
    parts[0].properties.height = totalH * 0.25;
    addPart(totalH * 0.2, totalH * 0.25, totalH * 0.4, cc, cf);
    addPart(totalH * 0.25, totalH * 0.4, totalH * 0.7, cc, cf);
    addPart(totalH * 0.15, totalH * 0.7, totalH, cc, cf);
  } else if (treeType === 'seco') {
    parts[0].properties.height = totalH;
    parts[0].geometry.coordinates = [buildTreePolygon(lng, lat, totalH * 0.04)];
    addOffPart(totalH * 0.08, 0, totalH * 0.02, totalH * 0.4, totalH * 0.6, tc, tf);
    addOffPart(-totalH * 0.06, totalH * 0.05, totalH * 0.02, totalH * 0.6, totalH * 0.8, tc, tf);
  }

  addFeatures(...parts);
  pushHistory(); refreshMap();
  selectFeature(trunkId);
}
