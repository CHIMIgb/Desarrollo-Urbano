export const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const TERRAIN_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
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
  furniture: { label: 'Mobiliario', color: '#9ca3af', fillColor: '#d1d5db' }
};

export const state = {
  features: [], 
  selectedIds: [], 
  tool: 'select',
  is3D: true, 
  isSatellite: true,
  drawPoints: [],
  history: [], 
  future: [],
  nextId: 1, 
  popup: null,
  draggingFeatureId: null, 
  lastDragPos: null, 
  isDragging: false,
  draggingVertexIdx: null,
  currentProjectId: null, // ID del proyecto activo en la base de datos
  map: null // Will be initialized here
};
