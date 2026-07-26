const jwt = require('jsonwebtoken');
const logger = require('../logger');

const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ success: false, error: 'Token no proporcionado' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) {
      logger.debug({ err }, 'Token inválido');
      return res.status(403).json({ success: false, error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

module.exports = authenticateToken;
