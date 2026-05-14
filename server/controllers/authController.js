const authService = require('../services/authService');
const { HttpError } = require('../middleware/errorMiddleware');

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new HttpError(400, 'Usuario y contraseña son requeridos');
    }

    const { token, user } = await authService.loginUser(username, password);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email
      }
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const token = req.headers['authorization'];
    if (!token) throw new HttpError(401, 'Token no proporcionado');

    const decoded = authService.verifyToken(token);
    res.json({ success: true, user: decoded });
  } catch (err) {
    next(err);
  }
}

async function register(req, res, next) {
  try {
    const { username, full_name, email, password } = req.body;

    if (!username || !password || !email || !full_name) {
      throw new HttpError(400, 'Todos los campos son obligatorios');
    }

    const { token, user } = await authService.registerUser(username, full_name, email, password);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  me,
  register
};
