const express = require('express');
const TaskController = require('../controllers/taskController');
const validateRequest = require('../middleware/validateRequest');
const {
  createTaskSchema,
  updateTaskSchema,
  filterTasksSchema,
  taskIdParamSchema
} = require('../validators/taskSchemas');

/**
 * Creates and configures the Express router for task endpoints.
 *
 * @param {TaskController} [taskController] - Injected TaskController instance
 * @returns {express.Router}
 */
function createTaskRouter(taskController = new TaskController()) {
  const router = express.Router();

  // POST /api/tasks - Create a new task
  router.post(
    '/',
    validateRequest({ body: createTaskSchema }),
    taskController.createTask
  );

  // GET /api/tasks - List all tasks (optional ?completed=true|false)
  router.get(
    '/',
    validateRequest({ query: filterTasksSchema }),
    taskController.getAllTasks
  );

  // GET /api/tasks/categories - List all categories
  router.get('/categories', taskController.getAllCategories);

  // GET /api/tasks/:id - Retrieve single task by ID
  router.get(
    '/:id',
    validateRequest({ params: taskIdParamSchema }),
    taskController.getTaskById
  );

  // PATCH /api/tasks/:id - Partially or fully update task
  router.patch(
    '/:id',
    validateRequest({ params: taskIdParamSchema, body: updateTaskSchema }),
    taskController.updateTask
  );

  // DELETE /api/tasks/:id - Delete a task by ID
  router.delete(
    '/:id',
    validateRequest({ params: taskIdParamSchema }),
    taskController.deleteTask
  );

  return router;
}

const defaultRouter = createTaskRouter();
defaultRouter.createTaskRouter = createTaskRouter;

module.exports = defaultRouter;
