import { apiClient } from './api-client.js';

export const courtService = {
  /**
   * Get court schedule for a specific date (PUB-04, Criteria 28, 29, 30, 31)
   * @param {string} courtId
   * @param {string} date - 'YYYY-MM-DD'
   * @param {string} [role=null] - Optional role filter ('CUSTOMER' or 'OWNER')
   * @returns {Promise<Object>} CourtScheduleDTO
   */
  async getCourtSchedule(courtId, date, role = null) {
    const params = new URLSearchParams({ date });
    if (role) {
      params.set('role', role);
    }
    const res = await apiClient.get(`/courts/${courtId}/schedule?${params.toString()}`);
    return res.data;
  },
};

