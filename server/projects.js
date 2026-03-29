const express = require('express');
const router = express.Router();
const db = require('./db');
const jwt = require('jsonwebtoken');

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
};

// GUARDAR PROYECTO
router.post('/save', authenticateToken, async (req, res) => {
  const { name, features, nextId, projectId } = req.body;
  const userId = req.user.id;

  try {
    await db.query('BEGIN');

    let currentProjectId = projectId;

    if (!currentProjectId) {
      // Buscar el último proyecto si existe o crear uno nuevo (regla de uno a la vez)
      const existing = await db.query('SELECT id FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [userId]);
      if (existing.rows.length > 0) {
        currentProjectId = existing.rows[0].id;
      } else {
        const result = await db.query(
          'INSERT INTO projects (user_id, name, next_id) VALUES ($1, $2, $3) RETURNING id',
          [userId, name || 'Mi Proyecto Urbano', nextId]
        );
        currentProjectId = result.rows[0].id;
      }
    } else {
      // Actualizar el proyecto existente
      await db.query('UPDATE projects SET name = $1, next_id = $2, updated_at = NOW() WHERE id = $3', [name, nextId, currentProjectId]);
    }

    // Limpiar características anteriores y añadir nuevas
    await db.query('DELETE FROM project_features WHERE project_id = $1', [currentProjectId]);
    
    for (const feat of features) {
      await db.query('INSERT INTO project_features (project_id, feature_data) VALUES ($1, $2)', [currentProjectId, feat]);
    }

    await db.query('COMMIT');
    res.json({ message: 'Proyecto guardado con éxito', projectId: currentProjectId });
  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error al guardar el proyecto' });
  }
});

// CARGAR ÚLTIMO PROYECTO
router.get('/load', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const projectResult = await db.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [userId]);
    if (projectResult.rows.length === 0) {
      return res.json({ project: null });
    }

    const project = projectResult.rows[0];
    const featuresResult = await db.query('SELECT feature_data FROM project_features WHERE project_id = $1', [project.id]);

    res.json({
      project: {
        id: project.id,
        name: project.name,
        nextId: project.next_id,
        features: featuresResult.rows.map(r => r.feature_data)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el proyecto' });
  }
});

// REGISTRAR AUDITORÍA (IMPORT/EXPORT)
router.post('/audit', authenticateToken, async (req, res) => {
  const { action_type, details, projectId } = req.body;
  const userId = req.user.id;

  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, project_id, action_type, details) VALUES ($1, $2, $3, $4)',
      [userId, projectId, action_type, details]
    );
    res.json({ message: 'Evento de auditoría registrado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar auditoría' });
  }
});

module.exports = router;
