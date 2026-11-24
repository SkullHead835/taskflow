const TaskRepository = require('../repositories/taskRepository');
const { BadRequestError } = require('../errors/appError');
const { sanitizeString } = require('../utils/sanitize');

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
    const sanitizedTitle = sanitizeString(trimmedTitle);
    if (!sanitizedTitle) {
      throw new BadRequestError('Task title cannot be empty or contain only HTML tags');
    }
    if (sanitizedTitle.length > 120) {
      throw new BadRequestError('Task title must not exceed 120 characters');
    }

    let sanitizedDescription = null;
    if (data.description !== undefined && data.description !== null) {
      const cleaned = sanitizeString(String(data.description));
      if (cleaned.length > 1000) {
        throw new BadRequestError('Task description must not exceed 1000 characters');
      }
      sanitizedDescription = cleaned.length > 0 ? cleaned : null;
    }

    if (data.completed !== undefined && typeof data.completed !== 'boolean') {
      throw new BadRequestError('Completed status must be a boolean');
    }

    let categoryId = null;
    if (data.category_id !== undefined && data.category_id !== null && data.category_id !== '') {
      const numCatId = Number(data.category_id);
      if (!Number.isInteger(numCatId) || numCatId <= 0) {
        throw new BadRequestError('Category ID must be a positive integer');
      }
      const cat = this.repository.getCategoryById(numCatId);
      if (!cat) {
        throw new BadRequestError('Category not found');
      }
      categoryId = numCatId;
    }

    const sanitizedData = {
      title: sanitizedTitle,
      description: sanitizedDescription,
      completed: Boolean(data.completed),
      category_id: categoryId
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

    const editableFields = ['title', 'description', 'completed', 'category_id'];
    const hasEditableField = editableFields.some((field) => data[field] !== undefined);

    if (!hasEditableField) {
      throw new BadRequestError(
        'Update payload must contain at least one editable field: title, description, completed, or category_id'
      );
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
      if (typeof data.title !== 'string' || data.title.trim() === '') {
        throw new BadRequestError('Task title cannot be empty');
      }
      const sanitized = sanitizeString(data.title);
      if (!sanitized) {
        throw new BadRequestError('Task title cannot be empty or contain only HTML tags');
      }
      if (sanitized.length > 120) {
        throw new BadRequestError('Task title must not exceed 120 characters');
      }
      sanitizedData.title = sanitized;
    }

    if (data.description !== undefined) {
      if (data.description === null) {
        sanitizedData.description = null;
      } else {
        const cleaned = sanitizeString(String(data.description));
        if (cleaned.length > 1000) {
          throw new BadRequestError('Task description must not exceed 1000 characters');
        }
        sanitizedData.description = cleaned.length > 0 ? cleaned : null;
      }
    }
    if (data.completed !== undefined) {
      sanitizedData.completed = data.completed;
    }
    if (data.category_id !== undefined) {
      if (data.category_id === null || data.category_id === '') {
        sanitizedData.category_id = null;
      } else {
        const numCatId = Number(data.category_id);
        if (!Number.isInteger(numCatId) || numCatId <= 0) {
          throw new BadRequestError('Category ID must be a positive integer');
        }
        const cat = this.repository.getCategoryById(numCatId);
        if (!cat) {
          throw new BadRequestError('Category not found');
        }
        sanitizedData.category_id = numCatId;
      }
    }

    return this.repository.updateTask(numericId, sanitizedData);
  }

  /**
   * Retrieves all task categories.
   *
   * @returns {Array<object>}
   */
  getAllCategories() {
    return this.repository.getAllCategories();
  }

  /**
   * Retrieves a category by ID.
   *
   * @param {number|string} id
   * @returns {object|null}
   */
  getCategoryById(id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestError('Category ID must be a positive integer');
    }
    return this.repository.getCategoryById(numericId);
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
