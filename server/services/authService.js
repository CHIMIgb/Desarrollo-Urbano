const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { HttpError } = require('../middleware/errorMiddleware');

async function loginUser(username, password) {
  const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);

  if (userResult.rows.length === 0) {
    throw new HttpError(401, 'Credenciales invalidas');
  }

  const user = userResult.rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);

  if (!isMatch) {
    throw new HttpError(401, 'Credenciales invalidas');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '2h' }
  );

  return { token, user };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch (err) {
    throw new HttpError(401, 'Token inválido');
  }
}

async function registerUser(username, full_name, email, password) {
  // Ver si existe
  const existing = await db.query('SELECT username FROM users WHERE username = $1 OR email = $2', [
    username,
    email,
  ]);
  if (existing.rows.length > 0) {
    throw new HttpError(400, 'El usuario o correo ya está en uso');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  // Insertar
  const result = await db.query(
    'INSERT INTO users (username, full_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, email',
    [username, full_name, email, hash]
  );

  const user = result.rows[0];

  const token = jwt.sign(
    { id: user.id, username: user.username, full_name: user.full_name },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '2h' }
  );

  return { token, user };
}

module.exports = {
  loginUser,
  verifyToken,
  registerUser,
};
