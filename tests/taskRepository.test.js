const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const initDatabase = require('../src/config/database');
const TaskRepository = require('../src/repositories/taskRepository');

describe('TaskRepository with SQLite', () => {
  let db;
  let repo;

  beforeEach(() => {
    // Isolated in-memory database for each test
    db = initDatabase(':memory:');
    repo = new TaskRepository(db);
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  // Test 1: Database initializes correctly
  it('1. Database initializes correctly with required table, indexes and pragmas', () => {
    // Check pragma foreign_keys
    const fkPragma = db.pragma('foreign_keys', { simple: true });
    assert.strictEqual(fkPragma, 1, 'Foreign keys pragma should be ON');

    // Check tasks table existence
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get();
    assert.ok(tableCheck, 'Table "tasks" should exist');

    // Check table column definitions
    const columns = db.prepare('PRAGMA table_info(tasks)').all();
    const columnNames = columns.map((col) => col.name);
    assert.ok(columnNames.includes('id'), 'tasks should have id column');
    assert.ok(columnNames.includes('title'), 'tasks should have title column');
    assert.ok(columnNames.includes('description'), 'tasks should have description column');
    assert.ok(columnNames.includes('completed'), 'tasks should have completed column');
    assert.ok(columnNames.includes('created_at'), 'tasks should have created_at column');
    assert.ok(columnNames.includes('updated_at'), 'tasks should have updated_at column');

    // Check index existence
    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all();
    const indexNames = indexes.map((idx) => idx.name);
    assert.ok(indexNames.includes('idx_tasks_completed'), 'idx_tasks_completed index should exist');
    assert.ok(indexNames.includes('idx_tasks_created_at'), 'idx_tasks_created_at index should exist');
  });

  // Test 2: Task can be created
  it('2. Task can be created and returns consistent task structure', () => {
    const taskData = {
      title: 'Implement Database Layer',
      description: 'Setup SQLite and repository'
    };

    const task = repo.createTask(taskData);

    assert.ok(task, 'Task should be returned');
    assert.strictEqual(typeof task.id, 'number');
    assert.ok(task.id > 0, 'Task ID should be a positive number');
    assert.strictEqual(task.title, 'Implement Database Layer');
    assert.strictEqual(task.description, 'Setup SQLite and repository');
    assert.strictEqual(task.completed, false, 'Default completed state should be false');
    assert.ok(typeof task.created_at === 'string' && !isNaN(Date.parse(task.created_at)));
    assert.ok(typeof task.updated_at === 'string' && !isNaN(Date.parse(task.updated_at)));
  });

  // Test 3: All tasks can be retrieved
  it('3. All tasks can be retrieved', () => {
    repo.createTask({ title: 'Task 1', description: 'First task' });
    repo.createTask({ title: 'Task 2', description: 'Second task' });

    const tasks = repo.getAllTasks();

    assert.strictEqual(tasks.length, 2);
    assert.strictEqual(tasks[0].title, 'Task 1');
    assert.strictEqual(tasks[1].title, 'Task 2');
  });

  // Test 4: Task can be retrieved by ID
  it('4. Task can be retrieved by ID', () => {
    const created = repo.createTask({
      title: 'Specific Task',
      description: 'Find me by ID'
    });

    const found = repo.getTaskById(created.id);

    assert.ok(found, 'Task should be found');
    assert.strictEqual(found.id, created.id);
    assert.strictEqual(found.title, 'Specific Task');
    assert.strictEqual(found.description, 'Find me by ID');
    assert.strictEqual(found.completed, false);
  });

  // Test 5: Task can be updated
  it('5. Task can be updated', () => {
    const created = repo.createTask({
      title: 'Original Title',
      description: 'Original Description'
    });

    const updated = repo.updateTask(created.id, {
      title: 'Revised Title',
      description: 'Revised Description'
    });

    assert.ok(updated, 'Updated task should be returned');
    assert.strictEqual(updated.id, created.id);
    assert.strictEqual(updated.title, 'Revised Title');
    assert.strictEqual(updated.description, 'Revised Description');
    assert.ok(updated.updated_at >= created.updated_at);
  });

  // Test 6: Task can be marked completed
  it('6. Task can be marked completed and reverted to pending', () => {
    const created = repo.createTask({ title: 'Finish homework' });
    assert.strictEqual(created.completed, false);

    // Mark as completed
    const completedTask = repo.updateTask(created.id, { completed: true });
    assert.ok(completedTask);
    assert.strictEqual(completedTask.completed, true);

    // Revert to incomplete
    const reopenedTask = repo.updateTask(created.id, { completed: false });
    assert.ok(reopenedTask);
    assert.strictEqual(reopenedTask.completed, false);
  });

  // Test 7: Task can be deleted
  it('7. Task can be deleted', () => {
    const created = repo.createTask({ title: 'To be deleted' });

    const deleteResult = repo.deleteTask(created.id);
    assert.strictEqual(deleteResult, true, 'deleteTask should return true on success');

    const lookup = repo.getTaskById(created.id);
    assert.strictEqual(lookup, null, 'Task should no longer exist');

    const repeatDelete = repo.deleteTask(created.id);
    assert.strictEqual(repeatDelete, false, 'Subsequent delete should return false');
  });

  // Test 8: Nonexistent task lookup is handled correctly
  it('8. Nonexistent task lookup is handled gracefully', () => {
    assert.strictEqual(repo.getTaskById(99999), null);
    assert.strictEqual(repo.getTaskById('invalid-id'), null);
    assert.strictEqual(repo.getTaskById(-5), null);

    assert.strictEqual(repo.updateTask(99999, { title: 'Ghost' }), null);
    assert.strictEqual(repo.deleteTask(99999), false);
    assert.strictEqual(repo.deleteTask('not-an-id'), false);
  });

  // Test 9: Completion filtering works
  it('9. Completion filtering works for active and completed tasks', () => {
    repo.createTask({ title: 'Task A', completed: false });
    repo.createTask({ title: 'Task B', completed: true });
    repo.createTask({ title: 'Task C', completed: false });

    const allTasks = repo.getAllTasks();
    assert.strictEqual(allTasks.length, 3, 'Should return all 3 tasks');

    const completedTasks = repo.getAllTasks({ completed: true });
    assert.strictEqual(completedTasks.length, 1, 'Should return 1 completed task');
    assert.strictEqual(completedTasks[0].title, 'Task B');

    const activeTasks = repo.getAllTasks({ completed: false });
    assert.strictEqual(activeTasks.length, 2, 'Should return 2 active tasks');
    assert.deepStrictEqual(
      activeTasks.map((t) => t.title),
      ['Task A', 'Task C']
    );
  });

  // Test 10: Invalid or missing required task data does not silently create bad records
  it('10. Invalid or missing required task data throws errors without creating records', () => {
    // Missing object
    assert.throws(() => repo.createTask(null), /must be an object/);
    assert.throws(() => repo.createTask(undefined), /must be an object/);

    // Missing title
    assert.throws(() => repo.createTask({}), /title is required/);
    assert.throws(() => repo.createTask({ title: '' }), /title is required/);
    assert.throws(() => repo.createTask({ title: '    ' }), /title is required/);
    assert.throws(() => repo.createTask({ title: 123 }), /title is required/);

    // Verify database remains untouched (no corrupted records inserted)
    const countRow = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    assert.strictEqual(countRow.count, 0, 'No rows should be inserted on validation failures');
  });
});
