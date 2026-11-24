const express = require('express');
const path = require('path');
const { createTaskRouter } = require('./routes/taskRoutes');
const TaskController = require('./controllers/taskController');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { securityHeaders, createRateLimiter } = require('./middleware/security');
const { config } = require('./config/env');

/**
 * Factory function creating and configuring an Express application instance.
 * Allows injecting TaskService for isolated testing.
 *
 * @param {object} [options={}]
 * @param {import('./services/taskService')} [options.taskService] - Injected TaskService instance
 * @returns {express.Application}
 */
function createApp(options = {}) {
  const app = express();

  // 1. Security Headers
  app.use(securityHeaders);

  // 2. Rate Limiting on API endpoints
  const rateLimitOptions = options.rateLimit !== undefined ? options.rateLimit : config.rateLimit;
  app.use('/api/', createRateLimiter(rateLimitOptions));

  // 3. Parse JSON request bodies
  app.use(express.json());

  // 4. Serve static frontend assets from public directory
  app.use(express.static(path.join(__dirname, '../public')));

  // 3. Health check endpoint (GET /api/health)
  app.get('/api/health', (req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        service: 'TaskFlow'
      }
    });
  });

  // 4. Mount Task API routes
  const taskController = options.taskService
    ? new TaskController(options.taskService)
    : new TaskController();

  app.get('/api/categories', taskController.getAllCategories);
  app.use('/api/tasks', createTaskRouter(taskController));

  // 5. Catch-all 404 handler for unknown routes
  app.use(notFoundHandler);

  // 6. Centralized error handling middleware
  app.use(errorHandler);

  return app;
}

const defaultApp = createApp();
defaultApp.createApp = createApp;

module.exports = defaultApp;
