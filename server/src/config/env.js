import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory or project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Validates and parses environment variables
 * @param {NodeJS.ProcessEnv} [source=process.env]
 * @returns {Record<string, any>}
 */
export function validateEnv(source = process.env) {
  const nodeEnv = source.NODE_ENV || 'development';
  const errors = [];

  const env = {
    NODE_ENV: nodeEnv,
    PORT: parseInt(source.PORT || '5000', 10),
    API_PREFIX: source.API_PREFIX || '/api/v1',
    CLIENT_ORIGIN: source.CLIENT_ORIGIN || 'http://localhost:3000',
    MONGODB_URI: source.MONGODB_URI || 'mongodb://127.0.0.1:27017/sport_booking',
    MONGODB_TEST_URI: source.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/sport_booking_test',
    JWT_ACCESS_SECRET: source.JWT_ACCESS_SECRET || (nodeEnv === 'production' ? '' : 'dev_jwt_access_secret_min_32_characters_long_for_test'),
    JWT_ACCESS_EXPIRES_IN: source.JWT_ACCESS_EXPIRES_IN || '10m',
    JWT_ISSUER: source.JWT_ISSUER || 'sport-booking',
    JWT_AUDIENCE: source.JWT_AUDIENCE || 'sport-booking-client',
    REFRESH_COOKIE_NAME: source.REFRESH_COOKIE_NAME || 'refresh_token',
    REFRESH_COOKIE_PATH: source.REFRESH_COOKIE_PATH || '/api/v1/auth',
    SESSION_MAX_AGE_DAYS: parseInt(source.SESSION_MAX_AGE_DAYS || '7', 10),
    VNPAY_TMN_CODE: source.VNPAY_TMN_CODE || 'SANDBOX_TMN_CODE',
    VNPAY_HASH_SECRET: source.VNPAY_HASH_SECRET || 'SANDBOX_HASH_SECRET_KEY',
    VNPAY_URL: source.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    VNPAY_RETURN_URL: source.VNPAY_RETURN_URL || 'http://localhost:3000/payment/result',
    VNPAY_IPN_URL: source.VNPAY_IPN_URL || 'https://sandbox.sportbooking.local/api/v1/payments/vnpay-ipn',
    SMTP_HOST: source.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
    SMTP_PORT: parseInt(source.SMTP_PORT || '2525', 10),
    SMTP_USER: source.SMTP_USER || '',
    SMTP_PASS: source.SMTP_PASS || '',
    SMTP_FROM: source.SMTP_FROM || 'SportBooking <no-reply@sportbooking.local>',
    STORAGE_DRIVER: source.STORAGE_DRIVER || 'local',
    STORAGE_LOCAL_PATH: source.STORAGE_LOCAL_PATH || './uploads',
    STORAGE_MAX_FILE_SIZE_MB: parseInt(source.STORAGE_MAX_FILE_SIZE_MB || '5', 10),
    RATE_LIMIT_WINDOW_MS: parseInt(source.RATE_LIMIT_WINDOW_MS || '900000', 10),
    RATE_LIMIT_MAX_REQUESTS: parseInt(source.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    LOG_LEVEL: source.LOG_LEVEL || 'info',
  };

  if (isNaN(env.PORT) || env.PORT <= 0 || env.PORT > 65535) {
    errors.push('PORT must be a valid port number between 1 and 65535.');
  }

  if (nodeEnv === 'production') {
    if (!source.JWT_ACCESS_SECRET || source.JWT_ACCESS_SECRET.length < 32) {
      errors.push('JWT_ACCESS_SECRET is required and must be at least 32 characters in production.');
    }
    if (!source.MONGODB_URI) {
      errors.push('MONGODB_URI is required in production.');
    }
  }

  if (errors.length > 0) {
    const errorMsg = `Environment configuration error:\n- ${errors.join('\n- ')}`;
    throw new Error(errorMsg);
  }

  return Object.freeze(env);
}

export const env = validateEnv();
