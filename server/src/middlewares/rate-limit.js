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

// In-memory store for email resend cooldowns (email -> lastTimestampMs)
const emailCooldownMap = new Map();

/**
 * Middleware enforcing 60-second cooldown per email address
 */
export function emailCooldownMiddleware(req, res, next) {
  const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : null;
  if (!email) {
    return next();
  }

  const now = Date.now();
  const lastRequested = emailCooldownMap.get(email);
  const cooldownMs = 60 * 1000;

  if (lastRequested && now - lastRequested < cooldownMs) {
    const remainingSeconds = Math.ceil((cooldownMs - (now - lastRequested)) / 1000);
    return res.status(429).json({
      success: false,
      error: {
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: `Mỗi lần yêu cầu gửi lại email phải cách nhau ít nhất 60 giây. Vui lòng thử lại sau ${remainingSeconds} giây.`,
        details: [{ field: 'email', remainingSeconds }],
      },
    });
  }

  res.on('finish', () => {
    if (res.statusCode < 400) {
      emailCooldownMap.set(email, Date.now());
    }
  });

  next();
}

/**
 * Resets the in-memory email cooldown map (primarily for testing)
 */
export function clearEmailCooldowns() {
  emailCooldownMap.clear();
}
