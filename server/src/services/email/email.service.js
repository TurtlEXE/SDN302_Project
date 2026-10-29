import { emailOutboxRepository } from '../../repositories/email-outbox.repository.js';
import { mailClient } from '../../integrations/mail.client.js';
import { renderEmail } from '../../templates/emails/index.js';
import { logger } from '../../utils/logger.js';

export const MAX_EMAIL_RETRIES = 3;

// Backoff intervals in milliseconds for retries: 1st retry: 1m, 2nd retry: 5m, 3rd retry: 15m
export const RETRY_BACKOFF_MS = [
  60 * 1000,      // Attempt 1 -> wait 1 min
  5 * 60 * 1000,  // Attempt 2 -> wait 5 min
  15 * 60 * 1000, // Attempt 3 -> wait 15 min
];

export class EmailService {
  constructor(repository = emailOutboxRepository, client = mailClient) {
    this.repository = repository;
    this.client = client;
  }

  /**
   * Enqueues an email into the transactional outbox
   * @param {object} payload
   * @param {string} payload.eventKey - Unique idempotency event key
   * @param {string} payload.eventType - VERIFY_EMAIL | ACTIVATE_OWNER | RESET_PASSWORD | etc.
   * @param {string} payload.recipientEmail
   * @param {string} [payload.recipientName='']
   * @param {string} payload.subject
   * @param {string} payload.templateName
   * @param {object} [payload.templateData={}]
   * @param {object} [context]
   * @param {import('mongoose').ClientSession} [context.session]
   * @returns {Promise<import('../../models/email-outbox.model.js').EmailOutbox>}
   */
  async queueEmail(payload, { session } = {}) {
    const {
      eventKey,
      eventType,
      recipientEmail,
      recipientName = '',
      subject,
      templateName,
      templateData = {},
    } = payload;

    try {
      return await this.repository.createMessage(
        {
          eventKey,
          eventType,
          recipientEmail: recipientEmail.toLowerCase().trim(),
          recipientName,
          subject,
          templateName,
          templateData,
          status: 'PENDING',
          retryCount: 0,
          nextRetryAt: new Date(),
        },
        { session }
      );
    } catch (err) {
      // If eventKey duplicate (MongoDB code 11000), return existing for idempotency
      if (err.code === 11000) {
        logger.warn(`[EmailService] Duplicate eventKey [${eventKey}] detected. Idempotent return.`);
        const existing = await this.repository.findByEventKey(eventKey);
        if (existing) return existing;
      }
      throw err;
    }
  }

  /**
   * Calculates next retry timestamp using exponential backoff
   * @param {number} retryCount - Current attempt count (0, 1, 2)
   * @returns {Date}
   */
  calculateNextRetryAt(retryCount) {
    const delay = RETRY_BACKOFF_MS[retryCount] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
    return new Date(Date.now() + delay);
  }

  /**
   * Processes a single claimed outbox message
   * @param {import('../../models/email-outbox.model.js').EmailOutbox} message
   * @returns {Promise<{ success: boolean, skipped?: boolean, error?: string }>}
   */
  async processMessage(message) {
    // Check if the email contains an expired token: "Không gửi liên kết đã hết hạn; người dùng phải xin liên kết mới"
    if (message.templateData && message.templateData.expiresAt) {
      const expiresAt = new Date(message.templateData.expiresAt);
      if (expiresAt <= new Date()) {
        const errorMsg = 'Token expired before email delivery. Refusing to send expired link.';
        logger.warn(`[EmailService] ${errorMsg} for outbox ID [${message._id}]`);
        await this.repository.markFailed(message._id, {
          error: errorMsg,
          retryCount: message.retryCount,
          isTerminal: true,
        });
        return { success: false, skipped: true, error: errorMsg };
      }
    }

    try {
      // Render email from registered template
      const { subject, html, text } = renderEmail(message.templateName, message.templateData);

      // Deliver message via mail transport
      await this.client.sendMail({
        to: message.recipientEmail,
        subject: message.subject || subject,
        html,
        text,
      });

      // Mark outbox entry as SENT
      await this.repository.markSent(message._id);
      logger.info(`[EmailService] Outbox message [${message._id}] delivered to [${message.recipientEmail}]`);
      return { success: true };
    } catch (err) {
      const newRetryCount = message.retryCount + 1;
      const isTerminal = newRetryCount >= MAX_EMAIL_RETRIES;
      const nextRetryAt = isTerminal ? null : this.calculateNextRetryAt(message.retryCount);

      logger.error(
        `[EmailService] Failed to send outbox message [${message._id}] (attempt ${newRetryCount}/${MAX_EMAIL_RETRIES}): ${err.message}`
      );

      await this.repository.markFailed(message._id, {
        error: err.message,
        retryCount: newRetryCount,
        nextRetryAt,
        isTerminal,
      });

      return { success: false, error: err.message };
    }
  }

  /**
   * Processes a batch of pending emails using atomic lease locking
   * Safe to call concurrently by multiple worker instances
   * @param {object} [options]
   * @param {object} [options.filter={}] - Optional query scope filter
   * @param {number} [options.limit=10]
   * @param {number} [options.leaseDurationMs=60000]
   * @returns {Promise<{ processed: number, sent: number, failed: number }>}
   */
  async processPendingBatch({ filter = {}, limit = 10, leaseDurationMs = 60000 } = {}) {
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < limit; i++) {
      // Atomically claim the next pending document
      const message = await this.repository.claimPendingMessage({ filter, leaseDurationMs });
      if (!message) {
        // No more ready messages to process in this cycle
        break;
      }

      processed++;
      const result = await this.processMessage(message);
      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { processed, sent, failed };
  }
}

export const emailService = new EmailService();
export default emailService;
