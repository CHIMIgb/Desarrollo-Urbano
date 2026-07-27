const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const path = require('path');
const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const { errorHandler } = require('./middleware/errorMiddleware');
const logger = require('./logger');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ── Helmet — HTTP security headers ─────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS ───────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Rate limiting global ────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas peticiones, intenta más tarde' },
});
app.use('/api/', globalLimiter);

// ── Rate limiting auth (más restrictivo) ────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos de autenticación, espera 15 minutos' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Body parsing ────────────────────────────────────────────────
const maxLimit = process.env.MAX_PAYLOAD_SIZE || '100mb';
app.use(express.json({ limit: maxLimit }));
app.use(express.urlencoded({ limit: maxLimit, extended: true }));

// ── pino-http request logging ───────────────────────────────────
app.use(pinoHttp({ logger, autoLogging: isProd }));

// ── Rutas de API ────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

// Endpoint para configuracion publica (OSM, etc.)
app.get('/api/config', (req, res) => {
  res.json({
    OSM_TILE_URL: process.env.OSM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    OSM_NOMINATIM_URL:
      process.env.OSM_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search',
    OSM_OVERPASS_ENDPOINTS: (process.env.OSM_OVERPASS_ENDPOINTS || '')
      .split(',')
      .filter((e) => e.trim()),
  });
});

// ── Static files ────────────────────────────────────────────────
const staticDir = isProd ? path.join(__dirname, '../dist') : path.join(__dirname, '../');
app.use(express.static(staticDir));

// ── Security: block access to backend files ─────────────────────
app.use((req, res, next) => {
  const forbidden = ['/server', '/data', '/package', '/.env', '/README'];
  if (forbidden.some((f) => req.path.startsWith(f))) {
    return res.status(403).json({ success: false, error: 'Acceso denegado' });
  }
  next();
});

// ── Catch-all ───────────────────────────────────────────────────
app.use((req, res) => {
  if (req.url.startsWith('/api/')) {
    logger.warn({ method: req.method, url: req.url }, 'API endpoint no encontrado');
    return res.status(404).json({ success: false, error: `Endpoint no encontrado: ${req.url}` });
  }
  res.sendFile(path.join(staticDir, 'index.html'));
});

// ── Abort handler ───────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.type === 'request.aborted') {
    logger.warn({ url: req.url }, 'Cliente abortó petición');
    return res.status(400).json({ success: false, error: 'Petición abortada' });
  }
  next(err);
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(
      { port: PORT, env: process.env.NODE_ENV || 'development' },
      'Servidor UrbanPlan 3D iniciado'
    );
  });
}

module.exports = app;
