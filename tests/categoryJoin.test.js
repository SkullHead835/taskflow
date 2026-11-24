const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const initDatabase = require('../src/config/database');
const TaskRepository = require('../src/repositories/taskRepository');
const TaskService = require('../src/services/taskService');
const { createApp } = require('../src/app');

describe('Database Normalization & SQL JOINs (Categories)', () => {
  let db;
  let repo;
  let service;
  let app;
  let server;
  let baseUrl;

  before(async () => {
    // 1. In-memory database with migrations and seeds
    db = initDatabase(':memory:');
    repo = new TaskRepository(db);
    service = new TaskService(repo);
    app = createApp({ taskService: service });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      if (server) server.close(resolve);
      else resolve();
    });
    if (db && db.open) db.close();
  });

  it('1. seeds default categories automatically (Work, Personal, Urgent)', () => {
    const categories = repo.getAllCategories();
    assert.ok(Array.isArray(categories));
    assert.strictEqual(categories.length >= 3, true);

    const names = categories.map((c) => c.name);
    assert.ok(names.includes('Work'));
    assert.ok(names.includes('Personal'));
    assert.ok(names.includes('Urgent'));
  });

  it('2. safely migrates an existing legacy database without category_id column without data loss', () => {
    // Spin up a raw legacy database simulating old version
    const legacyDb = new Database(':memory:');
    legacyDb.exec(`
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
        updated_at TEXT NOT NULL DEFAULT (DATETIME('now'))
      );
      INSERT INTO tasks (title, description, completed) VALUES ('Legacy Task 1', 'Old data', 0);
      INSERT INTO tasks (title, description, completed) VALUES ('Legacy Task 2', 'Old data 2', 1);
    `);

    // Verify category_id column does NOT exist yet
    const colsBefore = legacyDb.pragma('table_info(tasks)');
    assert.strictEqual(colsBefore.some((c) => c.name === 'category_id'), false);

    // Run createTables (which runs the migration)
    initDatabase.createTables(legacyDb);

    // Verify category_id column was added safely
    const colsAfter = legacyDb.pragma('table_info(tasks)');
    assert.strictEqual(colsAfter.some((c) => c.name === 'category_id'), true);

    // Verify original legacy data is 100% intact
    const legacyRepo = new TaskRepository(legacyDb);
    const tasks = legacyRepo.getAllTasks();
    assert.strictEqual(tasks.length, 2);
    assert.strictEqual(tasks[0].title, 'Legacy Task 1');
    assert.strictEqual(tasks[0].category_id, null);
    assert.strictEqual(tasks[0].category, null);
    assert.strictEqual(tasks[1].title, 'Legacy Task 2');
    assert.strictEqual(tasks[1].completed, true);

    legacyDb.close();
  });

  it('3. creates a task with a valid category and joins category details via LEFT JOIN', async () => {
    const categories = repo.getAllCategories();
    const workCategory = categories.find((c) => c.name === 'Work');
    assert.ok(workCategory);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Project Presentation',
        description: 'Prepare slide deck for assessment review',
        category_id: workCategory.id
      })
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.title, 'Project Presentation');
    assert.strictEqual(json.data.category_id, workCategory.id);
    assert.ok(json.data.category);
    assert.strictEqual(json.data.category.id, workCategory.id);
    assert.strictEqual(json.data.category.name, 'Work');
    assert.strictEqual(json.data.category.color, workCategory.color);
  });

  it('4. preserves backward compatibility for tasks without a category (LEFT JOIN returns null category)', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Uncategorized Quick Note'
      })
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.data.category_id, null);
    assert.strictEqual(json.data.category, null);

    // Verify GET by ID also preserves null category
    const getRes = await fetch(`${baseUrl}/api/tasks/${json.data.id}`);
    const getJson = await getRes.json();
    assert.strictEqual(getJson.data.category_id, null);
    assert.strictEqual(getJson.data.category, null);
  });

  it('5. rejects task creation with a nonexistent category ID', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Invalid Category Task',
        category_id: 9999
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.error.message.includes('Category not found'));
  });

  it('6. updates an existing task category', async () => {
    const categories = repo.getAllCategories();
    const urgentCategory = categories.find((c) => c.name === 'Urgent');
    assert.ok(urgentCategory);

    // Create task initially without category
    const created = service.createTask({ title: 'Task to Re-categorize' });
    assert.strictEqual(created.category_id, null);

    // Update with Urgent category
    const res = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: urgentCategory.id
      })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.category_id, urgentCategory.id);
    assert.strictEqual(json.data.category.name, 'Urgent');

    // Update to remove category (null)
    const clearRes = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: null
      })
    });

    assert.strictEqual(clearRes.status, 200);
    const clearJson = await clearRes.json();
    assert.strictEqual(clearJson.data.category_id, null);
    assert.strictEqual(clearJson.data.category, null);
  });

  it('7. filters tasks by category_id', async () => {
    const categories = repo.getAllCategories();
    const personalCategory = categories.find((c) => c.name === 'Personal');
    assert.ok(personalCategory);

    service.createTask({ title: 'Personal Task A', category_id: personalCategory.id });
    service.createTask({ title: 'Personal Task B', category_id: personalCategory.id });

    const res = await fetch(`${baseUrl}/api/tasks?category_id=${personalCategory.id}`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.length >= 2);
    assert.ok(json.data.every((t) => t.category_id === personalCategory.id));
  });

  it('8. GET /api/categories returns all available categories', async () => {
    const res = await fetch(`${baseUrl}/api/categories`);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 3);
  });
});
