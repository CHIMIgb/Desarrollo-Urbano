import { state, TERRAIN_URL, GLYPHS_URL, SATELLITE_URL, OSM_URL } from '../config/state.js';
import { toast } from '../ui/toolbar.js'; // Will create this later
import { addDataLayers, setupLayerInteractivity } from './layers.js';

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
    maxTileCacheSize: 500, // Aumentar memoria caché en RAM
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

  // Precarga proactiva al mover el mapa
  state.map.on('moveend', () => { saveMapView(); preloadNearbyTiles(); });

  state.map.on('style.load', () => {
    // Restaurar capas de datos siempre
    addDataLayers();
    // Re-bindear eventos de interactividad en las capas recreadas
    setupLayerInteractivity();
    // Restaurar visibilidad de capas según checkboxes del panel
    restoreLayerVisibility();
    // Restaurar terreno solo si estaba habilitado (o aún no se ha definido el estado = primera carga)
    if (state.terrainEnabled !== false) {
      addTerrainSource();
      state.terrainEnabled = true;
      document.getElementById('tool-terrain-toggle')?.classList.add('active');
    } else {
      document.getElementById('tool-terrain-toggle')?.classList.remove('active');
    }
  });
}

export function buildStyle() {
  const srcId = state.isSatellite ? 'satellite' : 'osm';
  const tiles = state.isSatellite ? SATELLITE_URL : OSM_URL;
  const attr = state.isSatellite ? '© Esri, Maxar' : '© OpenStreetMap contributors';
  return {
    version: 8,
    sources: { [srcId]: { type: 'raster', tiles: [tiles], tileSize: 512, attribution: attr, maxzoom: 19 } },
    layers: [{ id: 'base', type: 'raster', source: srcId }],
    glyphs: GLYPHS_URL
  };
}

export function preloadNearbyTiles() {
  if (!state.map) return;
  const zoom = Math.floor(state.map.getZoom());
  if (zoom < 10 || zoom > 18) return;

  const center = state.map.getCenter();
  const lat = center.lat;
  const lng = center.lng;

  // Convertir grados a coordenadas de tile OSM
  const x = Math.floor((lng + 180) / 360 * Math.pow(2, zoom));
  const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));

  // Calcular resolución para determinar cuántos tiles cubren 2km
  const groundRes = 156543.03 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom);
  const tileSizeMeters = groundRes * 512;
  const radiusInTiles = Math.max(1, Math.ceil(1000 / tileSizeMeters));

  const tilesTemplate = state.isSatellite ? SATELLITE_URL : OSM_URL;

  // Limitar el número de precargas para no saturar la red (máx 25 tiles extra)
  const limit = Math.min(radiusInTiles, 2);

  for (let dx = -limit; dx <= limit; dx++) {
    for (let dy = -limit; dy <= limit; dy++) {
      const tx = x + dx;
      const ty = y + dy;
      let url = tilesTemplate.replace('{z}', zoom);

      // Manejar diferentes formatos de URL {x}/{y} vs {y}/{x}
      if (tilesTemplate.indexOf('{x}/{y}') !== -1) {
        url = url.replace('{x}', tx).replace('{y}', ty);
      } else {
        url = url.replace('{y}', ty).replace('{x}', tx);
      }

      // "Priming" de la caché del navegador cargando la imagen invisiblemente
      const img = new Image();
      img.src = url;
    }
  }
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

/**
 * Restaura la visibilidad de capas según el estado actual de los checkboxes
 * del panel de capas. Necesario después de un setStyle() que destruye todas las capas.
 */
function restoreLayerVisibility() {
  const layersList = document.getElementById('layersList');
  if (layersList) {
    layersList.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
