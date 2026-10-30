/**
 * In-Memory Access Token Storage
 * 
 * Strict Architectural Rule (Mục 10 Architecture & AGENTS.md):
 * - Access Token is strictly held in RAM memory.
 * - NEVER written to localStorage or sessionStorage to prevent XSS exfiltration.
 * - Refresh Token is held in an HttpOnly, SameSite=Lax cookie managed exclusively by the browser.
 */

let memoryAccessToken = null;

// Multi-tab synchronization channel
let authChannel = null;
try {
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    authChannel = new BroadcastChannel('sport_booking_auth');
  }
} catch {
  // Graceful fallback if BroadcastChannel is blocked
  authChannel = null;
}

export const tokenMemory = {
  /**
   * Get current in-memory access token
   * @returns {string | null}
   */
  getToken() {
    return memoryAccessToken;
  },

  /**
   * Set access token in memory
   * @param {string | null} token
   */
  setToken(token) {
    memoryAccessToken = token || null;
  },

  /**
   * Clear access token from memory
   */
  clearToken() {
    memoryAccessToken = null;
  },

  /**
   * Check if token is currently present
   * @returns {boolean}
   */
  hasToken() {
    return Boolean(memoryAccessToken);
  },

  /**
   * Broadcast an auth event to other browser tabs
   * @param {'LOGOUT' | 'LOGIN' | 'SESSION_REVOKED'} type 
   * @param {any} [payload]
   */
  broadcast(type, payload = {}) {
    if (authChannel) {
      try {
        authChannel.postMessage({ type, payload, timestamp: Date.now() });
      } catch {
        // Broadcast silent failure
      }
    }
  },

  /**
   * Listen for auth events from other browser tabs
   * @param {(event: { type: string, payload: any }) => void} callback
   * @returns {() => void} Unsubscribe function
   */
  onBroadcast(callback) {
    if (!authChannel) return () => {};

    const handler = (event) => {
      if (event.data && typeof callback === 'function') {
        callback(event.data);
      }
    };

    authChannel.addEventListener('message', handler);
    return () => authChannel.removeEventListener('message', handler);
  },
};

