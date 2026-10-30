import { ActionLog } from '../models/action-log.model.js';
import { parsePagination, formatPaginatedResponse } from '../utils/pagination.js';

export const actionLogRepository = {
  /**
   * Records an administrative action log entry
   * @param {object} logData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/action-log.model.js').ActionLog>}
   */
  async create(logData, session = null) {
    const docs = await ActionLog.create([logData], session ? { session } : {});
    return docs[0];
  },

  /**
   * Retrieves paginated action logs with optional filtering
   * @param {object} filter
   * @param {string} [filter.targetType]
   * @param {string|import('mongoose').Types.ObjectId} [filter.targetId]
   * @param {string|import('mongoose').Types.ObjectId} [filter.actorId]
   * @param {string} [filter.action]
   * @param {number} [filter.page=1]
   * @param {number} [filter.limit=10]
   * @returns {Promise<{ items: Array, pagination: object }>}
   */
  async findLogs(filter = {}) {
    const { page, limit, skip } = parsePagination(filter);
    const query = {};

    if (filter.targetType) {
      query.targetType = filter.targetType;
    }
    if (filter.targetId) {
      query.targetId = filter.targetId;
    }
    if (filter.actorId) {
      query.actorId = filter.actorId;
    }
    if (filter.actorRole) {
      query.actorRole = filter.actorRole;
    }
    if (filter.action) {
      query.action = filter.action;
    }

    const [items, total] = await Promise.all([
      ActionLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      ActionLog.countDocuments(query).exec(),
    ]);

    const formattedItems = items.map((item) => this.toDTO(item));
    return formatPaginatedResponse(formattedItems, total, page, limit);
  },

  /**
   * Formats action log document to clean DTO
   * @param {object} log
   * @returns {object}
   */
  toDTO(log) {
    if (!log) return null;
    return {
      id: log._id.toString(),
      actorId: log.actorId ? log.actorId.toString() : null,
      actorRole: log.actorRole,
      targetType: log.targetType,
      targetId: log.targetId ? log.targetId.toString() : null,
      action: log.action,
      reason: log.reason,
      previousState: log.previousState,
      newState: log.newState,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt ? log.createdAt.toISOString() : null,
    };
  },
};

export default actionLogRepository;

