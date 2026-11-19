/**
 * Reusable Express middleware for validating request body, query, and params using Zod schemas.
 * Formats errors consistently and never leaks stack traces.
 * Compatible with Express 5 request prototypes (handling getter-only req.query via defineProperty).
 *
 * Usage:
 *   validateRequest({ body: createTaskSchema })
 *   validateRequest({ params: taskIdParamSchema })
 *   validateRequest({ query: filterTasksSchema })
 *   validateRequest(createTaskSchema, 'body')
 *
 * @param {object|import('zod').ZodSchema} schemas - Schema configuration or direct Zod schema
 * @param {'body'|'query'|'params'} [defaultSource='body'] - Default source if direct schema passed
 * @returns {Function} Express middleware handler
 */
function validateRequest(schemas, defaultSource = 'body') {
  return (req, res, next) => {
    try {
      const targets = {};

      if (schemas && typeof schemas.safeParse === 'function') {
        targets[defaultSource] = schemas;
      } else if (schemas && typeof schemas === 'object') {
        if (schemas.body) targets.body = schemas.body;
        if (schemas.query) targets.query = schemas.query;
        if (schemas.params) targets.params = schemas.params;
      } else {
        return next();
      }

      const allErrors = [];

      for (const [source, schema] of Object.entries(targets)) {
        const result = schema.safeParse(req[source] || {});

        if (!result.success) {
          const formatted = (result.error.issues || []).map((issue) => ({
            field: issue.path.length > 0 ? issue.path.join('.') : source,
            message: issue.message
          }));
          allErrors.push(...formatted);
        } else {
          // Replace with sanitized/coerced data
          // Express 5 defines req.query as a getter without setter on express.request prototype,
          // so we use Object.defineProperty to safely override the instance property.
          try {
            req[source] = result.data;
          } catch {
            // Getter-only in strict mode
          }

          if (req[source] !== result.data) {
            Object.defineProperty(req, source, {
              value: result.data,
              writable: true,
              configurable: true,
              enumerable: true
            });
          }

          req.validated = req.validated || {};
          req.validated[source] = result.data;
        }
      }

      if (allErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: allErrors
          }
        });
      }

      return next();
    } catch {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data'
        }
      });
    }
  };
}

module.exports = validateRequest;
