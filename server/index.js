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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

app.listen(PORT, () => {
  console.log(`Servidor UrbanPlan 3D corriendo en http://localhost:${PORT}`);
});
