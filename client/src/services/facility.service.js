import { apiClient } from './api-client.js';

export const facilityService = {
  /**
   * Search and list published facilities with pagination & filters
   * @param {Object} queryParams
   * @param {string} [queryParams.keyword]
   * @param {string} [queryParams.province]
   * @param {string} [queryParams.sportId]
   * @param {number} [queryParams.minPrice]
   * @param {number} [queryParams.maxPrice]
   * @param {string} [queryParams.sort]
   * @param {number} [queryParams.page=1]
   * @param {number} [queryParams.limit=12]
   */
  async getPublicFacilities(queryParams = {}) {
    const params = new URLSearchParams();

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get(`/facilities${queryString}`);
    return {
      success: true,
      data: res?.data || [],
      pagination: res?.pagination || {
        page: 1,
        limit: 12,
        total: 0,
        totalPages: 1,
        hasPrev: false,
        hasNext: false,
      },
    };
  },

  /**
   * Get public facility details by ID (images, facilitySports, active courts)
   * @param {string} id
   */
  async getPublicFacilityById(id) {
    return apiClient.get(`/facilities/${id}`);
  },

  /**
   * Get consolidated facility schedule by ID and date (B04)
   * @param {string} id - facilityId
   * @param {string} date - 'YYYY-MM-DD'
   */
  async getFacilitySchedule(id, date) {
    return apiClient.get(`/facilities/${id}/schedule?date=${encodeURIComponent(date)}`);
  },
};
