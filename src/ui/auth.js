import { state } from '../config/state.js';
import { trapFocus, releaseFocus } from '../utils/focusTrap.js';
import { logger } from '../utils/logger.js';
import { confirmDialog } from './notifications.js';

let _pendingAuth = null;

export function initAuth() {
  const token = localStorage.getItem('urbanplan_token');
  if (token) {
    checkSession(token);
  } else {
    updateUserMenu(false);
  }

  // Header login button
  document.getElementById('btnLoginHeader')?.addEventListener('click', () => {
    showLoginOverlay();
  });

  // Close button on login overlay
  document.getElementById('btnLoginClose')?.addEventListener('click', () => {
    hideLoginOverlay();
  });

  // Click outside the card to close
  document.getElementById('loginOverlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      hideLoginOverlay();
    }
  });

  // Escape key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const overlay = document.getElementById('loginOverlay');
      if (overlay && !overlay.classList.contains('hidden')) {
        hideLoginOverlay();
      }
    }
  });

  // Intercambiar formularios
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginError = document.getElementById('loginError');
  const registerError = document.getElementById('registerError');

  document.getElementById('btnShowRegister')?.addEventListener('click', (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
  });

  document.getElementById('btnShowLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    registerError.classList.add('hidden');
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  // Evento Login
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML =
      '<span class="spinner-container"><span class="spinner"></span><span>Verificando credenciales...</span></span>';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('urbanplan_token', data.token);
        localStorage.setItem('urbanplan_user', JSON.stringify(data.user));
        finishAuth(data.user);
      } else {
        loginError.textContent = data.error || 'Credenciales incorrectas';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      logger.error(err);
      loginError.textContent = 'No se pudo contactar al servidor';
      loginError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Evento Registro
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUser').value;
    const full_name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const submitBtn = registerForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.innerHTML =
      '<span class="spinner-container"><span class="spinner"></span><span>Creando cuenta...</span></span>';

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, full_name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('urbanplan_token', data.token);
        localStorage.setItem('urbanplan_user', JSON.stringify(data.user));
        finishAuth(data.user);
      } else {
        registerError.textContent = data.error || 'No se pudo crear la cuenta';
        registerError.classList.remove('hidden');
      }
    } catch (err) {
      logger.error('[Auth] Error en registro:', err.message);
      registerError.textContent = 'No se pudo contactar al servidor';
      registerError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Evento Logout
  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    if (state.features.length > 0) {
      const confirmed = await confirmDialog(
        'Cerrar sesión',
        'Tienes un proyecto abierto. Si no lo has guardado, los cambios se perderán. ¿Cerrar sesión de todas formas?'
      );
      if (!confirmed) return;
    }
    localStorage.removeItem('urbanplan_token');
    localStorage.removeItem('urbanplan_user');

    state.features = [];
    state.nextId = 1;
    state.currentProjectId = null;
    state.history = [];
    state.future = [];

    const nameDisplay = document.getElementById('projectName');
    if (nameDisplay) nameDisplay.textContent = 'Nuevo proyecto urbano';

    document.title = 'UrbanPlan 3D';
    document.getElementById('projectName')?.classList.remove('dirty');

    updateUserMenu(false);
    const { refreshMap } = await import('../map/core.js');
    refreshMap();
  });
}

function finishAuth(user) {
  hideLoginOverlay();
  showApp(user);

  if (_pendingAuth) {
    _pendingAuth.resolve(user);
    _pendingAuth = null;
  } else {
    import('./io.js').then((m) => m.loadSavedState());
  }
}

export function requireAuth() {
  return new Promise((resolve, reject) => {
    const token = localStorage.getItem('urbanplan_token');
    if (token) {
      fetch('/api/auth/me', { headers: { Authorization: token } })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Token invalido');
        })
        .then((data) => {
          resolve(data.user);
        })
        .catch(() => {
          localStorage.removeItem('urbanplan_token');
          localStorage.removeItem('urbanplan_user');
          _pendingAuth = { resolve, reject };
          showLoginOverlay();
        });
    } else {
      _pendingAuth = { resolve, reject };
      showLoginOverlay();
    }
  });
}

function showLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  overlay.classList.remove('hidden');
  trapFocus(overlay);

  // Resetear formularios
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('registerError').classList.add('hidden');
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  overlay.classList.add('hidden');
  releaseFocus();
  if (_pendingAuth) {
    _pendingAuth.reject(new Error('Login cancelado'));
    _pendingAuth = null;
  }
}

function showApp(user) {
  document.getElementById('loginOverlay').classList.add('hidden');
  releaseFocus();
  updateUserMenu(true);
  const rawName = user.full_name || user.username;

  const maxLen = 12;
  document.getElementById('userNameLabel').textContent =
    rawName.length > maxLen ? rawName.substring(0, maxLen) + '...' : rawName;

  const parts = rawName.trim().split(/\s+/);
  let initials;
  if (parts.length >= 2) {
    initials = parts[0].charAt(0) + parts[1].charAt(0);
  } else {
    initials = rawName.substring(0, 2);
  }
  document.getElementById('userInitial').textContent = initials.toUpperCase();

  if (state.map) {
    state.map.resize();
  }
}

function updateUserMenu(loggedIn) {
  const btnLogin = document.getElementById('btnLoginHeader');
  const userArea = document.getElementById('userInfoArea');
  if (loggedIn) {
    btnLogin.style.display = 'none';
    userArea.style.display = 'flex';
  } else {
    btnLogin.style.display = 'flex';
    userArea.style.display = 'none';
  }
}

async function checkSession(token) {
  try {
    const response = await fetch('/api/auth/me', {
      headers: { Authorization: token },
    });
    if (response.ok) {
      const data = await response.json();
      showApp(data.user);
      import('./io.js').then((m) => m.loadSavedState());
    } else {
      localStorage.removeItem('urbanplan_token');
      localStorage.removeItem('urbanplan_user');
      updateUserMenu(false);
    }
  } catch (err) {
    logger.error('Error verificando sesión:', err);
    updateUserMenu(false);
  }
}
