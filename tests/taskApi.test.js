const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const initDatabase = require('../src/config/database');
const TaskRepository = require('../src/repositories/taskRepository');
const TaskService = require('../src/services/taskService');
const { createApp } = require('../src/app');
const { BadRequestError } = require('../src/errors/appError');

describe('TaskFlow Lite REST API Integration', () => {
  let db;
  let repo;
  let service;
  let app;
  let server;
  let baseUrl;

  before(async () => {
    // Isolated in-memory database and service stack
    db = initDatabase(':memory:');
    repo = new TaskRepository(db);
    service = new TaskService(repo);
    app = createApp({ taskService: service });

    // Start ephemeral server
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => {
      if (server) {
        server.close(resolve);
      } else {
        resolve();
      }
    });

    if (db && db.open) {
      db.close();
    }
  });

  // 1. Health endpoint returns healthy status
  it('1. GET /api/health returns healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.status, 'healthy');
    assert.strictEqual(json.data.service, 'TaskFlow Lite');
  });

  // 2. POST creates a valid task
  let createdTaskId;
  it('2. POST /api/tasks creates a valid task', async () => {
    const payload = {
      title: 'First API Task',
      description: 'Created through REST API'
    };

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.title, 'First API Task');
    assert.strictEqual(json.data.description, 'Created through REST API');
    assert.strictEqual(json.data.completed, false);
    assert.ok(json.data.id > 0);

    createdTaskId = json.data.id;
  });

  // 3. GET returns all tasks
  it('3. GET /api/tasks returns all tasks', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.data.length >= 1);
  });

  // 4. GET filters pending tasks
  it('4. GET /api/tasks?completed=false filters pending tasks', async () => {
    const res = await fetch(`${baseUrl}/api/tasks?completed=false`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.every((task) => task.completed === false));
  });

  // 5. GET filters completed tasks
  it('5. GET /api/tasks?completed=true filters completed tasks', async () => {
    // Create an already completed task via service
    service.createTask({ title: 'Completed Item', completed: true });

    const res = await fetch(`${baseUrl}/api/tasks?completed=true`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.ok(json.data.length >= 1);
    assert.ok(json.data.every((task) => task.completed === true));
  });

  // 6. GET retrieves a task by ID
  it('6. GET /api/tasks/:id retrieves a task by ID', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.id, createdTaskId);
    assert.strictEqual(json.data.title, 'First API Task');
  });

  // 7. GET nonexistent task returns 404
  it('7. GET /api/tasks/:id returns 404 for nonexistent task', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/99999`);
    assert.strictEqual(res.status, 404);

    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  // 8. PATCH updates task title
  it('8. PATCH /api/tasks/:id updates task title', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated API Task Title' })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.title, 'Updated API Task Title');
  });

  // 9. PATCH updates description
  it('9. PATCH /api/tasks/:id updates task description', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated description detail' })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.description, 'Updated description detail');
  });

  // 10. PATCH marks task completed
  it('10. PATCH /api/tasks/:id marks task completed', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: true })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.completed, true);
  });

  // 11. PATCH rejects empty update
  it('11. PATCH /api/tasks/:id rejects empty update payload', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  // 12. PATCH rejects invalid data
  it('12. PATCH /api/tasks/:id rejects invalid data types', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: 'not-a-boolean' })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  // 13. POST rejects empty title
  it('13. POST /api/tasks rejects whitespace-only title', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '     ' })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  // 14. POST rejects missing title
  it('14. POST /api/tasks rejects missing title', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Only description' })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
  });

  // 15. DELETE removes a task
  it('15. DELETE /api/tasks/:id removes an existing task', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`, {
      method: 'DELETE'
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.message, 'Task deleted successfully');

    // Confirm it no longer exists
    const lookup = await fetch(`${baseUrl}/api/tasks/${createdTaskId}`);
    assert.strictEqual(lookup.status, 404);
  });

  // 16. DELETE nonexistent task returns 404
  it('16. DELETE /api/tasks/:id returns 404 for nonexistent task', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/99999`, {
      method: 'DELETE'
    });

    assert.strictEqual(res.status, 404);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  // 17. Invalid task ID returns 400
  it('17. Invalid task ID returns 400', async () => {
    const res1 = await fetch(`${baseUrl}/api/tasks/-5`);
    assert.strictEqual(res1.status, 400);
    const json1 = await res1.json();
    assert.strictEqual(json1.error.code, 'VALIDATION_ERROR');

    const res2 = await fetch(`${baseUrl}/api/tasks/invalid-id`);
    assert.strictEqual(res2.status, 400);
    const json2 = await res2.json();
    assert.strictEqual(json2.error.code, 'VALIDATION_ERROR');
  });

  // 18. Unknown API route returns 404
  it('18. Unknown route returns 404 with structured error', async () => {
    const res = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    assert.strictEqual(res.status, 404);

    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'NOT_FOUND');
  });

  // 19. Unexpected server errors do not expose stack traces
  it('19. Unexpected server error returns 500 without stack trace leakage', async () => {
    const originalGetTaskById = service.getTaskById.bind(service);
    service.getTaskById = () => {
      throw new Error('Database disk I/O failure');
    };

    try {
      const res = await fetch(`${baseUrl}/api/tasks/1`);
      assert.strictEqual(res.status, 500);

      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'INTERNAL_SERVER_ERROR');
      assert.strictEqual(json.error.message, 'An unexpected internal error occurred');
      assert.strictEqual('stack' in json.error, false, 'Stack trace must not leak');
    } finally {
      service.getTaskById = originalGetTaskById;
    }
  });

  // 20. Title exceeding 120 chars returns 400
  it('20. POST /api/tasks rejects title exceeding 120 characters', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'x'.repeat(121) })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.strictEqual(json.error.code, 'VALIDATION_ERROR');
    assert.match(json.error.details[0].message, /must not exceed 120 characters/i);
  });

  // 21. Typed AppError thrown in service returns 400 BAD_REQUEST
  it('21. Expected domain AppError returns 400 with BAD_REQUEST code', async () => {
    const originalCreateTask = service.createTask.bind(service);
    service.createTask = () => {
      throw new BadRequestError('Domain validation constraint failed');
    };

    try {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Valid title' })
      });

      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'BAD_REQUEST');
      assert.strictEqual(json.error.message, 'Domain validation constraint failed');
      assert.strictEqual('stack' in json.error, false);
    } finally {
      service.createTask = originalCreateTask;
    }
  });
});
