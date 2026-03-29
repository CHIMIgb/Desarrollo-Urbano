const bcrypt = require('bcryptjs');
const db = require('./db');
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

    console.log('✅ Usuario de prueba creado con éxito:');
    console.log(`   User: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Pass: ${password}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error al crear el usuario de prueba:', err);
    process.exit(1);
  }
}

seed();
