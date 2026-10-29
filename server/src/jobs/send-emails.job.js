import { emailService } from '../services/email/email.service.js';
import { logger } from '../utils/logger.js';

let intervalHandle = null;
let isJobRunning = false;

/**
 * Runs a single cycle of the send-emails job
 * @param {object} [options]
 * @param {number} [options.limit=10]
 * @param {number} [options.leaseDurationMs=60000]
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
export async function runSendEmailsJob({ limit = 10, leaseDurationMs = 60000 } = {}) {
  if (isJobRunning) {
    logger.debug('[SendEmailsJob] Previous job cycle is still executing. Skipping this tick.');
    return { processed: 0, sent: 0, failed: 0 };
  }

  isJobRunning = true;
  try {
    const summary = await emailService.processPendingBatch({ limit, leaseDurationMs });
    if (summary.processed > 0) {
      logger.info(
        `[SendEmailsJob] Cycle completed: ${summary.processed} processed (${summary.sent} sent, ${summary.failed} failed/retrying).`
      );
    }
    return summary;
  } catch (err) {
    logger.error(`[SendEmailsJob] Error executing job: ${err.message}`, { error: err.message });
    return { processed: 0, sent: 0, failed: 0, error: err.message };
  } finally {
    isJobRunning = false;
  }
}

/**
 * Starts the recurring send-emails background worker
 * @param {object} [options]
 * @param {number} [options.intervalMs=5000] - Polling interval in ms (default 5s)
 * @param {number} [options.limit=10] - Messages per tick
 */
export function startSendEmailsJob({ intervalMs = 5000, limit = 10 } = {}) {
  if (intervalHandle) {
    logger.warn('[SendEmailsJob] Background email job is already running.');
    return;
  }

  logger.info(`[SendEmailsJob] Starting recurring background email worker (interval: ${intervalMs}ms)...`);
  intervalHandle = setInterval(() => {
    runSendEmailsJob({ limit }).catch((err) => {
      logger.error(`[SendEmailsJob] Unhandled error in periodic tick: ${err.message}`);
    });
  }, intervalMs);

  // Run first cycle immediately
  runSendEmailsJob({ limit }).catch((err) => {
    logger.error(`[SendEmailsJob] Error in initial run: ${err.message}`);
  });
}

/**
 * Stops the recurring background worker
 */
export function stopSendEmailsJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('[SendEmailsJob] Background email job stopped.');
  }
}
