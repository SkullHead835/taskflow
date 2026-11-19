/**
 * Custom application error for expected domain and client-side errors.
 * Encapsulates HTTP status code, stable machine-readable code, and message.
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error description
   * @param {number} [statusCode=400] - HTTP status code
   * @param {string} [code='BAD_REQUEST'] - Stable error code
   */
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isAppError = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

class BadRequestError extends AppError {
  constructor(message, code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

module.exports = {
  AppError,
  BadRequestError,
  NotFoundError
};
