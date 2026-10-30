import { paymentService } from '../services/payment/payment.service.js';

/**
 * Controller for VNPay Payment integration & Webhook endpoints.
 * Handles payment URL generation, IPN, Return, and Guest order access (Section 8.6, Criteria 44–56).
 */
export class PaymentController {
  constructor(service = paymentService) {
    this.paymentService = service;
  }

  /**
   * POST /api/v1/payments/create-url
   * Issues an authenticated VNPay payment URL for an unexpired order.
   */
  createPaymentUrl = async (req, res, next) => {
    try {
      const { paymentOrderId } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
      const result = await this.paymentService.createPaymentUrl(req.user, paymentOrderId, clientIp);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/payments/vnpay-return
   * Handles user returning from VNPay gateway to the website.
   * Public endpoint; does not require Bearer JWT or CSRF headers (Section 10.5).
   * Supports both JSON response and minimal test HTML fixture page for browser testing.
   */
  handleVNPayReturn = async (req, res, next) => {
    try {
      const result = await this.paymentService.processVNPayCallback(req.query, false);

      // Support minimal HTML fixture for browser testing without React (Development Plan P11)
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')) {
        const { status, bookingRequestId, message } = result.body.data || {};
        const isSuccess = status === 'CONFIRMED';
        const isReview = status === 'REVIEW';

        const statusColor = isSuccess ? '#166534' : isReview ? '#92400e' : '#991b1b';
        const bgColor = isSuccess ? '#f0fdf4' : isReview ? '#fef3c7' : '#fef2f2';
        const title = isSuccess
          ? 'Thanh toán thành công'
          : isReview
          ? 'Đang xem xét đối soát'
          : 'Thanh toán thất bại';

        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Kết quả thanh toán VNPay - SportBooking</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6; padding: 40px 20px; }
    .card { max-width: 500px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 32px; text-align: center; }
    .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; background-color: ${bgColor}; color: ${statusColor}; margin-bottom: 20px; }
    h2 { margin: 0 0 12px; color: ${statusColor}; }
    p { color: #4b5563; line-height: 1.5; margin: 8px 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status-badge">${title}</div>
    <h2>Trạng thái: ${status || 'N/A'}</h2>
    <p>${message || ''}</p>
    ${bookingRequestId ? `<p>Mã yêu cầu: <strong>${bookingRequestId}</strong></p>` : ''}
  </div>
</body>
</html>`.trim();

        return res.status(result.httpStatus).send(html);
      }

      return res.status(result.httpStatus).json(result.body);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/payments/vnpay-ipn
   * Server-to-server webhook endpoint called by VNPay.
   * Public endpoint; does not require Bearer JWT, Cookie or CSRF headers (Section 10.5).
   * Strictly returns standard VNPay IPN response format: { RspCode, Message }.
   */
  handleVNPayIpn = async (req, res, next) => {
    try {
      const result = await this.paymentService.processVNPayCallback(req.query, true);
      res.status(result.httpStatus).json(result.body);
    } catch (err) {
      // In case of unexpected database exception, return VNPay error so VNPay retries
      res.status(200).json({
        RspCode: '99',
        Message: err.message || 'Unknown error occurred during IPN processing',
      });
    }
  };

  /**
   * GET /api/v1/payments/guest-order/:paymentOrderId?accessCode=...
   * Allows guests without accounts to view payment info and obtain VNPay URL (Criterion 52).
   */
  getGuestPaymentOrder = async (req, res, next) => {
    try {
      const { paymentOrderId } = req.params;
      const { accessCode } = req.query;
      const result = await this.paymentService.getGuestPaymentOrder(paymentOrderId, accessCode);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/payments/order/:bookingRequestId
   * Retrieves payment order details by bookingRequestId for customer/owner.
   */
  getPaymentOrderByBookingRequestId = async (req, res, next) => {
    try {
      const { bookingRequestId } = req.params;
      const result = await this.paymentService.getPaymentOrderByBookingRequestId(
        req.user,
        bookingRequestId
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const paymentController = new PaymentController();
export default paymentController;

