// Middleware global para manejo de errores
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR GLOBAL]', err);

  // Si es un error personalizado con status (lanzado desde un controlador)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // Error genérico del servidor
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
};

// Clase utilitaria para errores HTTP
class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = {
  errorHandler,
  HttpError
};
