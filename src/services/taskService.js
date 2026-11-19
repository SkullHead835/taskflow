const TaskRepository = require('../repositories/taskRepository');
const { BadRequestError } = require('../errors/appError');

/**
 * Service managing business logic and domain rules for Tasks.
 */
class TaskService {
  /**
   * @param {TaskRepository} [repository] - Optional TaskRepository for dependency injection
   */
  constructor(repository = null) {
    this._repository = repository;
  }

  /**
   * Lazily loads default TaskRepository if not injected.
   *
   * @returns {TaskRepository}
   */
  get repository() {
    if (!this._repository) {
      this._repository = new TaskRepository();
    }
    return this._repository;
  }

  /**
   * Validates and creates a new task.
   *
   * @param {object} data
   * @param {string} data.title - Required non-empty string (max 120 chars)
   * @param {string} [data.description] - Optional details (max 1000 chars)
   * @param {boolean} [data.completed=false] - Optional completion state
   * @returns {object} Created task
   * @throws {BadRequestError} If title is missing, empty, too long, or completion is invalid
   */
  createTask(data) {
    if (!data || typeof data !== 'object') {
      throw new BadRequestError('Task data must be an object');
    }

    if (typeof data.title !== 'string' || data.title.trim() === '') {
      throw new BadRequestError('Task title is required and cannot be empty');
    }

    const trimmedTitle = data.title.trim();
    if (trimmedTitle.length > 120) {
      throw new BadRequestError('Task title must not exceed 120 characters');
    }

    let sanitizedDescription = null;
    if (data.description !== undefined && data.description !== null) {
      const trimmedDesc = String(data.description).trim();
      if (trimmedDesc.length > 1000) {
        throw new BadRequestError('Task description must not exceed 1000 characters');
      }
      sanitizedDescription = trimmedDesc;
    }

    if (data.completed !== undefined && typeof data.completed !== 'boolean') {
      throw new BadRequestError('Completed status must be a boolean');
    }

    const sanitizedData = {
      title: trimmedTitle,
      description: sanitizedDescription,
      completed: Boolean(data.completed)
    };

    return this.repository.createTask(sanitizedData);
  }

  /**
   * Retrieves all tasks, optionally filtered by completion status.
   *
   * @param {object} [filters={}]
   * @param {boolean|string|number} [filters.completed]
   * @returns {Array<object>} List of task objects
   * @throws {BadRequestError} If completed filter value is invalid
   */
  getAllTasks(filters = {}) {
    if (filters && filters.completed !== undefined) {
      const isValid =
        typeof filters.completed === 'boolean' ||
        ['true', 'false', '1', '0', 1, 0].includes(filters.completed);

      if (!isValid) {
        throw new BadRequestError('Invalid completed filter: must be a boolean or boolean string');
      }
    }

    return this.repository.getAllTasks(filters);
  }

  /**
   * Retrieves a task by its unique ID.
   *
   * @param {number|string} id - Must be a positive integer
   * @returns {object|null} Found task or null if not found
   * @throws {BadRequestError} If ID is not a positive integer
   */
  getTaskById(id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestError('Task ID must be a positive integer');
    }

    return this.repository.getTaskById(numericId);
  }

  /**
   * Updates an existing task with partial or full fields.
   *
   * @param {number|string} id - Must be a positive integer
   * @param {object} data - Fields to update (must have at least one editable field)
   * @returns {object|null} Updated task or null if task not found
   * @throws {BadRequestError} If ID is invalid, data is missing, no editable fields exist, or fields are invalid
   */
  updateTask(id, data) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestError('Task ID must be a positive integer');
    }

    if (!data || typeof data !== 'object') {
      throw new BadRequestError('Update payload must be an object');
    }

    const editableFields = ['title', 'description', 'completed'];
    const hasEditableField = editableFields.some((field) => data[field] !== undefined);

    if (!hasEditableField) {
      throw new BadRequestError(
        'Update payload must contain at least one editable field: title, description, or completed'
      );
    }

    if (data.title !== undefined) {
      if (typeof data.title !== 'string' || data.title.trim() === '') {
        throw new BadRequestError('Task title cannot be empty');
      }
      if (data.title.trim().length > 120) {
        throw new BadRequestError('Task title must not exceed 120 characters');
      }
    }

    if (data.description !== undefined && data.description !== null) {
      const trimmedDesc = String(data.description).trim();
      if (trimmedDesc.length > 1000) {
        throw new BadRequestError('Task description must not exceed 1000 characters');
      }
    }

    if (data.completed !== undefined && typeof data.completed !== 'boolean') {
      throw new BadRequestError('Completed status must be a boolean');
    }

    const existing = this.repository.getTaskById(numericId);
    if (!existing) {
      return null;
    }

    const sanitizedData = {};
    if (data.title !== undefined) {
      sanitizedData.title = data.title.trim();
    }
    if (data.description !== undefined) {
      sanitizedData.description =
        data.description === null ? null : String(data.description).trim();
    }
    if (data.completed !== undefined) {
      sanitizedData.completed = data.completed;
    }

    return this.repository.updateTask(numericId, sanitizedData);
  }

  /**
   * Deletes a task by ID.
   *
   * @param {number|string} id - Must be a positive integer
   * @returns {boolean} True if task was deleted, false if task was not found
   * @throws {BadRequestError} If ID is not a positive integer
   */
  deleteTask(id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestError('Task ID must be a positive integer');
    }

    return this.repository.deleteTask(numericId);
  }
}

TaskService.TaskService = TaskService;

module.exports = TaskService;
