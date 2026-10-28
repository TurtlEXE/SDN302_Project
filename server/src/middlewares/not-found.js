import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

/**
 * 404 Not Found Middleware
 */
export function notFound(req, res, next) {
  const message = `Đường dẫn [${req.method}] ${req.originalUrl} không tồn tại trên hệ thống.`;
  next(new AppError(message, 404, ERROR_CODES.NOT_FOUND));
}

