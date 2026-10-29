import crypto from 'crypto';
import { authTokenRepository } from '../repositories/auth-token.repository.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export const TOKEN_TYPES = Object.freeze({
  VERIFY_EMAIL: 'VERIFY_EMAIL',
  ACTIVATE_OWNER: 'ACTIVATE_OWNER',
  RESET_PASSWORD: 'RESET_PASSWORD',
});

// Default expirations in minutes
export const TOKEN_EXPIRATIONS_MINUTES = Object.freeze({
  VERIFY_EMAIL: 15,
  ACTIVATE_OWNER: 24 * 60, // 24 hours
  RESET_PASSWORD: 15,
});

export class AuthTokenService {
  constructor(repository = authTokenRepository) {
    this.repository = repository;
  }

  /**
   * Hashes a raw token string using SHA-256
   * @param {string} rawToken
   * @returns {string} Hex-encoded SHA-256 hash
   */
  hashToken(rawToken) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw AppError.badRequest('Token không được để trống.', ERROR_CODES.TOKEN_INVALID);
    }
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a single-use random token, stores its hash, and invalidates any previous active tokens
   * @param {object} options
   * @param {string|import('mongoose').Types.ObjectId} options.userId
   * @param {string} options.type - VERIFY_EMAIL | ACTIVATE_OWNER | RESET_PASSWORD
   * @param {number} [options.customExpiresInMinutes]
   * @param {object} [context]
   * @param {import('mongoose').ClientSession} [context.session]
   * @returns {Promise<{ token: string, tokenHash: string, type: string, expiresAt: Date, doc: object }>}
   */
  async generateToken({ userId, type, customExpiresInMinutes }, { session } = {}) {
    if (!TOKEN_TYPES[type]) {
      throw AppError.badRequest(`Mục đích token [${type}] không hợp lệ.`, ERROR_CODES.VALIDATION_ERROR);
    }

    const durationMinutes = customExpiresInMinutes || TOKEN_EXPIRATIONS_MINUTES[type];
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    // Invalidate existing active tokens for this user and type (re-issuance rule)
    await this.repository.invalidateActiveTokens({ userId, type }, { session });

    // Generate 32 bytes cryptographically secure random token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const doc = await this.repository.createToken(
      {
        userId,
        type,
        tokenHash,
        expiresAt,
      },
      { session }
    );

    return {
      token: rawToken,
      tokenHash,
      type,
      expiresAt,
      doc,
    };
  }

  /**
   * Inspects token validity WITHOUT consuming it (for GET link checks or pre-validation)
   * @param {object} options
   * @param {string} options.token - Raw token
   * @param {string} options.type - Expected type
   * @returns {Promise<{ valid: boolean, userId: import('mongoose').Types.ObjectId, type: string, expiresAt: Date }>}
   */
  async inspectToken({ token, type }) {
    if (!TOKEN_TYPES[type]) {
      throw AppError.badRequest(`Mục đích token [${type}] không hợp lệ.`, ERROR_CODES.VALIDATION_ERROR);
    }

    const tokenHash = this.hashToken(token);
    const doc = await this.repository.findTokenByHash({ tokenHash, type });

    if (!doc) {
      throw AppError.badRequest('Liên kết xác thực không hợp lệ hoặc không tồn tại.', ERROR_CODES.TOKEN_INVALID);
    }

    if (doc.usedAt) {
      throw AppError.badRequest(
        'Liên kết này đã được sử dụng trước đó. Mỗi liên kết chỉ dùng được 1 lần.',
        ERROR_CODES.TOKEN_ALREADY_USED
      );
    }

    if (doc.expiresAt <= new Date()) {
      throw AppError.badRequest(
        'Liên kết đã hết thời gian hiệu lực. Vui lòng yêu cầu liên kết mới.',
        ERROR_CODES.TOKEN_EXPIRED
      );
    }

    return {
      valid: true,
      userId: doc.userId,
      type: doc.type,
      expiresAt: doc.expiresAt,
    };
  }

  /**
   * Atomically consumes a token (must be called via POST action)
   * @param {object} options
   * @param {string} options.token - Raw token
   * @param {string} options.type - Expected purpose
   * @param {object} [context]
   * @param {import('mongoose').ClientSession} [context.session]
   * @returns {Promise<import('../models/auth-token.model.js').AuthToken>}
   */
  async consumeToken({ token, type }, { session } = {}) {
    if (!TOKEN_TYPES[type]) {
      throw AppError.badRequest(`Mục đích token [${type}] không hợp lệ.`, ERROR_CODES.VALIDATION_ERROR);
    }

    const tokenHash = this.hashToken(token);

    // Atomic update: only succeeds if usedAt is null and expiresAt > now
    const consumed = await this.repository.consumeToken({ tokenHash, type }, { session });

    if (!consumed) {
      // Find out why it failed to provide accurate feedback
      const existing = await this.repository.findTokenByHash({ tokenHash, type });
      if (!existing) {
        throw AppError.badRequest('Mã xác thực không hợp lệ hoặc không tồn tại.', ERROR_CODES.TOKEN_INVALID);
      }
      if (existing.usedAt) {
        throw AppError.badRequest('Liên kết này đã được sử dụng trước đó.', ERROR_CODES.TOKEN_ALREADY_USED);
      }
      if (existing.expiresAt <= new Date()) {
        throw AppError.badRequest('Liên kết đã hết thời gian hiệu lực. Vui lòng yêu cầu liên kết mới.', ERROR_CODES.TOKEN_EXPIRED);
      }
      throw AppError.badRequest('Mã xác thực không hợp lệ.', ERROR_CODES.TOKEN_INVALID);
    }

    return consumed;
  }
}

export const authTokenService = new AuthTokenService();
export default authTokenService;
