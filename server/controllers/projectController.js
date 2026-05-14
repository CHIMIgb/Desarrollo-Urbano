const projectService = require('../services/projectService');
const { HttpError } = require('../middleware/errorMiddleware');

async function save(req, res, next) {
  try {
    const userId = req.user.id;
    if (!req.body.features || !Array.isArray(req.body.features)) {
      throw new HttpError(400, 'Los datos de las features son requeridos y deben ser un arreglo');
    }

    const projectId = await projectService.saveProject(userId, req.body);
    res.json({ success: true, message: 'Proyecto guardado con exito', projectId });
  } catch (err) {
    next(err);
  }
}

async function listAll(req, res, next) {
  try {
    const userId = req.user.id;
    const projects = await projectService.listUserProjects(userId);
    res.json({ success: true, projects });
  } catch (err) {
    next(err);
  }
}

async function loadLatest(req, res, next) {
  try {
    const userId = req.user.id;
    const project = await projectService.loadLatestProject(userId);
    res.json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

async function loadById(req, res, next) {
  try {
    const userId = req.user.id;
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) throw new HttpError(400, 'ID de proyecto invalido');

    const project = await projectService.loadProjectById(userId, projectId);
    res.json({ success: true, project });
  } catch (err) {
    next(err);
  }
}

async function audit(req, res, next) {
  try {
    const userId = req.user.id;
    const { action_type, details, projectId } = req.body;
    
    if (!action_type) throw new HttpError(400, 'El action_type es requerido');

    await projectService.addAuditLog(userId, projectId, action_type, details);
    res.json({ success: true, message: 'Evento de auditoria registrado' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  save,
  listAll,
  loadLatest,
  loadById,
  audit
};
