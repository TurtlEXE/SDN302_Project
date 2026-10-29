import { AuthToken } from '../models/auth-token.model.js';

export class AuthTokenRepository {
  /**
   * Creates an AuthToken record
   * @param {object} tokenData
   * @param {string|import('mongoose').Types.ObjectId} tokenData.userId
   * @param {string} tokenData.type
   * @param {string} tokenData.tokenHash
   * @param {Date} tokenData.expiresAt
   * @param {object} [options]
   * @param {import('mongoose').ClientSession} [options.session]
   * @returns {Promise<import('../models/auth-token.model.js').AuthToken>}
   */
  async createToken(tokenData, { session } = {}) {
    const docs = await AuthToken.create([tokenData], { session });
    return docs[0];
  }

  /**
   * Finds a token document by its hash
   * @param {object} filter
   * @param {string} filter.tokenHash
   * @param {string} [filter.type]
   * @returns {Promise<import('../models/auth-token.model.js').AuthToken|null>}
   */
  async findTokenByHash({ tokenHash, type }) {
    const query = { tokenHash };
    if (type) query.type = type;
    return AuthToken.findOne(query);
  }

  /**
   * Finds a valid, unused, non-expired token
   * @param {object} filter
   * @param {string} filter.tokenHash
   * @param {string} filter.type
   * @param {Date} [filter.now=new Date()]
   * @returns {Promise<import('../models/auth-token.model.js').AuthToken|null>}
   */
  async findValidToken({ tokenHash, type, now = new Date() }) {
    return AuthToken.findOne({
      tokenHash,
      type,
      usedAt: null,
      expiresAt: { $gt: now },
    });
  }

  /**
   * Atomically consumes a token, marking usedAt
   * Returns the consumed token doc or null if invalid/already used/expired
   * @param {object} filter
   * @param {string} filter.tokenHash
   * @param {string} filter.type
   * @param {Date} [filter.now=new Date()]
   * @param {object} [options]
   * @param {import('mongoose').ClientSession} [options.session]
   * @returns {Promise<import('../models/auth-token.model.js').AuthToken|null>}
   */
  async consumeToken({ tokenHash, type, now = new Date() }, { session } = {}) {
    return AuthToken.findOneAndUpdate(
      {
        tokenHash,
        type,
        usedAt: null,
        expiresAt: { $gt: now },
      },
      {
        $set: {
          usedAt: now,
        },
      },
      {
        new: true,
        session,
      }
    );
  }

  /**
   * Invalidates all active tokens of a specific type for a user (used upon re-issuance)
   * @param {object} filter
   * @param {string|import('mongoose').Types.ObjectId} filter.userId
   * @param {string} filter.type
   * @param {Date} [filter.now=new Date()]
   * @param {object} [options]
   * @param {import('mongoose').ClientSession} [options.session]
   * @returns {Promise<import('mongoose').UpdateWriteOpResult>}
   */
  async invalidateActiveTokens({ userId, type, now = new Date() }, { session } = {}) {
    return AuthToken.updateMany(
      {
        userId,
        type,
        usedAt: null,
      },
      {
        $set: {
          usedAt: now,
        },
      },
      { session }
    );
  }
}

export const authTokenRepository = new AuthTokenRepository();
export default authTokenRepository;
