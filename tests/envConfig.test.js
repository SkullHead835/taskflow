const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getEnvConfig } = require('../src/config/env');

describe('Environment Configuration', () => {
  it('1. provides sensible defaults when env variables are unset', () => {
    const config = getEnvConfig({});
    assert.strictEqual(config.port, 3000);
    assert.strictEqual(config.nodeEnv, 'development');
    assert.ok(config.dbPath.includes('taskflow.db'));
    assert.strictEqual(config.rateLimit.windowMs, 900000);
    assert.strictEqual(config.rateLimit.max, 100);
  });

  it('2. parses custom environment variables accurately', () => {
    const custom = getEnvConfig({
      PORT: '8080',
      NODE_ENV: 'production',
      DB_PATH: '/custom/path/db.sqlite',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX_REQUESTS: '50'
    });

    assert.strictEqual(custom.port, 8080);
    assert.strictEqual(custom.nodeEnv, 'production');
    assert.strictEqual(custom.dbPath, '/custom/path/db.sqlite');
    assert.strictEqual(custom.rateLimit.windowMs, 60000);
    assert.strictEqual(custom.rateLimit.max, 50);
  });

  it('3. falls back to defaults for invalid numeric values', () => {
    const invalid = getEnvConfig({
      PORT: 'not-a-number',
      RATE_LIMIT_WINDOW_MS: 'abc',
      RATE_LIMIT_MAX_REQUESTS: 'xyz'
    });

    assert.strictEqual(invalid.port, 3000);
    assert.strictEqual(invalid.rateLimit.windowMs, 900000);
    assert.strictEqual(invalid.rateLimit.max, 100);
  });
});
