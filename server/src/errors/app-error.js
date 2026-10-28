import { ERROR_CODES } from './error-codes.js';

/**
 * Custom Operational Application Error class
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [errorCode=ERROR_CODES.INTERNAL_SERVER_ERROR] - Standard business error code
   * @param {Array<{field?: string, message: string}>} [details=[]] - Optional validation or error details
   * @param {boolean} [isOperational=true] - Indicates if error is operational/expected
   */
  constructor(
    message,
    statusCode = 500,
    errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    details = [],
    isOperational = true
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = Array.isArray(details) ? details : [];
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Yêu cầu không hợp lệ', errorCode = ERROR_CODES.VALIDATION_ERROR, details = []) {
    return new AppError(message, 400, errorCode, details);
  }

  static unauthorized(message = 'Chưa đăng nhập hoặc phiên không hợp lệ', errorCode = ERROR_CODES.UNAUTHORIZED, details = []) {
    return new AppError(message, 401, errorCode, details);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này', errorCode = ERROR_CODES.FORBIDDEN, details = []) {
    return new AppError(message, 403, errorCode, details);
  }

  static notFound(message = 'Không tìm thấy tài nguyên yêu cầu', errorCode = ERROR_CODES.NOT_FOUND, details = []) {
    return new AppError(message, 404, errorCode, details);
  }

  static conflict(message = 'Xung đột dữ liệu hoặc trạng thái', errorCode = ERROR_CODES.SCHEDULE_CONFLICT, details = []) {
    return new AppError(message, 409, errorCode, details);
  }

  static validationError(message = 'Dữ liệu đầu vào không hợp lệ', details = []) {
    return new AppError(message, 422, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static internal(message = 'Lỗi máy chủ nội bộ', errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR) {
    return new AppError(message, 500, errorCode, [], false);
  }
}

