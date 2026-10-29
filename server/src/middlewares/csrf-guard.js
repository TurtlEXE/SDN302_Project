import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

/**
 * Returns list of allowed origins based on environment
 * @returns {string[]}
 */
export function getAllowedOrigins() {
  const allowed = [env.CLIENT_ORIGIN];
  if (env.NODE_ENV !== 'production') {
    allowed.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  return allowed;
}

/**
 * Auth Request Guard Middleware for Auth POST endpoints.
 * Enforces:
 * 1. X-CSRF-Guard: 1 header is present and valid.
 * 2. Origin header is present and in the allowlist (blocks missing, 'null', or unauthorized origins).
 * 3. Content-Type is application/json for requests with a body.
 */
export function csrfGuard(req, res, next) {
  // 1. Validate X-CSRF-Guard custom header
  const guardHeader = req.headers['x-csrf-guard'];
  if (guardHeader !== '1') {
    return next(
      new AppError(
        'Yêu cầu thiếu hoặc sai header bảo vệ X-CSRF-Guard: 1',
        403,
        ERROR_CODES.CSRF_GUARD_TRIGGERED
      )
    );
  }

  // 2. Validate Origin header
  const origin = req.headers.origin;
  if (!origin || origin === 'null') {
    return next(
      new AppError(
        'Header Origin không hợp lệ hoặc bị thiếu',
        403,
        ERROR_CODES.CSRF_GUARD_TRIGGERED
      )
    );
  }

  const allowedOrigins = getAllowedOrigins();
  if (!allowedOrigins.includes(origin)) {
    return next(
      new AppError(
        `Origin '${origin}' không được phép truy cập theo chính sách CORS/CSRF`,
        403,
        ERROR_CODES.CSRF_GUARD_TRIGGERED
      )
    );
  }

  // 3. Validate Content-Type for requests with payload
  const hasBody = req.body && Object.keys(req.body).length > 0;
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (hasBody || contentLength > 0) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return next(
        new AppError(
          'Định dạng yêu cầu không hợp lệ. Phải là application/json',
          403,
          ERROR_CODES.CSRF_GUARD_TRIGGERED
        )
      );
    }
  }

  next();
}

export default csrfGuard;
