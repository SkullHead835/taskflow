const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { config } = require('./env');

const DEFAULT_DB_PATH = config.dbPath;

/**
 * Initializes and configures the SQLite database.
 * Supports file-based storage for development and ':memory:' for isolated testing.
 *
 * @param {string} dbPath - File path to SQLite database or ':memory:'
 * @param {object} options - better-sqlite3 options
 * @returns {Database.Database} SQLite database instance
 */
function initDatabase(dbPath = DEFAULT_DB_PATH, options = {}) {
  const isMemory = dbPath === ':memory:';

  if (!isMemory) {
    const resolvedPath = path.resolve(dbPath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, options);

  // Safety pragmas
  db.pragma('foreign_keys = ON');

  if (!isMemory) {
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
    } catch {
      // Fallback gracefully if WAL is not supported on the target filesystem
    }
  }

  // Create tables & indexes if they do not exist
  createTables(db);

  return db;
}

/**
 * Creates required tables, indexes, and runs safe non-destructive migrations.
 *
 * @param {Database.Database} db
 */
function createTables(db) {
  // 1. Normalized categories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );
  `);

  // 2. Tasks table with category_id foreign key
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  `);

  // 3. Safe non-destructive migration: check if category_id column exists on existing tasks table
  const columns = db.pragma('table_info(tasks)');
  const hasCategoryId = columns.some((col) => col.name === 'category_id');
  if (!hasCategoryId) {
    db.exec(`
      ALTER TABLE tasks ADD COLUMN category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
    `);
  }

  // 4. Index on category_id for fast JOIN lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
  `);

  // 5. Seed default categories if table is empty
  seedDefaultCategories(db);
}

/**
 * Seeds initial task categories idempotently.
 *
 * @param {Database.Database} db
 */
function seedDefaultCategories(db) {
  const defaultCategories = [
    { name: 'Work', color: '#3b82f6' },
    { name: 'Personal', color: '#10b981' },
    { name: 'Urgent', color: '#ef4444' }
  ];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO categories (name, color)
    VALUES (?, ?)
  `);

  for (const cat of defaultCategories) {
    insertStmt.run(cat.name, cat.color);
  }
}

let defaultInstance = null;

/**
 * Gets or initializes the default singleton database instance.
 *
 * @returns {Database.Database}
 */
function getDatabase() {
  if (!defaultInstance || !defaultInstance.open) {
    defaultInstance = initDatabase();
  }
  return defaultInstance;
}

/**
 * Closes a database instance safely.
 *
 * @param {Database.Database} [db]
 */
function closeDatabase(db = defaultInstance) {
  if (db && db.open) {
    db.close();
  }
  if (db === defaultInstance) {
    defaultInstance = null;
  }
}

initDatabase.initDatabase = initDatabase;
initDatabase.createTables = createTables;
initDatabase.seedDefaultCategories = seedDefaultCategories;
initDatabase.getDatabase = getDatabase;
initDatabase.closeDatabase = closeDatabase;
initDatabase.DEFAULT_DB_PATH = DEFAULT_DB_PATH;

module.exports = initDatabase;
