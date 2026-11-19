const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/taskflow.db');

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
 * Creates required tables and indexes.
 *
 * @param {Database.Database} db
 */
function createTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  `);
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
initDatabase.getDatabase = getDatabase;
initDatabase.closeDatabase = closeDatabase;
initDatabase.DEFAULT_DB_PATH = DEFAULT_DB_PATH;

module.exports = initDatabase;
