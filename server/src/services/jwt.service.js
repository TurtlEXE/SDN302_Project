import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

export const jwtService = {
  /**
   * Signs an access JWT with standard claims and 10 minutes expiry.
   * @param {object} user - User document or object with _id, tokenVersion, role
   * @param {object} session - AuthSession document or object with _id
   * @returns {{ accessToken: string, expiresInSeconds: number }}
   */
  signAccessToken(user, session) {
    const payload = {
      sub: user._id.toString(),
      sid: session._id.toString(),
      ver: user.tokenVersion,
      role: user.role,
      type: 'access',
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    return {
      accessToken,
      expiresInSeconds: 600, // 10 minutes
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
