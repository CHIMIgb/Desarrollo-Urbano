/* =============================================================
   URBAN PLANNING 3D — ES Modules Entry Point
   ============================================================= */
import { initMap } from './src/map/core.js';
import { initToolbarEvents } from './src/ui/toolbar.js';
import { initSearchEvents } from './src/ui/search.js';
import { initIOEvents, loadSavedState } from './src/ui/io.js';
import { initKeyboardShortcuts } from './src/ui/shortcuts.js';
import { state } from './src/config/state.js';
import { handleMapClick, handleMapDblClick, handleMouseMove, handleMouseUp } from './src/tools/interaction.js';
import { initStatsEvents, updateGlobalStats } from './src/ui/stats.js';

import { initAuth } from './src/ui/auth.js';

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar autenticación
  initAuth();

  // Initialize map
  initMap();

  // Bind core events after map initialization
  state.map.once('load', () => {
     initToolbarEvents();
     initSearchEvents();
     initIOEvents();
     initKeyboardShortcuts();
     
     // Load saved state (if any)
     loadSavedState();

     // Stats Dashboard
     initStatsEvents();
     updateGlobalStats();

     // Map-specific interaction events
     state.map.on('click', handleMapClick);
     state.map.on('dblclick', handleMapDblClick);
     state.map.on('mousemove', handleMouseMove);
     state.map.on('mouseup', handleMouseUp);
     
     // Right-click to finish drawing tool
     state.map.on('contextmenu', e => {
        if (['road', 'railway', 'path', 'sidewalk', 'park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool)) {
         e.preventDefault();
         import('./src/tools/drawing.js').then(m => {
            if (['road', 'railway', 'path', 'sidewalk'].includes(state.tool) && state.drawPoints.length >= 2) m.finishLine();
           else if (['park', 'zone', 'terrain', 'custom_building', 'water'].includes(state.tool) && state.drawPoints.length >= 3) m.finishPolygon(state.tool);
         });
       }
     });

     // Selection by box zoom
     state.map.on('boxzoomend', e => {
       const bbox = [[e.boxZoomBoundingBox[0].x, e.boxZoomBoundingBox[0].y], [e.boxZoomBoundingBox[1].x, e.boxZoomBoundingBox[1].y]];
       const feats = state.map.queryRenderedFeatures(bbox, { layers: ['layer-buildings', 'layer-roads', 'layer-zones-fill', 'layer-trees-3d', 'layer-railways'] });
       const ids = [...new Set(feats.map(f => f.properties.id))];
       if (ids.length) {
          import('./src/tools/selection.js').then(m => {
            const allSelected = m.getGroupIds(ids);
            state.selectedIds = e.originalEvent.shiftKey ? [...new Set([...state.selectedIds, ...allSelected])] : allSelected;
            m.updateSelectionUI();
          });
       }
     });

     // Sync sliders for camera
     state.map.on('rotate', () => {
       const b = Math.round(state.map.getBearing());
       const cb = document.getElementById('cameraBearing');
       const cbv = document.getElementById('cameraBearingVal');
       if (cb) cb.value = b;
       if (cbv) cbv.textContent = b + '°';
     });
     
     state.map.on('pitch', () => {
       const p = Math.round(state.map.getPitch());
       const cp = document.getElementById('cameraPitch');
       const cpv = document.getElementById('cameraPitchVal');
       if (cp) cp.value = p;
       if (cpv) cpv.textContent = p + '°';
     });
  });
});
