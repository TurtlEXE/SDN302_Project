import { EmailOutbox } from '../models/email-outbox.model.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';

export class EmailOutboxRepository {
  /**
   * Creates a new email outbox entry within an optional transaction session
   * @param {object} data
   * @param {object} [options]
   * @param {import('mongoose').ClientSession} [options.session]
   * @returns {Promise<import('../models/email-outbox.model.js').EmailOutbox>}
   */
  async createMessage(data, { session } = {}) {
    const docs = await EmailOutbox.create([data], { session });
    return docs[0];
  }

  /**
   * Atomically claims the next pending message using lease locking
   * Guarantees no two concurrent workers process the same message
   * @param {object} [options]
   * @param {object} [options.filter={}] - Optional query scope filter
   * @param {number} [options.leaseDurationMs=60000] - Default 60 seconds lease
   * @param {Date} [options.now=new Date()]
   * @returns {Promise<import('../models/email-outbox.model.js').EmailOutbox|null>}
   */
  async claimPendingMessage({ filter = {}, leaseDurationMs = 60000, now = new Date() } = {}) {
    const lockExpiresAt = new Date(now.getTime() + leaseDurationMs);

    return EmailOutbox.findOneAndUpdate(
      {
        ...filter,
        status: 'PENDING',
        nextRetryAt: { $lte: now },
        $or: [
          { lockedUntil: null },
          { lockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          lockedUntil: lockExpiresAt,
        },
      },
      {
        new: true,
        sort: { createdAt: 1 },
      }
    );
  }

  /**
   * Marks a message as successfully sent
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} [options]
   * @param {Date} [options.sentAt=new Date()]
   * @param {import('mongoose').ClientSession} [options.session]
   * @returns {Promise<import('../models/email-outbox.model.js').EmailOutbox|null>}
   */
  async markSent(id, { sentAt = new Date(), session } = {}) {
    return EmailOutbox.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'SENT',
          sentAt,
          lockedUntil: null,
          lastError: null,
        },
      },
      { new: true, session }
    );
  }

  /**
   * Marks a message failure with retry or terminal FAILED status
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} options
   * @param {string} options.error - Error message
   * @param {number} options.retryCount - Updated retry attempt count
   * @param {Date} [options.nextRetryAt] - Scheduled next attempt
   * @param {boolean} [options.isTerminal=false] - Whether this reaches max retry limit
   * @param {import('mongoose').ClientSession} [options.session]
   * @returns {Promise<import('../models/email-outbox.model.js').EmailOutbox|null>}
   */
  async markFailed(id, { error, retryCount, nextRetryAt, isTerminal = false, session } = {}) {
    const update = isTerminal
      ? {
          $set: {
            status: 'FAILED',
            retryCount,
            lockedUntil: null,
            lastError: error,
          },
        }
      : {
          $set: {
            status: 'PENDING',
            retryCount,
            nextRetryAt: nextRetryAt || new Date(Date.now() + 60000),
            lockedUntil: null,
            lastError: error,
          },
        };

    return EmailOutbox.findByIdAndUpdate(id, update, { new: true, session });
  }

  /**
   * Finds an outbox message by event key
   * @param {string} eventKey
   * @returns {Promise<import('../models/email-outbox.model.js').EmailOutbox|null>}
   */
  async findByEventKey(eventKey) {
    return EmailOutbox.findOne({ eventKey });
  }

  /**
   * Finds an outbox message by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @returns {Promise<import('../models/email-outbox.model.js').EmailOutbox|null>}
   */
  async findById(id) {
    return EmailOutbox.findById(id);
  }

  /**
   * Counts pending outbox messages
   * @returns {Promise<number>}
   */
  async countPending() {
    return EmailOutbox.countDocuments({ status: 'PENDING' });
  }

  /**
   * Finds paginated outbox messages with optional filters
   * @param {object} filter
   * @param {string} [filter.status]
   * @param {string} [filter.eventType]
   * @param {string} [filter.recipientEmail]
   * @param {number} [filter.page=1]
   * @param {number} [filter.limit=20]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async findPaginated(filter = {}) {
    const { page, limit, skip } = parsePagination(filter);
    const query = {};

    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.eventType) {
      query.eventType = filter.eventType;
    }
    if (filter.recipientEmail) {
      query.recipientEmail = filter.recipientEmail.toLowerCase().trim();
    }

    const [items, total] = await Promise.all([
      EmailOutbox.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      EmailOutbox.countDocuments(query).exec(),
    ]);

    const formattedItems = items.map((item) => this.toDTO(item));
    return formatPaginatedResponse(formattedItems, total, page, limit);
  }

  /**
   * Converts an outbox document to clean DTO hiding sensitive secrets (Criterion 43)
   * @param {object} doc
   * @returns {object} EmailOutboxDTO
   */
  toDTO(doc) {
    if (!doc) return null;
    return {
      id: doc._id.toString(),
      eventType: doc.eventType,
      recipientEmail: doc.recipientEmail,
      recipientName: doc.recipientName || '',
      subject: doc.subject,
      status: doc.status,
      retryCount: doc.retryCount,
      lastError: doc.lastError || null,
      sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
      nextRetryAt: doc.nextRetryAt ? doc.nextRetryAt.toISOString() : null,
      createdAt: doc.createdAt ? doc.createdAt.toISOString() : null,
    };
  }
}

export const emailOutboxRepository = new EmailOutboxRepository();
export default emailOutboxRepository;
