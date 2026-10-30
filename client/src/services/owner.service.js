import { apiClient } from './api-client.js';

export const ownerService = {
  // ==========================================
  // DASHBOARD
  // ==========================================
  async getDashboard(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get(`/owner/dashboard${qs}`);
  },

  // ==========================================
  // FACILITIES
  // ==========================================
  async listFacilities() {
    return apiClient.get('/owner/facilities');
  },

  async getFacilityById(id) {
    return apiClient.get(`/owner/facilities/${id}`);
  },

  async createFacility(data) {
    return apiClient.post('/owner/facilities', data);
  },

  async updateFacility(id, data) {
    return apiClient.patch(`/owner/facilities/${id}`, data);
  },

  async uploadFacilityImage(id, file) {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post(`/owner/facilities/${id}/images`, formData, { isFormData: true });
  },

  async deleteFacilityImage(facilityId, imageId) {
    return apiClient.delete(`/owner/facilities/${facilityId}/images/${imageId}`);
  },

  async setCoverImage(facilityId, imageId) {
    return apiClient.patch(`/owner/facilities/${facilityId}/images/${imageId}/set-cover`);
  },

  // ==========================================
  // FACILITY SPORTS & SLOT STEPS
  // ==========================================
  async listFacilitySports(facilityId) {
    return apiClient.get(`/owner/facilities/${facilityId}/sports`);
  },

  async addFacilitySport(facilityId, data) {
    return apiClient.post(`/owner/facilities/${facilityId}/sports`, data);
  },

  async updateFacilitySportStep(facilityId, facilitySportId, data) {
    return apiClient.patch(
      `/owner/facilities/${facilityId}/sports/${facilitySportId}`,
      data
    );
  },

  // ==========================================
  // COURTS
  // ==========================================
  async listCourts(facilityId) {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    return apiClient.get(`/owner/courts${qs}`);
  },

  async createCourt(data) {
    return apiClient.post('/owner/courts', data);
  },

  async updateCourt(id, data) {
    return apiClient.patch(`/owner/courts/${id}`, data);
  },

  // ==========================================
  // COURT BLOCKS (MAINTENANCE)
  // ==========================================
  async listCourtBlocks(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get(`/owner/court-blocks${qs}`);
  },

  async createCourtBlock(data) {
    return apiClient.post('/owner/court-blocks', data);
  },

  async deleteCourtBlock(id) {
    return apiClient.delete(`/owner/court-blocks/${id}`);
  },

  // ==========================================
  // BOOKINGS OPERATIONS
  // ==========================================
  async listBookings(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
    });
    const qs = q.toString() ? `?${q.toString()}` : '';
    return apiClient.get(`/owner/bookings${qs}`);
  },

  async getBookingById(id) {
    return apiClient.get(`/owner/bookings/${id}`);
  },

  async completeBooking(id, note) {
    return apiClient.post(`/owner/bookings/${id}/complete`, { note });
  },

  async markNoShowBooking(id, reason) {
    return apiClient.post(`/owner/bookings/${id}/no-show`, { reason });
  },

  async cancelBookingRequest(bookingRequestId, reason) {
    return apiClient.post(`/owner/booking-requests/${bookingRequestId}/cancel`, {
      reason,
    });
  },

  // ==========================================
  // ON-BEHALF BOOKING (WALK-IN)
  // ==========================================
  async createOnBehalfBooking(data) {
    return apiClient.post('/owner/bookings/on-behalf', data);
  },
};

export default ownerService;
