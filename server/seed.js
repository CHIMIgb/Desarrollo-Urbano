const bcrypt = require('bcryptjs');
const db = require('./db');
const logger = require('./logger');
require('dotenv').config();

async function seed() {
  const username = 'admin';
  const email = 'admin@urbanplan.com';
  const password = 'admin123';
  const full_name = 'Administrador Sistema';

  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    await db.query(
      'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
      [username, email, hash, full_name]
    );

    logger.info({ user: username, email }, 'Usuario de prueba creado');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error al crear usuario de prueba');
    process.exit(1);
  }
}

seed();
