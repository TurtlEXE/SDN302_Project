import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/database.js';
import { startSendEmailsJob, stopSendEmailsJob } from './jobs/send-emails.job.js';
import { logger } from './utils/logger.js';

let isShuttingDown = false;

async function startWorker() {
  try {
    logger.info(`Starting Sport Booking Worker Process in [${env.NODE_ENV}] mode...`);

    // Connect to database for job execution
    await connectDB(env.MONGODB_URI);
    logger.info('Worker connected to database.');

    // Start background jobs
    startSendEmailsJob({ intervalMs: 5000 });
    logger.info('Worker background jobs started successfully. Ready for tasks.');
  } catch (err) {
    logger.error(`Worker failed to start: ${err.message}`, { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`Worker received ${signal}. Shutting down worker...`);
  try {
    stopSendEmailsJob();
    await disconnectDB();
    logger.info('Worker shutdown completed.');
    process.exit(0);
  } catch (err) {
    logger.error(`Error during worker shutdown: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  logger.error(`Worker Uncaught Exception: ${err.message}`, { stack: err.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Worker Unhandled Promise Rejection', { reason });
  gracefulShutdown('unhandledRejection');
});

startWorker();
