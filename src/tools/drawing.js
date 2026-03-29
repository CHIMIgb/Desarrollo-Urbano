import { state, TYPE_CONFIG } from '../config/state.js';
import { lineLength, polygonArea, polygonPerimeter, catmullRom, catmullRomClosed, fmtArea, fmtLen } from '../utils/geo.js';
import { pushHistory } from './interaction.js';
import { refreshMap } from '../map/core.js';
import { toast, updateStats } from '../ui/toolbar.js';
import { selectFeature } from './selection.js';

export function finishLine() {
  if (state.drawPoints.length < 2) return;
  const pts = [...state.drawPoints];
  const type = state.tool === 'railway' ? 'railway' : 'road';
  const cfg = TYPE_CONFIG[type];
  const len = lineLength(pts);
  const lanes = 2; 
  const id = state.nextId++;
  const feat = {
    type: 'Feature', id,
    properties: {
      id, type: type, name: `${cfg.label} ${id}`, color: cfg.color, fillColor: cfg.fillColor,
      length_m: len, raw_pts: [...state.drawPoints], curved: false, lanes: lanes, widthM: lanes * 3.5
    },
    geometry: { type: 'LineString', coordinates: pts }
  };
  pushHistory();
  state.features.push(feat);
  clearDrawing(); refreshMap(); updateStats();
  toast(`${cfg.label} trazada — ${fmtLen(len)}`, 'success');
  selectFeature(id);
}

export function finishPolygon(type) {
  const pts = [...state.drawPoints, state.drawPoints[0]];
  const cfg = TYPE_CONFIG[type];
  const area = polygonArea(pts);
  const id = state.nextId++;

  let feat;
  if (type === 'custom_building') {
    const h = cfg.defaultH || 30;
    feat = {
        type: 'Feature', id,
        properties: {
          id, type: type, name: `${cfg.label} ${id}`, color: cfg.color, fillColor: cfg.fillColor,
          height: h, floors: Math.round(h / 3.5), area_m2: area, raw_pts: [...state.drawPoints], curved: false
        },
        geometry: { type: 'Polygon', coordinates: [pts] },
    };
  } else {
    feat = {
      type: 'Feature', id,
      properties: {
        id, type: type, name: `${cfg.label} ${id}`, color: cfg.color, fillColor: cfg.fillColor,
        area_m2: area, raw_pts: [...state.drawPoints], curved: false
      },
      geometry: { type: 'Polygon', coordinates: [pts] },
    };
    if (type === 'water') {
      feat.properties.depth_m = 2;
      feat.properties.volume_m3 = Math.round(area * 2);
    }
  }

  state.features.push(feat);
  pushHistory();
  clearDrawing(); refreshMap();
  toast(`${cfg.label} — ${fmtArea(area)}`, 'success');
  selectFeature(id);
}

export function finishRadius(lng, lat) {
  const id = state.nextId++;
  const cfg = TYPE_CONFIG['radius'];
  const r_m = 400; 
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const ang = (i / 32) * Math.PI * 2;
    const dlat = (r_m * Math.cos(ang)) / 111320;
    const dlng = (r_m * Math.sin(ang)) / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    pts.push([lng + dlng, lat + dlat]);
  }
  state.features.push({
    type: 'Feature', id,
    properties: { id, type: 'radius', name: `Radio ${id}`, color: cfg.color, fillColor: cfg.fillColor, raw_pts: [...pts], radius_m: r_m, area_m2: Math.round(Math.PI * r_m * r_m) },
    geometry: { type: 'Polygon', coordinates: [pts] }
  });
  pushHistory(); refreshMap(); updateStats();
  selectFeature(id);
}

export function updateDrawPreview() {
  const pts = state.drawPoints;
  if (!pts.length || !state.map) return;
  const features = [];
  if (pts.length >= 2) {
    const isPoly = ['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool);
    const curved = (state.tool === 'road' && document.getElementById('roadCurved')?.checked) ||
      (isPoly && document.getElementById('polyCurved')?.checked);
    if (isPoly && pts.length >= 3) {
      const polyCoords = curved ? catmullRomClosed(pts) : [...pts, pts[0]];
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [polyCoords] }, properties: {} });
    } else {
      const lineCoords = curved && pts.length > 2 ? catmullRom(pts) : [...pts];
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: lineCoords }, properties: {} });
    }
  }
  pts.forEach(p => features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
  state.map.getSource('draw-preview')?.setData({ type: 'FeatureCollection', features });
}

export function updateLiveMeasure(lng, lat) {
  const pts = [...state.drawPoints, [lng, lat]];
  const el = document.getElementById('drawMeasure');
  if (!el) return;
  if (pts.length < 2) { el.style.display = 'none'; return; }
  const isPolygon = ['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool);
  let text = '';
  if (isPolygon && pts.length >= 3) {
    const closed = [...pts, pts[0]];
    text = `Área: ${fmtArea(polygonArea(closed))} · Perímetro: ${fmtLen(polygonPerimeter(closed))}`;
  } else {
    text = `Longitud: ${fmtLen(lineLength(pts))}`;
  }
  el.textContent = text; el.style.display = 'block';
}

export function clearDrawing() {
  state.drawPoints = [];
  if (state.map) {
    state.map.getSource('draw-preview')?.setData({ type: 'FeatureCollection', features: [] });
  }
  document.getElementById('drawHint').style.display = 'none';
  document.getElementById('drawMeasure').style.display = 'none';
}
