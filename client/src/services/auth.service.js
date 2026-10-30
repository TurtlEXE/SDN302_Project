import { apiClient } from './api-client.js';
import { tokenMemory } from './token-memory.js';

export const authService = {
  /**
   * Login with email and password
   */
  async login({ email, password }) {
    const res = await apiClient.post('/auth/login', { email, password });
    const { accessToken, user } = res.data;
    tokenMemory.setToken(accessToken);
    tokenMemory.broadcast('LOGIN', { user });
    return { user, accessToken };
  },

  /**
   * Register customer account
   */
  async register({ email, password, fullName, phoneNumber }) {
    const res = await apiClient.post('/auth/register', {
      email,
      password,
      fullName,
      phoneNumber,
    });
    return res.data;
  },

  /**
   * Silent session refresh on app startup or token renewal
   */
  async refresh() {
    const res = await apiClient.post('/auth/refresh', {});
    const { accessToken } = res.data;
    tokenMemory.setToken(accessToken);

    // Fetch user profile after setting token
    const userRes = await apiClient.get('/users/me');
    return { user: userRes.data, accessToken };
  },

  /**
   * Logout current session
   */
  async logout() {
    try {
      await apiClient.post('/auth/logout', {});
    } catch {
      // Even if server call fails, clean local memory
    } finally {
      tokenMemory.clearToken();
      tokenMemory.broadcast('LOGOUT');
    }
  },

  /**
   * Logout from all devices & active sessions
   */
  async logoutAll() {
    try {
      await apiClient.post('/auth/logout-all', {});
    } catch {
      // Clean local memory regardless
    } finally {
      tokenMemory.clearToken();
      tokenMemory.broadcast('SESSION_REVOKED');
    }
  },

  /**
   * Get current authenticated user profile
   */
  async getMe() {
    const res = await apiClient.get('/users/me');
    return res.data;
  },

  /**
   * Update personal profile (fullName, phoneNumber)
   */
  async updateProfile({ fullName, phoneNumber }) {
    const res = await apiClient.patch('/users/me', { fullName, phoneNumber });
    return res.data;
  },

  /**
   * Change current password
   */
  async changePassword({ oldPassword, newPassword }) {
    const res = await apiClient.post('/auth/change-password', {
      oldPassword,
      newPassword,
    });
    return res.data;
  },

  /**
   * Confirm email verification (single-use POST action)
   */
  async verifyEmail(token) {
    const res = await apiClient.post('/auth/verify-email', { token });
    return res.data;
  },

  /**
   * Owner activates account and sets first password (single-use POST action)
   */
  async activateOwner({ token, password, fullName, phoneNumber }) {
    const res = await apiClient.post('/auth/activate-owner', {
      token,
      password,
      fullName,
      phoneNumber,
    });
    return res.data;
  },

  /**
   * Request password reset link
   */
  async forgotPassword(email) {
    const res = await apiClient.post('/auth/forgot-password', { email });
    return res.data;
  },

  /**
   * Set new password with reset token (single-use POST action)
   */
  async resetPassword({ token, newPassword }) {
    const res = await apiClient.post('/auth/reset-password', {
      token,
      newPassword,
    });
    return res.data;
  },
};

