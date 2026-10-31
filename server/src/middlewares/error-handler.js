import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

/**
 * Global centralized error handling middleware for Express
 */
export function errorHandler(err, req, res, next) {
  let error = err;

  // Handle SyntaxError from invalid JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = AppError.badRequest('Dữ liệu JSON trong request body không đúng định dạng', ERROR_CODES.VALIDATION_ERROR);
  }

  // Handle Mongoose CastError / ValidationError
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = AppError.validationError('Dữ liệu không thỏa mãn validation', details);
  }

  if (err.name === 'CastError') {
    error = AppError.badRequest(`Giá trị không hợp lệ cho trường '${err.path}'`, ERROR_CODES.VALIDATION_ERROR, [
      { field: err.path, message: `Giá trị '${err.value}' không đúng kiểu` },
    ]);
  }

  // Handle Mongo duplicate key error (E11000) - INT-05 fix
  if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
    error = AppError.conflict(
      'Dữ liệu bị trùng lặp hoặc yêu cầu đang được xử lý đồng thời. Vui lòng thử lại.',
      ERROR_CODES.SCHEDULE_CONFLICT
    );
  }

  // Fallback for non-AppError
  if (!(error instanceof AppError)) {
    const statusCode = error.statusCode || error.status || 500;
    const message = error.message || 'Lỗi máy chủ nội bộ';
    error = new AppError(message, statusCode, ERROR_CODES.INTERNAL_SERVER_ERROR, [], false);
  }

  // Log error
  if (error.statusCode >= 500) {
    logger.error(`[Unhandled Error] ${req.method} ${req.originalUrl}: ${error.message}`, {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      stack: error.stack,
    });
  } else {
    logger.warn(`[Client Error] ${req.method} ${req.originalUrl}: ${error.message}`, {
      statusCode: error.statusCode,
      errorCode: error.errorCode,
      details: error.details,
    });
  }

  const responsePayload = {
    success: false,
    error: {
      code: error.errorCode,
      message: error.message,
      details: error.details || [],
    },
  };

  // Add stack trace in development mode for debugging
  if (process.env.NODE_ENV !== 'production' && env.NODE_ENV === 'development' && error.stack) {
    responsePayload.error.stack = error.stack;
  }

  return res.status(error.statusCode).json(responsePayload);
}

