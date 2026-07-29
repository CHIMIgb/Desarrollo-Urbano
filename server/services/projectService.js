const db = require('../db');
const { HttpError } = require('../middleware/errorMiddleware');

async function saveProject(userId, projectData) {
  const { name, features, nextId, projectId, mapView, metrics } = projectData;

  const centerLng = mapView?.center?.[0] ?? -99.1332;
  const centerLat = mapView?.center?.[1] ?? 19.4326;
  const zoom = mapView?.zoom ?? 13;
  const pitch = mapView?.pitch ?? 65;
  const bearing = mapView?.bearing ?? -20;

  try {
    await db.query('BEGIN');
    let currentProjectId = projectId;

    if (!currentProjectId) {
      const result = await db.query(
        `INSERT INTO projects (user_id, name, next_id, features, map_center_lng, map_center_lat, map_zoom, map_pitch, map_bearing)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9) RETURNING id`,
        [userId, name || 'Mi Proyecto Urbano', nextId, JSON.stringify(features), centerLng, centerLat, zoom, pitch, bearing]
      );
      currentProjectId = result.rows[0].id;
    } else {
      const check = await db.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        currentProjectId,
        userId,
      ]);
      if (check.rows.length === 0)
        throw new HttpError(403, 'Proyecto no encontrado o no pertenece al usuario');

      await db.query(
        `UPDATE projects
            SET name = $1, next_id = $2, features = $3::jsonb,
                map_center_lng = $4, map_center_lat = $5,
                map_zoom = $6, map_pitch = $7, map_bearing = $8,
                updated_at = NOW()
          WHERE id = $9`,
        [name, nextId, JSON.stringify(features), centerLng, centerLat, zoom, pitch, bearing, currentProjectId]
      );
    }

    // Guardar métricas si existen
    if (metrics && metrics.global) {
      const g = metrics.global;
      const snapshotResult = await db.query(
        `INSERT INTO project_metrics_snapshots
          (project_id, total_base_area, total_occupied_area, total_built_area, total_green_area, cos, cus, estimated_population)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          currentProjectId,
          g.total_base_area,
          g.total_occupied_area,
          g.total_built_area,
          g.total_green_area,
          g.cos,
          g.cus,
          g.estimated_population,
        ]
      );

      const snapshotId = snapshotResult.rows[0].id;

      if (metrics.lots && Array.isArray(metrics.lots)) {
        for (const lot of metrics.lots) {
          await db.query(
            `INSERT INTO project_lot_metrics_snapshots
              (snapshot_id, lot_id, name, base_area, occupied_area, built_area, green_area, cos, cus)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              snapshotId,
              lot.lot_id,
              lot.name,
              lot.base_area,
              lot.occupied_area,
              lot.built_area,
              lot.green_area,
              lot.cos,
              lot.cus,
            ]
          );
        }
      }
    }

    await db.query('COMMIT');
    return currentProjectId;
  } catch (err) {
    if (db.query) await db.query('ROLLBACK');
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, err.message || 'Error interno al guardar el proyecto');
  }
}

async function listUserProjects(userId) {
  const result = await db.query(
    'SELECT id, name, updated_at, created_at FROM projects WHERE user_id = $1 ORDER BY updated_at DESC',
    [userId]
  );
  return result.rows;
}

async function loadLatestProject(userId) {
  const projectResult = await db.query(
    'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1',
    [userId]
  );
  if (projectResult.rows.length === 0) return null;

  const project = projectResult.rows[0];
  let features = project.features || [];

  // Fallback: si features está vacío, buscar en project_features (datos legacy)
  if (!features.length) {
    const legacyResult = await db.query(
      'SELECT feature_data FROM project_features WHERE project_id = $1',
      [project.id]
    );
    features = legacyResult.rows.map((r) => r.feature_data);
  }

  return {
    id: project.id,
    name: project.name,
    nextId: project.next_id,
    features,
    mapView: {
      center: [parseFloat(project.map_center_lng), parseFloat(project.map_center_lat)],
      zoom: parseFloat(project.map_zoom),
      pitch: parseFloat(project.map_pitch),
      bearing: parseFloat(project.map_bearing),
    },
  };
}

async function loadProjectById(userId, projectId) {
  const projectResult = await db.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
    projectId,
    userId,
  ]);
  if (projectResult.rows.length === 0)
    throw new HttpError(404, 'Proyecto no encontrado o sin acceso');

  const project = projectResult.rows[0];
  let features = project.features || [];

  // Fallback: si features está vacío, buscar en project_features (datos legacy)
  if (!features.length) {
    const legacyResult = await db.query(
      'SELECT feature_data FROM project_features WHERE project_id = $1',
      [project.id]
    );
    features = legacyResult.rows.map((r) => r.feature_data);
  }

  return {
    id: project.id,
    name: project.name,
    nextId: project.next_id,
    features,
    mapView: {
      center: [parseFloat(project.map_center_lng), parseFloat(project.map_center_lat)],
      zoom: parseFloat(project.map_zoom),
      pitch: parseFloat(project.map_pitch),
      bearing: parseFloat(project.map_bearing),
    },
  };
}

async function addAuditLog(userId, projectId, actionType, details) {
  await db.query(
    'INSERT INTO audit_logs (user_id, project_id, action_type, details) VALUES ($1, $2, $3, $4)',
    [userId, projectId, actionType, details]
  );
}

module.exports = {
  saveProject,
  listUserProjects,
  loadLatestProject,
  loadProjectById,
  addAuditLog,
};
