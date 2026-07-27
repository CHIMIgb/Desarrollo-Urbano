/**
 * Typed error hierarchy for UrbanPlan 3D.
 *
 * AppError (base)
 * ├── NetworkError   — fetch failed, server unreachable, timeout
 * ├── APIError       — HTTP response with non-2xx status
 * ├── ValidationError — invalid user input or data shape
 * └── StorageError   — localStorage / IndexedDB failure
 *
 * Each error carries a machine-readable `code` string so catch blocks
 * can branch without matching on human-readable messages.
 */

export class AppError extends Error {
  /**
   * @param {string} message  Human-readable description
   * @param {object} [opts]
   * @param {string} [opts.code]      Machine-readable code (e.g. 'NETWORK_FAIL')
   * @param {number} [opts.statusCode] HTTP status code when applicable
   * @param {Error}  [opts.cause]     Original error (for stack preservation)
   */
  constructor(message, { code = 'APP_ERROR', statusCode = null, cause = null } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export class NetworkError extends AppError {
  constructor(message, opts = {}) {
    super(message, { code: 'NETWORK_FAIL', ...opts });
  }
}

export class APIError extends AppError {
  constructor(message, { statusCode = 500, ...rest } = {}) {
    super(message, { code: 'API_ERROR', statusCode, ...rest });
  }
}

export class ValidationError extends AppError {
  constructor(message, opts = {}) {
    super(message, { code: 'VALIDATION_FAIL', ...opts });
  }
}

export class StorageError extends AppError {
  constructor(message, opts = {}) {
    super(message, { code: 'STORAGE_FAIL', ...opts });
  }
}
