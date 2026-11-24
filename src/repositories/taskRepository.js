const { getDatabase } = require('../config/database');

/**
 * Formats a raw database row into a clean, consistent Task object.
 *
 * @param {object|undefined|null} row
 * @returns {object|null}
 */
function formatTask(row) {
  if (!row) return null;
  const categoryId =
    row.category_id !== undefined && row.category_id !== null ? Number(row.category_id) : null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: Boolean(row.completed),
    category_id: categoryId,
    category: row.category_name
      ? {
          id: categoryId,
          name: row.category_name,
          color: row.category_color
        }
      : null,
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
   * @param {number|null} [data.category_id=null]
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
    const description =
      data.description !== undefined && data.description !== null
        ? String(data.description).trim()
        : null;
    const completed = data.completed ? 1 : 0;
    const categoryId =
      data.category_id !== undefined && data.category_id !== null && data.category_id !== ''
        ? Number(data.category_id)
        : null;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO tasks (title, description, completed, category_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(title, description, completed, categoryId, now, now);
    return this.getTaskById(result.lastInsertRowid);
  }

  /**
   * Retrieves a task by its unique ID with category details via LEFT JOIN.
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
      SELECT
        t.id, t.title, t.description, t.completed, t.category_id,
        t.created_at, t.updated_at,
        c.name AS category_name, c.color AS category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `);

    const row = stmt.get(numericId);
    return formatTask(row);
  }

  /**
   * Retrieves all tasks matching the specified filters via LEFT JOIN with categories.
   *
   * @param {object} [filters={}]
   * @param {boolean|number|string} [filters.completed]
   * @param {number|string} [filters.category_id]
   * @returns {Array<object>} Array of task objects
   */
  getAllTasks(filters = {}) {
    const whereClauses = [];
    const params = [];

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
        whereClauses.push('t.completed = ?');
        params.push(filterCompleted);
      }
    }

    if (
      filters &&
      filters.category_id !== undefined &&
      filters.category_id !== null &&
      filters.category_id !== ''
    ) {
      const catId = Number(filters.category_id);
      if (Number.isInteger(catId) && catId > 0) {
        whereClauses.push('t.category_id = ?');
        params.push(catId);
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const sql = `
      SELECT
        t.id, t.title, t.description, t.completed, t.category_id,
        t.created_at, t.updated_at,
        c.name AS category_name, c.color AS category_color
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereSql}
      ORDER BY t.id ASC
    `;

    const stmt = this.db.prepare(sql);
    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
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
    const description =
      data.description !== undefined
        ? data.description === null
          ? null
          : String(data.description).trim()
        : existing.description;
    const completed =
      data.completed !== undefined
        ? data.completed
          ? 1
          : 0
        : existing.completed
        ? 1
        : 0;
    const categoryId =
      data.category_id !== undefined
        ? data.category_id === null || data.category_id === ''
          ? null
          : Number(data.category_id)
        : existing.category_id;
    const updatedAt = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, completed = ?, category_id = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(title, description, completed, categoryId, updatedAt, numericId);
    return this.getTaskById(numericId);
  }

  /**
   * Retrieves all available categories.
   *
   * @returns {Array<object>}
   */
  getAllCategories() {
    const stmt = this.db.prepare(`
      SELECT id, name, color, created_at
      FROM categories
      ORDER BY id ASC
    `);
    return stmt.all();
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
      return null;
    }

    const stmt = this.db.prepare(`
      SELECT id, name, color, created_at
      FROM categories
      WHERE id = ?
    `);
    return stmt.get(numericId) || null;
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
