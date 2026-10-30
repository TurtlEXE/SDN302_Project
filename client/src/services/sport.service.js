import { apiClient } from './api-client.js';

export const sportService = {
  /**
   * Get active sports catalog
   * @returns {Promise<Array>}
   */
  async getPublicSports() {
    const res = await apiClient.get('/sports');
    return res.data || [];
  },
};

