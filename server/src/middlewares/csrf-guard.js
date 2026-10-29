import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

/**
 * CSRF Guard Middleware for Auth Mutation POST endpoints.
 * In Phase P04: Validates X-CSRF-Guard header when provided.
 * Full origin allowlist & mandatory request guard will be enforced in Phase P05.
 */
export function csrfGuard(req, res, next) {
  const guardHeader = req.headers['x-csrf-guard'];

  if (guardHeader !== undefined && guardHeader !== '1') {
    return next(
      new AppError(
        'Header bảo vệ CSRF X-CSRF-Guard không hợp lệ',
        403,
        ERROR_CODES.CSRF_GUARD_TRIGGERED
      )
    );
  }

  next();
}

export default csrfGuard;
