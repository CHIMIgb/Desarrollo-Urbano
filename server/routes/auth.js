const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authController = require('../controllers/authController');
const { HttpError } = require('../middleware/errorMiddleware');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map(e => e.msg).join(', ');
    throw new HttpError(400, msg);
  }
  next();
};

const loginRules = [
  body('username')
    .trim()
    .isString().withMessage('Usuario debe ser texto')
    .isLength({ min: 3, max: 50 }).withMessage('Usuario: 3-50 caracteres'),
  body('password')
    .isString().withMessage('Contraseña debe ser texto')
    .isLength({ min: 6, max: 100 }).withMessage('Contraseña: 6-100 caracteres')
];

const registerRules = [
  body('username')
    .trim()
    .isString().withMessage('Usuario debe ser texto')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Usuario: solo letras, números y guión bajo')
    .isLength({ min: 3, max: 30 }).withMessage('Usuario: 3-30 caracteres'),
  body('full_name')
    .trim()
    .isString().withMessage('Nombre debe ser texto')
    .isLength({ min: 2, max: 100 }).withMessage('Nombre: 2-100 caracteres'),
  body('email')
    .trim()
    .isEmail().withMessage('Email no válido')
    .normalizeEmail(),
  body('password')
    .isString().withMessage('Contraseña debe ser texto')
    .isLength({ min: 6, max: 100 }).withMessage('Contraseña: 6-100 caracteres')
];

router.post('/login', loginRules, validate, authController.login);
router.get('/me', authController.me);
router.post('/register', registerRules, validate, authController.register);

module.exports = router;
