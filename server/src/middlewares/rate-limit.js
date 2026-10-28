import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../errors/error-codes.js';
import { env } from '../config/env.js';

/**
 * Creates an Express rate limiter middleware
 * @param {object} options
 * @param {number} [options.windowMs]
 * @param {number} [options.max]
 * @param {string} [options.message]
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || env.RATE_LIMIT_WINDOW_MS;
  const max = options.max || env.RATE_LIMIT_MAX_REQUESTS;
  const message = options.message || 'Bạn đã gửi quá nhiều yêu cầu trong khoảng thời gian ngắn. Vui lòng thử lại sau.';

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message,
          details: [],
        },
      });
    },
  });
}

export const generalRateLimiter = createRateLimiter();

