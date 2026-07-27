import { AppError } from './errors.js';

export function initGlobalErrors() {
  window.addEventListener('error', (event) => {
    const { message, filename, lineno, error } = event;
    if (error instanceof AppError) {
      console.error(`[GlobalError] ${error.code}: ${message}`, {
        filename,
        lineno,
        cause: error.cause,
      });
    } else {
      console.error('[GlobalError]', message, filename, lineno);
    }
    showGlobalToast('Error inesperado en la aplicación', 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const { reason } = event;
    if (reason instanceof AppError) {
      console.error(`[UnhandledRejection] ${reason.code}: ${reason.message}`, reason.cause);
    } else {
      console.error('[UnhandledRejection]', reason);
    }
    showGlobalToast('Error de conexión o procesamiento', 'error');
  });
}

function showGlobalToast(msg, type) {
  if (window.__toastFromToolbar) {
    window.__toastFromToolbar(msg, type);
  } else {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-dot"></span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('dismissing');
      setTimeout(() => t.remove(), 300);
    }, 5000);
  }
}
