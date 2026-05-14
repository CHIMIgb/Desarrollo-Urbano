const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authenticateToken = require('../middleware/authMiddleware');

// Todas las rutas de proyectos están protegidas
router.use(authenticateToken);

router.post('/save', projectController.save);
router.get('/all', projectController.listAll);
router.get('/load', projectController.loadLatest);
router.get('/:id', projectController.loadById);
router.post('/audit', projectController.audit);

module.exports = router;
