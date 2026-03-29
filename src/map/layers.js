import { state, TYPE_CONFIG } from '../config/state.js';
import { buildGeoJSON } from './core.js';
import { selectFeature } from '../tools/selection.js';
import { deleteSelection } from '../tools/selection.js';

export function addDataLayers() {
  if (!state.map) return;
  
  state.map.addSource('urban-data', { type: 'geojson', data: buildGeoJSON() });

  // Roads
  const zoomInterpolation = ['interpolate', ['exponential', 2], ['zoom'], 
    12, ['/', ['coalesce', ['get', 'widthM'], 7], 1.0], 
    16, ['*', ['coalesce', ['get', 'widthM'], 7], 2.4], 
    20, ['*', ['coalesce', ['get', 'widthM'], 7], 8.0]
  ];
  
  state.map.addLayer({
    id: 'layer-roads', type: 'line', source: 'urban-data',
    filter: ['==', ['get', 'type'], 'road'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-opacity': 0.9,
      'line-width': zoomInterpolation,
    }
  });

  // Lane Dividers
  for (let k = 1; k <= 9; k++) {
    state.map.addLayer({
      id: `layer-roads-div-${k}`, type: 'line', source: 'urban-data',
      filter: ['all', ['==', ['get', 'type'], 'road'], ['>', ['coalesce', ['get', 'lanes'], 2], k]],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#fbbf24',
        'line-dasharray': [4, 3],
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2.5, 20, 10],
        'line-opacity': 1.0,
        'line-blur': 0.5,
        'line-offset': ['interpolate', ['exponential', 2], ['zoom'],
          12, ['*', ['/', ['coalesce', ['get', 'widthM'], 7], 1.0], ['-', ['/', k, ['coalesce', ['get', 'lanes'], 2]], 0.5]],
          16, ['*', ['*', ['coalesce', ['get', 'widthM'], 7], 2.4], ['-', ['/', k, ['coalesce', ['get', 'lanes'], 2]], 0.5]],
          20, ['*', ['*', ['coalesce', ['get', 'widthM'], 7], 8.0], ['-', ['/', k, ['coalesce', ['get', 'lanes'], 2]], 0.5]]
        ]
      }
    });
  }

  const zoneFilter = ['match', ['get', 'type'], ['zone', 'park', 'terrain', 'water', 'radius'], true, false];
  state.map.addLayer({
    id: 'layer-zones-fill', type: 'fill', source: 'urban-data', filter: zoneFilter,
    paint: {
      'fill-color': ['get', 'fillColor'],
      'fill-opacity': ['match', ['get', 'type'], 'radius', 0.15, 'water', 0.65, 0.25]
    }
  });
  state.map.addLayer({
    id: 'layer-zones-line', type: 'line', source: 'urban-data', filter: zoneFilter,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [4, 2] }
  });

  state.map.addLayer({
    id: 'layer-trees-3d', type: 'fill-extrusion', source: 'urban-data', filter: ['==', ['get', 'type'], 'tree'],
    paint: {
      'fill-extrusion-color': ['get', 'fillColor'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 0.95
    }
  });

  state.map.addLayer({
    id: 'layer-furniture', type: 'fill-extrusion', source: 'urban-data', filter: ['==', ['get', 'type'], 'furniture'],
    paint: {
      'fill-extrusion-color': ['get', 'fillColor'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 1.0
    }
  });

  state.map.addLayer({
    id: 'layer-railways', type: 'line', source: 'urban-data', filter: ['==', ['get', 'type'], 'railway'],
    paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 18, 6] }
  });
  state.map.addLayer({
    id: 'layer-railways-dash', type: 'line', source: 'urban-data', filter: ['==', ['get', 'type'], 'railway'],
    paint: { 'line-color': '#f97316', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 18, 3], 'line-dasharray': [2, 2] }
  });

  const bldFilter = ['match', ['get', 'type'], ['house', 'building', 'custom_building'], true, false];
  state.map.addLayer({
    id: 'layer-buildings', type: 'fill-extrusion', source: 'urban-data', filter: bldFilter,
    paint: {
      'fill-extrusion-color': ['get', 'fillColor'],
      'fill-extrusion-height': ['get', 'height'],
      'fill-extrusion-base': ['coalesce', ['get', 'base_height'], 0],
      'fill-extrusion-opacity': 0.85,
    }
  });
  state.map.addLayer({
    id: 'layer-buildings-outline', type: 'line', source: 'urban-data', filter: bldFilter,
    layout: { 'line-join': 'round' },
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.8 }
  });

  // Draw preview
  state.map.addSource('draw-preview', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  state.map.addLayer({
    id: 'layer-draw-line', type: 'line', source: 'draw-preview',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#6366f1', 'line-width': 2, 'line-dasharray': [4, 3] }
  });
  state.map.addLayer({
    id: 'layer-draw-fill', type: 'fill', source: 'draw-preview',
    paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.1 }
  });
  state.map.addLayer({
    id: 'layer-draw-pts', type: 'circle', source: 'draw-preview',
    paint: { 'circle-radius': 5, 'circle-color': '#6366f1', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' }
  });

  // Highlight layer
  state.map.addLayer({
    id: 'highlight-polygons', type: 'line', source: 'urban-data',
    filter: ['in', ['get', 'id'], ['literal', ['']]],
    layout: { 'line-join': 'round' },
    paint: { 'line-color': '#fff', 'line-width': 3, 'line-dasharray': [2, 2] }
  });

  // Edit Handles Layer
  state.map.addSource('edit-handles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  state.map.addLayer({
    id: 'layer-edit-handles', type: 'circle', source: 'edit-handles',
    paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#ef4444' }
  });

  // Interactivity
  state.map.on('mousedown', 'layer-edit-handles', e => {
    e.preventDefault(); e.originalEvent.stopPropagation();
    state.draggingVertexIdx = e.features[0].properties.idx;
    state.map.getCanvas().style.cursor = 'grabbing';
  });
  state.map.on('mouseenter', 'layer-edit-handles', () => { 
    if (['select', 'move'].includes(state.tool)) state.map.getCanvas().style.cursor = 'grab'; 
  });
  state.map.on('mouseleave', 'layer-edit-handles', () => { state.map.getCanvas().style.cursor = ''; });

  ['layer-buildings', 'layer-roads', 'layer-zones-fill', 'layer-trees-3d', 'layer-railways', 'layer-furniture'].forEach(lid => {
    state.map.on('mousedown', lid, e => {
      if (state.tool !== 'move') return;
      e.preventDefault();
      let id = e.features[0]?.properties?.id;
      if (!id) return;
      if (e.features[0].properties.parent_id) id = e.features[0].properties.parent_id;
      state.draggingFeatureId = id;
      state.lastDragPos = e.lngLat;
      state.isDragging = false;
      state.map.getCanvas().style.cursor = 'grabbing';
      if (state.popup) { state.popup.remove(); state.popup = null; }
    });
    state.map.on('click', lid, e => {
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
    state.map.on('mouseenter', lid, () => {
      if (['select', 'delete', 'move'].includes(state.tool))
        state.map.getCanvas().style.cursor = state.tool === 'delete' ? 'not-allowed' : state.tool === 'move' ? 'grab' : 'pointer';
    });
    state.map.on('mouseleave', lid, () => { state.map.getCanvas().style.cursor = ''; });
  });
}
