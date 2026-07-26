export function initGlobalErrors() {
  window.addEventListener('error', (event) => {
    console.error('[GlobalError]', event.message, event.filename, event.lineno);
    showGlobalToast('Error inesperado en la aplicación', 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[UnhandledRejection]', event.reason);
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
    setTimeout(() => { t.classList.add('dismissing'); setTimeout(() => t.remove(), 300); }, 5000);
  }
}
