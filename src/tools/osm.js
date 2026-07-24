import { state, TYPE_CONFIG, publicConfig } from '../config/state.js';
import { getNextId, addFeatures } from '../config/store.js';
import { refreshMap } from '../map/core.js';
import { toast } from '../ui/toolbar.js';
import { pushHistory } from './interaction.js';
import { generateTreeParts } from '../models/trees.js';
import { generateFurnitureParts } from '../models/furniture.js';

/**
 * Espejos públicos de Overpass para evitar bloqueos por IP y Timeouts.
 */
const getOsmEndpoints = () => publicConfig.OSM_OVERPASS_ENDPOINTS;

/**
 * Realiza la descarga, parseo y conversión matemática de los datos espaciales 
 * reales desde la API de OpenStreetMap al lienzo vectorial 3D de la app.
 */
export async function importOSMContext(retryCount = 0) {
  if (!state.map) return;
  const endpoints = getOsmEndpoints();
  const endpoint = endpoints[retryCount % endpoints.length];

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
      way["leisure"="park"](${s},${w},${n},${e});
      relation["leisure"="park"](${s},${w},${n},${e});
      // way["natural"="water"](${s},${w},${n},${e});
      // relation["natural"="water"](${s},${w},${n},${e});
      // way["waterway"](${s},${w},${n},${e});
      way["railway"](${s},${w},${n},${e});
      way["landuse"](${s},${w},${n},${e});
      relation["landuse"](${s},${w},${n},${e});
      node["natural"="tree"](${s},${w},${n},${e});
      node["amenity"~"bench|waste_basket|street_lamp"](${s},${w},${n},${e});
      node["highway"="street_lamp"](${s},${w},${n},${e});
    );
    out body;
    >;
    out skel qt;
  `;

  toast(`Consultando satélites (Servidor ${retryCount + 1})...`, 'info');
  const btn = document.getElementById('btnImportOSM');
  if (btn) btn.style.opacity = '0.5';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(query)}`
    });

    if (response.status === 429 || response.status === 504) {
      if (retryCount < 2) {
        toast('Servidor saturado, reintentando con otro espejo...', 'warning');
        await new Promise(r => setTimeout(r, 2000));
        return importOSMContext(retryCount + 1);
      }
      throw new Error(`Server saturated (${response.status})`);
    }

    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    
    // El milagro del parseador OSM a GeoJSON de la librería que incluimos
    if (!window.osmtogeojson) {
      throw new Error('OSM/GeoJSON parser not loaded');
    }
    const geojsonData = window.osmtogeojson(data);
    
    let addedCount = 0;
    let treeCount = 0;
    
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
        const id = getNextId();
        // Estimar altura basados en pisos ('building:levels') si existen
        const levels = parseInt(props['building:levels'], 10) || Math.floor(Math.random() * 3) + 1;
        const h = levels * 3.5;
        
        let buildingType = 'building';
        if (props.building === 'house' || props.building === 'detached') buildingType = 'house';
        
        const cfg = TYPE_CONFIG[buildingType];
        
        addFeatures({
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
        const id = getNextId();
        let pathType = 'road';
        // Ajustar el tipo según el highway tag
        if (['path', 'footway', 'pedestrian', 'steps'].includes(props.highway)) {
          pathType = 'path';
          if (props.footway === 'sidewalk') pathType = 'sidewalk';
        }
        
        const cfg = TYPE_CONFIG[pathType];
        
        addFeatures({
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
      
      // 3. PARQUES (Polígonos)
      else if (props.leisure === 'park' && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
        const id = getNextId();
        const cfg = TYPE_CONFIG['park'];
        
        addFeatures({
          type: 'Feature',
          id: id,
          properties: {
            id, type: 'park', name: props.name || `${cfg.label} OSM`,
            color: cfg.color, fillColor: cfg.fillColor,
            osm_id: osmId,
            raw_pts: []
          },
          geometry: feature.geometry
        });
        addedCount++;
      }
      
      // 4. AGUA
      else if ((props.natural === 'water' || props.waterway) && (geomType === 'Polygon' || geomType === 'MultiPolygon' || geomType === 'LineString' || geomType === 'MultiLineString')) {
        const id = getNextId();
        const cfg = TYPE_CONFIG['water'];
        addFeatures({
          type: 'Feature', id,
          properties: { id, type: 'water', name: props.name || `${cfg.label} OSM`, color: cfg.color, fillColor: cfg.fillColor, osm_id: osmId, raw_pts: [] },
          geometry: feature.geometry
        });
        addedCount++;
      }
      
      // 5. ZONAS (Uso de Suelo)
      else if (props.landuse && (geomType === 'Polygon' || geomType === 'MultiPolygon')) {
        const id = getNextId();
        const cfg = TYPE_CONFIG['zone'];
        addFeatures({
          type: 'Feature', id,
          properties: { id, type: 'zone', name: props.name || `${props.landuse} OSM`, color: cfg.color, fillColor: cfg.fillColor, osm_id: osmId, raw_pts: [] },
          geometry: feature.geometry
        });
        addedCount++;
      }
      
      // 6. VIAS FERREAS
      else if (props.railway && (geomType === 'LineString' || geomType === 'MultiLineString')) {
        const id = getNextId();
        const cfg = TYPE_CONFIG['railway'];
        addFeatures({
          type: 'Feature', id,
          properties: { id, type: 'railway', name: props.name || `${cfg.label} OSM`, color: cfg.color, fillColor: cfg.fillColor, osm_id: osmId, raw_pts: [] },
          geometry: feature.geometry
        });
        addedCount++;
      }
      
      // 7. ARBOLES (con límite)
      else if (props.natural === 'tree' && geomType === 'Point') {
        if (treeCount < 300) {
          const lng = feature.geometry.coordinates[0];
          const lat = feature.geometry.coordinates[1];
          const id = getNextId();
          const tTypes = ['pino', 'abeto', 'roble', 'ovalado'];
          const randomType = tTypes[Math.floor(Math.random() * tTypes.length)];
          const parts = generateTreeParts(id, lng, lat, randomType);
          
          parts[0].properties.osm_id = osmId;
          addFeatures(...parts);
          addedCount++;
          treeCount++;
        }
      }
      
      // 8. MOBILIARIO
      else if ((props.amenity || props.highway === 'street_lamp') && geomType === 'Point') {
        let fType = 'banca';
        if (props.amenity === 'waste_basket') fType = 'papelera';
        if (props.amenity === 'street_lamp' || props.highway === 'street_lamp') fType = 'farol';
        
        const lng = feature.geometry.coordinates[0];
        const lat = feature.geometry.coordinates[1];
        const id = getNextId();
        const parts = generateFurnitureParts(id, lng, lat, 0, fType);
        
        parts[0].properties.osm_id = osmId;
        addFeatures(...parts);
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
    if (retryCount >= 2) {
      toast('Los servidores de OSM están muy ocupados. Intenta en una zona más pequeña o más tarde.', 'error');
    }
  } finally {
    if (btn) btn.style.opacity = '1';
  }
}
