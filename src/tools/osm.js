import { state, TYPE_CONFIG } from '../config/state.js';
import { refreshMap } from '../map/core.js';
import { toast } from '../ui/toolbar.js';
import { pushHistory } from './interaction.js';

/**
 * Realiza la descarga, parseo y conversión matemática de los datos espaciales 
 * reales desde la API de OpenStreetMap al lienzo vectorial 3D de la app.
 */
export async function importOSMContext() {
  if (!state.map) return;

  const zoom = state.map.getZoom();
  // Validar nivel de zoom para no saturar al servidor OSM gratuito
  if (zoom < 15) {
    toast('Debes acercar más la cámara (Zoom > 15) para importar contexto (prevención de Timeout).', 'error');
    return;
  }

  // Extraer ventana gráfica visible (Bounding Box)
  const bounds = state.map.getBounds();
  const s = bounds.getSouth();
  const n = bounds.getNorth();
  const w = bounds.getWest();
  const e = bounds.getEast();
  
  // Overpass QL Query: Extraemos edificios y carreteras dentro de la cámara actual
  const query = `
    [out:json][timeout:60];
    (
      way["building"](${s},${w},${n},${e});
      relation["building"](${s},${w},${n},${e});
      way["building:part"](${s},${w},${n},${e});
      relation["building:part"](${s},${w},${n},${e});
      way["highway"](${s},${w},${n},${e});
    );
    out body;
    >;
    out skel qt;
  `;

  toast('Consultando satélites (OpenStreetMap)...', 'info');
  const btn = document.getElementById('btnImportOSM');
  if (btn) btn.style.opacity = '0.5';

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query
    });

    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    
    // El milagro del parseador OSM a GeoJSON de la librería que incluimos
    if (!window.osmtogeojson) {
      throw new Error('OSM/GeoJSON parser not loaded');
    }
    const geojsonData = window.osmtogeojson(data);
    
    let addedCount = 0;
    
    // Iniciar transacción en el historial
    pushHistory();

    const currentOsmIds = new Set(
      state.features.map(f => f.properties?.osm_id).filter(id => id)
    );

    geojsonData.features.forEach(feature => {
      // Ignorar si ya lo habíamos importado en un encuadre anterior
      const osmId = feature.id; // 'way/123456'
      if (currentOsmIds.has(osmId)) return;

      const props = feature.properties;
      const geomType = feature.geometry.type;

      // 1. EDIFICIOS (Polígonos 3D y Partes Complejas)
      if ((props.building || props['building:part']) && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
        const id = state.nextId++;
        // Estimar altura basados en pisos ('building:levels') si existen
        const levels = parseInt(props['building:levels'], 10) || Math.floor(Math.random() * 3) + 1;
        const h = levels * 3.5;
        
        let buildingType = 'building';
        if (props.building === 'house' || props.building === 'detached') buildingType = 'house';
        
        const cfg = TYPE_CONFIG[buildingType];
        
        state.features.push({
          type: 'Feature',
          id: id,
          properties: {
            id, type: buildingType, name: props.name || `${cfg.label} OSM`, 
            color: cfg.color, fillColor: cfg.fillColor, 
            height: h, base_height: 0, floors: levels,
            osm_id: osmId,
            raw_pts: [] // Not editable vertex by vertex to avoid slowing down arrays yet
          },
          geometry: feature.geometry
        });
        addedCount++;
      }
      
      // 2. VIALIDADES (Líneas)
      else if (props.highway && (geomType === 'LineString' || geomType === 'MultiLineString')) {
        const id = state.nextId++;
        let pathType = 'road';
        // Ajustar el tipo según el highway tag
        if (['path', 'footway', 'pedestrian', 'steps'].includes(props.highway)) {
          pathType = 'path';
        }
        
        const cfg = TYPE_CONFIG[pathType];
        
        state.features.push({
          type: 'Feature',
          id: id,
          properties: {
            id, type: pathType, name: props.name || `${cfg.label} OSM`,
            color: cfg.color, fillColor: cfg.fillColor,
            osm_id: osmId,
            lanes: parseInt(props.lanes, 10) || 2,
            widthM: parseFloat(props.width) || (pathType === 'path' ? 2 : 7),
            raw_pts: []
          },
          geometry: feature.geometry
        });
        addedCount++;
      }
    });

    if (addedCount > 0) {
      toast(`🏙 Importados ${addedCount} elementos urbanos con éxito.`, 'success');
      refreshMap();
    } else {
      toast('No se encontró contexto nuevo en esta vista.', 'info');
    }

  } catch (err) {
    console.error('Error importando OSM:', err);
    toast('Fallo al comunicarse con OSM.', 'error');
  } finally {
    if (btn) btn.style.opacity = '1';
  }
}
