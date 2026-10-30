import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { RefundService, generateRefundCaseCode } from '../../src/services/payment/refund.service.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';

describe('Refund Service Unit Tests (P12)', () => {
  describe('generateRefundCaseCode', () => {
    it('should generate a code starting with RF followed by compact date and random hex', () => {
      const code1 = generateRefundCaseCode();
      const code2 = generateRefundCaseCode();

      const todayCompact = getCurrentDateVN().replace(/-/g, '');
      assert.ok(code1.startsWith(`RF${todayCompact}-`));
      assert.ok(code2.startsWith(`RF${todayCompact}-`));
      assert.notEqual(code1, code2);
    });
  });

  describe('cancelAndRefundBooking unit validation checks', () => {
    it('should reject non-admin actors with FORBIDDEN', async () => {
      const service = new RefundService();
      const nonAdmin = { _id: new mongoose.Types.ObjectId(), role: 'CUSTOMER' };

      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(nonAdmin, new mongoose.Types.ObjectId().toString(), 'Bão lũ');
        },
        {
          statusCode: 403,
          errorCode: 'FORBIDDEN',
        }
      );
    });

    it('should reject invalid bookingId or missing reason', async () => {
      const service = new RefundService();
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(admin, 'invalid-id', 'Lý do');
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );

      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(admin, new mongoose.Types.ObjectId().toString(), '   ');
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });

    it('should reject bookings not in CONFIRMED / PAID status', async () => {
      const mockBookingRepo = {
        findById: async () => ({
          _id: new mongoose.Types.ObjectId(),
          status: 'PENDING_PAYMENT',
          paymentStatus: 'UNPAID',
        }),
      };
      const service = new RefundService(null, mockBookingRepo);
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(admin, new mongoose.Types.ObjectId().toString(), 'Sân bảo trì');
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });

    it('should reject bookings after endTime in Asia/Ho_Chi_Minh', async () => {
      const mockBookingRepo = {
        findById: async () => ({
          _id: new mongoose.Types.ObjectId(),
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          bookingDate: '2020-01-01', // Date in the past
          endTime: '10:00',
        }),
      };
      const service = new RefundService(null, mockBookingRepo);
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(admin, new mongoose.Types.ObjectId().toString(), 'Sân bảo trì');
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });

    it('should reject if booking already has an existing RefundCase', async () => {
      const bookingId = new mongoose.Types.ObjectId();
      const mockBookingRepo = {
        findById: async () => ({
          _id: bookingId,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          bookingDate: '2099-01-01', // Future date
          endTime: '22:00',
        }),
      };
      const mockRefundCaseRepo = {
        findByBookingId: async () => [{ _id: new mongoose.Types.ObjectId(), status: 'PENDING' }],
      };
      const service = new RefundService(mockRefundCaseRepo, mockBookingRepo);
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(admin, bookingId.toString(), 'Sân bảo trì');
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });

    it('should reject if total refunded and pending exceeds payment transaction amount (Criterion 54)', async () => {
      const bookingId = new mongoose.Types.ObjectId();
      const bookingRequestId = new mongoose.Types.ObjectId();
      const paymentOrderId = new mongoose.Types.ObjectId();
      const paymentTxnId = new mongoose.Types.ObjectId();

      const mockBookingRepo = {
        findById: async () => ({
          _id: bookingId,
          bookingRequestId,
          allocatedAmountVnd: 120000,
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          bookingDate: '2099-01-01',
          endTime: '22:00',
        }),
      };
      const mockRefundCaseRepo = {
        findByBookingId: async () => [],
        getTotalRefundedAndPending: async () => 80000, // 80k already pending/refunded out of 100k
      };
      const mockPaymentOrderRepo = {
        findByBookingRequestId: async () => ({ _id: paymentOrderId }),
      };
      const mockPaymentTxnRepo = {
        findAcceptedByPaymentOrderId: async () => ({
          _id: paymentTxnId,
          amountVnd: 100000, // Total actual received is 100,000 VND
        }),
      };

      const service = new RefundService(
        mockRefundCaseRepo,
        mockBookingRepo,
        mockPaymentOrderRepo,
        mockPaymentTxnRepo
      );
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      // 80k + 120k = 200k > 100k -> Must reject
      await assert.rejects(
        async () => {
          await service.cancelAndRefundBooking(admin, bookingId.toString(), 'Sân ngập');
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });
  });

  describe('recordManualRefund unit validation checks', () => {
    it('should reject non-admin actors with FORBIDDEN', async () => {
      const service = new RefundService();
      const nonAdmin = { _id: new mongoose.Types.ObjectId(), role: 'OWNER' };

      await assert.rejects(
        async () => {
          await service.recordManualRefund(nonAdmin, new mongoose.Types.ObjectId().toString(), {
            proofReference: 'REF123',
          });
        },
        {
          statusCode: 403,
          errorCode: 'FORBIDDEN',
        }
      );
    });

    it('should reject missing proofReference', async () => {
      const service = new RefundService();
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.recordManualRefund(admin, new mongoose.Types.ObjectId().toString(), {
            proofReference: '',
          });
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });

    it('should reject if RefundCase is already REFUNDED', async () => {
      const refundCaseId = new mongoose.Types.ObjectId();
      const mockRefundCaseRepo = {
        findById: async () => ({
          _id: refundCaseId,
          status: 'REFUNDED',
          refundCaseCode: 'RF20261030-ABC',
        }),
      };
      const service = new RefundService(mockRefundCaseRepo);
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.recordManualRefund(admin, refundCaseId.toString(), {
            proofReference: 'REF123',
          });
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });
  });

  describe('createExceptionRefund unit validation checks', () => {
    it('should reject creating exception refund for normal accepted transaction without exception', async () => {
      const txnId = new mongoose.Types.ObjectId();
      const mockPaymentTxnRepo = {
        findById: async () => ({
          _id: txnId,
          amountVnd: 200000,
          isAccepted: true,
          exceptionType: null,
        }),
      };
      const service = new RefundService(null, null, null, mockPaymentTxnRepo);
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.createExceptionRefund(admin, {
            paymentTransactionId: txnId.toString(),
            reason: 'Hoàn tiền',
          });
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });

    it('should reject if exception transaction has already been fully refunded', async () => {
      const txnId = new mongoose.Types.ObjectId();
      const mockPaymentTxnRepo = {
        findById: async () => ({
          _id: txnId,
          amountVnd: 150000,
          isAccepted: false,
          exceptionType: 'WRONG_AMOUNT',
        }),
      };
      const mockRefundCaseRepo = {
        getTotalRefundedAndPending: async () => 150000, // 100% already allocated for refund
      };
      const service = new RefundService(mockRefundCaseRepo, null, null, mockPaymentTxnRepo);
      const admin = { _id: new mongoose.Types.ObjectId(), role: 'ADMIN' };

      await assert.rejects(
        async () => {
          await service.createExceptionRefund(admin, {
            paymentTransactionId: txnId.toString(),
            reason: 'Hoàn tiền nạp sai',
          });
        },
        {
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
        }
      );
    });
  });
});

