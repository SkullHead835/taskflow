const path = require('path');
const fs = require('fs');

/**
 * Loads .env file using Node's built-in process.loadEnvFile if available,
 * or safely falls back if the file does not exist or method is unavailable.
 *
 * @param {string} [customPath]
 */
function loadEnv(customPath) {
  const envPath = customPath || path.resolve(process.cwd(), '.env');
  if (typeof process.loadEnvFile === 'function' && fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Safe fallback if .env contains non-standard entries
    }
  }
}

// Auto-load on import
loadEnv();

/**
 * Validates and returns parsed configuration values.
 *
 * @param {object} [env=process.env]
 * @returns {object}
 */
function getEnvConfig(env = process.env) {
  const port = Number(env.PORT) || 3000;
  const nodeEnv = env.NODE_ENV || 'development';
  const defaultDbPath = path.join(__dirname, '../../data/taskflow.db');
  const dbPath = env.DB_PATH || defaultDbPath;
  const rateLimitWindowMs = Number(env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
  const rateLimitMax = Number(env.RATE_LIMIT_MAX_REQUESTS) || 100;

  return {
    port,
    nodeEnv,
    dbPath,
    rateLimit: {
      windowMs: rateLimitWindowMs,
      max: rateLimitMax
    }
  };
}

const config = getEnvConfig();

module.exports = {
  config,
  getEnvConfig,
  loadEnv
};
