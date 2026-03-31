const express = require('express');
const cors = require('cors');
const path = require('path');
const authRouter = require('./auth');
const projectsRouter = require('./projects');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
const maxLimit = process.env.MAX_PAYLOAD_SIZE;
app.use(express.json({ limit: maxLimit }));
app.use(express.urlencoded({ limit: maxLimit, extended: true }));

// Logger simple para depuración
app.use((req, res, next) => {
  console.log(`[API LOG] ${req.method} ${req.url}`);
  next();
});

// Rutas de API
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

// Servir archivos estáticos del frontend (la raíz del proyecto)
app.use(express.static(path.join(__dirname, '../')));

// Catch-all: Envía index.html para cualquier otra ruta (SPA)
app.use((req, res) => {
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '../index.html'));
});
// Catch-all de errores Express (Manejador Global)
app.use((err, req, res, next) => {
  if (err.type === 'request.aborted') {
    console.warn(`[WARN] Cliente abortó la petición HTTP prematuramente en ${req.url}`);
    return res.status(400).end();
  }
  console.error('[ERROR] Error interno del servidor:', err);
  res.status(500).json({ error: 'Error interno de servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor UrbanPlan 3D corriendo en http://localhost:${PORT}`);
});
