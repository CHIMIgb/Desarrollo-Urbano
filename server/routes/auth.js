const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Las rutas ahora son declarativas
router.post('/login', authController.login);
router.get('/me', authController.me);
router.post('/register', authController.register);

module.exports = router;
