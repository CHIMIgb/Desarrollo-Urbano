-- Migración: añadir columnas de vista del mapa a proyectos existentes
-- Ejecutar UNA SOLA VEZ contra la base de datos de producción/desarrollo
-- PostgreSQL 16 — UrbanPlan 3D

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS map_center_lng DOUBLE PRECISION DEFAULT -99.1332,
  ADD COLUMN IF NOT EXISTS map_center_lat DOUBLE PRECISION DEFAULT 19.4326,
  ADD COLUMN IF NOT EXISTS map_zoom       DOUBLE PRECISION DEFAULT 13,
  ADD COLUMN IF NOT EXISTS map_pitch      DOUBLE PRECISION DEFAULT 65,
  ADD COLUMN IF NOT EXISTS map_bearing    DOUBLE PRECISION DEFAULT -20;

-- Verificar que las columnas se añadieron correctamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('map_center_lng','map_center_lat','map_zoom','map_pitch','map_bearing')
ORDER BY column_name;
