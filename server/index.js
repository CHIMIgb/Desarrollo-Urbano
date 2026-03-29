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
app.use(express.json());

// Servir archivos estáticos del frontend (la raíz del proyecto)
app.use(express.static(path.join(__dirname, '../')));

// Rutas de API
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

// Ruta para servir el index.html en cualquier otra ruta (SPA style)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor UrbanPlan 3D corriendo en http://localhost:${PORT}`);
});
