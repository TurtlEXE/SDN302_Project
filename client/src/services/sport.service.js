import { apiClient } from './api-client.js';

export const sportService = {
  /**
   * Get active sports catalog
   * @returns {Promise<{ success: boolean, data: Array }>}
   */
  async getPublicSports() {
    const res = await apiClient.get('/sports');
    const data = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    return {
      success: true,
      data,
    };
  },
};

