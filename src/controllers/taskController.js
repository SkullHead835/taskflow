const TaskService = require('../services/taskService');

/**
 * Controller handling HTTP requests for the Tasks API.
 * Delegates all business logic to TaskService and formats standard JSON responses.
 */
class TaskController {
  /**
   * @param {TaskService} [taskService] - Optional TaskService for dependency injection
   */
  constructor(taskService = null) {
    this._taskService = taskService;

    // Bind methods to ensure correct execution context
    this.createTask = this.createTask.bind(this);
    this.getAllTasks = this.getAllTasks.bind(this);
    this.getTaskById = this.getTaskById.bind(this);
    this.updateTask = this.updateTask.bind(this);
    this.deleteTask = this.deleteTask.bind(this);
  }

  /**
   * Lazily loads default TaskService if not injected.
   *
   * @returns {TaskService}
   */
  get taskService() {
    if (!this._taskService) {
      this._taskService = new TaskService();
    }
    return this._taskService;
  }

  /**
   * POST /api/tasks - Creates a new task.
   */
  async createTask(req, res, next) {
    try {
      const task = this.taskService.createTask(req.body);
      return res.status(201).json({
        success: true,
        data: task
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /api/tasks - Retrieves all tasks with optional completion status filter.
   */
  async getAllTasks(req, res, next) {
    try {
      const filters = req.query || {};
      const tasks = this.taskService.getAllTasks(filters);
      return res.status(200).json({
        success: true,
        data: tasks
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * GET /api/tasks/:id - Retrieves a task by its ID.
   */
  async getTaskById(req, res, next) {
    try {
      const task = this.taskService.getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: task
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * PATCH /api/tasks/:id - Updates an existing task partially or fully.
   */
  async updateTask(req, res, next) {
    try {
      const task = this.taskService.updateTask(req.params.id, req.body);
      if (!task) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: task
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * DELETE /api/tasks/:id - Deletes a task by ID.
   */
  async deleteTask(req, res, next) {
    try {
      const deleted = this.taskService.deleteTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Task not found'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          message: 'Task deleted successfully'
        }
      });
    } catch (err) {
      return next(err);
    }
  }
}

TaskController.TaskController = TaskController;

module.exports = TaskController;
