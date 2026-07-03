import { state } from '../config/state.js';

export function initAuth() {
  const loginOverlay = document.getElementById('loginOverlay');
  const appContainer = document.getElementById('appContainer');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const registerForm = document.getElementById('registerForm');
  const registerError = document.getElementById('registerError');
  const btnShowRegister = document.getElementById('btnShowRegister');
  const btnShowLogin = document.getElementById('btnShowLogin');
  const userNameLabel = document.getElementById('userNameLabel');
  const userInitial = document.getElementById('userInitial');
  const btnLogout = document.getElementById('btnLogout');

  // Verificar si hay una sesión activa al cargar
  const token = localStorage.getItem('urbanplan_token');
  if (token) {
    checkSession(token);
  } else {
    // Si no hay token, mostramos el login inmediatamente
    loginOverlay.classList.remove('hidden');
  }

  // Intercambiar formularios
  btnShowRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden'); // Or flex depending on css
  });

  btnShowLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  // Evento Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-container"><span class="spinner"></span><span>Accediendo...</span></span>';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('urbanplan_token', data.token);
        localStorage.setItem('urbanplan_user', JSON.stringify(data.user));
        showApp(data.user);
        // Cargar proyecto desde el servidor tras login
        import('./io.js').then(m => m.loadSavedState());
      } else {
        loginError.textContent = data.error || 'Error al iniciar sesión';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      loginError.textContent = 'Error de conexión con el servidor';
      loginError.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  // Evento Registro
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('regUser').value;
    const full_name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, full_name, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('urbanplan_token', data.token);
        localStorage.setItem('urbanplan_user', JSON.stringify(data.user));
        showApp(data.user);
        import('./io.js').then(m => m.loadSavedState());
      } else {
        registerError.textContent = data.error || 'Error al registrarse';
        registerError.classList.remove('hidden');
      }
    } catch (err) {
      console.error(err);
      registerError.textContent = 'Error de conexión con el servidor';
      registerError.classList.remove('hidden');
    }
  });

  // Evento Logout
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('urbanplan_token');
    localStorage.removeItem('urbanplan_user');
    window.location.reload();
  });

  async function checkSession(token) {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': token }
      });
      if (response.ok) {
        const data = await response.json();
        showApp(data.user);
        // Cargar proyecto desde el servidor tras verificar sesión
        import('./io.js').then(m => m.loadSavedState());
      } else {
        localStorage.removeItem('urbanplan_token');
        loginOverlay.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Error verificando sesión:', err);
      loginOverlay.classList.remove('hidden');
    }
  }

  function showApp(user) {
    loginOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    userNameLabel.textContent = user.full_name || user.username;
    userInitial.textContent = (user.full_name || user.username).charAt(0).toUpperCase();
    
    // Si el mapa ya estaba inicializado o necesita recarga, este es el punto
    if (state.map) {
        state.map.resize();
    }
  }
}
