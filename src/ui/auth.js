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
    loginOverlay.style.display = 'flex';
  }

  // Intercambiar formularios
  btnShowRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginForm.style.display = 'none';
    registerForm.style.display = 'block'; // Or flex depending on css
  });

  btnShowLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  // Evento Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPass').value;

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
        loginError.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      loginError.textContent = 'Error de conexión con el servidor';
      loginError.style.display = 'block';
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
        registerError.style.display = 'block';
      }
    } catch (err) {
      console.error(err);
      registerError.textContent = 'Error de conexión con el servidor';
      registerError.style.display = 'block';
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
        loginOverlay.style.display = 'flex';
      }
    } catch (err) {
      console.error('Error verificando sesión:', err);
      loginOverlay.style.display = 'flex';
    }
  }

  function showApp(user) {
    loginOverlay.style.display = 'none';
    appContainer.style.display = 'block';
    userNameLabel.textContent = user.full_name || user.username;
    userInitial.textContent = (user.full_name || user.username).charAt(0).toUpperCase();
    
    // Si el mapa ya estaba inicializado o necesita recarga, este es el punto
    if (state.map) {
        state.map.resize();
    }
  }
}
