const { getDatabase } = require('../config/database');

/**
 * Formats a raw database row into a clean, consistent Task object.
 *
 * @param {object|undefined|null} row
 * @returns {object|null}
 */
function formatTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Repository handling all database operations for Tasks.
 * Supports database injection for testing.
 */
class TaskRepository {
  /**
   * @param {import('better-sqlite3').Database} [db] - Optional SQLite database instance for injection
   */
  constructor(db = null) {
    this._db = db;
  }

  /**
   * Returns the injected database or the lazily loaded default database.
   *
   * @returns {import('better-sqlite3').Database}
   */
  get db() {
    if (!this._db) {
      this._db = getDatabase();
    }
    return this._db;
  }

  /**
   * Creates a new task record.
   *
   * @param {object} data
   * @param {string} data.title
   * @param {string} [data.description]
   * @param {boolean|number} [data.completed=false]
   * @returns {object} Created task
   * @throws {Error} If title is missing or invalid
   */
  createTask(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Task data must be an object');
    }

    if (typeof data.title !== 'string' || data.title.trim() === '') {
      throw new Error('Task title is required and cannot be empty');
    }

    const title = data.title.trim();
    const description = data.description !== undefined && data.description !== null
      ? String(data.description).trim()
      : null;
    const completed = data.completed ? 1 : 0;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO tasks (title, description, completed, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(title, description, completed, now, now);
    return this.getTaskById(result.lastInsertRowid);
  }

  /**
   * Retrieves a task by its unique ID.
   *
   * @param {number|string} id
   * @returns {object|null} Found task or null
   */
  getTaskById(id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return null;
    }

    const stmt = this.db.prepare(`
      SELECT id, title, description, completed, created_at, updated_at
      FROM tasks
      WHERE id = ?
    `);

    const row = stmt.get(numericId);
    return formatTask(row);
  }

  /**
   * Retrieves all tasks matching the specified filters.
   *
   * @param {object} [filters={}]
   * @param {boolean|number|string} [filters.completed]
   * @returns {Array<object>} Array of task objects
   */
  getAllTasks(filters = {}) {
    if (filters && filters.completed !== undefined) {
      let filterCompleted = null;

      if (typeof filters.completed === 'boolean') {
        filterCompleted = filters.completed ? 1 : 0;
      } else if (filters.completed === 'true' || filters.completed === 1 || filters.completed === '1') {
        filterCompleted = 1;
      } else if (filters.completed === 'false' || filters.completed === 0 || filters.completed === '0') {
        filterCompleted = 0;
      }

      if (filterCompleted !== null) {
        const stmt = this.db.prepare(`
          SELECT id, title, description, completed, created_at, updated_at
          FROM tasks
          WHERE completed = ?
          ORDER BY id ASC
        `);
        const rows = stmt.all(filterCompleted);
        return rows.map(formatTask);
      }
    }

    const stmt = this.db.prepare(`
      SELECT id, title, description, completed, created_at, updated_at
      FROM tasks
      ORDER BY id ASC
    `);

    const rows = stmt.all();
    return rows.map(formatTask);
  }

  /**
   * Updates an existing task record.
   *
   * @param {number|string} id
   * @param {object} data
   * @returns {object|null} Updated task or null if not found
   * @throws {Error} If title is provided but invalid
   */
  updateTask(id, data) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return null;
    }

    const existing = this.getTaskById(numericId);
    if (!existing) {
      return null;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Update data must be an object');
    }

    if (data.title !== undefined && (typeof data.title !== 'string' || data.title.trim() === '')) {
      throw new Error('Task title cannot be empty');
    }

    const title = data.title !== undefined ? data.title.trim() : existing.title;
    const description = data.description !== undefined
      ? (data.description === null ? null : String(data.description).trim())
      : existing.description;
    const completed = data.completed !== undefined
      ? (data.completed ? 1 : 0)
      : (existing.completed ? 1 : 0);
    const updatedAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, completed = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(title, description, completed, updatedAt, numericId);
    return this.getTaskById(numericId);
  }

  /**
   * Deletes a task by ID.
   *
   * @param {number|string} id
   * @returns {boolean} True if task was deleted, false otherwise
   */
  deleteTask(id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return false;
    }

    const stmt = this.db.prepare(`
      DELETE FROM tasks
      WHERE id = ?
    `);

    const result = stmt.run(numericId);
    return result.changes > 0;
  }
}

TaskRepository.TaskRepository = TaskRepository;
TaskRepository.formatTask = formatTask;

module.exports = TaskRepository;
