import { env } from './env.js';
import { AppError } from '../errors/app-error.js';
import { ERROR_CODES } from '../errors/error-codes.js';

/**
 * CORS Configuration options
 */
export const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. server-to-server, curl, tests) when origin is undefined
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [env.CLIENT_ORIGIN];
    // In local development or testing, also allow localhost variants if configured
    if (env.NODE_ENV !== 'production') {
      allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new AppError(
        `Origin '${origin}' không được phép truy cập theo chính sách CORS.`,
        403,
        ERROR_CODES.CSRF_GUARD_TRIGGERED
      )
    );
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Guard', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
  maxAge: 86400, // 24 hours preflight cache
};

export default corsOptions;
