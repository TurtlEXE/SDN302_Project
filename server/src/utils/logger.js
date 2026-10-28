/**
 * Centralized Application Logger with sensitive data masking
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'tokenhash',
  'accesstoken',
  'refreshtoken',
  'cookie',
  'authorization',
  'x-csrf-guard',
  'secret',
  'vnp_securehash',
  'vnp_hashsecret',
]);

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Recursively masks sensitive fields in objects, arrays, and strings
 * @param {*} data
 * @param {number} depth
 * @returns {*}
 */
export function sanitize(data, depth = 0) {
  if (depth > 8 || data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    // Mask Bearer tokens if present in string
    if (/bearer\s+[a-zA-Z0-9._-]+/i.test(data)) {
      return data.replace(/bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, depth + 1));
  }

  if (typeof data === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitize(value, depth + 1);
      }
    }
    return clean;
  }

  return data;
}

class Logger {
  constructor(level = process.env.LOG_LEVEL || 'info') {
    this.currentLevel = LOG_LEVELS[level.toLowerCase()] ?? LOG_LEVELS.info;
  }

  setLevel(level) {
    if (level && LOG_LEVELS[level.toLowerCase()] !== undefined) {
      this.currentLevel = LOG_LEVELS[level.toLowerCase()];
    }
  }

  _format(level, message, meta) {
    const timestamp = new Date().toISOString();
    const sanitizedMeta = meta !== undefined ? sanitize(meta) : '';
    const metaString = sanitizedMeta ? ` ${JSON.stringify(sanitizedMeta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaString}`;
  }

  debug(message, meta) {
    if (this.currentLevel <= LOG_LEVELS.debug) {
      console.debug(this._format('debug', message, meta));
    }
  }

  info(message, meta) {
    if (this.currentLevel <= LOG_LEVELS.info) {
      console.info(this._format('info', message, meta));
    }
  }

  warn(message, meta) {
    if (this.currentLevel <= LOG_LEVELS.warn) {
      console.warn(this._format('warn', message, meta));
    }
  }

  error(message, meta) {
    if (this.currentLevel <= LOG_LEVELS.error) {
      console.error(this._format('error', message, meta));
    }
  }
}

export const logger = new Logger();

