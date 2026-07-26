import { state } from '../config/state.js';
import { setTool } from './toolbar.js';
import { deleteSelection } from '../tools/selection.js';
import { clearDrawing, finishLine, finishPolygon } from '../tools/drawing.js';

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    const isEditable = e.target.isContentEditable;

    // Ctrl+S — Guardar (siempre activo)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('btnSave')?.click();
      return;
    }

    // Ctrl+Z / Ctrl+Y — Undo/Redo (siempre activo)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('btnUndo')?.click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      document.getElementById('btnRedo')?.click();
      return;
    }

    // Si está en input/textarea/contenteditable, no ejecutar shortcuts de herramientas
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || isEditable) return;

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
        if (['road', 'railway', 'path', 'sidewalk'].includes(state.tool) && state.drawPoints.length >= 2) finishLine();
       else if (['zone', 'park', 'terrain', 'custom_building'].includes(state.tool) && state.drawPoints.length >= 3) finishPolygon(state.tool);
    }
  });
}
