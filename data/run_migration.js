/**
 * Script de migración: añade columnas de vista del mapa a la tabla projects.
 * Ejecutar: node data/run_migration.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE,
  connectionTimeoutMillis: 5000,
});

async function migrate() {
  console.log('🔌 Conectando a:', process.env.DB_DATABASE, 'en', process.env.DB_HOST);

  await db.query(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS map_center_lng DOUBLE PRECISION DEFAULT -99.1332,
      ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION DEFAULT 19.4326,
      ADD COLUMN IF NOT EXISTS map_zoom       DOUBLE PRECISION DEFAULT 13,
      ADD COLUMN IF NOT EXISTS map_pitch      DOUBLE PRECISION DEFAULT 65,
      ADD COLUMN IF NOT EXISTS map_bearing    DOUBLE PRECISION DEFAULT -20
  `);
  console.log('✅ Columnas añadidas (o ya existían)');

  const { rows } = await db.query(`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'projects'
    ORDER BY ordinal_position
  `);

  console.log('\nEstructura actual de la tabla projects:');
  rows.forEach(r => console.log(`  ${r.column_name.padEnd(20)} ${r.data_type.padEnd(22)} DEFAULT: ${r.column_default ?? '–'}`));
}

migrate()
  .catch(err => { console.error('❌ Error en migración:', err.message); process.exit(1); })
  .finally(() => db.end());
