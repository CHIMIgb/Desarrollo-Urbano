const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

// RUTA DE LOGIN
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales invalidas' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '2h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// RUTA DE VERIFICACIÓN (ME)
router.get('/me', async (req, res) => {
  const token = req.headers['authorization'];

  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    res.json({ user: decoded });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// RUTA DE REGISTRO
router.post('/register', async (req, res) => {
  const { username, full_name, email, password } = req.body;

  if (!username || !password || !email || !full_name) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }

  try {
    // Check if user exists
    const existing = await db.query('SELECT username FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El usuario o correo ya está en uso' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await db.query(
      'INSERT INTO users (username, full_name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, email',
      [username, full_name, email, hash]
    );

    const user = result.rows[0];

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '2h' }
    );

    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al registrar usuario' });
  }
});

module.exports = router;
