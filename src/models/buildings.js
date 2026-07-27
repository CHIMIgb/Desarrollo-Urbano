import { state, TYPE_CONFIG } from '../config/state.js';
import { getNextId, addFeatures } from '../config/store.js';
import { buildingPolygon, polygonArea } from '../utils/geo.js';
import { pushHistory } from '../tools/interaction.js';
import { refreshMap } from '../map/core.js';
import { toast } from '../ui/toolbar.js';
import { selectFeature } from '../tools/selection.js';

export function generateBuildingParts(baseId, lng, lat, w, l, h, rot, type, customCoords = null) {
  const cfg = TYPE_CONFIG[type];
  const parts = [];
  const floors = Math.round(h / 3.5) || 1;

  // 1. Main Body
  const mainGeom = customCoords
    ? { type: 'Polygon', coordinates: [customCoords] }
    : { type: 'Polygon', coordinates: [buildingPolygon(lng, lat, w, l, rot)] };

  parts.push({
    type: 'Feature',
    id: baseId,
    properties: {
      id: baseId,
      type,
      name: `${cfg.label} ${baseId}`,
      height: h,
      floors,
      color: cfg.color,
      fillColor: cfg.fillColor,
      uso_suelo: type === 'building' ? 'comercial' : type === 'house' ? 'habitacional' : 'mixto',
      center_lng: lng,
      center_lat: lat,
      width_m: w,
      length_m: l,
      rotation: rot,
      area_m2: customCoords ? polygonArea(customCoords) : w * l,
      raw_pts: customCoords ? customCoords.slice(0, -1) : null,
    },
    geometry: mainGeom,
  });

  const addPartBox = (dlngM, dlatM, pw, pl, pBase, pHeight, pCol) => {
    const rad = (rot * Math.PI) / 180;
    const dx = dlngM * Math.cos(rad) - dlatM * Math.sin(rad);
    const dy = dlngM * Math.sin(rad) + dlatM * Math.cos(rad);
    const dlat = dy / 111320;
    const dlng = dx / ((40075000 * Math.cos((lat * Math.PI) / 180)) / 360);
    const id = getNextId();
    parts.push({
      type: 'Feature',
      id,
      properties: {
        id,
        parent_id: baseId,
        type: type,
        color: pCol,
        fillColor: pCol,
        base_height: pBase,
        height: pHeight,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [buildingPolygon(lng + dlng, lat + dlat, pw, pl, rot)],
      },
    });
  };

  const addWindowsRect = () => {
    const winCol = '#93c5fd';
    const numW = Math.max(1, Math.floor(w / 5));
    const numL = Math.max(1, Math.floor(l / 5));
    for (let f = 0; f < floors; f++) {
      const bH = f * 3.5 + 1.2,
        tH = bH + 1.2;
      for (let i = 0; i < numW; i++) {
        const offX = numW > 1 ? -w / 2 + (w / (numW + 1)) * (i + 1) : 0;
        addPartBox(offX, l / 2, 2, 0.1, bH, tH, winCol);
        addPartBox(offX, -l / 2, 2, 0.1, bH, tH, winCol);
      }
      for (let i = 0; i < numL; i++) {
        const offY = numL > 1 ? -l / 2 + (l / (numL + 1)) * (i + 1) : 0;
        addPartBox(w / 2, offY, 0.1, 2, bH, tH, winCol);
        addPartBox(-w / 2, offY, 0.1, 2, bH, tH, winCol);
      }
    }
  };

  if (type === 'custom_building') {
    addWindowsRect();
  } else if (type === 'house') {
    const roofCol = '#451a03';
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const ratio = 1 - i / steps;
      const bH = h + i * (1.8 / steps),
        tH = bH + 1.8 / steps;
      addPartBox(0, 0, (w + 0.6) * ratio, l + 0.6, bH, tH, roofCol);
    }
  } else if (type === 'building') {
    addPartBox(0, 0, w * 0.3, l * 0.3, h, h + 3, '#94a3b8');
    addWindowsRect();
  }

  return parts;
}

export function placeBuilding(type, lng, lat) {
  const cfg = TYPE_CONFIG[type];
  const w = cfg.defW || 10;
  const l = cfg.defL || 10;
  const h = cfg.defaultH || 5;
  const baseId = getNextId();

  const allParts = generateBuildingParts(baseId, lng, lat, w, l, h, 0, type);
  addFeatures(...allParts);

  pushHistory();
  refreshMap();
  toast(`${cfg.label} colocado en el terreno`, 'success');
  selectFeature(baseId, { lng, lat });
}
