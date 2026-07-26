/**
 * Focus trap para modales (accesibilidad WCAG).
 * Uso: trapFocus(modalEl) al abrir, releaseFocus() al cerrar.
 */
let lastFocusedElement = null;
let trapHandler = null;

export function trapFocus(modal) {
  releaseFocus();
  lastFocusedElement = document.activeElement;

  const focusable = modal.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;

  const firstEl = focusable[0];
  const lastEl = focusable[focusable.length - 1];

  firstEl.focus();

  trapHandler = (e) => {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  modal.addEventListener('keydown', trapHandler);
}

export function releaseFocus() {
  if (trapHandler) {
    document.removeEventListener('keydown', trapHandler);
    trapHandler = null;
  }
  if (lastFocusedElement && lastFocusedElement.focus) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}
