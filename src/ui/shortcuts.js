import { state } from '../config/state.js';
import { setTool } from './toolbar.js';
import { deleteSelection } from '../tools/selection.js';
import { clearDrawing, finishLine, finishPolygon } from '../tools/drawing.js';

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    
    // Undo/Redo are already handled in toolbar.js but for completeness with global listeners:
    // Actually, it's better to have them here or unify.

    const keys = { 
      s: 'select', 
      h: 'house', 
      b: 'building', 
      c: 'custom_building', 
      r: 'road', 
      p: 'park', 
      z: 'zone', 
      t: 'terrain', 
      m: 'move' 
    };

    if (!e.ctrlKey && keys[e.key]) setTool(keys[e.key]);
    if (e.key === 'Delete' && state.selectedIds.length) deleteSelection();
    if (e.key === 'Escape') { 
      clearDrawing(); 
      setTool('select'); 
      state.selectedIds = []; 
      import('../tools/selection.js').then(m => m.updateSelectionUI());
    }
    
    if (e.key === 'Enter') {
       if (state.tool === 'road' && state.drawPoints.length >= 2) finishLine();
       else if (['zone', 'park', 'terrain', 'custom_building'].includes(state.tool) && state.drawPoints.length >= 3) finishPolygon(state.tool);
    }
  });
}
