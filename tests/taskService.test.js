const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const initDatabase = require('../src/config/database');
const TaskRepository = require('../src/repositories/taskRepository');
const TaskService = require('../src/services/taskService');
const { AppError, BadRequestError } = require('../src/errors/appError');

describe('TaskService Business Logic', () => {
  let db;
  let repo;
  let service;

  beforeEach(() => {
    db = initDatabase(':memory:');
    repo = new TaskRepository(db);
    service = new TaskService(repo);
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  it('creates a valid task with trimmed title and default completed false', () => {
    const task = service.createTask({
      title: '  Clean Room  ',
      description: '  Vacuum and dust  '
    });

    assert.ok(task);
    assert.strictEqual(task.title, 'Clean Room');
    assert.strictEqual(task.description, 'Vacuum and dust');
    assert.strictEqual(task.completed, false);
    assert.ok(task.id > 0);
  });

  it('rejects an empty or whitespace-only title on creation', () => {
    assert.throws(() => service.createTask({ title: '' }), /title is required/i);
    assert.throws(() => service.createTask({ title: '     ' }), /title is required/i);
    assert.throws(() => service.createTask({}), /title is required/i);
    assert.throws(() => service.createTask(null), /must be an object/i);
  });

  it('validates string length limits on task creation (120 title, 1000 description)', () => {
    // Exactly 120 characters title
    const exactTitle = 't'.repeat(120);
    const exactDesc = 'd'.repeat(1000);
    const task = service.createTask({ title: exactTitle, description: exactDesc });
    assert.strictEqual(task.title, exactTitle);
    assert.strictEqual(task.description, exactDesc);

    // Exceeding 120 title
    const overTitle = 't'.repeat(121);
    assert.throws(
      () => service.createTask({ title: overTitle }),
      (err) => err instanceof BadRequestError && /must not exceed 120 characters/i.test(err.message)
    );

    // Exceeding 1000 description
    const overDesc = 'd'.repeat(1001);
    assert.throws(
      () => service.createTask({ title: 'Valid Title', description: overDesc }),
      (err) => err instanceof BadRequestError && /must not exceed 1000 characters/i.test(err.message)
    );
  });

  it('throws typed BadRequestError / AppError instances for domain errors', () => {
    try {
      service.createTask({ title: '' });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.ok(err instanceof AppError);
      assert.ok(err instanceof BadRequestError);
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, 'BAD_REQUEST');
      assert.strictEqual(err.isAppError, true);
    }
  });

  it('prevents invalid completion values on creation', () => {
    assert.throws(
      () => service.createTask({ title: 'Task', completed: 'yes' }),
      /Completed status must be a boolean/i
    );
    assert.throws(
      () => service.createTask({ title: 'Task', completed: 1 }),
      /Completed status must be a boolean/i
    );
  });

  it('retrieves all tasks and supports completion filtering', () => {
    service.createTask({ title: 'Task 1', completed: false });
    service.createTask({ title: 'Task 2', completed: true });

    const all = service.getAllTasks();
    assert.strictEqual(all.length, 2);

    const completed = service.getAllTasks({ completed: true });
    assert.strictEqual(completed.length, 1);
    assert.strictEqual(completed[0].title, 'Task 2');

    const pending = service.getAllTasks({ completed: false });
    assert.strictEqual(pending.length, 1);
    assert.strictEqual(pending[0].title, 'Task 1');
  });

  it('rejects invalid completion filter values', () => {
    assert.throws(
      () => service.getAllTasks({ completed: 'not-valid' }),
      /Invalid completed filter/i
    );
  });

  it('retrieves task by ID and returns null for nonexistent task', () => {
    const created = service.createTask({ title: 'Find Me' });
    const found = service.getTaskById(created.id);
    assert.ok(found);
    assert.strictEqual(found.title, 'Find Me');

    const nonexistent = service.getTaskById(99999);
    assert.strictEqual(nonexistent, null);
  });

  it('rejects invalid IDs in getTaskById, updateTask, and deleteTask', () => {
    const invalidIds = [0, -1, 'invalid', 3.14, null, undefined];

    for (const id of invalidIds) {
      assert.throws(() => service.getTaskById(id), /Task ID must be a positive integer/i);
      assert.throws(() => service.updateTask(id, { title: 'X' }), /Task ID must be a positive integer/i);
      assert.throws(() => service.deleteTask(id), /Task ID must be a positive integer/i);
    }
  });

  it('updates task with valid fields and updates timestamp', () => {
    const created = service.createTask({ title: 'Original', description: 'Old desc' });

    const updated = service.updateTask(created.id, {
      title: 'Updated',
      description: 'New desc'
    });

    assert.ok(updated);
    assert.strictEqual(updated.title, 'Updated');
    assert.strictEqual(updated.description, 'New desc');
    assert.ok(updated.updated_at >= created.updated_at);
  });

  it('validates string length limits on task update (120 title, 1000 description)', () => {
    const created = service.createTask({ title: 'Original' });

    // Exactly 120 chars title
    const exactTitle = 'u'.repeat(120);
    const exactDesc = 'y'.repeat(1000);
    const updated = service.updateTask(created.id, { title: exactTitle, description: exactDesc });
    assert.strictEqual(updated.title, exactTitle);
    assert.strictEqual(updated.description, exactDesc);

    // Over 120 chars title
    const overTitle = 'u'.repeat(121);
    assert.throws(
      () => service.updateTask(created.id, { title: overTitle }),
      (err) => err instanceof BadRequestError && /must not exceed 120 characters/i.test(err.message)
    );

    // Over 1000 chars description
    const overDesc = 'y'.repeat(1001);
    assert.throws(
      () => service.updateTask(created.id, { description: overDesc }),
      (err) => err instanceof BadRequestError && /must not exceed 1000 characters/i.test(err.message)
    );
  });

  it('accepts valid partial updates', () => {
    const created = service.createTask({ title: 'Original', description: 'Original desc' });

    // Update only completed
    const partial1 = service.updateTask(created.id, { completed: true });
    assert.strictEqual(partial1.completed, true);
    assert.strictEqual(partial1.title, 'Original');
    assert.strictEqual(partial1.description, 'Original desc');

    // Update only title
    const partial2 = service.updateTask(created.id, { title: 'New Name' });
    assert.strictEqual(partial2.title, 'New Name');
    assert.strictEqual(partial2.completed, true);

    // Update only description
    const partial3 = service.updateTask(created.id, { description: 'Updated desc only' });
    assert.strictEqual(partial3.description, 'Updated desc only');
  });

  it('rejects empty updates or updates with no editable fields', () => {
    const created = service.createTask({ title: 'Test' });

    assert.throws(
      () => service.updateTask(created.id, {}),
      /at least one editable field/i
    );
    assert.throws(
      () => service.updateTask(created.id, { uneditable: 'ignored' }),
      /at least one editable field/i
    );
  });

  it('rejects empty title on update', () => {
    const created = service.createTask({ title: 'Test' });

    assert.throws(
      () => service.updateTask(created.id, { title: '' }),
      /title cannot be empty/i
    );
    assert.throws(
      () => service.updateTask(created.id, { title: '   ' }),
      /title cannot be empty/i
    );
  });

  it('rejects invalid completion values on update', () => {
    const created = service.createTask({ title: 'Test' });

    assert.throws(
      () => service.updateTask(created.id, { completed: 'true' }),
      /Completed status must be a boolean/i
    );
    assert.throws(
      () => service.updateTask(created.id, { completed: 1 }),
      /Completed status must be a boolean/i
    );
  });

  it('returns null when updating a nonexistent task', () => {
    const result = service.updateTask(99999, { title: 'Nonexistent' });
    assert.strictEqual(result, null);
  });

  it('deletes a task and handles nonexistent task deletion', () => {
    const created = service.createTask({ title: 'Delete me' });

    const deleted = service.deleteTask(created.id);
    assert.strictEqual(deleted, true);

    const lookup = service.getTaskById(created.id);
    assert.strictEqual(lookup, null);

    const deleteAgain = service.deleteTask(created.id);
    assert.strictEqual(deleteAgain, false);
  });
});
