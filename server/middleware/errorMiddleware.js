const logger = require('../logger');

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isClient = statusCode < 500;

  if (isClient) {
    logger.warn({ err, statusCode, url: req.url }, err.message);
  } else {
    logger.error({ err, statusCode, url: req.url }, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: isClient ? err.message : 'Error interno del servidor',
  });
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = {
  errorHandler,
  HttpError,
};
