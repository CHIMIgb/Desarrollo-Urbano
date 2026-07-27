import { logger } from '../utils/logger.js';

export const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export let OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const publicConfig = {
  OSM_TILE_URL: OSM_URL,
  OSM_NOMINATIM_URL: 'https://nominatim.openstreetmap.org/search',
  OSM_OVERPASS_ENDPOINTS: [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
  ],
};

export async function loadPublicConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.OSM_TILE_URL) {
      OSM_URL = data.OSM_TILE_URL;
      publicConfig.OSM_TILE_URL = data.OSM_TILE_URL;
    }
    if (data.OSM_NOMINATIM_URL) publicConfig.OSM_NOMINATIM_URL = data.OSM_NOMINATIM_URL;
    if (data.OSM_OVERPASS_ENDPOINTS && data.OSM_OVERPASS_ENDPOINTS.length) {
      publicConfig.OSM_OVERPASS_ENDPOINTS = data.OSM_OVERPASS_ENDPOINTS;
    }
    logger.log('[CONFIG] Configuración remota de OSM cargada con éxito');
  } catch (e) {
    logger.warn(
      '[CONFIG] Error cargando configuración remota, usando valores por defecto:',
      e.message
    );
  }
}
export const TERRAIN_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const GLYPHS_URL = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';

export const TYPE_CONFIG = {
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
  path: { label: 'Camino', color: '#a8a29e', fillColor: '#78716c' },
  sidewalk: { label: 'Banqueta', color: '#cbd5e1', fillColor: '#94a3b8' },
  radius: { label: 'Isócrona', color: '#f0abfc', fillColor: '#c026d3' },
  furniture: { label: 'Mobiliario', color: '#9ca3af', fillColor: '#d1d5db' },
};

// El estado ahora vive en store.js — re-exportar para compatibilidad.
export { state } from './store.js';
