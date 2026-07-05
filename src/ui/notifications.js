/**
 * Sistema centralizado de notificaciones toast.
 * Uso: import { notify } from './notifications.js';
 *       notify('Proyecto guardado', 'success');
 */
export function notify(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return () => {};
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  
  if (type === 'loading') {
    t.innerHTML = `<span class="spinner" style="margin-right: 8px;"></span><span>${msg}</span>`;
  } else {
    t.innerHTML = `<div class="toast-dot"></div><span>${msg}</span>`;
  }
  
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '1'; t.style.transform = 'translateY(0)'; }, 10);
  
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
    
    const btnAccept = document.getElementById('btnConfirmAccept');
    const btnCancel = document.getElementById('btnConfirmCancel');
    
    const cleanup = () => {
      modal.classList.add('hidden');
      btnAccept.removeEventListener('click', onAccept);
      btnCancel.removeEventListener('click', onCancel);
    };
    
    const onAccept = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };
    
    btnAccept.addEventListener('click', onAccept);
    btnCancel.addEventListener('click', onCancel);
  });
}
