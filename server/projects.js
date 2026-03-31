const express = require('express');
const router = express.Router();
const db = require('./db');
const jwt = require('jsonwebtoken');

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalido' });
    req.user = user;
    next();
  });
};

// GUARDAR PROYECTO
router.post('/save', authenticateToken, async (req, res) => {
  const { name, features, nextId, projectId, mapView, metrics } = req.body;
  const userId = req.user.id;

  console.log(`[SAVE DEBUG] Guardando proyecto para usuario ${userId}. Metrics included: ${!!metrics}`);

  // Extraer campos de vista del mapa con valores por defecto
  const centerLng = mapView?.center?.[0] ?? -99.1332;
  const centerLat = mapView?.center?.[1] ?? 19.4326;
  const zoom      = mapView?.zoom      ?? 13;
  const pitch     = mapView?.pitch     ?? 65;
  const bearing   = mapView?.bearing   ?? -20;

  try {
    await db.query('BEGIN');

    let currentProjectId = projectId;

    if (!currentProjectId) {
      console.log('[SAVE DEBUG] Creando nuevo proyecto...');
      const result = await db.query(
        `INSERT INTO projects (user_id, name, next_id, map_center_lng, map_center_lat, map_zoom, map_pitch, map_bearing)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [userId, name || 'Mi Proyecto Urbano', nextId, centerLng, centerLat, zoom, pitch, bearing]
      );
      currentProjectId = result.rows[0].id;
    } else {
      console.log(`[SAVE DEBUG] Actualizando proyecto existente ID: ${currentProjectId}`);
      const check = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [currentProjectId, userId]);
      if (check.rows.length === 0) throw new Error('Proyecto no encontrado o no pertenece al usuario');

      await db.query(
        `UPDATE projects
            SET name = $1, next_id = $2,
                map_center_lng = $3, map_center_lat = $4,
                map_zoom = $5, map_pitch = $6, map_bearing = $7,
                updated_at = NOW()
          WHERE id = $8`,
        [name, nextId, centerLng, centerLat, zoom, pitch, bearing, currentProjectId]
      );
    }

    // Limpiar features anteriores y añadir nuevas
    await db.query('DELETE FROM project_features WHERE project_id = $1', [currentProjectId]);
    console.log(`[SAVE DEBUG] Insertando ${features.length} features...`);
    for (const feat of features) {
      await db.query('INSERT INTO project_features (project_id, feature_data) VALUES ($1, $2)', [currentProjectId, feat]);
    }
    
    // --- PERSISTENCIA DE METRICAS (SNAPSHOTS) ---
    if (metrics && metrics.global) {
      const g = metrics.global;
      console.log('[SAVE DEBUG] Insertando snapshot global...');
      const snapshotResult = await db.query(
        `INSERT INTO project_metrics_snapshots 
          (project_id, total_base_area, total_occupied_area, total_built_area, total_green_area, cos, cus, estimated_population)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [currentProjectId, g.total_base_area, g.total_occupied_area, g.total_built_area, g.total_green_area, g.cos, g.cus, g.estimated_population]
      );

      const snapshotId = snapshotResult.rows[0].id;
      console.log(`[SAVE DEBUG] Snapshot ID: ${snapshotId}. Insertando desglose de ${metrics.lots?.length || 0} lotes...`);

      if (metrics.lots && Array.isArray(metrics.lots)) {
        for (const lot of metrics.lots) {
          await db.query(
            `INSERT INTO project_lot_metrics_snapshots
              (snapshot_id, lot_id, name, base_area, occupied_area, built_area, green_area, cos, cus)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [snapshotId, lot.lot_id, lot.name, lot.base_area, lot.occupied_area, lot.built_area, lot.green_area, lot.cos, lot.cus]
          );
        }
      }
    } else {
      console.log('[SAVE DEBUG] No se recibieron metricas para guardar snapshots.');
    }

    await db.query('COMMIT');
    console.log('[SAVE DEBUG] Guardado completado con exito.');
    res.json({ message: 'Proyecto guardado con exito', projectId: currentProjectId });
  } catch (err) {
    if (db.query) await db.query('ROLLBACK');
    console.error('[SAVE ERROR] Error en transaccion:', err);
    res.status(500).json({ error: err.message || 'Error al guardar el proyecto' });
  }
});

// LISTAR TODOS LOS PROYECTOS DEL USUARIO
router.get('/all', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(
      'SELECT id, name, updated_at, created_at FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId]
    );
    res.json({ projects: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al listar proyectos' });
  }
});

// CARGAR ULTIMO PROYECTO
router.get('/load', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const projectResult = await db.query('SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1', [userId]);
    if (projectResult.rows.length === 0) return res.json({ project: null });

    const project = projectResult.rows[0];
    const featuresResult = await db.query('SELECT feature_data FROM project_features WHERE project_id = $1', [project.id]);

    res.json({
      project: {
        id: project.id,
        name: project.name,
        nextId: project.next_id,
        features: featuresResult.rows.map(r => r.feature_data),
        mapView: {
          center: [parseFloat(project.map_center_lng), parseFloat(project.map_center_lat)],
          zoom:    parseFloat(project.map_zoom),
          pitch:   parseFloat(project.map_pitch),
          bearing: parseFloat(project.map_bearing)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el proyecto' });
  }
});

// CARGAR PROYECTO ESPECIFICO POR ID
router.get('/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const projectId = parseInt(req.params.id, 10);
  if (isNaN(projectId)) return res.status(400).json({ error: 'ID de proyecto invalido' });

  try {
    const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);
    if (projectResult.rows.length === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const project = projectResult.rows[0];
    const featuresResult = await db.query('SELECT feature_data FROM project_features WHERE project_id = $1', [project.id]);

    res.json({
      project: {
        id: project.id,
        name: project.name,
        nextId: project.next_id,
        features: featuresResult.rows.map(r => r.feature_data),
        mapView: {
          center: [parseFloat(project.map_center_lng), parseFloat(project.map_center_lat)],
          zoom:    parseFloat(project.map_zoom),
          pitch:   parseFloat(project.map_pitch),
          bearing: parseFloat(project.map_bearing)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al cargar el proyecto' });
  }
});

// REGISTRAR AUDITORIA
router.post('/audit', authenticateToken, async (req, res) => {
  const { action_type, details, projectId } = req.body;
  const userId = req.user.id;

  try {
    await db.query(
      'INSERT INTO audit_logs (user_id, project_id, action_type, details) VALUES ($1, $2, $3, $4)',
      [userId, projectId, action_type, details]
    );
    res.json({ message: 'Evento de auditoria registrado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar auditoria' });
  }
});

module.exports = router;
