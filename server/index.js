const express = require('express');
const cors = require('cors');
const path = require('path');
const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const { errorHandler } = require('./middleware/errorMiddleware');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
const maxLimit = process.env.MAX_PAYLOAD_SIZE || '100mb';
app.use(express.json({ limit: maxLimit }));
app.use(express.urlencoded({ limit: maxLimit, extended: true }));

// Logger simple para depuracion
app.use((req, res, next) => {
  console.log(`[API LOG] ${req.method} ${req.url}`);
  next();
});

// Rutas de API
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

// Endpoint para configuracion publica (OSM, etc.)
app.get('/api/config', (req, res) => {
  res.json({
    OSM_TILE_URL: process.env.OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    OSM_NOMINATIM_URL: process.env.OSM_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search',
    OSM_OVERPASS_ENDPOINTS: (process.env.OSM_OVERPASS_ENDPOINTS || '').split(',').filter(e => e.trim())
  });
});

// Proxy para Overpass API para evitar problemas de CORS y User-Agent en navegadores
app.post('/api/osm', async (req, res) => {
  try {
    const query = req.body.data || req.body;
    const queryStr = typeof query === 'object' ? query.data : query;
    
    // Usamos node-fetch (nativo en Node 18+)
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'UrbanPlan3D-App/1.0 (Vercel Node.js Proxy)'
      },
      body: `data=${encodeURIComponent(queryStr)}`
    });
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Overpass API error: ${response.status}` });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('OSM Proxy Error:', err);
    res.status(500).json({ error: 'Error connecting to OSM Overpass API' });
  }
});


// Seguridad: Bloquear acceso a archivos sensibles del backend
app.use((req, res, next) => {
  const forbidden = ['/server', '/data', '/package', '/.env', '/README'];
  if (forbidden.some(f => req.path.startsWith(f))) {
    return res.status(403).json({ error: 'Acceso denegado a archivos internos' });
  }
  next();
});

// Servir archivos estaticos del frontend (la raiz del proyecto)
app.use(express.static(path.join(__dirname, '../')));

// Catch-all: Envia index.html para cualquier otra ruta (SPA) o devuelve 404 para API
app.use((req, res) => {
  if (req.url.startsWith('/api/')) {
    console.warn(`[404 WARNING] API Endpoint no encontrado: ${req.method} ${req.url}`);
    return res.status(404).json({ error: `API endpoint not found: ${req.url}` });
  }
  // Si no es API y no se encontro archivo estatico, enviamos el index por si es una ruta SPA
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Catch-all de errores Express (Manejador Global unificado)
app.use((err, req, res, next) => {
  if (err.type === 'request.aborted') {
    console.warn(`[WARN] Cliente aborto la peticion HTTP prematuramente en ${req.url}`);
    return res.status(400).end();
  }
  next(err);
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor UrbanPlan 3D corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
