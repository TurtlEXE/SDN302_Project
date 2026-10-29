import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export const jwtService = {
  /**
   * Signs an access JWT with standard claims and 10 minutes expiry (capped by session absolute expiry).
   * @param {object} user - User document or object with _id, tokenVersion, role
   * @param {object} session - AuthSession document or object with _id, optional absoluteExpiresAt
   * @param {object} [options={}] - Optional overrides
   * @returns {{ accessToken: string, expiresInSeconds: number }}
   */
  signAccessToken(user, session, options = {}) {
    const payload = {
      sub: user._id.toString(),
      sid: session._id.toString(),
      ver: user.tokenVersion,
      role: user.role,
      type: 'access',
    };

    let expiresInSeconds = 600; // Default 10 minutes (600s)

    if (session?.absoluteExpiresAt) {
      const remainingSeconds = Math.max(
        1,
        Math.floor((new Date(session.absoluteExpiresAt).getTime() - Date.now()) / 1000)
      );
      expiresInSeconds = Math.min(600, remainingSeconds);
    }

    if (options.expiresInSeconds && typeof options.expiresInSeconds === 'number') {
      expiresInSeconds = options.expiresInSeconds;
    }

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: `${expiresInSeconds}s`,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    return {
      accessToken,
      expiresInSeconds,
    };
  },

  /**
   * Verifies an access JWT, enforcing HS256 algorithm, issuer, audience, and type='access'.
   * @param {string} token - Raw JWT string
   * @returns {object} Decoded payload
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      });

      if (decoded.type !== 'access') {
        throw new AppError('Loại token không hợp lệ', 401, ERROR_CODES.TOKEN_INVALID);
      }

      return decoded;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Access token đã hết hạn', 401, ERROR_CODES.ACCESS_TOKEN_EXPIRED);
      }
      throw new AppError('Token xác thực không hợp lệ hoặc chữ ký bị sai', 401, ERROR_CODES.TOKEN_INVALID);
    }
  },
};

export default jwtService;
