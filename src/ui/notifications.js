/**
 * Sistema centralizado de notificaciones toast.
 * Uso: import { notify } from './notifications.js';
 *       notify('Proyecto guardado', 'success');
 */
export function notify(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; setTimeout(() => t.remove(), 400); }, 3000);
}
