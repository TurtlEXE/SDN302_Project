import { env } from '../config/env.js';

/**
 * Cookie options for the refresh token
 * @param {number} maxAgeMs - Time to live in milliseconds
 * @returns {import('express').CookieOptions}
 */
export function getRefreshCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: env.REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
  };
}

/**
 * Cookie options for clearing the refresh token
 * @returns {import('express').CookieOptions}
 */
export function getClearRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: env.REFRESH_COOKIE_PATH,
  };
}

/**
 * Sets the refresh token cookie on the response
 * @param {import('express').Response} res
 * @param {string} rawToken
 * @param {Date} absoluteExpiresAt
 */
export function setRefreshCookie(res, rawToken, absoluteExpiresAt) {
  const maxAgeMs = Math.max(0, absoluteExpiresAt.getTime() - Date.now());
  res.cookie(env.REFRESH_COOKIE_NAME, rawToken, getRefreshCookieOptions(maxAgeMs));
}

/**
 * Clears the refresh token cookie from the response
 * @param {import('express').Response} res
 */
export function clearRefreshCookie(res) {
  res.clearCookie(env.REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
}

export default {
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,
  setRefreshCookie,
  clearRefreshCookie,
};
