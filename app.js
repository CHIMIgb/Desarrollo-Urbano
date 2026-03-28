/* =============================================================
   URBAN PLANNING 3D — app.js v2
   Nuevas funciones: edificios rotados + dimensiones, carreteras
   curvas + ancho, herramienta Terreno, mediciones completas
   ============================================================= */

// ── TILE SOURCES (sin API key)
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const OSM_URL       = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TERRAIN_URL   = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const GLYPHS_URL    = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

// ── HELPERS GEO ──────────────────────────────────────────────
function haversine(lng1, lat1, lng2, lat2) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function lineLength(coords) {
  let t = 0;
  for (let i = 0; i < coords.length-1; i++)
    t += haversine(coords[i][0],coords[i][1],coords[i+1][0],coords[i+1][1]);
  return t;
}
function polygonArea(coords) {
  // Shoelace in local meters
  if (coords.length < 3) return 0;
  const cLat = coords.reduce((s,c)=>s+c[1],0)/coords.length;
  const mLat = 111320, mLng = 111320*Math.cos(cLat*Math.PI/180);
  let area = 0;
  for (let i=0,j=coords.length-1; i<coords.length; j=i++) {
    area += (coords[j][0]*mLng + coords[i][0]*mLng) * (coords[j][1]*mLat - coords[i][1]*mLat);
  }
  return Math.abs(area/2);
}
function polygonPerimeter(coords) { return lineLength(coords); }

// Bounding box dims of a polygon (lat/lon → meters)
function polygonBBox(coords) {
  const lngs = coords.map(c=>c[0]), lats = coords.map(c=>c[1]);
  const cLat = (Math.max(...lats)+Math.min(...lats))/2;
  const mLng = 111320*Math.cos(cLat*Math.PI/180), mLat=111320;
  const w = (Math.max(...lngs)-Math.min(...lngs))*mLng;
  const h = (Math.max(...lats)-Math.min(...lats))*mLat;
  return { width: w, length: h };
}

// Rotated rectangle polygon from center + dims + bearing
function buildingPolygon(cLng, cLat, widthM, lengthM, rotDeg) {
  const r = Math.PI/180;
  // Half-dimensions in local offset meters
  const hw = widthM/2;
  const hl = lengthM/2;
  const a  = rotDeg * r, cos=Math.cos(a), sin=Math.sin(a);
  // Unrotated corners in meters (origin at 0,0)
  const raw = [[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]];
  // Factors to convert meters back to degrees at this latitude
  const mLat = 111320;
  const mLng = 111320 * Math.cos(cLat * r);
  
  const pts = raw.map(([x,y]) => {
    // 1. Rotate in meters space
    const rx = x*cos - y*sin;
    const ry = x*sin + y*cos;
    // 2. Convert to geographic degrees
    return [cLng + (rx/mLng), cLat + (ry/mLat)];
  });
  pts.push(pts[0]);
  return pts;
}

// Catmull-Rom spline smoothing
function catmullRom(pts, steps=10) {
  if (pts.length < 2) return pts;
  const ext = [pts[0], ...pts, pts[pts.length-1]];
  const result = [];
  for (let i=1; i<ext.length-2; i++) {
    const [p0,p1,p2,p3] = [ext[i-1],ext[i],ext[i+1],ext[i+2]];
    for (let t=0; t<steps; t++) {
      const tt=t/steps, t2=tt*tt, t3=t2*tt;
      result.push([
        0.5*((2*p1[0])+(-p0[0]+p2[0])*tt+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5*((2*p1[1])+(-p0[1]+p2[1])*tt+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
      ]);
    }
  }
  result.push(pts[pts.length-1]);
  return result;
}

// Catmull-Rom closed spline smoothing
function catmullRomClosed(pts, steps=10) {
  if (pts.length < 3) return [...pts, pts[0]];
  const ext = [pts[pts.length-1], ...pts, pts[0], pts[1]];
  const result = [];
  for (let i=1; i<ext.length-2; i++) {
    const [p0,p1,p2,p3] = [ext[i-1],ext[i],ext[i+1],ext[i+2]];
    for (let t=0; t<steps; t++) {
      const tt=t/steps, t2=tt*tt, t3=t2*tt;
      result.push([
        0.5*((2*p1[0])+(-p0[0]+p2[0])*tt+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
        0.5*((2*p1[1])+(-p0[1]+p2[1])*tt+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)
      ]);
    }
  }
  result.push(result[0]); // Explicitly close it
  return result;
}

// Format helpers
function fmtLen(m) {
  if (m == null || isNaN(m)) return '—';
  return m >= 1000 ? (m/1000).toFixed(2)+' km' : Math.round(m)+' m';
}
function fmtArea(m2) {
  if (m2 == null || isNaN(m2)) return '—';
  return m2 >= 10000 ? (m2/10000).toFixed(2)+' ha' : Math.round(m2)+' m²';
}
function fmtVol(m3) {
  if (m3 == null || isNaN(m3)) return '—';
  return Math.round(m3).toLocaleString()+' m³';
}

// ── TYPE CONFIG ───────────────────────────────────────────────
const TYPE_CONFIG = {
  house:    { color:'#f59e0b', fillColor:'#fbbf24', label:'Casa',      defaultH:7,  defW:10, defL:10 },
  building: { color:'#6366f1', fillColor:'#818cf8', label:'Edificio',  defaultH:30, defW:20, defL:20 },
  custom_building:{ color:'#8b5cf6', fillColor:'#a78bfa', label:'Silueta 3D', defaultH:30 },
  park:     { color:'#4ade80', fillColor:'#86efac', label:'Parque',    defaultH:0 },
  road:     { color:'#94a3b8', fillColor:'#94a3b8', label:'Carretera', defaultH:0 },
  zone:     { color:'#f472b6', fillColor:'#f9a8d4', label:'Zona',      defaultH:0 },
  terrain:  { color:'#fb923c', fillColor:'#fdba74', label:'Terreno',   defaultH:0 },
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
  map = new maplibregl.Map({
    container:'map', style:buildStyle(),
    center:[-99.1332,19.4326], zoom:13, pitch:45, bearing:-20, antialias:true,
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:true}),'bottom-right');
  map.addControl(new maplibregl.ScaleControl({unit:'metric'}),'bottom-left');
  map.addControl(new maplibregl.FullscreenControl(),'bottom-right');
  map.doubleClickZoom.disable();

  map.on('load',()=>{ addTerrainSource(); addDataLayers(); toast('Terreno 3D listo','success'); });
  map.on('mousemove',e=>{
    const {lng,lat}=e.lngLat;
    document.getElementById('coordDisplay').textContent=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    if(state.drawPoints.length>0) updateLiveMeasure(lng,lat);
    
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
         if(mc) mc.innerHTML = buildMeasureHTML(f);
      }
      return;
    }

    if(state.draggingFeatureId && state.tool==='move') {
      state.isDragging=true;
      const dlng = lng - state.lastDragPos.lng;
      const dlat = lat - state.lastDragPos.lat;
      const toMove = state.selectedIds.includes(state.draggingFeatureId)?state.selectedIds:[state.draggingFeatureId];
      toMove.forEach(id=>translateFeature(id, dlng, dlat));
      state.lastDragPos = {lng, lat};
      refreshMap(); updateEditHandles();
    }
  });
  map.on('mouseup', () => {
    if (state.draggingVertexIdx !== null && state.draggingVertexIdx !== undefined) {
      state.draggingVertexIdx = null; map.getCanvas().style.cursor = ''; pushHistory();
    }
    if(state.draggingFeatureId) {
      state.draggingFeatureId=null;
      map.getCanvas().style.cursor=state.tool==='move'?'grab':'';
      if(state.isDragging) pushHistory();
    }
  });
  map.on('click', handleMapClick);
  map.on('dblclick', handleMapDblClick);
  
  // Right click to close
  map.on('contextmenu', e => {
    if(['road','park','zone','terrain','custom_building'].includes(state.tool)) {
      e.preventDefault();
      if(state.tool==='road' && state.drawPoints.length>=2) finishRoad();
      else if(['park','zone','terrain','custom_building'].includes(state.tool) && state.drawPoints.length>=3) finishPolygon(state.tool);
    }
  });

  // Box Zoom for selection
  map.on('boxzoomend', e => {
     const bbox = [[e.boxZoomBoundingBox[0].x, e.boxZoomBoundingBox[0].y], [e.boxZoomBoundingBox[1].x, e.boxZoomBoundingBox[1].y]];
     const feats = map.queryRenderedFeatures(bbox, {layers:['layer-buildings','layer-roads','layer-zones-fill']});
     const ids = [...new Set(feats.map(f=>f.properties.id))];
     if(ids.length) {
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
  const srcId = state.isSatellite?'satellite':'osm';
  const tiles = state.isSatellite?SATELLITE_URL:OSM_URL;
  const attr  = state.isSatellite?'© Esri, Maxar':'© OpenStreetMap contributors';
  return { version:8,
    sources:{ [srcId]:{ type:'raster', tiles:[tiles], tileSize:256, attribution:attr, maxzoom:19 }},
    layers:[{id:'base',type:'raster',source:srcId}],
    glyphs:GLYPHS_URL };
}

// ── TERRAIN ───────────────────────────────────────────────────
function addTerrainSource() {
  if(!map.getSource('terrain'))
    map.addSource('terrain',{ type:'raster-dem', tiles:[TERRAIN_URL], tileSize:256, encoding:'terrarium', maxzoom:15 });
  const exag = parseFloat(document.getElementById('terrainExaggeration').value);
  map.setTerrain({source:'terrain', exaggeration:exag});
  try { map.setFog({'color':'rgb(15,18,30)','high-color':'rgb(40,50,80)','horizon-blend':0.08,'space-color':'rgb(5,8,20)','star-intensity':0.5}); } catch(e){}
}

// ── DATA LAYERS ───────────────────────────────────────────────
function addDataLayers() {
  map.addSource('urban-data',{type:'geojson',data:buildGeoJSON()});

  // Roads
  const zoomInterpolation = ['interpolate',['exponential',2],['zoom'],12,['/',['coalesce',['get','widthM'],8],4],16,['/',['coalesce',['get','widthM'],8],1.2],20,['*',['coalesce',['get','widthM'],8],2]];
  map.addLayer({id:'layer-roads',type:'line',source:'urban-data',
    filter:['==',['get','type'],'road'],
    layout:{'line-cap':'round','line-join':'round'},
    paint:{
      'line-color':['get','color'],
      'line-opacity':0.9,
      'line-width': zoomInterpolation,
    }
  });

  const laneRatios = [
    [2,0, 3,-0.166, 4,-0.25, 5,-0.3, 6,-0.333, 7,-0.357], 
    [3,0.166, 4,0, 5,-0.1, 6,-0.166, 7,-0.214],
    [4,0.25, 5,0.1, 6,0, 7,-0.071],
    [5,0.3, 6,0.166, 7,0.071],
    [6,0.333, 7,0.214],
    [7,0.357]
  ];
  laneRatios.forEach((ratios, i) => {
    const matchExpr = ['match', ['coalesce', ['get', 'lanes'], 2]];
    for (let j=0; j<ratios.length; j+=2) { matchExpr.push(ratios[j], ratios[j+1]); }
    matchExpr.push(0);
    map.addLayer({
      id: `layer-roads-div-${i+1}`, type: 'line', source: 'urban-data',
      filter: ['all', ['==', ['get', 'type'], 'road'], ['>=', ['coalesce', ['get', 'lanes'], 2], ratios[0]]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ffffff', 'line-dasharray': [4, 4],
        'line-width': ['interpolate',['linear'],['zoom'], 14, 0.5, 20, 2],
        'line-opacity': ['interpolate',['linear'],['zoom'], 14, 0, 15, 0.9],
        'line-offset': ['*', zoomInterpolation, matchExpr]
      }
    });
  });

  const zoneFilter=['match',['get','type'],['zone','park','terrain'],true,false];
  map.addLayer({id:'layer-zones-fill',type:'fill',source:'urban-data',filter:zoneFilter,
    paint:{'fill-color':['get','fillColor'],'fill-opacity':0.25}});
  map.addLayer({id:'layer-zones-line',type:'line',source:'urban-data',filter:zoneFilter,
    layout:{'line-join':'round'},
    paint:{'line-color':['get','color'],'line-width':2,'line-dasharray':[4,2]}});

  const bldFilter=['match',['get','type'],['house','building','custom_building'],true,false];
  map.addLayer({id:'layer-buildings',type:'fill-extrusion',source:'urban-data',filter:bldFilter,
    paint:{
      'fill-extrusion-color':['get','fillColor'],
      'fill-extrusion-height':['get','height'],
      'fill-extrusion-base':0,
      'fill-extrusion-opacity':0.85,
    }
  });
  map.addLayer({id:'layer-buildings-outline',type:'line',source:'urban-data',filter:bldFilter,
    layout:{'line-join':'round'},
    paint:{'line-color':['get','color'],'line-width':1.5,'line-opacity':0.8}});

  // Draw preview
  map.addSource('draw-preview',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'layer-draw-line',type:'line',source:'draw-preview',
    layout:{'line-cap':'round','line-join':'round'},
    paint:{'line-color':'#6366f1','line-width':2,'line-dasharray':[4,3]}});
  map.addLayer({id:'layer-draw-fill',type:'fill',source:'draw-preview',
    paint:{'fill-color':'#6366f1','fill-opacity':0.1}});
  map.addLayer({id:'layer-draw-pts',type:'circle',source:'draw-preview',
    paint:{'circle-radius':5,'circle-color':'#6366f1','circle-stroke-width':2,'circle-stroke-color':'#fff'}});

  // Highlight layer
  map.addLayer({id:'highlight-polygons',type:'line',source:'urban-data',
    filter:['in',['get','id'],['literal',['']]],
    layout:{'line-join':'round'},
    paint:{'line-color':'#fff','line-width':3,'line-dasharray':[2,2]}
  });

  // Edit Handles Layer
  map.addSource('edit-handles',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'layer-edit-handles',type:'circle',source:'edit-handles',
    paint:{'circle-radius':6,'circle-color':'#fff','circle-stroke-width':2,'circle-stroke-color':'#ef4444'}
  });

  map.on('mousedown', 'layer-edit-handles', e => {
    e.preventDefault(); e.originalEvent.stopPropagation();
    state.draggingVertexIdx = e.features[0].properties.idx;
    map.getCanvas().style.cursor = 'grabbing';
  });
  map.on('mouseenter', 'layer-edit-handles', () => { if(['select','move'].includes(state.tool)) map.getCanvas().style.cursor = 'grab'; });
  map.on('mouseleave', 'layer-edit-handles', () => { map.getCanvas().style.cursor = ''; });

  // Click interactivity
  ['layer-buildings','layer-roads','layer-zones-fill'].forEach(lid=>{
    map.on('mousedown',lid,e=>{
      if(state.tool!=='move') return;
      e.preventDefault();
      const id=e.features[0]?.properties?.id;
      if(!id) return;
      state.draggingFeatureId=id;
      state.lastDragPos=e.lngLat;
      state.isDragging=false;
      map.getCanvas().style.cursor='grabbing';
      if(state.popup){ state.popup.remove(); state.popup=null; }
    });
    map.on('click',lid,e=>{
      const id=e.features[0]?.properties?.id;
      if(!id) return;
      if(['select','delete'].includes(state.tool)){
        e.originalEvent.stopPropagation();
        if(state.tool==='delete') { state.selectedIds=[id]; deleteSelection(); }
        else selectFeature(id,e.lngLat,e.originalEvent.shiftKey);
      } else if(state.tool==='move'){
        e.originalEvent.stopPropagation();
        if(!state.isDragging) selectFeature(id,e.lngLat,e.originalEvent.shiftKey);
      }
    });
    map.on('mouseenter',lid,()=>{ 
      if(['select','delete','move'].includes(state.tool)) 
        map.getCanvas().style.cursor=state.tool==='delete'?'not-allowed':state.tool==='move'?'grab':'pointer';
    });
    map.on('mouseleave',lid,()=>{ map.getCanvas().style.cursor=''; });
  });
}

// ── GEOJSON BUILDER ───────────────────────────────────────────
function buildGeoJSON() {
  return {type:'FeatureCollection',features:state.features};
}
function refreshMap() {
  map.getSource('urban-data')?.setData(buildGeoJSON());
  updateStats();
}

// ── MAP CLICK ─────────────────────────────────────────────────
function handleMapClick(e) {
  const {lng,lat}=e.lngLat;
  if(['select','delete'].includes(state.tool)) return;
  if(['house','building'].includes(state.tool)) { placeBuilding(state.tool,lng,lat); return; }
  if(['road','park','zone','terrain','custom_building'].includes(state.tool)) {
    // Check click-to-close
    if (state.drawPoints.length > 0) {
      const p = e.point;
      if (['park','zone','terrain','custom_building'].includes(state.tool) && state.drawPoints.length >= 3) {
        const firstP = map.project(state.drawPoints[0]);
        if (Math.hypot(p.x - firstP.x, p.y - firstP.y) < 20) { finishPolygon(state.tool); return; }
      } else if (state.tool === 'road' && state.drawPoints.length >= 2) {
        const lastP = map.project(state.drawPoints[state.drawPoints.length-1]);
        if (Math.hypot(p.x - lastP.x, p.y - lastP.y) < 20) { finishRoad(); return; }
      }
    }

    state.drawPoints.push([lng,lat]);
    updateDrawPreview();
    if(state.drawPoints.length===1) {
      document.getElementById('drawHint').style.display='block';
      document.getElementById('drawHintText').textContent =
        state.tool==='road'
          ? 'Traza con clic Izquierdo · Clic DERECHO para terminar'
          : 'Traza con clic Izquierdo · Clic DERECHO para cerrar';
    }
  }
}
function handleMapDblClick(e) {
  e.preventDefault();
}

// ── PLACE BUILDING ────────────────────────────────────────────
function placeBuilding(type, lng, lat) {
  const cfg = TYPE_CONFIG[type];
  const wEl  = document.getElementById(type==='building'?'bldWidth':'hsWidth');
  const lEl  = document.getElementById(type==='building'?'bldLength':'hsLength');
  const hEl  = document.getElementById(type==='building'?'bldHeight':'hsHeight');
  const rEl  = document.getElementById(type==='building'?'bldRotation':'hsRotation');
  const widthM  = wEl  ? parseFloat(wEl.value)  : cfg.defW;
  const lengthM = lEl  ? parseFloat(lEl.value)  : cfg.defL;
  const height  = hEl  ? parseFloat(hEl.value)  : cfg.defaultH;
  const rotation= rEl  ? parseFloat(rEl.value)  : 0;
  const floors  = Math.round(height/3.5) || 1;
  const coords  = buildingPolygon(lng, lat, widthM, lengthM, rotation);
  const id = state.nextId++;
  const feat = {
    type:'Feature', id,
    properties:{ id, type, name:`${cfg.label} ${id}`, height, floors,
      color:cfg.color, fillColor:cfg.fillColor, uso_suelo:type==='building'?'comercial':'habitacional',
      center_lng:lng, center_lat:lat, width_m:widthM, length_m:lengthM, rotation,
      area_m2: widthM*lengthM },
    geometry:{ type:'Polygon', coordinates:[coords] },
  };
  pushHistory();
  state.features.push(feat);
  refreshMap();
  toast(`${cfg.label} colocado`,'success');
  selectFeature(id,{lng,lat});
}

// ── ROAD ─────────────────────────────────────────────────────
function finishRoad() {
  if(state.drawPoints.length<2) return;
  const curved = document.getElementById('roadCurved')?.checked;
  const wSel   = document.getElementById('roadWidthSelect');
  const wCust  = document.getElementById('roadWidthCustom');
  const widthM = wSel?.value==='custom' ? parseFloat(wCust?.value||8) : parseFloat(wSel?.value||8);
  const coords = curved && state.drawPoints.length>2 ? catmullRom(state.drawPoints) : [...state.drawPoints];
  const len    = lineLength(coords);
  const id     = state.nextId++;
  const feat   = {
    type:'Feature', id,
    properties:{ id, type:'road', name:`Vía ${id}`, color:TYPE_CONFIG.road.color, fillColor:TYPE_CONFIG.road.color,
      widthM, lanes:Math.max(1, Math.round(widthM/3)), roadType:'secundaria', curved:!!curved, length_m:Math.round(len),
      raw_pts: [...state.drawPoints] },
    geometry:{ type:'LineString', coordinates:coords },
  };
  pushHistory();
  state.features.push(feat);
  clearDrawing(); refreshMap();
  toast(`Carretera trazada — ${fmtLen(len)}`,'success');
}

// ── POLYGON ───────────────────────────────────────────────────
function finishPolygon(type) {
  const isCurved = document.getElementById('polyCurved')?.checked;
  const pts = isCurved && state.drawPoints.length > 2 ? catmullRomClosed(state.drawPoints) : [...state.drawPoints, state.drawPoints[0]];
  const cfg  = TYPE_CONFIG[type];
  const area = polygonArea(pts);
  const peri = polygonPerimeter(pts);
  const id   = state.nextId++;
  const feat = {
    type:'Feature', id,
    properties:{ id, type, name:`${cfg.label} ${id}`, color:cfg.color, fillColor:cfg.fillColor,
      area_m2:Math.round(area), perimeter_m:Math.round(peri), raw_pts: [...state.drawPoints], curved: !!isCurved },
    geometry:{ type:'Polygon', coordinates:[pts] },
  };
  if (type === 'custom_building') {
    feat.properties.height = cfg.defaultH;
    feat.properties.floors = Math.round(cfg.defaultH/3.5);
    feat.properties.uso_suelo = 'mixto';
  }
  pushHistory();
  state.features.push(feat);
  clearDrawing(); refreshMap();
  toast(`${cfg.label} — ${fmtArea(area)}`,'success');
}

// ── DRAW PREVIEW ──────────────────────────────────────────────
function updateDrawPreview() {
  const pts = state.drawPoints;
  if(!pts.length) return;
  const features=[];
  if(pts.length>=2) {
    const isPoly = ['park','zone','terrain','custom_building'].includes(state.tool);
    const curved = (state.tool === 'road' && document.getElementById('roadCurved')?.checked) || 
                   (isPoly && document.getElementById('polyCurved')?.checked);
    if(isPoly && pts.length>=3) {
      const polyCoords = curved ? catmullRomClosed(pts) : [...pts, pts[0]];
      features.push({type:'Feature',geometry:{type:'Polygon',coordinates:[polyCoords]},properties:{}});
    } else {
      const lineCoords = curved && pts.length>2 ? catmullRom(pts) : [...pts];
      features.push({type:'Feature',geometry:{type:'LineString',coordinates:lineCoords},properties:{}});
    }
  }
  pts.forEach(p=>features.push({type:'Feature',geometry:{type:'Point',coordinates:p},properties:{}}));
  map.getSource('draw-preview')?.setData({type:'FeatureCollection',features});
}

function updateLiveMeasure(lng,lat) {
  const pts=[...state.drawPoints,[lng,lat]];
  const el=document.getElementById('drawMeasure');
  if(!el) return;
  if(pts.length<2) { el.style.display='none'; return; }
  const isPolygon=['park','zone','terrain','custom_building'].includes(state.tool);
  let text='';
  if(isPolygon && pts.length>=3) {
    const closed=[...pts,pts[0]];
    text=`Área: ${fmtArea(polygonArea(closed))} · Perímetro: ${fmtLen(polygonPerimeter(closed))}`;
  } else {
    text=`Longitud: ${fmtLen(lineLength(pts))}`;
  }
  el.textContent=text; el.style.display='block';
}

function clearDrawing() {
  state.drawPoints=[];
  map.getSource('draw-preview')?.setData({type:'FeatureCollection',features:[]});
  document.getElementById('drawHint').style.display='none';
  document.getElementById('drawMeasure').style.display='none';
}

// ── SELECT / DELETE ───────────────────────────────────────────
function selectFeature(id, lngLat, isMulti=false) {
  if(isMulti){
    if(state.selectedIds.includes(id)) state.selectedIds=state.selectedIds.filter(x=>x!==id);
    else state.selectedIds.push(id);
  } else {
    state.selectedIds=[id];
  }
  updateSelectionUI(lngLat);
}

function updateSelectionUI(lngLat) {
  map.setFilter('highlight-polygons', ['in', ['get', 'id'], ['literal', state.selectedIds.length?state.selectedIds:['']]]);
  if(state.selectedIds.length===1){
    const feat=state.features.find(f=>f.properties.id===state.selectedIds[0]);
    if(feat) showPropsPanel(feat,lngLat);
  } else if(state.selectedIds.length>1){
    showMultiPropsPanel();
  } else {
    document.getElementById('propsSection').style.display='none';
    state.popup?.remove(); state.popup=null;
  }
  updateEditHandles();
}

function updateEditHandles() {
  const feats = [];
  if (state.selectedIds.length === 1 && ['select','move'].includes(state.tool)) {
    const f = state.features.find(x => x.properties.id === state.selectedIds[0]);
    if (f && f.properties.raw_pts && !['house','building'].includes(f.properties.type)) {
      f.properties.raw_pts.forEach((pt, idx) => {
        feats.push({type:'Feature', properties:{fid: f.properties.id, idx}, geometry:{type:'Point', coordinates:pt}});
      });
    }
  }
  map.getSource('edit-handles')?.setData({type:'FeatureCollection',features:feats});
}

function deleteSelection() {
  if(!state.selectedIds.length) return;
  pushHistory();
  state.features=state.features.filter(f=>!state.selectedIds.includes(f.properties.id));
  state.selectedIds=[]; updateSelectionUI();
  refreshMap(); toast('Objeto(s) eliminado(s)','error');
}

function translateFeature(id, dlng, dlat) {
  const f = state.features.find(x => x.properties.id === id);
  if (!f) return;
  if (f.properties.center_lng != null) {
    f.properties.center_lng += dlng;
    f.properties.center_lat += dlat;
  }
  if (f.properties.raw_pts) {
    f.properties.raw_pts = f.properties.raw_pts.map(c => [c[0]+dlng, c[1]+dlat]);
  }
  const movePts = pts => pts.map(c => [c[0]+dlng, c[1]+dlat]);
  if (f.geometry.type === 'Point') f.geometry.coordinates = movePts([f.geometry.coordinates])[0];
  else if (f.geometry.type === 'LineString') f.geometry.coordinates = movePts(f.geometry.coordinates);
  else if (f.geometry.type === 'Polygon') f.geometry.coordinates = f.geometry.coordinates.map(movePts);
}

// ── PROPERTIES PANEL ─────────────────────────────────────────
function showPropsPanel(feat, lngLat) {
  const p=feat.properties, cfg=TYPE_CONFIG[p.type]||{};
  document.getElementById('propsSection').style.display='block';
  const form=document.getElementById('propsForm');

  // ─ Measurement card HTML
  const measHTML = buildMeasureHTML(feat);

  // ─ Common fields
  let fields=`
    <div class="form-field"><label>Nombre</label><input type="text" id="prop-name" value="${p.name||''}" /></div>
    ${measHTML}`;

  if(['house','building'].includes(p.type)) {
    fields+=`
      <div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-w" value="${p.width_m||10}" min="2" max="500" step="0.5"/></div>
      <div class="form-field"><label>Largo (m)</label><input type="number" id="prop-l" value="${p.length_m||10}" min="2" max="500" step="0.5"/></div>
      <div class="form-field"><label>Altura (m)</label><input type="number" id="prop-height" value="${p.height||5}" min="1" max="600" step="0.5"/></div>
      <div class="form-field"><label>Pisos</label><input type="number" id="prop-floors" value="${p.floors||1}" min="1" max="200"/></div>
      <div class="form-field">
        <label>Rotación: <span id="propRotLabel">${Math.round(p.rotation||0)}°</span></label>
        <input type="range" id="prop-rotation" min="0" max="359" step="1" value="${p.rotation||0}" style="width:100%"/>
      </div>
      <div class="form-field"><label>Uso de suelo</label><select id="prop-uso">
        <option value="habitacional" ${p.uso_suelo==='habitacional'?'selected':''}>Habitacional</option>
        <option value="comercial"    ${p.uso_suelo==='comercial'?'selected':''}>Comercial</option>
        <option value="mixto"        ${p.uso_suelo==='mixto'?'selected':''}>Mixto</option>
        <option value="industrial"   ${p.uso_suelo==='industrial'?'selected':''}>Industrial</option>
      </select></div>`;
  } else if (p.type === 'custom_building') {
    fields+=`
      <div class="form-field"><label>Altura (m)</label><input type="number" id="prop-height" value="${p.height||30}" min="1" max="600" step="0.5"/></div>
      <div class="form-field"><label>Pisos</label><input type="number" id="prop-floors" value="${p.floors||10}" min="1" max="200"/></div>
      <div class="form-field"><label>Uso de suelo</label><select id="prop-uso">
        <option value="habitacional" ${p.uso_suelo==='habitacional'?'selected':''}>Habitacional</option>
        <option value="comercial"    ${p.uso_suelo==='comercial'?'selected':''}>Comercial</option>
        <option value="mixto"        ${p.uso_suelo==='mixto'?'selected':''}>Mixto</option>
        <option value="industrial"   ${p.uso_suelo==='industrial'?'selected':''}>Industrial</option>
      </select></div>`;
  }
  if(['park','zone','terrain','custom_building'].includes(p.type)) {
     fields+=`
      <div class="form-field opt-toggle" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="prop-poly-curved" ${p.curved ? 'checked' : ''} style="display:none;" />
          <span class="toggle-track" style="margin:0"><span class="toggle-thumb"></span></span>
          <span style="font-size:11px;color:var(--text-primary);font-weight:500;">Curvas suaves</span>
        </label>
      </div>`;
  }
  if(p.type==='road') {
    fields+=`
      <div class="form-field"><label>Tipo de vía</label><select id="prop-roadType">
        <option value="local"        ${p.roadType==='local'?'selected':''}>Local</option>
        <option value="secundaria"   ${p.roadType==='secundaria'?'selected':''}>Secundaria</option>
        <option value="primaria"     ${p.roadType==='primaria'?'selected':''}>Primaria</option>
        <option value="autopista"    ${p.roadType==='autopista'?'selected':''}>Autopista</option>
      </select></div>
      <div class="form-field"><label>Ancho (m)</label><input type="number" id="prop-roadW" value="${p.widthM||8}" min="2" max="60"/></div>
      <div class="form-field"><label>Carriles</label><input type="number" id="prop-lanes" value="${p.lanes||2}" min="1" max="16"/></div>
      <div class="form-field opt-toggle" style="margin-top:6px;">
        <label style="display:flex;align-items:center;gap:8px;">
          <input type="checkbox" id="prop-curved" ${p.curved ? 'checked' : ''} style="display:none;" />
          <span class="toggle-track" style="margin:0"><span class="toggle-thumb"></span></span>
          <span style="font-size:11px;color:var(--text-primary);font-weight:500;">Curvas suaves</span>
        </label>
      </div>`;
  }
  fields+=`
    <div class="form-field"><label>Color</label><input type="color" id="prop-color" value="${p.fillColor||'#6366f1'}"/></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnApplyProps">Aplicar</button>
      <button class="btn btn-secondary" id="btnDeleteSelected">Borrar</button>
    </div>`;

  form.innerHTML=fields;

  // Live events for buildings
  if(['house','building'].includes(p.type)) {
    const rotRange=document.getElementById('prop-rotation');
    const rotLabel=document.getElementById('propRotLabel');
    const wIn=document.getElementById('prop-w');
    const lIn=document.getElementById('prop-l');
    const hIn=document.getElementById('prop-height');
    const fIn=document.getElementById('prop-floors');

    const rebuildGeom=()=>{
      const f=state.features.find(f=>f.properties.id===state.selectedIds[0]);
      if(!f) return;
      f.properties.width_m  = parseFloat(wIn.value)||10;
      f.properties.length_m = parseFloat(lIn.value)||10;
      f.properties.height   = parseFloat(hIn.value)||5;
      f.properties.rotation = parseFloat(rotRange.value)||0;
      f.properties.area_m2  = f.properties.width_m * f.properties.length_m;
      f.geometry.coordinates= [buildingPolygon(f.properties.center_lng,f.properties.center_lat,f.properties.width_m,f.properties.length_m,f.properties.rotation)];
      refreshMap();
      const mc=document.getElementById('liveMeasures');
      if(mc) mc.innerHTML=buildMeasureHTML(f);
    };

    rotRange.addEventListener('input',()=>{ rotLabel.textContent=rotRange.value+'°'; rebuildGeom(); });
    [wIn,lIn,hIn].forEach(el=>el?.addEventListener('input',rebuildGeom));
    fIn?.addEventListener('input',()=>{ if(hIn) hIn.value=Math.round(parseFloat(fIn.value)*3.5); rebuildGeom(); });
  }

  // Live events for custom building
  if(p.type==='custom_building') {
    const hIn=document.getElementById('prop-height');
    const fIn=document.getElementById('prop-floors');
    const rebuildCB=()=>{
      const f=state.features.find(f=>f.properties.id===state.selectedIds[0]);
      if(!f) return;
      f.properties.height = parseFloat(hIn.value)||30;
      refreshMap();
    };
    hIn?.addEventListener('input',rebuildCB);
    fIn?.addEventListener('input',()=>{ if(hIn) hIn.value=Math.round(parseFloat(fIn.value)*3.5); rebuildCB(); });
  }

  // Live events for curved polygons/parks
  if(['park','zone','terrain','custom_building'].includes(p.type)) {
    const curvedCb = document.getElementById('prop-poly-curved');
    const rebuildPoly=()=>{
      const f=state.features.find(f=>f.properties.id===state.selectedIds[0]);
      if(!f) return;
      if(curvedCb) {
        f.properties.curved = curvedCb.checked;
        if(f.properties.raw_pts) {
           const coords = f.properties.curved && f.properties.raw_pts.length > 2 ? catmullRomClosed(f.properties.raw_pts) : [...f.properties.raw_pts, f.properties.raw_pts[0]];
           f.geometry.coordinates = [coords];
           f.properties.area_m2 = Math.round(polygonArea(coords));
           f.properties.perimeter_m = Math.round(polygonPerimeter(coords));
        }
      }
      refreshMap();
      const mc=document.getElementById('liveMeasures');
      if(mc) mc.innerHTML=buildMeasureHTML(f);
    };
    curvedCb?.addEventListener('change', rebuildPoly);
  }

  // Live events for roads
  if(p.type==='road') {
    const wIn = document.getElementById('prop-roadW');
    const lIn = document.getElementById('prop-lanes');
    const curvedCb = document.getElementById('prop-curved');

    const rebuildRoad=()=>{
      const f=state.features.find(f=>f.properties.id===state.selectedIds[0]);
      if(!f) return;
      f.properties.widthM = parseFloat(wIn.value)||3;
      f.properties.lanes  = parseInt(lIn.value)||1;
      if(curvedCb) {
        f.properties.curved = curvedCb.checked;
        if(f.properties.raw_pts) {
           f.geometry.coordinates = f.properties.curved && f.properties.raw_pts.length>2 ? catmullRom(f.properties.raw_pts) : [...f.properties.raw_pts];
           f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));
        }
      }
      refreshMap();
      const mc=document.getElementById('liveMeasures');
      if(mc) mc.innerHTML=buildMeasureHTML(f);
    };

    if(wIn && lIn) {
      lIn.addEventListener('input',()=>{ wIn.value=parseInt(lIn.value)*3||3; rebuildRoad(); });
      wIn.addEventListener('input',()=>{ lIn.value=Math.max(1,Math.round(parseFloat(wIn.value)/3))||1; rebuildRoad(); });
      curvedCb?.addEventListener('change', rebuildRoad);
    }
  }

  // Apply button
  document.getElementById('btnApplyProps').addEventListener('click',()=>{
    pushHistory();
    const f=state.features.find(f=>f.properties.id===state.selectedIds[0]);
    if(!f) return;
    f.properties.name=document.getElementById('prop-name').value;
    if(document.getElementById('prop-uso'))      f.properties.uso_suelo=document.getElementById('prop-uso').value;
    if(document.getElementById('prop-roadType')) f.properties.roadType=document.getElementById('prop-roadType').value;
    if(document.getElementById('prop-height')){
      const h=parseFloat(document.getElementById('prop-height').value)||f.properties.height;
      f.properties.height=h;
      if(document.getElementById('prop-floors')) f.properties.floors=parseInt(document.getElementById('prop-floors').value);
    }
    if(document.getElementById('prop-roadW')){
      const w=parseFloat(document.getElementById('prop-roadW').value)||8;
      f.properties.widthM=w;
      f.properties.lanes=document.getElementById('prop-lanes')?parseInt(document.getElementById('prop-lanes').value):Math.max(1, Math.round(w/3));
    }
    if(document.getElementById('prop-curved')){
      const curved = document.getElementById('prop-curved').checked;
      f.properties.curved = curved;
      if(f.properties.raw_pts) {
         f.geometry.coordinates = curved && f.properties.raw_pts.length>2 ? catmullRom(f.properties.raw_pts) : [...f.properties.raw_pts];
         f.properties.length_m = Math.round(lineLength(f.geometry.coordinates));
      }
    }
    const col=document.getElementById('prop-color').value;
    f.properties.fillColor=col; f.properties.color=col;
    refreshMap(); toast('Propiedades actualizadas','success');
  });
  document.getElementById('btnDeleteSelected').addEventListener('click', deleteSelection);

  // Map popup
  state.popup?.remove();
  if(lngLat){
    const ctr=getFeatureCenter(feat);
    state.popup=new maplibregl.Popup({closeButton:true,maxWidth:'220px'})
      .setLngLat(ctr||lngLat)
      .setHTML(`<div class="popup-name">${p.name||cfg.label}</div><div class="popup-type">${cfg.label||p.type}</div>
        <div class="popup-props">
          ${p.width_m?`<div class="popup-prop"><span class="popup-prop-key">Ancho</span><span class="popup-prop-val">${fmtLen(p.width_m)}</span></div>`:''}
          ${p.length_m?`<div class="popup-prop"><span class="popup-prop-key">Largo</span><span class="popup-prop-val">${fmtLen(p.length_m)}</span></div>`:''}
          ${p.height?`<div class="popup-prop"><span class="popup-prop-key">Altura</span><span class="popup-prop-val">${p.height}m</span></div>`:''}
          ${p.area_m2?`<div class="popup-prop"><span class="popup-prop-key">Área</span><span class="popup-prop-val">${fmtArea(p.area_m2)}</span></div>`:''}
          ${p.length_m && p.type==='road'?`<div class="popup-prop"><span class="popup-prop-key">Long.</span><span class="popup-prop-val">${fmtLen(p.length_m)}</span></div>`:''}
        </div>`)
      .addTo(map);
  }
}

function showMultiPropsPanel() {
  document.getElementById('propsSection').style.display='block';
  const form=document.getElementById('propsForm');
  form.innerHTML=`
    <div class="form-field"><label style="font-size:14px;color:var(--accent)">${state.selectedIds.length} objetos seleccionados</label></div>
    <div class="form-field"><label>Color unificado</label><input type="color" id="prop-multi-color" value="#6366f1"/></div>
    <div class="form-actions">
      <button class="btn btn-primary" id="btnMultiApply">Aplicar</button>
      <button class="btn btn-secondary" id="btnMultiDelete">Borrar</button>
    </div>`;
  document.getElementById('btnMultiDelete').addEventListener('click', deleteSelection);
  document.getElementById('btnMultiApply').addEventListener('click', () => {
    pushHistory();
    const col=document.getElementById('prop-multi-color').value;
    state.features.forEach(f => {
      if(state.selectedIds.includes(f.properties.id)) { f.properties.color=col; f.properties.fillColor=col; }
    });
    refreshMap(); toast('Color aplicado a todos', 'success');
  });
  state.popup?.remove(); state.popup=null;
}

function buildMeasureHTML(feat) {
  const p=feat.properties;
  const isBuilding=['house','building','custom_building'].includes(p.type);
  const isRoad=p.type==='road';
  const isPoly=['park','zone','terrain','custom_building'].includes(p.type);

  const items=[];
  if(p.width_m  != null && !isRoad) items.push({val:fmtLen(p.width_m),  lbl:'Ancho'});
  if(p.length_m != null && !isRoad) items.push({val:fmtLen(p.length_m), lbl:'Largo'});
  if(p.height   != null && isBuilding) items.push({val:p.height+'m',   lbl:'Altura'});
  // Auto-calculated area box for simple buildings
  if(['house','building'].includes(p.type) && p.width_m && p.length_m && p.height) {
    items.push({val:fmtArea(p.width_m*p.length_m),lbl:'Área piso'},{val:fmtVol(p.width_m*p.length_m*p.height),lbl:'Volumen'});
  }
  // Free polygon area/volume
  if(isPoly && p.area_m2) {
    items.push({val:fmtArea(p.area_m2),     lbl:'Área'});
    if (isBuilding && p.height) items.push({val:fmtVol(p.area_m2 * p.height), lbl:'Volumen'});
  }
  if(isPoly && p.perimeter_m) items.push({val:fmtLen(p.perimeter_m),  lbl:'Perímetro'});
  if(isRoad  && p.length_m)   items.push({val:fmtLen(p.length_m),    lbl:'Longitud'},{val:(p.widthM||8)+'m',lbl:'Ancho'});

  if(!items.length) return '';
  return `<div class="measure-card" id="liveMeasures">
    <div class="measure-title">📐 Medidas</div>
    <div class="measure-grid">
      ${items.map(i=>`<div class="measure-item"><div class="measure-val">${i.val}</div><div class="measure-unit">${i.lbl}</div></div>`).join('')}
    </div>
  </div>`;
}

function getFeatureCenter(feat) {
  const g=feat.geometry;
  if(g.type==='Point') return {lng:g.coordinates[0],lat:g.coordinates[1]};
  if(g.type==='LineString'){ const m=Math.floor(g.coordinates.length/2); return{lng:g.coordinates[m][0],lat:g.coordinates[m][1]}; }
  if(g.type==='Polygon'){ const c=g.coordinates[0]; return{lng:c.reduce((s,p)=>s+p[0],0)/c.length,lat:c.reduce((s,p)=>s+p[1],0)/c.length}; }
  return null;
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats() {
  const cnt={house:0,building:0,road:0,park:0,zone:0,terrain:0};
  state.features.forEach(f=>{ cnt[f.properties.type]=(cnt[f.properties.type]||0)+1; });
  document.getElementById('stat-houses').textContent=cnt.house;
  document.getElementById('stat-buildings').textContent=cnt.building;
  document.getElementById('stat-roads').textContent=cnt.road;
  document.getElementById('stat-parks').textContent=cnt.park+cnt.zone+cnt.terrain;
}

// ── LAYERS TOGGLE ─────────────────────────────────────────────
document.getElementById('layersList').addEventListener('change', () => {
  const getVis = (id) => {
    const el = document.querySelector(`input[data-layer="${id}"]`);
    return el ? el.checked : true;
  };
  const t = {
    house: getVis('house'), building: getVis('building'), custom_building: getVis('custom_building'),
    road: getVis('road'), park: getVis('park'), zone: getVis('zone'), terrain: getVis('terrain')
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

  // Roads and lane dividers visibility
  const rVis = t.road ? 'visible' : 'none';
  if (map.getLayer('layer-roads')) map.setLayoutProperty('layer-roads', 'visibility', rVis);
  for (let i = 1; i <= 6; i++) {
     if (map.getLayer(`layer-roads-div-${i}`)) map.setLayoutProperty(`layer-roads-div-${i}`, 'visibility', rVis);
  }
});

// ── TERRAIN CONTROLS ──────────────────────────────────────────
document.getElementById('terrainExaggeration').addEventListener('input',function(){
  document.getElementById('terrainExVal').textContent=parseFloat(this.value).toFixed(1)+'x';
  map.setTerrain({source:'terrain',exaggeration:parseFloat(this.value)});
});
document.getElementById('cameraPitch').addEventListener('input',function(){
  const v=parseInt(this.value);
  document.getElementById('cameraPitchVal').textContent=v+'°';
  map.setPitch(v);
});
document.getElementById('cameraBearing')?.addEventListener('input',function(){
  const v=parseInt(this.value);
  document.getElementById('cameraBearingVal').textContent=v+'°';
  map.setBearing(v);
});

// ── OPTIONS BAR WIRING ────────────────────────────────────────
// Road width custom input
document.getElementById('roadWidthSelect')?.addEventListener('change',function(){
  const cust=document.getElementById('roadWidthCustom');
  if(this.value==='custom') cust.style.display='';
  else { cust.style.display='none'; cust.value=this.value; }
});
// Rotation sliders in options bars
['bld','hs'].forEach(prefix=>{
  document.getElementById(prefix+'Rotation')?.addEventListener('input',function(){
    document.getElementById(prefix+'RotVal').textContent=this.value+'°';
  });
});

// ── TOOL BUTTONS ──────────────────────────────────────────────
const optionsBars={
  road:'roadOptionsBar', building:'buildingOptionsBar', house:'houseOptionsBar',
  park:'polygonOptionsBar', zone:'polygonOptionsBar', terrain:'polygonOptionsBar', custom_building:'polygonOptionsBar'
};
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
  btn.addEventListener('click',()=>setTool(btn.dataset.tool));
});

function setTool(tool) {
  state.tool=tool; clearDrawing();
  document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
  document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');

  // Hide all option bars, show relevant one
  ['roadOptionsBar','buildingOptionsBar','houseOptionsBar','polygonOptionsBar'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.display='none';
  });
  const barId=optionsBars[tool];
  if(barId){ 
     const b=document.getElementById(barId); 
     if(b) b.style.display='flex'; 
     if(barId==='polygonOptionsBar') { const lbl=document.getElementById('polyLabel'); if(lbl) lbl.textContent=TYPE_CONFIG[tool].label; }
  }

  // Cursor
  document.body.classList.remove('map-cursor-road','map-cursor-place','map-cursor-delete');
  if(['road','zone','park','terrain','custom_building'].includes(tool)) document.body.classList.add('map-cursor-road');
  else if(['house','building'].includes(tool)) document.body.classList.add('map-cursor-place');
  else if(tool==='delete') document.body.classList.add('map-cursor-delete');

  map.getCanvas().style.cursor = tool==='move' ? 'grab' : tool==='delete' ? 'not-allowed' : '';
  if(!['select','delete','move'].includes(tool)) { state.selectedIds=[]; updateSelectionUI(); }

  if(tool==='road') document.getElementById('drawHintText').textContent='Traza con clic Izquierdo · Clic DERECHO para terminar';
  else if(['zone','terrain','park','custom_building'].includes(tool)) document.getElementById('drawHintText').textContent='Traza con clic Izquierdo · Clic DERECHO para cerrar';
}

// ── 3D / SATELLITE TOGGLE ────────────────────────────────────
document.getElementById('tool-3d').addEventListener('click',()=>{
  state.is3D=!state.is3D;
  const pitch=state.is3D?45:0;
  map.setPitch(pitch);
  document.getElementById('cameraPitch').value=pitch;
  document.getElementById('cameraPitchVal').textContent=pitch+'°';
  toast(state.is3D?'Vista 3D':'Vista 2D','info');
});
document.getElementById('tool-satellite').addEventListener('click',()=>{
  state.isSatellite=!state.isSatellite;
  const snap={features:[...state.features],nextId:state.nextId};
  map.setStyle(buildStyle());
  map.once('styledata',()=>{
    state.features=snap.features; state.nextId=snap.nextId;
    addTerrainSource(); addDataLayers(); refreshMap();
  });
  toast(state.isSatellite?'Satélite':'Mapa base','info');
});

// ── UNDO / REDO ───────────────────────────────────────────────
function pushHistory() {
  state.history.push(JSON.stringify({features:state.features,nextId:state.nextId}));
  state.future=[];
  if(state.history.length>50) state.history.shift();
}
function undo() {
  if(!state.history.length) return;
  state.future.push(JSON.stringify({features:state.features,nextId:state.nextId}));
  const s=JSON.parse(state.history.pop());
  state.features=s.features; state.nextId=s.nextId;
  refreshMap(); toast('Deshacer','info');
}
function redo() {
  if(!state.future.length) return;
  state.history.push(JSON.stringify({features:state.features,nextId:state.nextId}));
  const s=JSON.parse(state.future.pop());
  state.features=s.features; state.nextId=s.nextId;
  refreshMap(); toast('Rehacer','info');
}
document.getElementById('btnUndo').addEventListener('click',undo);
document.getElementById('btnRedo').addEventListener('click',redo);

// ── EXPORT ────────────────────────────────────────────────────
document.getElementById('btnExport').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify(buildGeoJSON(),null,2)],{type:'application/json'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:(document.getElementById('projectName').textContent.trim()||'proyecto')+'.geojson'});
  a.click(); toast('GeoJSON exportado','success');
});

// ── SAVE / LOAD ───────────────────────────────────────────────
document.getElementById('btnSave').addEventListener('click',()=>{
  localStorage.setItem('urbanplan_v2',JSON.stringify({features:state.features,nextId:state.nextId,name:document.getElementById('projectName').textContent,saved:new Date().toISOString()}));
  toast('Proyecto guardado','success');
});
function loadSaved() {
  try {
    const raw=localStorage.getItem('urbanplan_v2'); if(!raw) return;
    const d=JSON.parse(raw);
    state.features=d.features||[]; state.nextId=d.nextId||1;
    document.getElementById('projectName').textContent=d.name||'Proyecto';
    refreshMap(); toast('Proyecto restaurado','info');
  } catch(e){}
}

// ── SEARCH ───────────────────────────────────────────────────
let searchTimer;
const searchInput=document.getElementById('searchInput');
const searchResults=document.getElementById('searchResults');
searchInput.addEventListener('input',()=>{
  clearTimeout(searchTimer);
  const q=searchInput.value.trim();
  if(q.length<3){searchResults.classList.remove('open');return;}
  searchTimer=setTimeout(()=>doSearch(q),400);
});
searchInput.addEventListener('keydown',e=>{ if(e.key==='Escape'){searchResults.classList.remove('open');searchInput.blur();} });
document.addEventListener('click',e=>{ if(!e.target.closest('.search-box')) searchResults.classList.remove('open'); });
async function doSearch(q) {
  try {
    const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`,{headers:{'Accept-Language':'es'}});
    const data=await res.json();
    searchResults.innerHTML=data.map(r=>`<div class="search-result-item" data-lng="${r.lon}" data-lat="${r.lat}"><strong>${r.display_name.split(',')[0]}</strong>${r.display_name.split(',').slice(1,3).join(',')}</div>`).join('');
    searchResults.classList.add('open');
    searchResults.querySelectorAll('.search-result-item').forEach(item=>{
      item.addEventListener('click',()=>{
        map.flyTo({center:[parseFloat(item.dataset.lng),parseFloat(item.dataset.lat)],zoom:14,pitch:45,duration:1500});
        searchResults.classList.remove('open');
        searchInput.value=item.querySelector('strong').textContent;
      });
    });
  } catch(e){}
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if(e.ctrlKey&&e.key.toLowerCase()==='a'){ e.preventDefault(); state.selectedIds=state.features.map(f=>f.properties.id); updateSelectionUI(); return; }
  if(e.ctrlKey&&e.key==='z'){e.preventDefault();undo();return;}
  if(e.ctrlKey&&e.key==='y'){e.preventDefault();redo();return;}
  const keys={s:'select',h:'house',b:'building',c:'custom_building',r:'road',p:'park',z:'zone',t:'terrain',m:'move'};
  if(!e.ctrlKey&&keys[e.key]) setTool(keys[e.key]);
  if(e.key==='Delete'&&state.selectedIds.length) deleteSelection();
  if(e.key==='Escape'){clearDrawing();setTool('select');state.selectedIds=[];updateSelectionUI();}
  if(e.key==='Enter'&&state.tool==='road'&&state.drawPoints.length>=2) finishRoad();
  if(e.key==='Enter'&&['zone','park','terrain','custom_building'].includes(state.tool)&&state.drawPoints.length>=3) finishPolygon(state.tool);
});

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg,type='info') {
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<div class="toast-dot"></div><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(()=>{ el.style.animation='toastOut 0.3s ease forwards'; setTimeout(()=>el.remove(),300); },2500);
}

// ── INIT ──────────────────────────────────────────────────────
initMap();
map.once('load',()=>setTimeout(loadSaved,600));
