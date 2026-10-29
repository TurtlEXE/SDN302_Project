import { AuthSession } from '../models/auth-session.model.js';

export const authSessionRepository = {
  /**
   * Create a new AuthSession
   * @param {object} sessionData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/auth-session.model.js').AuthSession>}
   */
  async create(sessionData, session = null) {
    const docs = await AuthSession.create([sessionData], session ? { session } : {});
    return docs[0];
  },

  /**
   * Find session by ID
   * @param {string|import('mongoose').Types.ObjectId} sessionId
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/auth-session.model.js').AuthSession|null>}
   */
  async findById(sessionId, session = null) {
    const query = AuthSession.findById(sessionId);
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Find valid (unrevoked, non-expired) session by ID
   * @param {string|import('mongoose').Types.ObjectId} sessionId
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/auth-session.model.js').AuthSession|null>}
   */
  async findValidSession(sessionId, session = null) {
    const now = new Date();
    const query = AuthSession.findOne({
      _id: sessionId,
      revokedAt: null,
      absoluteExpiresAt: { $gt: now },
    });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Revoke a single session
   * @param {string|import('mongoose').Types.ObjectId} sessionId
   * @param {string} [reason='LOGOUT']
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/auth-session.model.js').AuthSession|null>}
   */
  async revokeSession(sessionId, reason = 'LOGOUT', session = null) {
    const query = AuthSession.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      },
      { new: true }
    );
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Revoke all active sessions for a user
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} [reason='PASSWORD_CHANGED']
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async revokeAllUserSessions(userId, reason = 'PASSWORD_CHANGED', session = null) {
    const query = AuthSession.updateMany(
      {
        userId,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: reason,
        },
      }
    );
    if (session) query.session(session);
    return query.exec();
  },
};

export default authSessionRepository;
