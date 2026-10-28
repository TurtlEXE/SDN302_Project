import app from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';
import { logger } from './utils/logger.js';

let server;

async function startServer() {
  try {
    logger.info(`Starting Sport Booking API Server in [${env.NODE_ENV}] mode...`);

    // Connect to MongoDB
    await connectDB(env.MONGODB_URI);

    // Start HTTP Server
    server = app.listen(env.PORT, () => {
      logger.info(`HTTP Server running on port ${env.PORT} (Prefix: ${env.API_PREFIX})`);
      logger.info(`Health check: http://localhost:${env.PORT}/health`);
      logger.info(`Readiness check: http://localhost:${env.PORT}/ready`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`, { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await disconnectDB();
        logger.info('Graceful shutdown completed.');
        process.exit(0);
      } catch (err) {
        logger.error(`Error during database disconnect: ${err.message}`);
        process.exit(1);
      }
    });

    // Force close after 10 seconds if not closed
    setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason });
  gracefulShutdown('unhandledRejection');
});

startServer();

