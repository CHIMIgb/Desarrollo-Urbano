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

-- Usuario de prueba (contraseña: 'admin123' - el hash deberá ser generado por bcrypt en el backend)
-- Por ahora insertamos uno manual para pruebas iniciales si es necesario, 
-- pero lo ideal es usar el endpoint de registro o un script de seed.
