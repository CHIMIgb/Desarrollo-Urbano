/**
 * Sistema centralizado de notificaciones toast.
 * Uso: import { notify } from './notifications.js';
 *       notify('Proyecto guardado', 'success');
 */
import { escapeHTML } from '../utils/sanitize.js';
import { trapFocus, releaseFocus } from '../utils/focusTrap.js';

export function notify(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return () => {};
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  
  if (type === 'loading') {
    t.innerHTML = `<span class="spinner" style="margin-right: 8px;"></span><span>${escapeHTML(msg)}</span>`;
  } else {
    t.innerHTML = `<div class="toast-dot"></div><span>${escapeHTML(msg)}</span>`;
  }
  
  container.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; });
  
  const removeToast = () => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 400);
  };

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }

  return removeToast;
}

export function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    if (!modal) {
      resolve(confirm(`${title}\n${message}`));
      return;
    }
    
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    
    modal.classList.remove('hidden');
    trapFocus(modal);
    
    const btnAccept = document.getElementById('btnConfirmAccept');
    const btnCancel = document.getElementById('btnConfirmCancel');
    
    const onEscape = (e) => {
      if (e.key === 'Escape') { cleanup(); resolve(false); }
    };
    
    const cleanup = () => {
      modal.classList.add('hidden');
      releaseFocus();
      btnAccept.removeEventListener('click', onAccept);
      btnCancel.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onEscape);
    };
    
    const onAccept = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    
    btnAccept.addEventListener('click', onAccept);
    btnCancel.addEventListener('click', onCancel);
    document.addEventListener('keydown', onEscape);
  });
}
