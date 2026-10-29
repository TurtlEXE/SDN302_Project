import crypto from 'crypto';
import { RefreshToken } from '../models/refresh-token.model.js';

export const refreshTokenRepository = {
  /**
   * Hashes a raw refresh token using SHA-256
   * @param {string} rawToken
   * @returns {string} 64-character hex hash
   */
  hashToken(rawToken) {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  },

  /**
   * Generates a cryptographically secure 32-byte hex refresh token
   * @returns {string} 64-character hex string
   */
  generateRawToken() {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Create a new RefreshToken record
   * @param {object} tokenData
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/refresh-token.model.js').RefreshToken>}
   */
  async create(tokenData, session = null) {
    const docs = await RefreshToken.create([tokenData], session ? { session } : {});
    return docs[0];
  },

  /**
   * Find refresh token by SHA-256 hash
   * @param {string} tokenHash
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('../models/refresh-token.model.js').RefreshToken|null>}
   */
  async findByTokenHash(tokenHash, session = null) {
    const query = RefreshToken.findOne({ tokenHash });
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Revoke all refresh tokens for a session
   * @param {string|import('mongoose').Types.ObjectId} sessionId
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async revokeAllForSession(sessionId, session = null) {
    const query = RefreshToken.updateMany(
      { sessionId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    if (session) query.session(session);
    return query.exec();
  },

  /**
   * Revoke all refresh tokens for a user
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {import('mongoose').ClientSession|null} [session=null]
   * @returns {Promise<import('mongodb').UpdateResult>}
   */
  async revokeAllForUser(userId, session = null) {
    const query = RefreshToken.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    if (session) query.session(session);
    return query.exec();
  },
};

export default refreshTokenRepository;
