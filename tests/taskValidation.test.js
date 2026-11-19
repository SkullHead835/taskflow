const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  createTaskSchema,
  updateTaskSchema,
  filterTasksSchema,
  taskIdParamSchema
} = require('../src/validators/taskSchemas');
const validateRequest = require('../src/middleware/validateRequest');

describe('Zod Task Schemas', () => {
  describe('createTaskSchema', () => {
    it('accepts valid task data and trims title/description', () => {
      const result = createTaskSchema.safeParse({
        title: '  Buy Groceries  ',
        description: '  Milk, Bread  ',
        completed: false
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.title, 'Buy Groceries');
      assert.strictEqual(result.data.description, 'Milk, Bread');
      assert.strictEqual(result.data.completed, false);
    });

    it('rejects missing or empty title', () => {
      const missingTitle = createTaskSchema.safeParse({ description: 'No title' });
      assert.strictEqual(missingTitle.success, false);

      const emptyTitle = createTaskSchema.safeParse({ title: '    ' });
      assert.strictEqual(emptyTitle.success, false);
    });

    it('rejects non-boolean completed value', () => {
      const result = createTaskSchema.safeParse({
        title: 'Valid title',
        completed: 'true'
      });
      assert.strictEqual(result.success, false);
    });

    it('validates title length limits (120 chars)', () => {
      const exact120 = 'a'.repeat(120);
      assert.strictEqual(createTaskSchema.safeParse({ title: exact120 }).success, true);

      const over120 = 'a'.repeat(121);
      const res = createTaskSchema.safeParse({ title: over120 });
      assert.strictEqual(res.success, false);
      assert.match(res.error.issues[0].message, /must not exceed 120 characters/i);
    });

    it('validates description length limits (1000 chars)', () => {
      const exact1000 = 'd'.repeat(1000);
      assert.strictEqual(
        createTaskSchema.safeParse({ title: 'Valid', description: exact1000 }).success,
        true
      );

      const over1000 = 'd'.repeat(1001);
      const res = createTaskSchema.safeParse({ title: 'Valid', description: over1000 });
      assert.strictEqual(res.success, false);
      assert.match(res.error.issues[0].message, /must not exceed 1000 characters/i);
    });
  });

  describe('updateTaskSchema', () => {
    it('accepts valid partial updates', () => {
      const titleUpdate = updateTaskSchema.safeParse({ title: 'New title' });
      assert.strictEqual(titleUpdate.success, true);

      const completionUpdate = updateTaskSchema.safeParse({ completed: true });
      assert.strictEqual(completionUpdate.success, true);

      const descUpdate = updateTaskSchema.safeParse({ description: 'New description' });
      assert.strictEqual(descUpdate.success, true);
    });

    it('rejects empty update objects with no editable fields', () => {
      const emptyUpdate = updateTaskSchema.safeParse({});
      assert.strictEqual(emptyUpdate.success, false);

      const irrelevantFields = updateTaskSchema.safeParse({ random: 123 });
      assert.strictEqual(irrelevantFields.success, false);
    });

    it('rejects invalid fields in update', () => {
      const emptyTitle = updateTaskSchema.safeParse({ title: '   ' });
      assert.strictEqual(emptyTitle.success, false);

      const invalidCompleted = updateTaskSchema.safeParse({ completed: 'yes' });
      assert.strictEqual(invalidCompleted.success, false);
    });

    it('validates title length limits on update (120 chars)', () => {
      const exact120 = 'u'.repeat(120);
      assert.strictEqual(updateTaskSchema.safeParse({ title: exact120 }).success, true);

      const over120 = 'u'.repeat(121);
      const res = updateTaskSchema.safeParse({ title: over120 });
      assert.strictEqual(res.success, false);
      assert.match(res.error.issues[0].message, /must not exceed 120 characters/i);
    });

    it('validates description length limits on update (1000 chars)', () => {
      const exact1000 = 'x'.repeat(1000);
      assert.strictEqual(updateTaskSchema.safeParse({ description: exact1000 }).success, true);

      const over1000 = 'x'.repeat(1001);
      const res = updateTaskSchema.safeParse({ description: over1000 });
      assert.strictEqual(res.success, false);
      assert.match(res.error.issues[0].message, /must not exceed 1000 characters/i);
    });
  });

  describe('filterTasksSchema', () => {
    it('parses and transforms boolean string representations', () => {
      const trueStr = filterTasksSchema.safeParse({ completed: 'true' });
      assert.strictEqual(trueStr.success, true);
      assert.strictEqual(trueStr.data.completed, true);

      const falseStr = filterTasksSchema.safeParse({ completed: 'false' });
      assert.strictEqual(falseStr.success, true);
      assert.strictEqual(falseStr.data.completed, false);

      const oneStr = filterTasksSchema.safeParse({ completed: '1' });
      assert.strictEqual(oneStr.success, true);
      assert.strictEqual(oneStr.data.completed, true);

      const zeroStr = filterTasksSchema.safeParse({ completed: '0' });
      assert.strictEqual(zeroStr.success, true);
      assert.strictEqual(zeroStr.data.completed, false);

      const actualBool = filterTasksSchema.safeParse({ completed: true });
      assert.strictEqual(actualBool.success, true);
      assert.strictEqual(actualBool.data.completed, true);
    });

    it('rejects invalid filter values', () => {
      const invalid = filterTasksSchema.safeParse({ completed: 'maybe' });
      assert.strictEqual(invalid.success, false);
    });
  });

  describe('taskIdParamSchema', () => {
    it('coerces valid numeric strings to positive integers', () => {
      const result = taskIdParamSchema.safeParse({ id: '42' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data.id, 42);
    });

    it('rejects non-positive numbers and non-integers', () => {
      assert.strictEqual(taskIdParamSchema.safeParse({ id: '0' }).success, false);
      assert.strictEqual(taskIdParamSchema.safeParse({ id: '-5' }).success, false);
      assert.strictEqual(taskIdParamSchema.safeParse({ id: '3.14' }).success, false);
      assert.strictEqual(taskIdParamSchema.safeParse({ id: 'invalid' }).success, false);
    });
  });
});

describe('validateRequest Middleware', () => {
  function createMockResponse() {
    const res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      }
    };
    return res;
  }

  it('calls next() and updates req.body with sanitized data for valid payload', () => {
    const middleware = validateRequest({ body: createTaskSchema });
    const req = { body: { title: '  Trim Me  ', description: 'Details' } };
    const res = createMockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.body.title, 'Trim Me');
    assert.strictEqual(res.statusCode, null);
  });

  it('returns 400 with structured JSON error details when validation fails', () => {
    const middleware = validateRequest({ body: createTaskSchema });
    const req = { body: { title: '   ' } };
    const res = createMockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.success, false);
    assert.strictEqual(res.jsonData.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res.jsonData.error.details));
    assert.strictEqual(res.jsonData.error.details[0].field, 'title');
    assert.ok(!('stack' in res.jsonData.error), 'Stack traces must never leak');
  });

  it('validates params and coerces numeric id', () => {
    const middleware = validateRequest({ params: taskIdParamSchema });
    const req = { params: { id: '7' } };
    const res = createMockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, true);
    assert.strictEqual(req.params.id, 7);
  });

  it('returns 400 for invalid params', () => {
    const middleware = validateRequest({ params: taskIdParamSchema });
    const req = { params: { id: '-2' } };
    const res = createMockResponse();
    let nextCalled = false;

    middleware(req, res, () => {
      nextCalled = true;
    });

    assert.strictEqual(nextCalled, false);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.jsonData.error.details[0].field, 'id');
  });
});
