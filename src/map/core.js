import { state, TERRAIN_URL, GLYPHS_URL, SATELLITE_URL, OSM_URL } from '../config/state.js';
import { toast } from '../ui/toolbar.js'; // Will create this later
import { addDataLayers } from './layers.js'; // Will create this later

export function initMap() {
  let initialView = {
    center: [-99.1332, 19.4326], 
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

  state.map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    center: initialView.center,
    zoom: initialView.zoom,
    pitch: initialView.pitch,
    bearing: initialView.bearing,
    antialias: true,
    maxPitch: 85,
  });

  if (!hasSavedView && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const center = [pos.coords.longitude, pos.coords.latitude];
        state.map.flyTo({ center, zoom: 16, duration: 2000 });
        saveMapView();
      },
      err => { console.warn('Geolocation denied or failed', err); },
      { enableHighAccuracy: true }
    );
  }

  state.map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
  state.map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  state.map.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
  state.map.doubleClickZoom.disable();

  const saveMapView = () => {
    const view = {
      center: state.map.getCenter().toArray(),
      zoom: state.map.getZoom(),
      pitch: state.map.getPitch(),
      bearing: state.map.getBearing()
    };
    localStorage.setItem('urbanPlan_view', JSON.stringify(view));
  };

  state.map.on('moveend', saveMapView);
  state.map.on('zoomend', saveMapView);
  state.map.on('pitchend', saveMapView);
  state.map.on('rotateend', saveMapView);

  state.map.on('load', () => { 
    addTerrainSource(); 
    addDataLayers(); 
    toast('Terreno 3D listo', 'success'); 
  });
}

export function buildStyle() {
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

export function addTerrainSource() {
  if (!state.map.getSource('terrain'))
    state.map.addSource('terrain', { type: 'raster-dem', tiles: [TERRAIN_URL], tileSize: 256, encoding: 'terrarium', maxzoom: 15 });
  const exag = parseFloat(document.getElementById('terrainExaggeration').value);
  state.map.setTerrain({ source: 'terrain', exaggeration: exag });
  try { 
    state.map.setFog({ 
      'color': 'rgb(15,18,30)', 
      'high-color': 'rgb(40,50,80)', 
      'horizon-blend': 0.08, 
      'space-color': 'rgb(5,8,20)', 
      'star-intensity': 0.5 
    }); 
  } catch (e) { }
}

export function buildGeoJSON() {
  return { type: 'FeatureCollection', features: state.features };
}

export function refreshMap() {
  state.map.getSource('urban-data')?.setData(buildGeoJSON());
  import('../ui/toolbar.js').then(m => m.updateStats());
}
