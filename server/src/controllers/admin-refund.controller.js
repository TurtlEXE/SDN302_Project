import { refundService } from '../services/payment/refund.service.js';

export class AdminRefundController {
  constructor(service = refundService) {
    this.refundService = service;
  }

  /**
   * POST /api/v1/admin/bookings/:id/cancel-and-refund
   * Admin cancels a confirmed/paid booking when facility cannot serve, releasing the schedule
   * and creating a RefundCase (Section 8.7, Criteria 13, 53, 54).
   */
  cancelAndRefundBooking = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await this.refundService.cancelAndRefundBooking(req.user, id, reason);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/refunds
   * Lists RefundCases for Admin inspection.
   */
  listRefundCases = async (req, res, next) => {
    try {
      const result = await this.refundService.listRefundCases(req.query);
      const dtoArray = result.items.map((item) => ({
        id: item._id.toString(),
        refundCaseCode: item.refundCaseCode,
        bookingCode: item.bookingId?.bookingCode || null,
        bookingId: item.bookingId?._id
          ? item.bookingId._id.toString()
          : item.bookingId
            ? item.bookingId.toString()
            : null,
        paymentTransactionId: item.paymentTransactionId?._id
          ? item.paymentTransactionId._id.toString()
          : item.paymentTransactionId
            ? item.paymentTransactionId.toString()
            : null,
        refundAmountVnd: item.refundAmountVnd,
        reason: item.reason,
        status: item.status,
        processedBy: item.processedBy?._id
          ? item.processedBy._id.toString()
          : item.processedBy
            ? item.processedBy.toString()
            : null,
        processedAt: item.processedAt ? item.processedAt.toISOString() : null,
        proofReference: item.proofReference,
        proofImageUrl: item.proofImageUrl,
        createdAt: item.createdAt ? item.createdAt.toISOString() : null,
        updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
      }));

      res.status(200).json({
        success: true,
        data: dtoArray,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/refunds/:id
   * Retrieves single RefundCase detail.
   */
  getRefundCaseById = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.refundService.getRefundCaseById(id);
      res.status(200).json({
        success: true,
        data: {
          id: result._id.toString(),
          _id: result._id.toString(),
          refundCaseCode: result.refundCaseCode,
          bookingCode: result.bookingId?.bookingCode || null,
          bookingId: result.bookingId?._id
            ? result.bookingId._id.toString()
            : result.bookingId
              ? result.bookingId.toString()
              : null,
          paymentTransactionId: result.paymentTransactionId?._id
            ? result.paymentTransactionId._id.toString()
            : result.paymentTransactionId
              ? result.paymentTransactionId.toString()
              : null,
          refundAmountVnd: result.refundAmountVnd,
          reason: result.reason,
          status: result.status,
          processedBy: result.processedBy?._id
            ? result.processedBy._id.toString()
            : result.processedBy
              ? result.processedBy.toString()
              : null,
          processedAt: result.processedAt ? result.processedAt.toISOString() : null,
          proofReference: result.proofReference,
          proofImageUrl: result.proofImageUrl,
          createdAt: result.createdAt ? result.createdAt.toISOString() : null,
          updatedAt: result.updatedAt ? result.updatedAt.toISOString() : null,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/admin/refunds/:id/record-manual-refund
   * Admin records proof of manual refund execution outside the system, transitioning RefundCase
   * to REFUNDED and updating attached Booking to CANCELLED/REFUNDED (Section 8.7, Criterion 54).
   */
  recordManualRefund = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { proofReference, proofImageUrl } = req.body;
      const result = await this.refundService.recordManualRefund(req.user, id, {
        proofReference,
        proofImageUrl,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/v1/admin/refunds/exception-refund
   * Admin creates a RefundCase for an exception payment transaction (LATE_PAYMENT, WRONG_AMOUNT, DUPLICATE_PAYMENT)
   * (Section 8.7, Criteria 49, 55).
   */
  createExceptionRefund = async (req, res, next) => {
    try {
      const { paymentTransactionId, reason } = req.body;
      const result = await this.refundService.createExceptionRefund(req.user, {
        paymentTransactionId,
        reason,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/v1/admin/payment-transactions
   * Lists payment transactions and exceptions for Admin inspection (Section 8.7, Criterion 55).
   */
  listPaymentTransactions = async (req, res, next) => {
    try {
      const result = await this.refundService.listPaymentTransactions(req.query);
      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}

export const adminRefundController = new AdminRefundController();
export default adminRefundController;
