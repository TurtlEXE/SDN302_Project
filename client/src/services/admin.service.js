import { apiClient } from './api-client.js';

function buildQueryString(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      q.append(k, String(v));
    }
  });
  return q.toString() ? `?${q.toString()}` : '';
}

export const adminService = {
  // ==========================================
  // DASHBOARD (ADM-06)
  // ==========================================
  async getDashboard(params = {}) {
    return apiClient.get(`/admin/dashboard${buildQueryString(params)}`);
  },

  // ==========================================
  // USER MANAGEMENT (ADM-01, ADM-02)
  // ==========================================
  async listUsers(params = {}) {
    return apiClient.get(`/admin/users${buildQueryString(params)}`);
  },

  async getUserById(id) {
    return apiClient.get(`/admin/users/${id}`);
  },

  async provisionOwner(data) {
    return apiClient.post('/admin/users/owners', data);
  },

  async updateUser(id, data) {
    return apiClient.patch(`/admin/users/${id}`, data);
  },

  async resendOwnerInvitation(id) {
    return apiClient.post(`/admin/users/${id}/resend-invitation`);
  },

  async lockUser(id, reason) {
    return apiClient.patch(`/admin/users/${id}/lock`, { reason });
  },

  async unlockUser(id, reason) {
    return apiClient.patch(`/admin/users/${id}/unlock`, { reason });
  },

  async resetPassword(id) {
    return apiClient.post(`/admin/users/${id}/reset-password`);
  },

  async listActionLogs(params = {}) {
    return apiClient.get(`/admin/action-logs${buildQueryString(params)}`);
  },

  // ==========================================
  // SPORT CATALOG MANAGEMENT (ADM-03)
  // ==========================================
  async listSports(params = {}) {
    return apiClient.get(`/admin/sports${buildQueryString(params)}`);
  },

  async getSportById(id) {
    return apiClient.get(`/admin/sports/${id}`);
  },

  async createSport(data) {
    return apiClient.post('/admin/sports', data);
  },

  async updateSport(id, data) {
    return apiClient.patch(`/admin/sports/${id}`, data);
  },

  async deleteSport(id) {
    return apiClient.delete(`/admin/sports/${id}`);
  },

  // ==========================================
  // REFUNDS & PAYMENT EXCEPTIONS (ADM-05, Section 8.7, Criteria 13, 53, 54, 55)
  // ==========================================
  async listRefundCases(params = {}) {
    return apiClient.get(`/admin/refunds${buildQueryString(params)}`);
  },

  async getRefundCaseById(id) {
    return apiClient.get(`/admin/refunds/${id}`);
  },

  async recordManualRefund(id, data) {
    return apiClient.post(`/admin/refunds/${id}/record-manual-refund`, data);
  },

  async createExceptionRefund(data) {
    return apiClient.post('/admin/refunds/exception-refund', data);
  },

  async listPaymentTransactions(params = {}) {
    return apiClient.get(`/admin/payment-transactions${buildQueryString(params)}`);
  },

  async cancelAndRefundBooking(bookingId, reason) {
    return apiClient.post(`/admin/bookings/${bookingId}/cancel-and-refund`, { reason });
  },

  // ==========================================
  // EMAIL OUTBOX & RETRY (ADM-07, Criterion 43)
  // ==========================================
  async listEmailOutbox(params = {}) {
    return apiClient.get(`/admin/email-outbox${buildQueryString(params)}`);
  },

  async retryEmail(id) {
    return apiClient.post(`/admin/email-outbox/${id}/retry`);
  },

  // ==========================================
  // FACILITY & BOOKING OVERSIGHT (ADM-04, ADM-05)
  // ==========================================
  async listFacilities(params = {}) {
    return apiClient.get(`/admin/facilities${buildQueryString(params)}`);
  },

  async lockFacility(id, reason) {
    return apiClient.patch(`/admin/facilities/${id}/lock`, { reason });
  },

  async unlockFacility(id) {
    return apiClient.patch(`/admin/facilities/${id}/unlock`);
  },

  async listAdminBookings(params = {}) {
    return apiClient.get(`/admin/bookings${buildQueryString(params)}`);
  },

  async getAdminBookingById(id) {
    return apiClient.get(`/admin/bookings/${id}`);
  },
};

export default adminService;

