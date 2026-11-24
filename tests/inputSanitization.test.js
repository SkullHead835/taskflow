const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const initDatabase = require('../src/config/database');
const TaskRepository = require('../src/repositories/taskRepository');
const TaskService = require('../src/services/taskService');
const { createApp } = require('../src/app');
const { sanitizeString } = require('../src/utils/sanitize');

describe('Server-Side Input Sanitization', () => {
  let db;
  let repo;
  let service;
  let app;
  let server;
  let baseUrl;

  before(async () => {
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

  it('1. sanitizeString utility strips HTML tags and scripts', () => {
    assert.strictEqual(sanitizeString('<script>alert("xss")</script>Hello'), 'alert("xss")Hello');
    assert.strictEqual(sanitizeString('<b style="color:red">Bold Title</b>'), 'Bold Title');
    assert.strictEqual(sanitizeString('<img src=x onerror=alert(1)>Photo Note'), 'Photo Note');
    assert.strictEqual(sanitizeString(null), null);
    assert.strictEqual(sanitizeString(undefined), null);
  });

  it('2. sanitizeString preserves legitimate punctuation, symbols, and comparison angle brackets', () => {
    const text = "Review O'Connor's budget & proposal (v2.0) - $500, #urgent, 100%!";
    assert.strictEqual(sanitizeString(text), text);

    const mathText = "Condition: x < 5 && y > 10 (budget < $1000)";
    assert.strictEqual(sanitizeString(mathText), mathText);
  });

  it('3. rejects task creation when title consists only of HTML tags', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '<script></script>'
      })
    });

    assert.strictEqual(res.status, 400);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.ok(json.error.message.includes('cannot be empty or contain only HTML tags'));
  });

  it('4. sanitizes HTML in task title and description on creation via REST API', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '<h3>Important Meeting</h3>',
        description: '<p>Discuss <strong>Q3 roadmap</strong> and <a href="http://bad.site">click here</a>.</p>'
      })
    });

    assert.strictEqual(res.status, 201);
    const json = await res.json();
    assert.strictEqual(json.data.title, 'Important Meeting');
    assert.strictEqual(json.data.description, 'Discuss Q3 roadmap and click here.');
  });

  it('5. sanitizes HTML in task title and description on update via REST API', async () => {
    const created = service.createTask({ title: 'Initial Clean Task' });

    const res = await fetch(`${baseUrl}/api/tasks/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '<i>Updated Title</i>',
        description: '<script>evilCode()</script>Notes for the team'
      })
    });

    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.data.title, 'Updated Title');
    assert.strictEqual(json.data.description, 'evilCode()Notes for the team');
  });
});
