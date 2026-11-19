const { AppError } = require('../errors/appError');

/**
 * Centralized Express error handler middleware.
 * Recognizes typed application errors, Zod validation errors, and malformed JSON payloads.
 * Returns a safe generic 500 for unexpected errors and never leaks internal stack traces to clients.
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle malformed JSON body errors from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Malformed JSON payload in request body'
      }
    });
  }

  // Handle Zod validation errors
  if (err && err.name === 'ZodError') {
    const details = (err.issues || []).map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details
      }
    });
  }

  // Handle typed application domain errors (AppError, BadRequestError, NotFoundError)
  if (err && (err instanceof AppError || err.isAppError || (typeof err.statusCode === 'number' && err.statusCode < 500))) {
    const statusCode = err.statusCode || 400;
    const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST');

    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message: err.message
      }
    });
  }

  // Fallback for unexpected internal server errors (500)
  const statusCode = typeof err.statusCode === 'number' && err.statusCode >= 400 ? err.statusCode : 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred'
    }
  });
}

/**
 * 404 handler for unknown routes.
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.originalUrl || req.url}`
    }
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
