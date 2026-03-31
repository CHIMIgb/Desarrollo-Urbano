/**
 * Script de migración: crea tablas para snapshots de métricas urbanas (historial).
 * Ejecutar: node data/migrate_metrics_snapshots.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_DATABASE,
});

async function migrate() {
  console.log('🔌 Conectando para migración de snapshots...');

  await db.query(`
    -- Tabla para snapshots globales
    CREATE TABLE IF NOT EXISTS project_metrics_snapshots (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      total_base_area DOUBLE PRECISION,
      total_occupied_area DOUBLE PRECISION,
      total_built_area DOUBLE PRECISION,
      total_green_area DOUBLE PRECISION,
      cos DOUBLE PRECISION,
      cus DOUBLE PRECISION,
      estimated_population INTEGER,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Tabla para desglose por lote dentro de cada snapshot
    CREATE TABLE IF NOT EXISTS project_lot_metrics_snapshots (
      id SERIAL PRIMARY KEY,
      snapshot_id INTEGER REFERENCES project_metrics_snapshots(id) ON DELETE CASCADE,
      lot_id INTEGER, -- Feature ID de la app
      name TEXT,
      base_area DOUBLE PRECISION,
      occupied_area DOUBLE PRECISION,
      built_area DOUBLE PRECISION,
      green_area DOUBLE PRECISION,
      cos DOUBLE PRECISION,
      cus DOUBLE PRECISION
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_project ON project_metrics_snapshots(project_id);
    CREATE INDEX IF NOT EXISTS idx_lot_metrics_snapshot ON project_lot_metrics_snapshots(snapshot_id);
  `);

  console.log('✅ Tablas de snapshots creadas con éxito');
}

migrate()
  .catch(err => { console.error('❌ Error:', err.message); process.exit(1); })
  .finally(() => db.end());
