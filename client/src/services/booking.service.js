import { apiClient } from './api-client.js';

export const bookingService = {
  /**
   * Create a customer booking request with 10-minute hold (CUS-01, Criterion 46)
   * @param {Object} payload
   * @param {string} payload.courtId
   * @param {string} payload.bookingDate - 'YYYY-MM-DD'
   * @param {number} [payload.configVersion]
   * @param {Array<{ startTime: string, endTime: string }>} payload.selectedSlots
   * @param {string} payload.contactName
   * @param {string} payload.contactPhone
   * @param {string} payload.idempotencyKey
   */
  async createBookingRequest(payload) {
    return apiClient.post('/booking-requests', payload);
  },

  /**
   * Get booking request details and child bookings (CUS-01, CUS-02)
   * @param {string} id - bookingRequestId
   */
  async getBookingRequestById(id) {
    return apiClient.get(`/booking-requests/${id}`);
  },

  /**
   * Cancel pending booking request and release slots (CUS-03, Criterion 49)
   * @param {string} id - bookingRequestId
   * @param {string} [reason]
   */
  async cancelBookingRequest(id, reason = 'Khách hàng hủy yêu cầu giữ chỗ.') {
    return apiClient.post(`/booking-requests/${id}/cancel`, { reason });
  },

  /**
   * List customer's own bookings with filter & pagination (CUS-02)
   * @param {Object} queryParams
   * @param {string} [queryParams.status] - 'UPCOMING' | 'HISTORY' | 'CONFIRMED' | 'PENDING_PAYMENT' etc.
   * @param {number} [queryParams.page=1]
   * @param {number} [queryParams.limit=10]
   */
  async getMyBookings(queryParams = {}) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get(`/bookings${queryString}`);
  },

  /**
   * Get booking detail by bookingId (CUS-02)
   * @param {string} id - bookingId
   */
  async getBookingById(id) {
    return apiClient.get(`/bookings/${id}`);
  },
};

export default bookingService;

