const express = require('express');
const zlib = require('zlib');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticateToken = require('../middleware/authMiddleware');

// Todas las rutas de proyectos están protegidas
router.use(authenticateToken);

// Save route con soporte para body comprimido (gzip)
router.post(
  '/save',
  express.raw({ type: 'application/octet-stream', limit: '10mb' }),
  (req, _res, next) => {
    if (Buffer.isBuffer(req.body) && req.body.length > 0) {
      req.body = JSON.parse(zlib.gunzipSync(req.body).toString());
    }
    next();
  },
  projectController.save
);
router.get('/all', projectController.listAll);
router.get('/load', projectController.loadLatest);
router.get('/:id', projectController.loadById);
router.post('/audit', projectController.audit);

module.exports = router;
