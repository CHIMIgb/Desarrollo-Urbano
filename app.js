/* =============================================================
   URBAN PLANNING 3D — app.js v2
   Nuevas funciones: edificios rotados + dimensiones, carreteras
   curvas + ancho, herramienta Terreno, mediciones completas
   ============================================================= */

// ── TILE SOURCES (sin API key)
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

// ── HELPERS GEO ──────────────────────────────────────────────
function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function lineLength(coords) {
  let t = 0;
  for (let i = 0; i < coords.length - 1; i++)
    t += haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  return t;
}
function polygonArea(coords) {
  // Shoelace in local meters
  if (coords.length < 3) return 0;
  const cLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const mLat = 111320, mLng = 111320 * Math.cos(cLat * Math.PI / 180);
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    area += (coords[j][0] * mLng + coords[i][0] * mLng) * (coords[j][1] * mLat - coords[i][1] * mLat);
  }
  return Math.abs(area / 2);
}
function polygonPerimeter(coords) { return lineLength(coords); }

// Bounding box dims of a polygon (lat/lon → meters)
function polygonBBox(coords) {
  const lngs = coords.map(c => c[0]), lats = coords.map(c => c[1]);
  const cLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const mLng = 111320 * Math.cos(cLat * Math.PI / 180), mLat = 111320;
  const w = (Math.max(...lngs) - Math.min(...lngs)) * mLng;
  const h = (Math.max(...lats) - Math.min(...lats)) * mLat;
  return { width: w, length: h };
}

// Rotated rectangle polygon from center + dims + bearing
function buildingPolygon(cLng, cLat, widthM, lengthM, rotDeg) {
  const r = Math.PI / 180;
  // Half-dimensions in local offset meters
  const hw = widthM / 2;
  const hl = lengthM / 2;
  const a = rotDeg * r, cos = Math.cos(a), sin = Math.sin(a);
  // Unrotated corners in meters (origin at 0,0)
  const raw = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
  // Factors to convert meters back to degrees at this latitude
  const mLat = 111320;
  const mLng = 111320 * Math.cos(cLat * r);

  const pts = raw.map(([x, y]) => {
    // 1. Rotate in meters space
    const rx = x * cos - y * sin;
    const ry = x * sin + y * cos;
    // 2. Convert to geographic degrees
    return [cLng + (rx / mLng), cLat + (ry / mLat)];
  });
  pts.push(pts[0]);
  return pts;
}

// Catmull-Rom spline smoothing
function catmullRom(pts, steps = 10) {
  if (pts.length < 2) return pts;
  const ext = [pts[0], ...pts, pts[pts.length - 1]];
  const result = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    for (let t = 0; t < steps; t++) {
      const tt = t / steps, t2 = tt * tt, t3 = t2 * tt;
      result.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * tt + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * tt + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  result.push(pts[pts.length - 1]);
  return result;
}

// Catmull-Rom closed spline smoothing
function catmullRomClosed(pts, steps = 10) {
  if (pts.length < 3) return [...pts, pts[0]];
  const ext = [pts[pts.length - 1], ...pts, pts[0], pts[1]];
  const result = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    for (let t = 0; t < steps; t++) {
      const tt = t / steps, t2 = tt * tt, t3 = t2 * tt;
      result.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * tt + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * tt + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  result.push(result[0]); // Explicitly close it
  return result;
}

// Format helpers
function fmtLen(m) {
  if (m == null || isNaN(m)) return '—';
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km';
  return (Math.round(m * 10) / 10).toLocaleString() + ' m';
}
function fmtArea(m2) {
  if (m2 == null || isNaN(m2)) return '—';
  if (m2 >= 10000) return (m2 / 10000).toFixed(2) + ' ha';
  return (Math.round(m2 * 10) / 10).toLocaleString() + ' m²';
}
function fmtVol(m3) {
  if (m3 == null || isNaN(m3)) return '—';
  return (Math.round(m3 * 10) / 10).toLocaleString() + ' m³';
}

// ── TYPE CONFIG ───────────────────────────────────────────────
const TYPE_CONFIG = {
  house: { label: 'Casa', color: '#fbbf24', fillColor: '#f59e0b' },
  building: { label: 'Edificio', color: '#818cf8', fillColor: '#6366f1' },
  custom_building: { label: 'Silueta 3D', color: '#a78bfa', fillColor: '#8b5cf6' },
  road: { label: 'Carretera', color: '#94a3b8', fillColor: '#cbd5e1' },
  park: { label: 'Parque', color: '#4ade80', fillColor: '#22c55e' },
  zone: { label: 'Zona', color: '#f472b6', fillColor: '#ec4899' },
  terrain: { label: 'Terreno', color: '#fdba74', fillColor: '#fb923c' },
  water: { label: 'Cuerpo de Agua', color: '#38bdf8', fillColor: '#0284c7' },
  tree: { label: 'Árbol 3D', color: '#4ade80', fillColor: '#16a34a' },
  railway: { label: 'Vía Férrea', color: '#64748b', fillColor: '#334155' },
  radius: { label: 'Isócrona', color: '#f0abfc', fillColor: '#c026d3' },
  furniture: { label: 'Mobiliario', color: '#9ca3af', fillColor: '#d1d5db' }
};

// ── STATE ─────────────────────────────────────────────────────
const state = {
  features: [], selectedIds: [], tool: 'select',
  is3D: true, isSatellite: true,
  drawPoints: [],
  history: [], future: [],
  nextId: 1, popup: null,
  draggingFeatureId: null, lastDragPos: null, isDragging: false,
  draggingVertexIdx: null,
};

// ── MAP INIT ──────────────────────────────────────────────────
let map;
function initMap() {
  // 1. Try to load saved view from localStorage
  let initialView = {
    center: [-99.1332, 19.4326], // Default: CDMX
    zoom: 13,
    pitch: 65,
    bearing: -20
  };

  const savedView = localStorage.getItem('urbanPlan_view');
  let hasSavedView = false;
  if (savedView) {
    try {
      initialView = JSON.parse(savedView);
      hasSavedView = true;
    } catch (e) { console.error('Error loading saved view', e); }
  }

  map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    center: initialView.center,
    zoom: initialView.zoom,
    pitch: initialView.pitch,
    bearing: initialView.bearing,
    antialias: true,
    maxPitch: 85,
  });

  // 2. If no saved view, try geolocation
  if (!hasSavedView && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const center = [pos.coords.longitude, pos.coords.latitude];
        map.flyTo({ center, zoom: 16, duration: 2000 });
        // Save initial spot
        saveMapView();
      },
      err => { console.warn('Geolocation denied or failed', err); },
      { enableHighAccuracy: true }
    );
  }

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
  map.doubleClickZoom.disable();

  // Save view state on any move
  const saveMapView = () => {
    const view = {
      center: map.getCenter().toArray(),
      zoom: map.getZoom(),
      pitch: map.getPitch(),
      bearing: map.getBearing()
    };
    localStorage.setItem('urbanPlan_view', JSON.stringify(view));
  };

  map.on('moveend', saveMapView);
  map.on('zoomend', saveMapView);
  map.on('pitchend', saveMapView);
  map.on('rotateend', saveMapView);

  map.on('load', () => { addTerrainSource(); addDataLayers(); toast('Terreno 3D listo', 'success'); });
  map.on('mousemove', e => {
    const { lng, lat } = e.lngLat;
    document.getElementById('coordDisplay').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if (state.drawPoints.length > 0) updateLiveMeasure(lng, lat);

    if (state.draggingVertexIdx !== null && state.draggingVertexIdx !== undefined) {
      const f = state.features.find(x => x.properties.id === state.selectedIds[0]);
      if (f && f.properties.raw_pts) {
        f.properties.raw_pts[state.draggingVertexIdx] = [lng, lat];
        if (f.properties.type === 'road') {
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
  });
  map.on('mouseup', () => {
    if (state.draggingVertexIdx !== null && state.draggingVertexIdx !== undefined) {
      state.draggingVertexIdx = null; map.getCanvas().style.cursor = ''; pushHistory();
    }
    if (state.draggingFeatureId) {
      state.draggingFeatureId = null;
      map.getCanvas().style.cursor = state.tool === 'move' ? 'grab' : '';
      if (state.isDragging) pushHistory();
    }
  });
  map.on('click', handleMapClick);
  map.on('dblclick', handleMapDblClick);

  // Right click to close
  map.on('contextmenu', e => {
    if (['road', 'railway', 'park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool)) {
      e.preventDefault();
      if (['road', 'railway'].includes(state.tool) && state.drawPoints.length >= 2) finishLine();
      else if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool) && state.drawPoints.length >= 3) finishPolygon(state.tool);
    }
  });

  // Box Zoom for selection
  map.on('boxzoomend', e => {
    const bbox = [[e.boxZoomBoundingBox[0].x, e.boxZoomBoundingBox[0].y], [e.boxZoomBoundingBox[1].x, e.boxZoomBoundingBox[1].y]];
    const feats = map.queryRenderedFeatures(bbox, { layers: ['layer-buildings', 'layer-roads', 'layer-zones-fill', 'layer-trees-3d', 'layer-railways'] });
    const ids = [...new Set(feats.map(f => f.properties.id))];
    if (ids.length) {
      state.selectedIds = e.originalEvent.shiftKey ? [...new Set([...state.selectedIds, ...ids])] : ids;
      updateSelectionUI();
    }
  });

  // Sync sliders when map is moved by mouse (Right-Click Drag)
  map.on('rotate', () => {
    const b = Math.round(map.getBearing());
    const cb = document.getElementById('cameraBearing');
    if (cb && cb.value != b) {
      cb.value = b;
      document.getElementById('cameraBearingVal').textContent = b + '°';
    }
  });
  map.on('pitch', () => {
    const p = Math.round(map.getPitch());
    const cp = document.getElementById('cameraPitch');
    if (cp && cp.value != p) {
      cp.value = p;
      document.getElementById('cameraPitchVal').textContent = p + '°';
    }
  });
}

// ── STYLE BUILDER ─────────────────────────────────────────────
function buildStyle() {
  const srcId = state.isSatellite ? 'satellite' : 'osm';
  const tiles = state.isSatellite ? SATELLITE_URL : OSM_URL;
  const attr = state.isSatellite ? '© Esri, Maxar' : '© OpenStreetMap contributors';
  return {
    version: 8,
    sources: { [srcId]: { type: 'raster', tiles: [tiles], tileSize: 256, attribution: attr, maxzoom: 19 } },
    layers: [{ id: 'base', type: 'raster', source: srcId }],
    glyphs: GLYPHS_URL
  };
}

// ── TERRAIN ───────────────────────────────────────────────────
function addTerrainSource() {
  if (!map.getSource('terrain'))
    map.addSource('terrain', { type: 'raster-dem', tiles: [TERRAIN_URL], tileSize: 256, encoding: 'terrarium', maxzoom: 15 });
  const exag = parseFloat(document.getElementById('terrainExaggeration').value);
  map.setTerrain({ source: 'terrain', exaggeration: exag });
  try { map.setFog({ 'color': 'rgb(15,18,30)', 'high-color': 'rgb(40,50,80)', 'horizon-blend': 0.08, 'space-color': 'rgb(5,8,20)', 'star-intensity': 0.5 }); } catch (e) { }
}

// ── IMPORT/EXPORT ─────────────────────────────────────────────
document.getElementById('btnExport')?.addEventListener('click', () => {
  const data = JSON.stringify({ features: state.features, nextId: state.nextId }, null, 2);
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
        pushHistory(); refreshMap(); updateStats();
        toast('Proyecto importado con éxito', 'success');
      } else toast('Archivo inválido', 'error');
    } catch (err) { toast('Error al leer el archivo', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ── CONFIGURATION & LABELS ───────────────────────────────────────────────
function addDataLayers() {
  map.addSource('urban-data', { type: 'geojson', data: buildGeoJSON() });

  // Roads
  const zoomInterpolation = ['interpolate', ['exponential', 2], ['zoom'], 
    12, ['/', ['coalesce', ['get', 'widthM'], 7], 1.0], 
    16, ['*', ['coalesce', ['get', 'widthM'], 7], 2.4], 
    20, ['*', ['coalesce', ['get', 'widthM'], 7], 8.0]
  ];
  map.addLayer({
    id: 'layer-roads', type: 'line', source: 'urban-data',
    filter: ['==', ['get', 'type'], 'road'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-opacity': 0.9,
      'line-width': zoomInterpolation,
    }
  });

  const laneRatios = [
    [2, 0, 3, -0.166, 4, -0.25, 5, -0.3, 6, -0.333, 7, -0.357],
    [3, 0.166, 4, 0, 5, -0.1, 6, -0.166, 7, -0.214],
    [4, 0.25, 5, 0.1, 6, 0, 7, -0.071],
    [5, 0.3, 6, 0.166, 7, 0.071],
    [6, 0.333, 7, 0.214],
    [7, 0.357]
  ];
  laneRatios.forEach((ratios, i) => {
    const matchExpr = ['match', ['coalesce', ['get', 'lanes'], 2]];
    for (let j = 0; j < ratios.length; j += 2) { matchExpr.push(ratios[j], ratios[j + 1]); }
    matchExpr.push(0);
    map.addLayer({
      id: `layer-roads-div-${i + 1}`, type: 'line', source: 'urban-data',
      filter: ['all', ['==', ['get', 'type'], 'road'], ['>=', ['coalesce', ['get', 'lanes'], 2], ratios[0]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff', 'line-dasharray': [6, 4],
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 20, 6],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.9],
        'line-offset': ['*', zoomInterpolation, matchExpr]
      }
    });
  });

  const zoneFilter = ['match', ['get', 'type'], ['zone', 'park', 'terrain', 'water', 'radius'], true, false];
  map.addLayer({
    id: 'layer-zones-fill', type: 'fill', source: 'urban-data', filter: zoneFilter,
    paint: {
      'fill-color': ['get', 'fillColor'],
      'fill-opacity': ['match', ['get', 'type'], 'radius', 0.15, 'water', 0.65, 0.25]
    }
  });
  map.addLayer({
    id: 'layer-zones-line', type: 'line', source: 'urban-data', filter: zoneFilter,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [4, 2] }
  });

  map.addLayer({
    id: 'layer-trees-3d', type: 'fill-extrusion', source: 'urban-data', filter: ['==', ['get', 'type'], 'tree'],
    paint: {
      'fill-extrusion-color': ['get', 'fillColor'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 0.95
    }
  });

  map.addLayer({
    id: 'layer-furniture', type: 'fill-extrusion', source: 'urban-data', filter: ['==', ['get', 'type'], 'furniture'],
    paint: {
      'fill-extrusion-color': ['get', 'fillColor'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 1.0
    }
  });

  map.addLayer({
    id: 'layer-railways', type: 'line', source: 'urban-data', filter: ['==', ['get', 'type'], 'railway'],
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 18, 6] }
  });
  map.addLayer({
    id: 'layer-railways-dash', type: 'line', source: 'urban-data', filter: ['==', ['get', 'type'], 'railway'],
    paint: { 'line-color': '#f97316', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 18, 3], 'line-dasharray': [2, 2] }
  });

  const bldFilter = ['match', ['get', 'type'], ['house', 'building', 'custom_building'], true, false];
  map.addLayer({
    id: 'layer-buildings', type: 'fill-extrusion', source: 'urban-data', filter: bldFilter,
    paint: {
      'fill-extrusion-color': ['get', 'fillColor'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 0.85,
    }
  });
  map.addLayer({
    id: 'layer-buildings-outline', type: 'line', source: 'urban-data', filter: bldFilter,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.8 }
  });

  // Draw preview
  map.addSource('draw-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'layer-draw-line', type: 'line', source: 'draw-preview',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#6366f1', 'line-width': 2, 'line-dasharray': [4, 3] }
  });
  map.addLayer({
    id: 'layer-draw-fill', type: 'fill', source: 'draw-preview',
    paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.1 }
  });
  map.addLayer({
    id: 'layer-draw-pts', type: 'circle', source: 'draw-preview',
    paint: { 'circle-radius': 5, 'circle-color': '#6366f1', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
  });

  // Highlight layer
  map.addLayer({
    id: 'highlight-polygons', type: 'line', source: 'urban-data',
    filter: ['in', ['get', 'id'], ['literal', ['']]],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 3, 'line-dasharray': [2, 2] }
  });

  // Edit Handles Layer
  map.addSource('edit-handles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'layer-edit-handles', type: 'circle', source: 'edit-handles',
    paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#ef4444' }
  });

  map.on('mousedown', 'layer-edit-handles', e => {
    e.preventDefault(); e.originalEvent.stopPropagation();
    state.draggingVertexIdx = e.features[0].properties.idx;
    map.getCanvas().style.cursor = 'grabbing';
  });
  map.on('mouseenter', 'layer-edit-handles', () => { if (['select', 'move'].includes(state.tool)) map.getCanvas().style.cursor = 'grab'; });
  map.on('mouseleave', 'layer-edit-handles', () => { map.getCanvas().style.cursor = ''; });

  // Click interactivity
  ['layer-buildings', 'layer-roads', 'layer-zones-fill', 'layer-trees-3d', 'layer-railways', 'layer-furniture'].forEach(lid => {
    map.on('mousedown', lid, e => {
      if (state.tool !== 'move') return;
      e.preventDefault();
      let id = e.features[0]?.properties?.id;
      if (!id) return;
      if (e.features[0].properties.parent_id) id = e.features[0].properties.parent_id;
      state.draggingFeatureId = id;
      state.lastDragPos = e.lngLat;
      state.isDragging = false;
      map.getCanvas().style.cursor = 'grabbing';
      if (state.popup) { state.popup.remove(); state.popup = null; }
    });
    map.on('click', lid, e => {
      let id = e.features[0]?.properties?.id;
      if (!id) return;
      if (e.features[0].properties.parent_id) id = e.features[0].properties.parent_id;
      if (['select', 'delete'].includes(state.tool)) {
        e.originalEvent.stopPropagation();
        if (state.tool === 'delete') { state.selectedIds = [id]; deleteSelection(); }
        else selectFeature(id, e.lngLat, e.originalEvent.shiftKey);
      } else if (state.tool === 'move') {
        e.originalEvent.stopPropagation();
        if (!state.isDragging) selectFeature(id, e.lngLat, e.originalEvent.shiftKey);
      }
    });
    map.on('mouseenter', lid, () => {
      if (['select', 'delete', 'move'].includes(state.tool))
        map.getCanvas().style.cursor = state.tool === 'delete' ? 'not-allowed' : state.tool === 'move' ? 'grab' : 'pointer';
    });
    map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
  });
}

// ── GEOJSON BUILDER ───────────────────────────────────────────
function buildGeoJSON() {
  return { type: 'FeatureCollection', features: state.features };
}
function refreshMap() {
  map.getSource('urban-data')?.setData(buildGeoJSON());
  updateStats();
}

// ── INTERACTION HANDLERS ──────────────────────────────────────
function handleMapClick(e) {
  if (state.tool === 'move' || state.tool === 'delete' || state.tool === 'select') return;
  const { lng, lat } = e.lngLat;

  if (['house', 'building'].includes(state.tool)) {
    placeBuilding(state.tool, lng, lat); return;
  } else if (state.tool === 'tree') {
    finishTree(lng, lat); return;
  } else if (state.tool === 'furniture') {
    finishFurniture(lng, lat); return;
  } else if (state.tool === 'radius') {
    finishRadius(lng, lat); return;
  } else {
    // Check click-to-close
    if (state.drawPoints.length > 0) {
      const p = e.point;
      if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool) && state.drawPoints.length >= 3) {
        const firstP = map.project(state.drawPoints[0]);
        if (Math.hypot(p.x - firstP.x, p.y - firstP.y) < 20) { finishPolygon(state.tool); return; }
      } else if (['road', 'railway'].includes(state.tool) && state.drawPoints.length >= 2) {
        const lastP = map.project(state.drawPoints[state.drawPoints.length - 1]);
        if (Math.hypot(p.x - lastP.x, p.y - lastP.y) < 20) { finishLine(); return; }
      }
    }

    state.drawPoints.push([lng, lat]);
    updateDrawPreview();
    if (state.drawPoints.length === 1) {
      document.getElementById('drawHint').style.display = 'block';
      document.getElementById('drawHintText').textContent =
        ['road', 'railway'].includes(state.tool)
          ? 'Traza con clic Izquierdo · Clic DERECHO para terminar'
          : 'Traza con clic Izquierdo · Clic DERECHO para cerrar';
    }
  }
}
function handleMapDblClick(e) {
  e.preventDefault();
}

function generateBuildingParts(baseId, lng, lat, w, l, h, rot, type) {
  const cfg = TYPE_CONFIG[type];
  const parts = [];
  const floors = Math.round(h / 3.5) || 1;
  const darkFac = (col, amt) => {
    // Simple hex darken (not perfect but works for low-poly)
    return col === cfg.fillColor ? '#374151' : col; 
  };

  // 1. Cuerpo Principal
  parts.push({
    type: 'Feature', id: baseId,
    properties: {
      id: baseId, type, name: `${cfg.label} ${baseId}`, height: h, floors,
      color: cfg.color, fillColor: cfg.fillColor, 
      uso_suelo: type === 'building' ? 'comercial' : 'habitacional',
      center_lng: lng, center_lat: lat, width_m: w, length_m: l, rotation: rot,
      area_m2: w * l
    },
    geometry: { type: 'Polygon', coordinates: [buildingPolygon(lng, lat, w, l, rot)] }
  });

  const addPartBox = (dlngM, dlatM, pw, pl, pBase, pHeight, pCol) => {
    const rad = rot * Math.PI / 180;
    const dx = dlngM * Math.cos(rad) - dlatM * Math.sin(rad);
    const dy = dlngM * Math.sin(rad) + dlatM * Math.cos(rad);
    const dlat = dy / 111320;
    const dlng = dx / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    const id = state.nextId++;
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: baseId, type: type, color: pCol, fillColor: pCol, base_height: pBase, height: pHeight },
      geometry: { type: 'Polygon', coordinates: [buildingPolygon(lng + dlng, lat + dlat, pw, pl, rot)] }
    });
  };

  if (type === 'house') {
    // Techo a dos aguas más triangular (8 pasos)
    const roofCol = '#451a03'; // Marrón oscuro / Teja
    const steps = 8;
    for (let i = 0; i < steps; i++) {
        const ratio = 1 - (i / steps);
        const bH = h + (i * (1.8 / steps));
        const tH = bH + (1.8 / steps);
        // El techo se encoge en el ancho (w) para formar el ángulo
        addPartBox(0, 0, (w + 0.6) * ratio, l + 0.6, bH, tH, roofCol);
    }
  } else if (type === 'building') {
    // Detalles de Azotea
    addPartBox(0, 0, w * 0.3, l * 0.3, h, h + 3, '#94a3b8'); // Cuarto de máquinas
    
    // Ventanas dinámicas (proporcionales: 1 cada 5 metros aprox)
    const winCol = '#93c5fd'; // Azul claro
    const numW = Math.max(1, Math.floor(w / 5));
    const numL = Math.max(1, Math.floor(l / 5));

    for (let f = 0; f < floors; f++) {
      const bH = f * 3.5 + 1.2;
      const tH = bH + 1.2;
      
      // Lados Norte/Sur (distribución a lo largo del ancho w)
      for (let i = 0; i < numW; i++) {
          const offX = (numW > 1) ? (-w/2 + (w / (numW + 1)) * (i + 1)) : 0;
          addPartBox(offX, l/2, 2, 0.1, bH, tH, winCol); // Norte
          addPartBox(offX, -l/2, 2, 0.1, bH, tH, winCol); // Sur
      }
      // Lados Este/Oeste (distribución a lo largo del largo l)
      for (let i = 0; i < numL; i++) {
          const offY = (numL > 1) ? (-l/2 + (l / (numL + 1)) * (i + 1)) : 0;
          addPartBox(w/2, offY, 0.1, 2, bH, tH, winCol); // Este
          addPartBox(-w/2, offY, 0.1, 2, bH, tH, winCol); // Oeste
      }
    }
  }

  return parts;
}

// ── PLACE BUILDING ────────────────────────────────────────────
function placeBuilding(type, lng, lat) {
  const cfg = TYPE_CONFIG[type];
  const w = cfg.defW || 10;
  const l = cfg.defL || 10;
  const h = cfg.defaultH || 5;
  const baseId = state.nextId++;
  
  const allParts = generateBuildingParts(baseId, lng, lat, w, l, h, 0, type);
  state.features.push(...allParts);
  
  pushHistory();
  refreshMap();
  toast(`${cfg.label} colocado`, 'success');
  selectFeature(baseId, { lng, lat });
}

// ── LINE (ROAD/RAILWAY) ───────────────────────────────────────
function finishLine() {
  if (state.drawPoints.length < 2) return;
  const isCurved = false; // Default: straight, can be toggled in side panel
  const pts = [...state.drawPoints];
  const type = state.tool === 'railway' ? 'railway' : 'road';
  const cfg = TYPE_CONFIG[type];
  const len = lineLength(pts);
  const lanes = 2; // Default 2 lanes
  const id = state.nextId++;
  const feat = {
    type: 'Feature', id,
    properties: {
      id, type: type, name: `${cfg.label} ${id}`, color: cfg.color, fillColor: cfg.fillColor,
      length_m: len, raw_pts: [...state.drawPoints], curved: !!isCurved, lanes: lanes, widthM: lanes * 3.5
    },
    geometry: { type: 'LineString', coordinates: pts }
  };
  pushHistory();
  state.features.push(feat);
  clearDrawing(); refreshMap(); updateStats();
  toast(`${cfg.label} trazada — ${fmtLen(len)}`, 'success');
  selectFeature(id);
}

// ── POLYGON ───────────────────────────────────────────────────
function finishPolygon(type) {
  const isCurved = false; // Default: straight, can be curved in properties panel
  const pts = [...state.drawPoints, state.drawPoints[0]];
  const cfg = TYPE_CONFIG[type];
  const area = polygonArea(pts);
  const peri = polygonPerimeter(pts);
  const id = state.nextId++;
  const feat = {
    type: 'Feature', id,
    properties: {
      id, type: type, name: `${cfg.label} ${id}`, color: cfg.color, fillColor: cfg.fillColor,
      area_m2: area, perimeter_m: peri, raw_pts: [...state.drawPoints], curved: !!isCurved
    },
    geometry: { type: 'Polygon', coordinates: [pts] },
  };
  if (type === 'custom_building') {
    feat.properties.height = cfg.defaultH;
    feat.properties.floors = Math.round(cfg.defaultH / 3.5);
    feat.properties.uso_suelo = 'mixto';
  } else if (type === 'water') {
    const depth = 2; // Default 2m, can be edited in side panel
    feat.properties.depth_m = depth;
    feat.properties.volume_m3 = Math.round(area * depth);
  }
  pushHistory();
  state.features.push(feat);
  clearDrawing(); refreshMap();
  toast(`${cfg.label} — ${fmtArea(area)}`, 'success');
  selectFeature(id);
}

// ── ADDITIONAL POINT/CIRCULAR TOOLS ─────────────────────────
function buildTreePolygon(lng, lat, radiusM) {
  const pts = [];
  // 6 sides (Hexagon) for a beautiful low-poly tree look
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const dlat = (radiusM * Math.cos(ang)) / 111320;
    const dlng = (radiusM * Math.sin(ang)) / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    pts.push([lng + dlng, lat + dlat]);
  }
  return [...pts, pts[0]];
}

function finishTree(lng, lat) {
  const treeType = document.getElementById('treeType')?.value || 'pino';
  let totalH = 8; // Base height set to 8m (with organic variation below)

  // Randomize actual height slightly for organic scale 
  totalH = totalH * (0.85 + Math.random() * 0.3);

  const trunkId = state.nextId++;
  const cfg = TYPE_CONFIG['tree'];
  const parts = [];

  const tc = '#451a03'; const tf = '#78350f'; // Trunk colors
  const cc = cfg.color; const cf = cfg.fillColor; // Canopy colors

  const addPart = (rM, base, h, colC, colF) => {
    const id = state.nextId++;
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: trunkId, type: 'tree', color: colC, fillColor: colF, base_height: base, height: Math.round(h * 10) / 10 },
      geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng, lat, rM)] }
    });
  };
  const addOffPart = (dlngM, dlatM, rM, base, h, colC, colF) => {
    const dlat = dlatM / 111320;
    const dlng = dlngM / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    const id = state.nextId++;
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: trunkId, type: 'tree', color: colC, fillColor: colF, base_height: base, height: Math.round(h * 10) / 10 },
      geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng + dlng, lat + dlat, rM)] }
    });
  };

  // Base Trunk feature
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
      addPart(r, base, base + stepH * 1.4, cc, cf); // overlap stepH * 1.4 creates dense effect
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

  state.features.push(...parts);
  pushHistory(); refreshMap(); updateStats();
  selectFeature(trunkId);
}
function generateFurnitureParts(baseId, lng, lat, rot, fType) {
  const cfg = TYPE_CONFIG['furniture'];
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

  const addOffCircle = (dlngM, dlatM, rM, base, h, col) => {
    const rad = rot * Math.PI / 180;
    const dx = dlngM * Math.cos(rad) - dlatM * Math.sin(rad);
    const dy = dlngM * Math.sin(rad) + dlatM * Math.cos(rad);
    const dlat = dy / 111320;
    const dlng = dx / (40075000 * Math.cos(lat * Math.PI / 180) / 360);
    const id = state.nextId++;
    parts.push({
      type: 'Feature', id,
      properties: { id, parent_id: baseId, type: 'furniture', color: col, fillColor: col, base_height: base, height: Math.round(h * 10) / 10 },
      geometry: { type: 'Polygon', coordinates: [buildTreePolygon(lng + dlng, lat + dlat, rM)] }
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
    // Luces
    addOffBox(0, 0.22, 0.2, 0.05, 0, 4.5, 4.8, '#ef4444');
    addOffBox(0, 0.22, 0.2, 0.05, 0, 4.1, 4.4, '#eab308');
    addOffBox(0, 0.22, 0.2, 0.05, 0, 3.7, 4.0, '#22c55e');
    // Semáforo peatonal
    addOffBox(0.22, 0, 0.05, 0.2, 0, 2.5, 3.0, darkCol);
    addOffBox(0.24, 0, 0.02, 0.15, 0, 2.55, 2.7, '#22c55e');
  } else if (fType === 'semaforo_brazo') {
    parts[0].properties.height = 0.8;
    addCircle(0.15, 0.8, 6.2, poleCol);
    
    // Brazo extendido hacia la izquierda (-X)
    addOffBox(-2.25, 0, 4.5, 0.15, 0, 6.0, 6.2, poleCol);

    // Semáforo colgante (Extremo del brazo)
    addOffBox(-4.2, 0, 0.4, 0.4, 0, 4.6, 6.0, darkCol);
    addOffBox(-4.2, 0.22, 0.2, 0.05, 0, 5.5, 5.8, '#ef4444');
    addOffBox(-4.2, 0.22, 0.2, 0.05, 0, 5.1, 5.4, '#eab308');
    addOffBox(-4.2, 0.22, 0.2, 0.05, 0, 4.7, 5.0, '#22c55e');

    // Semáforo en el poste
    addOffBox(-0.35, 0, 0.4, 0.4, 0, 3.5, 4.9, darkCol);
    addOffBox(-0.35, 0.22, 0.2, 0.05, 0, 4.4, 4.7, '#ef4444');
    addOffBox(-0.35, 0.22, 0.2, 0.05, 0, 4.0, 4.3, '#eab308');
    addOffBox(-0.35, 0.22, 0.2, 0.05, 0, 3.6, 3.9, '#22c55e');
    
    // Control de tráfico (caja en el poste inferior)
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

function finishFurniture(lng, lat) {
  const fType = document.getElementById('furnitureType')?.value || 'semaforo';
  const rot = parseFloat(document.getElementById('furnitureRot')?.value || 0);
  const baseId = state.nextId++;
  const parts = generateFurnitureParts(baseId, lng, lat, rot, fType);
  state.features.push(...parts);
  pushHistory(); refreshMap(); updateStats();
  selectFeature(baseId);
}

function finishRadius(lng, lat) {
  const id = state.nextId++;
  const cfg = TYPE_CONFIG['radius'];
  const r_m = 400; // Default radius 400m
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

// ── DRAW PREVIEW ──────────────────────────────────────────────
function updateDrawPreview() {
  const pts = state.drawPoints;
  if (!pts.length) return;
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
  map.getSource('draw-preview')?.setData({ type: 'FeatureCollection', features });
}

function updateLiveMeasure(lng, lat) {
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

function clearDrawing() {
  state.drawPoints = [];
  map.getSource('draw-preview')?.setData({ type: 'FeatureCollection', features: [] });
  document.getElementById('drawHint').style.display = 'none';
  document.getElementById('drawMeasure').style.display = 'none';
}

// ── SELECT / DELETE ───────────────────────────────────────────
function selectFeature(id, lngLat, isMulti = false) {
  if (isMulti) {
    if (state.selectedIds.includes(id)) state.selectedIds = state.selectedIds.filter(x => x !== id);
    else state.selectedIds.push(id);
  } else {
    state.selectedIds = [id];
  }
  updateSelectionUI(lngLat);
}

function updateSelectionUI(lngLat) {
  map.setFilter('highlight-polygons', ['in', ['get', 'id'], ['literal', state.selectedIds.length ? state.selectedIds : ['']]]);
  if (state.selectedIds.length === 1) {
    const feat = state.features.find(f => f.properties.id === state.selectedIds[0]);
    if (feat) showPropsPanel(feat, lngLat);
  } else if (state.selectedIds.length > 1) {
    showMultiPropsPanel();
  } else {
    document.getElementById('propsSection').style.display = 'none';
    state.popup?.remove(); state.popup = null;
  }
  updateEditHandles();
}

function updateEditHandles() {
  const feats = [];
  if (state.selectedIds.length === 1 && ['select', 'move'].includes(state.tool)) {
    const f = state.features.find(x => x.properties.id === state.selectedIds[0]);
    if (f && f.properties.raw_pts && !['house', 'building'].includes(f.properties.type)) {
      f.properties.raw_pts.forEach((pt, idx) => {
        feats.push({ type: 'Feature', properties: { fid: f.properties.id, idx }, geometry: { type: 'Point', coordinates: pt } });
      });
    }
  }
  map.getSource('edit-handles')?.setData({ type: 'FeatureCollection', features: feats });
}

function deleteSelection() {
  if (!state.selectedIds.length) return;
  pushHistory();
  const toDelete = new Set([...state.selectedIds]);
  // cascade delete to children
  state.features.forEach(f => {
    if (f.properties.parent_id && toDelete.has(f.properties.parent_id)) toDelete.add(f.properties.id);
  });
  state.features = state.features.filter(f => !toDelete.has(f.properties.id));
  state.selectedIds = []; updateSelectionUI();
  refreshMap(); toast('Objeto(s) eliminado(s)', 'error');
}

function translateFeature(id, dlng, dlat) {
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

// ── PROPERTIES PANEL ─────────────────────────────────────────
function showPropsPanel(feat, lngLat) {
  const p = feat.properties, cfg = TYPE_CONFIG[p.type] || {};
  document.getElementById('propsSection').style.display = 'block';
  const form = document.getElementById('propsForm');

  // ─ Measurement card HTML
  const measHTML = buildMeasureHTML(feat);

  // ─ Common fields
  let fields = `
    <div class="form-field"><label>Nombre</label><input type="text" id="prop-name" value="${p.name || ''}" /></div>
    ${measHTML}`;

  if (['house', 'building'].includes(p.type)) {
    fields += `
      <div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-w" value="${p.width_m || 10}" min="2" max="500" step="0.1"/></div>
      <div class="form-field"><label>Largo (m)</label><input type="number" id="prop-l" value="${p.length_m || 10}" min="2" max="500" step="0.1"/></div>
      <div class="form-field"><label>Altura (m)</label><input type="number" id="prop-height" value="${p.height || 5}" min="1" max="600" step="0.1"/></div>
      <div class="form-field"><label>Pisos</label><input type="number" id="prop-floors" value="${p.floors || 1}" min="1" max="200"/></div>
      <div class="form-field">
        <label>Rotación: <span id="propRotLabel">${Math.round(p.rotation || 0)}°</span></label>
        <input type="range" id="prop-rotation" min="0" max="359" step="1" value="${p.rotation || 0}" style="width:100%"/>
      </div>
      <div class="form-field"><label>Uso de suelo</label><select id="prop-uso">
        <option value="habitacional" ${p.uso_suelo === 'habitacional' ? 'selected' : ''}>Habitacional</option>
        <option value="comercial"    ${p.uso_suelo === 'comercial' ? 'selected' : ''}>Comercial</option>
        <option value="mixto"        ${p.uso_suelo === 'mixto' ? 'selected' : ''}>Mixto</option>
        <option value="industrial"   ${p.uso_suelo === 'industrial' ? 'selected' : ''}>Industrial</option>
      </select></div>`;
  } else if (p.type === 'custom_building') {
    fields += `
      <div class="form-field"><label>Altura (m)</label><input type="number" id="prop-height" value="${p.height || 30}" min="1" max="600" step="0.1"/></div>
      <div class="form-field"><label>Pisos</label><input type="number" id="prop-floors" value="${p.floors || 10}" min="1" max="200"/></div>
      <div class="form-field"><label>Uso de suelo</label><select id="prop-uso">
        <option value="habitacional" ${p.uso_suelo === 'habitacional' ? 'selected' : ''}>Habitacional</option>
        <option value="comercial"    ${p.uso_suelo === 'comercial' ? 'selected' : ''}>Comercial</option>
        <option value="mixto"        ${p.uso_suelo === 'mixto' ? 'selected' : ''}>Mixto</option>
        <option value="industrial"   ${p.uso_suelo === 'industrial' ? 'selected' : ''}>Industrial</option>
      </select></div>`;
  } else if (p.type === 'radius') {
    fields += `
      <div class="form-field">
        <label>Alcance (Radio): <span id="propRadLabel">${p.radius_m || 400}</span>m</label>
        <input type="range" id="prop-radius" min="50" max="5000" step="50" value="${p.radius_m || 400}" style="width:100%"/>
      </div>`;
  }
  if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(p.type)) {
    if (p.type === 'water') {
      fields += `<div class="form-field"><label>Profundidad (m)</label><input type="number" id="prop-water-depth" value="${p.depth_m || 2}" min="0.5" max="500" step="0.5"/></div>`;
    }
    fields += `
      <div class="form-field opt-toggle" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="prop-poly-curved" ${p.curved ? 'checked' : ''} style="display:none;" />
          <span class="toggle-track" style="margin:0"><span class="toggle-thumb"></span></span>
          <span style="font-size:11px;color:var(--text-primary);font-weight:500;">Curvas suaves</span>
        </label>
      </div>`;
  }
  if (['furniture'].includes(p.type)) {
    fields += `
      <div class="form-field">
        <label>Rotación: <span id="propRotLabel">${Math.round(p.rotation || 0)}°</span></label>
        <input type="range" id="prop-rotation" min="0" max="359" step="5" value="${Math.round(p.rotation || 0)}" style="width:100%"/>
      </div>`;
  }
  if (p.type === 'road') {
    fields += `
      <div class="form-field"><label>Tipo de vía</label><select id="prop-roadType">
        <option value="local"        ${p.roadType === 'local' ? 'selected' : ''}>Local</option>
        <option value="secundaria"   ${p.roadType === 'secundaria' ? 'selected' : ''}>Secundaria</option>
        <option value="primaria"     ${p.roadType === 'primaria' ? 'selected' : ''}>Primaria</option>
        <option value="autopista"    ${p.roadType === 'autopista' ? 'selected' : ''}>Autopista</option>
      </select></div>
      <div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-roadW" value="${p.widthM || 8}" min="2" max="60"/></div>
      <div class="form-field"><label>Carriles</label><input type="number" id="prop-lanes" value="${p.lanes || 2}" min="1" max="16"/></div>
      <div class="form-field opt-toggle" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="prop-curved" ${p.curved ? 'checked' : ''} style="display:none;" />
          <span class="toggle-track" style="margin:0"><span class="toggle-thumb"></span></span>
          <span style="font-size:11px;color:var(--text-primary);font-weight:500;">Curvas suaves</span>
        </label>
      </div>`;
  }
  fields += `
    <div class="form-field"><label>Color</label><input type="color" id="prop-color" value="${p.fillColor || '#6366f1'}"/></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnApplyProps">Aplicar</button>
      <button class="btn btn-secondary" id="btnDeleteSelected">Borrar</button>
    </div>`;

  form.innerHTML = fields;

  // Live events for buildings
  if (['house', 'building'].includes(p.type)) {
    const rotRange = document.getElementById('prop-rotation');
    const rotLabel = document.getElementById('propRotLabel');
    const wIn = document.getElementById('prop-w');
    const lIn = document.getElementById('prop-l');
    const hIn = document.getElementById('prop-height');
    const fIn = document.getElementById('prop-floors');

    const rebuildGeom = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      const w = parseFloat(wIn.value) || 10;
      const l = parseFloat(lIn.value) || 10;
      const h = parseFloat(hIn.value) || 5;
      const rot = parseFloat(rotRange.value) || 0;

      const baseId = f.properties.id;
      // Eliminar partes viejas
      state.features = state.features.filter(x => !(x.properties.id === baseId || x.properties.parent_id === baseId));
      
      // Regenerar partes nuevas
      const newParts = generateBuildingParts(baseId, f.properties.center_lng, f.properties.center_lat, w, l, h, rot, f.properties.type);
      state.features.push(...newParts);

      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(state.features.find(x => x.properties.id === baseId));
    };

    rotRange.addEventListener('input', () => { rotLabel.textContent = rotRange.value + '°'; rebuildGeom(); });
    [wIn, lIn, hIn].forEach(el => el?.addEventListener('input', rebuildGeom));
    fIn?.addEventListener('input', () => { if (hIn) hIn.value = Math.round(parseFloat(fIn.value) * 3.5); rebuildGeom(); });
  }

  // Live events for furniture
  if (p.type === 'furniture') {
    const rotRange = document.getElementById('prop-rotation');
    const rotLabel = document.getElementById('propRotLabel');
    const rebuildFurn = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      const rot = parseFloat(rotRange.value) || 0;
      f.properties.rotation = rot;

      const oldId = f.properties.id;
      // Filter out this object and its children from state array
      const oldLength = state.features.length;
      state.features = state.features.filter(x => !(x.properties.id === oldId || x.properties.parent_id === oldId));

      // Re-generate using the same base ID
      const newParts = generateFurnitureParts(oldId, f.properties.center_lng, f.properties.center_lat, rot, f.properties.furniture_type);
      state.features.push(...newParts);

      refreshMap();
    };
    rotRange?.addEventListener('input', () => { if (rotLabel) rotLabel.textContent = rotRange.value + '°'; rebuildFurn(); });
  }

  // Live events for custom building
  if (p.type === 'custom_building') {
    const hIn = document.getElementById('prop-height');
    const fIn = document.getElementById('prop-floors');
    const rebuildCB = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      f.properties.height = parseFloat(hIn.value) || 30;
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };
    hIn?.addEventListener('input', rebuildCB);
    fIn?.addEventListener('input', () => { if (hIn) hIn.value = Math.round(parseFloat(fIn.value) * 3.5); rebuildCB(); });
  }

  // Live events for curved polygons/parks/water
  if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(p.type)) {
    const curvedCb = document.getElementById('prop-poly-curved');
    const depthIn = document.getElementById('prop-water-depth');
    const rebuildPoly = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      if (curvedCb) {
        f.properties.curved = curvedCb.checked;
        if (f.properties.raw_pts) {
          const coords = f.properties.curved && f.properties.raw_pts.length > 2 ? catmullRomClosed(f.properties.raw_pts) : [...f.properties.raw_pts, f.properties.raw_pts[0]];
          f.geometry.coordinates = [coords];
          f.properties.area_m2 = Math.round(polygonArea(coords));
          f.properties.perimeter_m = Math.round(polygonPerimeter(coords));
        }
      }
      if (p.type === 'water' && depthIn) {
        f.properties.depth_m = parseFloat(depthIn.value) || 2;
        f.properties.volume_m3 = Math.round(f.properties.area_m2 * f.properties.depth_m);
      }
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };
    curvedCb?.addEventListener('change', rebuildPoly);
    depthIn?.addEventListener('input', rebuildPoly);
  }

  // Live events for roads
  if (p.type === 'road') {
    const wIn = document.getElementById('prop-roadW');
    const lIn = document.getElementById('prop-lanes');
    const curvedCb = document.getElementById('prop-curved');

    const rebuildRoad = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      f.properties.widthM = parseFloat(wIn.value) || 3;
      f.properties.lanes = parseInt(lIn.value) || 1;
      if (curvedCb) {
        f.properties.curved = curvedCb.checked;
        if (f.properties.raw_pts) {
          f.geometry.coordinates = f.properties.curved && f.properties.raw_pts.length > 2 ? catmullRom(f.properties.raw_pts) : [...f.properties.raw_pts];
          f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));
        }
      }
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };

    if (wIn && lIn) {
      lIn.addEventListener('input', () => { wIn.value = (parseFloat(lIn.value) * 3.5).toFixed(1) || 3.5; rebuildRoad(); });
      wIn.addEventListener('input', () => { lIn.value = Math.max(1, Math.round(parseFloat(wIn.value) / 3.5)) || 1; rebuildRoad(); });
      curvedCb?.addEventListener('change', rebuildRoad);
    }
  }

  // Live events for radius isochrone
  if (p.type === 'radius') {
    const radRange = document.getElementById('prop-radius');
    const radLabel = document.getElementById('propRadLabel');
    const rebuildRadius = () => {
      const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
      if (!f) return;
      f.properties.radius_m = parseFloat(radRange.value) || 400;
      const center = getFeatureCenter(f);
      if (!center) return;
      const pts = [];
      const r_m = f.properties.radius_m;
      for (let i = 0; i <= 32; i++) {
        const ang = (i / 32) * Math.PI * 2;
        const dlat = (r_m * Math.cos(ang)) / 111320;
        const dlng = (r_m * Math.sin(ang)) / (40075000 * Math.cos(center.lat * Math.PI / 180) / 360);
        pts.push([center.lng + dlng, center.lat + dlat]);
      }
      f.geometry.coordinates = [pts];
      f.properties.raw_pts = [...pts];
      f.properties.area_m2 = Math.round(Math.PI * r_m * r_m);
      refreshMap();
      const mc = document.getElementById('liveMeasures');
      if (mc) mc.innerHTML = buildMeasureHTML(f);
    };
    radRange?.addEventListener('input', () => { radLabel.textContent = radRange.value; rebuildRadius(); });
  }

  // Apply button
  document.getElementById('btnApplyProps').addEventListener('click', () => {
    pushHistory();
    const f = state.features.find(f => f.properties.id === state.selectedIds[0]);
    if (!f) return;
    f.properties.name = document.getElementById('prop-name').value;
    if (document.getElementById('prop-uso')) f.properties.uso_suelo = document.getElementById('prop-uso').value;
    if (document.getElementById('prop-roadType')) f.properties.roadType = document.getElementById('prop-roadType').value;
    if (document.getElementById('prop-height')) {
      const h = parseFloat(document.getElementById('prop-height').value) || f.properties.height;
      f.properties.height = h;
      if (document.getElementById('prop-floors')) f.properties.floors = parseInt(document.getElementById('prop-floors').value);
    }
    if (document.getElementById('prop-roadW')) {
      const w = parseFloat(document.getElementById('prop-roadW').value) || 8;
      f.properties.widthM = w;
      f.properties.lanes = document.getElementById('prop-lanes') ? parseInt(document.getElementById('prop-lanes').value) : Math.max(1, Math.round(w / 3));
    }
    if (document.getElementById('prop-curved')) {
      const curved = document.getElementById('prop-curved').checked;
      f.properties.curved = curved;
      if (f.properties.raw_pts) {
        f.geometry.coordinates = curved && f.properties.raw_pts.length > 2 ? catmullRom(f.properties.raw_pts) : [...f.properties.raw_pts];
        f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));
      }
    }
    if (document.getElementById('prop-poly-curved')) {
      f.properties.curved = document.getElementById('prop-poly-curved').checked;
    }
    if (document.getElementById('prop-water-depth')) {
      f.properties.depth_m = parseFloat(document.getElementById('prop-water-depth').value) || 2;
      f.properties.volume_m3 = Math.round(f.properties.area_m2 * f.properties.depth_m);
    }
    if (document.getElementById('prop-radius')) {
      f.properties.radius_m = parseFloat(document.getElementById('prop-radius').value) || 400;
    }
    const col = document.getElementById('prop-color').value;
    f.properties.fillColor = col; f.properties.color = col;
    refreshMap(); toast('Propiedades actualizadas', 'success');
  });
  document.getElementById('btnDeleteSelected').addEventListener('click', deleteSelection);

  // Map popup
  state.popup?.remove();
  if (lngLat) {
    const ctr = getFeatureCenter(feat);
    state.popup = new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
      .setLngLat(ctr || lngLat)
      .setHTML(`<div class="popup-name">${p.name || cfg.label}</div><div class="popup-type">${cfg.label || p.type}</div>
        <div class="popup-props">
          ${p.width_m ? `<div class="popup-prop"><span class="popup-prop-key">Ancho</span><span class="popup-prop-val">${fmtLen(p.width_m)}</span></div>` : ''}
          ${p.length_m ? `<div class="popup-prop"><span class="popup-prop-key">Largo</span><span class="popup-prop-val">${fmtLen(p.length_m)}</span></div>` : ''}
          ${p.height ? `<div class="popup-prop"><span class="popup-prop-key">Altura</span><span class="popup-prop-val">${p.height}m</span></div>` : ''}
          ${p.area_m2 ? `<div class="popup-prop"><span class="popup-prop-key">Área</span><span class="popup-prop-val">${fmtArea(p.area_m2)}</span></div>` : ''}
          ${p.length_m && p.type === 'road' ? `<div class="popup-prop"><span class="popup-prop-key">Long.</span><span class="popup-prop-val">${fmtLen(p.length_m)}</span></div>` : ''}
        </div>`)
      .addTo(map);
  }
}

function showMultiPropsPanel() {
  document.getElementById('propsSection').style.display = 'block';
  const form = document.getElementById('propsForm');
  form.innerHTML = `
    <div class="form-field"><label style="font-size:14px;color:var(--accent)">${state.selectedIds.length} objetos seleccionados</label></div>
    <div class="form-field"><label>Color unificado</label><input type="color" id="prop-multi-color" value="#6366f1"/></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnMultiApply">Aplicar</button>
      <button class="btn btn-secondary" id="btnMultiDelete">Borrar</button>
    </div>`;
  document.getElementById('btnMultiDelete').addEventListener('click', deleteSelection);
  document.getElementById('btnMultiApply').addEventListener('click', () => {
    pushHistory();
    const col = document.getElementById('prop-multi-color').value;
    state.features.forEach(f => {
      if (state.selectedIds.includes(f.properties.id)) { f.properties.color = col; f.properties.fillColor = col; }
    });
    refreshMap(); toast('Color aplicado a todos', 'success');
  });
  state.popup?.remove(); state.popup = null;
}

function buildMeasureHTML(feat) {
  const p = feat.properties;
  const isBuilding = ['house', 'building', 'custom_building'].includes(p.type);
  const isRoad = p.type === 'road';
  const isPoly = ['park', 'zone', 'terrain', 'custom_building', 'water'].includes(p.type);

  const items = [];
  if (p.width_m != null && !isRoad) items.push({ val: fmtLen(p.width_m), lbl: 'Ancho' });
  if (p.length_m != null && !isRoad) items.push({ val: fmtLen(p.length_m), lbl: 'Largo' });
  if (p.height != null && isBuilding) items.push({ val: p.height + 'm', lbl: 'Altura' });
  // Auto-calculated area box for simple buildings
  if (['house', 'building'].includes(p.type) && p.width_m && p.length_m && p.height) {
    items.push({ val: fmtArea(p.width_m * p.length_m), lbl: 'Área piso' }, { val: fmtVol(p.width_m * p.length_m * p.height), lbl: 'Volumen' });
  }
  // Free polygon area/volume
  if (isPoly && p.area_m2) {
    items.push({ val: fmtArea(p.area_m2), lbl: 'Área' });
    if (isBuilding && p.height) items.push({ val: fmtVol(p.area_m2 * p.height), lbl: 'Volumen' });
  }
  if (p.type === 'water') {
    if (p.depth_m) items.push({ val: p.depth_m + 'm', lbl: 'Profundidad' });
    if (p.volume_m3) items.push({ val: fmtVol(p.volume_m3), lbl: 'Volumen' });
  }
  if (isPoly && p.perimeter_m) items.push({ val: fmtLen(p.perimeter_m), lbl: 'Perímetro' });
  if (isRoad && p.length_m) items.push({ val: fmtLen(p.length_m), lbl: 'Longitud' }, { val: (p.widthM || 8) + 'm', lbl: 'Ancho' });

  if (!items.length) return '';
  return `<div class="measure-card" id="liveMeasures">
    <div class="measure-title">📐 Medidas</div>
    <div class="measure-grid">
      ${items.map(i => `<div class="measure-item"><div class="measure-val">${i.val}</div><div class="measure-unit">${i.lbl}</div></div>`).join('')}
    </div>
  </div>`;
}

function getFeatureCenter(feat) {
  const g = feat.geometry;
  if (g.type === 'Point') return { lng: g.coordinates[0], lat: g.coordinates[1] };
  if (g.type === 'LineString') { const m = Math.floor(g.coordinates.length / 2); return { lng: g.coordinates[m][0], lat: g.coordinates[m][1] }; }
  if (g.type === 'Polygon') { const c = g.coordinates[0]; return { lng: c.reduce((s, p) => s + p[0], 0) / c.length, lat: c.reduce((s, p) => s + p[1], 0) / c.length }; }
  return null;
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats() {
  const cnt = { house: 0, building: 0, road: 0, park: 0, zone: 0, terrain: 0 };
  state.features.forEach(f => { cnt[f.properties.type] = (cnt[f.properties.type] || 0) + 1; });
  document.getElementById('stat-houses').textContent = cnt.house;
  document.getElementById('stat-buildings').textContent = cnt.building;
  document.getElementById('stat-roads').textContent = cnt.road;
  document.getElementById('stat-parks').textContent = cnt.park + cnt.zone + cnt.terrain;
}

// ── LAYERS TOGGLE ─────────────────────────────────────────────
document.getElementById('layersList').addEventListener('change', () => {
  const getVis = (id) => {
    const el = document.querySelector(`input[data-layer="${id}"]`);
    return el ? el.checked : true;
  };
  const t = {
    house: getVis('house'), building: getVis('building'), custom_building: getVis('custom_building'),
    road: getVis('road'), park: getVis('park'), zone: getVis('zone'), terrain: getVis('terrain'),
    water: getVis('water'), tree: getVis('tree'), railway: getVis('railway'), radius: getVis('radius')
  };

  // Buildings Layer Filter
  const bldTypes = [];
  if (t.house) bldTypes.push('house');
  if (t.building) bldTypes.push('building');
  if (t.custom_building) bldTypes.push('custom_building');

  if (bldTypes.length === 0) {
    ['layer-buildings', 'layer-buildings-outline'].forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
  } else {
    ['layer-buildings', 'layer-buildings-outline'].forEach(id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'visible');
        map.setFilter(id, ['match', ['get', 'type'], bldTypes, true, false]);
      }
    });
  }

  // Zones Layer Filter
  const znTypes = [];
  if (t.park) znTypes.push('park');
  if (t.zone) znTypes.push('zone');
  if (t.terrain) znTypes.push('terrain');
  if (t.water) znTypes.push('water');
  if (t.radius) znTypes.push('radius');

  const zonesLays = ['layer-zones-fill', 'layer-zones-line'];
  if (znTypes.length === 0) {
    zonesLays.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none'); });
  } else {
    zonesLays.forEach(id => {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', 'visible');
        map.setFilter(id, ['match', ['get', 'type'], znTypes, true, false]);
      }
    });
  }

  // Furniture visibility linked to its layer
  if (map.getLayer('layer-furniture')) map.setLayoutProperty('layer-furniture', 'visibility', t.furniture ? 'visible' : 'none');

  // Trees visibility
  if (map.getLayer('layer-trees-3d')) map.setLayoutProperty('layer-trees-3d', 'visibility', t.tree ? 'visible' : 'none');

  // Roads and lane dividers visibility
  const rVis = t.road ? 'visible' : 'none';
  if (map.getLayer('layer-roads')) map.setLayoutProperty('layer-roads', 'visibility', rVis);
  for (let i = 1; i <= 6; i++) {
    if (map.getLayer(`layer-roads-div-${i}`)) map.setLayoutProperty(`layer-roads-div-${i}`, 'visibility', rVis);
  }

  // Railways visibility
  const railVis = t.railway ? 'visible' : 'none';
  if (map.getLayer('layer-railways')) map.setLayoutProperty('layer-railways', 'visibility', railVis);
  if (map.getLayer('layer-railways-dash')) map.setLayoutProperty('layer-railways-dash', 'visibility', railVis);
});

// ── TERRAIN CONTROLS ──────────────────────────────────────────
document.getElementById('terrainExaggeration').addEventListener('input', function () {
  document.getElementById('terrainExVal').textContent = parseFloat(this.value).toFixed(1) + 'x';
  map.setTerrain({ source: 'terrain', exaggeration: parseFloat(this.value) });
});
document.getElementById('cameraPitch').addEventListener('input', function () {
  const v = parseInt(this.value);
  document.getElementById('cameraPitchVal').textContent = v + '°';
  map.setPitch(v);
});
document.getElementById('cameraBearing')?.addEventListener('input', function () {
  const v = parseInt(this.value);
  document.getElementById('cameraBearingVal').textContent = v + '°';
  map.setBearing(v);
});

// ── OPTIONS BAR WIRING ────────────────────────────────────────
// Road width custom input
document.getElementById('roadWidthSelect')?.addEventListener('change', function () {
  const cust = document.getElementById('roadWidthCustom');
  if (this.value === 'custom') cust.style.display = '';
  else { cust.style.display = 'none'; cust.value = this.value; }
});
// Rotation sliders in options bars
['bld', 'hs'].forEach(prefix => {
  document.getElementById(prefix + 'Rotation')?.addEventListener('input', function () {
    document.getElementById(prefix + 'RotVal').textContent = this.value + '°';
  });
});

// ── TOOL BUTTONS ──────────────────────────────────────────────
const optionsBars = {
  tree: 'treeOptionsBar', furniture: 'furnitureOptionsBar'
};
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => setTool(btn.dataset.tool));
});

function setTool(tool) {
  state.tool = tool; clearDrawing();
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');

  // Hide all option bars, show relevant one
  ['treeOptionsBar', 'furnitureOptionsBar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const barId = optionsBars[tool];
  if (barId) {
    const b = document.getElementById(barId);
    if (b) b.style.display = 'flex';
    if (barId === 'polygonOptionsBar') { const lbl = document.getElementById('polyLabel'); if (lbl) lbl.textContent = TYPE_CONFIG[tool].label; }
  }

  // Cursor
  document.body.classList.remove('map-cursor-road', 'map-cursor-place', 'map-cursor-delete');
  if (['road', 'railway', 'zone', 'park', 'terrain', 'custom_building', 'water'].includes(tool)) document.body.classList.add('map-cursor-road');
  else if (['house', 'building', 'tree', 'radius', 'furniture'].includes(tool)) document.body.classList.add('map-cursor-place');
  else if (tool === 'delete') document.body.classList.add('map-cursor-delete');

  map.getCanvas().style.cursor = tool === 'move' ? 'grab' : tool === 'delete' ? 'not-allowed' : '';
  if (!['select', 'delete', 'move'].includes(tool)) { state.selectedIds = []; updateSelectionUI(); }

  if (tool === 'road') document.getElementById('drawHintText').textContent = 'Traza con clic Izquierdo · Clic DERECHO para terminar';
  else if (['zone', 'terrain', 'park', 'custom_building'].includes(tool)) document.getElementById('drawHintText').textContent = 'Traza con clic Izquierdo · Clic DERECHO para cerrar';
}

// ── 3D / SATELLITE TOGGLE ────────────────────────────────────
document.getElementById('tool-3d').addEventListener('click', () => {
  state.is3D = !state.is3D;
  const pitch = state.is3D ? 65 : 0;
  map.setPitch(pitch);
  document.getElementById('cameraPitch').value = pitch;
  document.getElementById('cameraPitchVal').textContent = pitch + '°';
  toast(state.is3D ? 'Vista 3D' : 'Vista 2D', 'info');
});
document.getElementById('tool-satellite').addEventListener('click', () => {
  state.isSatellite = !state.isSatellite;
  const snap = { features: [...state.features], nextId: state.nextId };
  map.setStyle(buildStyle());
  map.once('styledata', () => {
    state.features = snap.features; state.nextId = snap.nextId;
    addTerrainSource(); addDataLayers(); refreshMap();
  });
  toast(state.isSatellite ? 'Satélite' : 'Mapa base', 'info');
});

// ── UNDO / REDO ───────────────────────────────────────────────
function pushHistory() {
  state.history.push(JSON.stringify({ features: state.features, nextId: state.nextId }));
  state.future = [];
  if (state.history.length > 50) state.history.shift();
}
function undo() {
  if (!state.history.length) return;
  state.future.push(JSON.stringify({ features: state.features, nextId: state.nextId }));
  const s = JSON.parse(state.history.pop());
  state.features = s.features; state.nextId = s.nextId;
  refreshMap(); toast('Deshacer', 'info');
}
function redo() {
  if (!state.future.length) return;
  state.history.push(JSON.stringify({ features: state.features, nextId: state.nextId }));
  const s = JSON.parse(state.future.pop());
  state.features = s.features; state.nextId = s.nextId;
  refreshMap(); toast('Rehacer', 'info');
}
document.getElementById('btnUndo').addEventListener('click', undo);
document.getElementById('btnRedo').addEventListener('click', redo);

// ── EXPORT ────────────────────────────────────────────────────
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(buildGeoJSON(), null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: (document.getElementById('projectName').textContent.trim() || 'proyecto') + '.geojson' });
  a.click(); toast('GeoJSON exportado', 'success');
});

// ── SAVE / LOAD ───────────────────────────────────────────────
document.getElementById('btnSave').addEventListener('click', () => {
  localStorage.setItem('urbanplan_v2', JSON.stringify({ features: state.features, nextId: state.nextId, name: document.getElementById('projectName').textContent, saved: new Date().toISOString() }));
  toast('Proyecto guardado', 'success');
});
function loadSaved() {
  try {
    const raw = localStorage.getItem('urbanplan_v2'); if (!raw) return;
    const d = JSON.parse(raw);
    state.features = d.features || []; state.nextId = d.nextId || 1;
    document.getElementById('projectName').textContent = d.name || 'Proyecto';
    refreshMap(); toast('Proyecto restaurado', 'info');
  } catch (e) { }
}

// ── SEARCH ───────────────────────────────────────────────────
let searchTimer;
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim();
  if (q.length < 3) { searchResults.classList.remove('open'); return; }
  searchTimer = setTimeout(() => doSearch(q), 400);
});
searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') { searchResults.classList.remove('open'); searchInput.blur(); } });
document.addEventListener('click', e => { if (!e.target.closest('.search-box')) searchResults.classList.remove('open'); });
async function doSearch(q) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`, { headers: { 'Accept-Language': 'es' } });
    const data = await res.json();
    searchResults.innerHTML = data.map(r => `<div class="search-result-item" data-lng="${r.lon}" data-lat="${r.lat}"><strong>${r.display_name.split(',')[0]}</strong>${r.display_name.split(',').slice(1, 3).join(',')}</div>`).join('');
    searchResults.classList.add('open');
    searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        map.flyTo({ center: [parseFloat(item.dataset.lng), parseFloat(item.dataset.lat)], zoom: 14, pitch: 45, duration: 1500 });
        searchResults.classList.remove('open');
        searchInput.value = item.querySelector('strong').textContent;
      });
    });
  } catch (e) { }
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.ctrlKey && e.key.toLowerCase() === 'a') { e.preventDefault(); state.selectedIds = state.features.map(f => f.properties.id); updateSelectionUI(); return; }
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); return; }
  const keys = { s: 'select', h: 'house', b: 'building', c: 'custom_building', r: 'road', p: 'park', z: 'zone', t: 'terrain', m: 'move' };
  if (!e.ctrlKey && keys[e.key]) setTool(keys[e.key]);
  if (e.key === 'Delete' && state.selectedIds.length) deleteSelection();
  if (e.key === 'Escape') { clearDrawing(); setTool('select'); state.selectedIds = []; updateSelectionUI(); }
  if (e.key === 'Enter' && state.tool === 'road' && state.drawPoints.length >= 2) finishRoad();
  if (e.key === 'Enter' && ['zone', 'park', 'terrain', 'custom_building'].includes(state.tool) && state.drawPoints.length >= 3) finishPolygon(state.tool);
});

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => { el.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => el.remove(), 300); }, 2500);
}

// ── INIT ──────────────────────────────────────────────────────
initMap();
map.once('load', () => setTimeout(loadSaved, 600));
