import { apiClient } from './api-client.js';

export const paymentService = {
  /**
   * Re-generate / get payment URL for pending payment order (PAY-01)
   * @param {string} paymentOrderId
   */
  async createPaymentUrl(paymentOrderId) {
    return apiClient.post('/payments/create-url', { paymentOrderId });
  },

  /**
   * Get payment order info by bookingRequestId (PAY-02)
   * @param {string} bookingRequestId
   */
  async getPaymentOrderByBookingRequestId(bookingRequestId) {
    return apiClient.get(`/payments/order/${bookingRequestId}`);
  },

  /**
   * Process VNPay return parameters through backend verification (PAY-03, Section 10.5)
   * Backend verifies HMAC-SHA512 signature authoritatively.
   * @param {URLSearchParams|string|Object} params
   */
  async processVNPayReturn(params) {
    let queryString = '';
    if (params instanceof URLSearchParams) {
      queryString = params.toString();
    } else if (typeof params === 'string') {
      queryString = params.startsWith('?') ? params.slice(1) : params;
    } else if (params && typeof params === 'object') {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          searchParams.append(key, String(val));
        }
      });
      queryString = searchParams.toString();
    }

    return apiClient.get(`/payments/vnpay-return?${queryString}`);
  },

  /**
   * Get guest payment order details with secret accessCode (OWN-08, Criterion 52)
   * @param {string} paymentOrderId
   * @param {string} accessCode
   */
  async getGuestPaymentOrder(paymentOrderId, accessCode) {
    return apiClient.get(`/payments/guest-order/${paymentOrderId}?accessCode=${accessCode}`);
  },
};

export default paymentService;

