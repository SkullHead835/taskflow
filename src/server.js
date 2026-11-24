const app = require('./app');
const { getDatabase, closeDatabase } = require('./config/database');
const { config } = require('./config/env');

const PORT = config.port;

/**
 * Starts the TaskFlow HTTP server.
 *
 * @param {number} [port=PORT]
 * @returns {import('http').Server}
 */
function startServer(port = PORT) {
  // Initialize SQLite database instance
  const db = getDatabase();

  const server = app.listen(port, () => {
    console.log(`TaskFlow server running on http://localhost:${port}`);
  });

  // Graceful shutdown handlers
  let isShuttingDown = false;
  const handleShutdown = (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    server.close(() => {
      closeDatabase(db);
      console.log('Server and database connections successfully closed.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  return server;
}

// Start listening only when executed directly via `node src/server.js`
if (require.main === module) {
  startServer();
}

module.exports = startServer;
