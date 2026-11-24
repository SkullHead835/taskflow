const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { securityHeaders, createRateLimiter } = require('../src/middleware/security');
const { createApp } = require('../src/app');

describe('Security & Rate Limiting Middleware', () => {
  it('1. sets standard security headers on HTTP responses', async () => {
    const app = createApp({ rateLimit: { enabled: false } });
    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
      assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
      assert.strictEqual(res.headers.get('x-xss-protection'), '1; mode=block');
      assert.strictEqual(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      assert.ok(res.headers.get('content-security-policy'));
    } finally {
      server.close();
    }
  });

  it('2. returns rate limit headers (Limit, Remaining, Reset)', async () => {
    const app = express();
    app.use(createRateLimiter({ max: 5, windowMs: 10000 }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/test`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get('x-ratelimit-limit'), '5');
      assert.strictEqual(res.headers.get('x-ratelimit-remaining'), '4');
      assert.ok(res.headers.get('x-ratelimit-reset'));
    } finally {
      server.close();
    }
  });

  it('3. blocks requests exceeding rate limit with HTTP 429 and Retry-After header', async () => {
    const app = express();
    app.use(createRateLimiter({ max: 2, windowMs: 10000 }));
    app.get('/test', (req, res) => res.json({ ok: true }));

    const server = app.listen(0);
    const port = server.address().port;

    try {
      // 1st request -> 200
      const res1 = await fetch(`http://127.0.0.1:${port}/test`);
      assert.strictEqual(res1.status, 200);

      // 2nd request -> 200
      const res2 = await fetch(`http://127.0.0.1:${port}/test`);
      assert.strictEqual(res2.status, 200);

      // 3rd request -> 429 Too Many Requests
      const res3 = await fetch(`http://127.0.0.1:${port}/test`);
      assert.strictEqual(res3.status, 429);
      assert.ok(res3.headers.get('retry-after'));

      const json = await res3.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.error.code, 'TOO_MANY_REQUESTS');
      assert.ok(json.error.message.includes('Too many requests'));
    } finally {
      server.close();
    }
  });
});
