-- Script de creación de base de datos para UrbanPlan 3D
-- PostgreSQL 16

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    next_id INT DEFAULT 1,
    -- Vista del mapa (cámara) al momento de guardar
    map_center_lng DOUBLE PRECISION DEFAULT -99.1332,
    map_center_lat DOUBLE PRECISION DEFAULT 19.4326,
    map_zoom DOUBLE PRECISION DEFAULT 13,
    map_pitch DOUBLE PRECISION DEFAULT 65,
    map_bearing DOUBLE PRECISION DEFAULT -20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PROJECT FEATURES (OBJECTS)
-- Stored as JSONB for flexibility (contains type, geometry, properties)
CREATE TABLE IF NOT EXISTS project_features (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    feature_data JSONB NOT NULL
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    project_id INT REFERENCES projects(id) ON DELETE SET NULL,
    action_type VARCHAR(50) NOT NULL, -- 'IMPORT', 'EXPORT'
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Usuario de prueba (contraseña: 'admin123' - el hash deberá ser generado por bcrypt en el backend)
-- Por ahora insertamos uno manual para pruebas iniciales si es necesario, 
-- pero lo ideal es usar el endpoint de registro o un script de seed.
