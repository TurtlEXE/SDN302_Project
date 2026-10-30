import crypto from 'crypto';
import mongoose from 'mongoose';
import { vnpayClient } from '../../integrations/vnpay.client.js';
import { paymentOrderRepository } from '../../repositories/payment-order.repository.js';
import { paymentTransactionRepository } from '../../repositories/payment-transaction.repository.js';
import { bookingRequestRepository } from '../../repositories/booking-request.repository.js';
import { bookingRepository } from '../../repositories/booking.repository.js';
import { courtDayScheduleRepository } from '../../repositories/court-day-schedule.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { courtRepository } from '../../repositories/court.repository.js';
import { emailOutboxRepository } from '../../repositories/email-outbox.repository.js';
import { actionLogRepository } from '../../repositories/action-log.repository.js';
import { User } from '../../models/user.model.js';
import { withTransaction } from '../../database/transaction.js';
import { parseVnpayDate } from '../../integrations/vnpay.client.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

export class PaymentService {
  constructor(
    client = vnpayClient,
    paymentOrderRepo = paymentOrderRepository,
    paymentTxnRepo = paymentTransactionRepository,
    bookingRequestRepo = bookingRequestRepository,
    bookingRepo = bookingRepository,
    courtScheduleRepo = courtDayScheduleRepository,
    emailOutboxRepo = emailOutboxRepository,
    actionLogRepo = actionLogRepository
  ) {
    this.vnpayClient = client;
    this.paymentOrderRepo = paymentOrderRepo;
    this.paymentTxnRepo = paymentTxnRepo;
    this.bookingRequestRepo = bookingRequestRepo;
    this.bookingRepo = bookingRepo;
    this.courtScheduleRepo = courtScheduleRepo;
    this.emailOutboxRepo = emailOutboxRepo;
    this.actionLogRepo = actionLogRepo;
  }

  /**
   * Generates or retrieves an authenticated VNPay payment URL for an unexpired PaymentOrder.
   * Reopening an unexpired order does NOT extend hold or modify price (Section 8.6 item 3, Criterion 46).
   *
   * @param {Object} actorUser - Authenticated user
   * @param {string} paymentOrderId
   * @param {string} [ipAddr='127.0.0.1']
   * @returns {Promise<{ paymentUrl: string, expiresAt: string }>}
   */
  async createPaymentUrl(actorUser, paymentOrderId, ipAddr = '127.0.0.1') {
    if (!paymentOrderId || !mongoose.Types.ObjectId.isValid(paymentOrderId)) {
      throw AppError.badRequest('ID đơn thanh toán không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const paymentOrder = await this.paymentOrderRepo.findById(paymentOrderId);
    if (!paymentOrder) {
      throw AppError.notFound('Không tìm thấy đơn thanh toán.', ERROR_CODES.NOT_FOUND);
    }

    if (paymentOrder.status !== 'PENDING') {
      throw AppError.badRequest(
        `Đơn thanh toán không ở trạng thái chờ thanh toán (Trạng thái hiện tại: ${paymentOrder.status}).`,
        ERROR_CODES.PAYMENT_FAILED
      );
    }

    const now = new Date();
    if (now >= new Date(paymentOrder.expiresAt)) {
      throw AppError.badRequest('Đơn thanh toán đã hết hạn.', ERROR_CODES.HOLD_EXPIRED);
    }

    const bookingRequest = await this.bookingRequestRepo.findById(paymentOrder.bookingRequestId);
    if (!bookingRequest) {
      throw AppError.notFound('Không tìm thấy yêu cầu đặt sân liên quan.', ERROR_CODES.NOT_FOUND);
    }

    // Role-based authorization
    if (actorUser.role === 'CUSTOMER') {
      const isOwner =
        (bookingRequest.customerId && bookingRequest.customerId.toString() === actorUser.id) ||
        (bookingRequest.createdBy && bookingRequest.createdBy.toString() === actorUser.id);
      if (!isOwner) {
        throw AppError.forbidden('Bạn không có quyền thanh toán cho đơn của người khác.', ERROR_CODES.FORBIDDEN);
      }
    } else if (actorUser.role === 'OWNER') {
      const facility = await facilityRepository.findById(bookingRequest.facilityId);
      if (!facility || facility.ownerId.toString() !== actorUser.id) {
        throw AppError.forbidden('Chủ sân chỉ được phát hành link thanh toán cho cơ sở của mình.', ERROR_CODES.FORBIDDEN);
      }
    }

    const paymentUrl = this.vnpayClient.createPaymentUrl({
      txnRef: paymentOrder.vnpayTxnRef,
      amountVnd: paymentOrder.expectedAmountVnd,
      orderInfo: `Thanh toan don dat san ${bookingRequest.requestNumber}`,
      ipAddr,
      createDate: paymentOrder.createdAt,
      expireDate: paymentOrder.expiresAt, // Criterion 46: matches holdExpiresAt
    });

    return {
      paymentUrl,
      expiresAt: paymentOrder.expiresAt.toISOString(),
    };
  }

  /**
   * Unified processor for VNPay callbacks (both server-to-server IPN and browser Return).
   * Adheres strictly to Section 8.6, Section 10.5, and Acceptance Criteria 44–56:
   * - Validates cryptographic HMAC-SHA512 signature
   * - Validates merchant & order reference
   * - Validates 100% exact amount (VND * 100)
   * - Idempotency protection against duplicate/concurrent callbacks
   * - Multi-document ACID transaction with CourtDaySchedule coordination locking
   * - Allocates payment to all child bookings and enqueues BOOKING_CONFIRMED email in outbox
   * - Comprehensive exception handling: LATE_PAYMENT, WRONG_AMOUNT, DUPLICATE_PAYMENT
   *
   * @param {Record<string, string>} queryParams - VNPay query parameters
   * @param {boolean} [isIpn=false] - Whether callback is IPN (server-to-server) or Return (browser)
   * @returns {Promise<{ httpStatus: number, body: Object }>}
   */
  async processVNPayCallback(queryParams, isIpn = false) {
    // 1. Verify cryptographic HMAC-SHA512 signature (Section 8.6, Criterion 45)
    const isValidSignature = this.vnpayClient.verifySignature(queryParams);
    if (!isValidSignature) {
      if (isIpn) {
        return {
          httpStatus: 400,
          body: { RspCode: '97', Message: 'Invalid Signature' },
        };
      }
      throw AppError.badRequest('Chữ ký bảo mật VNPay không hợp lệ.', ERROR_CODES.INVALID_SIGNATURE);
    }

    // 2. Lookup PaymentOrder by vnpayTxnRef
    const vnpayTxnRef = queryParams.vnp_TxnRef;
    if (!vnpayTxnRef) {
      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '01', Message: 'Order not found' },
        };
      }
      throw AppError.badRequest('Tham số vnp_TxnRef bị thiếu.', ERROR_CODES.VALIDATION_ERROR);
    }

    const paymentOrder = await this.paymentOrderRepo.findByVnpayTxnRef(vnpayTxnRef);
    if (!paymentOrder) {
      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '01', Message: 'Order not found' },
        };
      }
      throw AppError.notFound(
        'Không tìm thấy đơn thanh toán tương ứng với mã tham chiếu VNPay.',
        ERROR_CODES.NOT_FOUND
      );
    }

    const bookingRequest = await this.bookingRequestRepo.findById(paymentOrder.bookingRequestId);
    if (!bookingRequest) {
      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '01', Message: 'BookingRequest not found' },
        };
      }
      throw AppError.notFound('Không tìm thấy yêu cầu đặt sân liên quan.', ERROR_CODES.NOT_FOUND);
    }

    // 3. Amount validation (Criterion 44, Criterion 55, Section 8.6 item 11)
    // VNPay sends amount in VND * 100
    const rawAmount = parseInt(queryParams.vnp_Amount, 10);
    const callbackAmountVnd = isNaN(rawAmount) ? 0 : rawAmount / 100;
    const expectedAmountVnd = paymentOrder.expectedAmountVnd;

    if (callbackAmountVnd !== expectedAmountVnd) {
      // Amount mismatch exception: record transaction, set PaymentOrder to REVIEW, cancel child bookings
      await withTransaction(async (session) => {
        await this.courtScheduleRepo.acquireCoordinationLock(
          bookingRequest.courtId,
          bookingRequest.bookingDate,
          session
        );

        await this.paymentTxnRepo.create(
          {
            paymentOrderId: paymentOrder._id,
            vnpayTransactionNo: queryParams.vnp_TransactionNo || null,
            vnpayTxnRef,
            amountVnd: callbackAmountVnd,
            bankCode: queryParams.vnp_BankCode || null,
            responseCode: queryParams.vnp_ResponseCode || '',
            transactionStatus: queryParams.vnp_TransactionStatus || '',
            payDate: parseVnpayDate(queryParams.vnp_PayDate),
            isAccepted: false,
            exceptionType: 'WRONG_AMOUNT',
            rawCallbackData: queryParams,
          },
          session
        );

        if (paymentOrder.status === 'PENDING') {
          await this.paymentOrderRepo.updateById(
            paymentOrder._id,
            {
              $set: {
                status: 'REVIEW',
                updatedAt: new Date(),
              },
              $inc: { processingVersion: 1 },
            },
            session
          );

          await this.bookingRepo.updateManyByRequestId(
            bookingRequest._id,
            {
              $set: {
                status: 'CANCELLED',
                cancellation: {
                  cancelledAt: new Date(),
                  reason: 'Thanh toán sai số tiền so với đơn đã chốt.',
                },
                updatedAt: new Date(),
              },
              $inc: { statusVersion: 1 },
            },
            session
          );
        }

        await this.actionLogRepo.create(
          {
            actorId: bookingRequest.createdBy,
            actorRole: 'SYSTEM',
            targetType: 'PAYMENT_ORDER',
            targetId: paymentOrder._id,
            action: 'PAYMENT_WRONG_AMOUNT_REVIEW',
            previousState: { status: paymentOrder.status },
            newState: { status: 'REVIEW', callbackAmountVnd, expectedAmountVnd },
            reason: 'Số tiền thanh toán callback không khớp với expectedAmountVnd.',
          },
          session
        );
      });

      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '04', Message: 'Invalid amount' },
        };
      }

      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            status: 'REVIEW',
            bookingRequestId: bookingRequest._id.toString(),
            message: 'Số tiền thanh toán không khớp với đơn đặt sân. Đơn chuyển sang trạng thái chờ admin đối soát.',
          },
        },
      };
    }

    // 4. Idempotency & Duplicate payment check (Criteria 47, 55, Section 8.6 item 7)
    if (paymentOrder.status === 'PAID') {
      const vnpayTransactionNo = queryParams.vnp_TransactionNo;
      const existingAcceptedTxn = await this.paymentTxnRepo.findAcceptedByPaymentOrderId(paymentOrder._id);

      if (existingAcceptedTxn && existingAcceptedTxn.vnpayTransactionNo === vnpayTransactionNo) {
        // Idempotent duplicate delivery of the exact same callback
        if (isIpn) {
          return {
            httpStatus: 200,
            body: { RspCode: '02', Message: 'Order already confirmed' },
          };
        }
        return {
          httpStatus: 200,
          body: {
            success: true,
            data: {
              status: 'CONFIRMED',
              bookingRequestId: bookingRequest._id.toString(),
              message: 'Giao dịch đã được xác nhận thành công trước đó.',
            },
          },
        };
      }

      // Different transaction number for an already PAID order -> record DUPLICATE_PAYMENT exception
      await this.paymentTxnRepo.create({
        paymentOrderId: paymentOrder._id,
        vnpayTransactionNo: vnpayTransactionNo || null,
        vnpayTxnRef,
        amountVnd: callbackAmountVnd,
        bankCode: queryParams.vnp_BankCode || null,
        responseCode: queryParams.vnp_ResponseCode || '',
        transactionStatus: queryParams.vnp_TransactionStatus || '',
        payDate: parseVnpayDate(queryParams.vnp_PayDate),
        isAccepted: false,
        exceptionType: 'DUPLICATE_PAYMENT',
        rawCallbackData: queryParams,
      });

      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '02', Message: 'Order already confirmed' },
        };
      }

      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            status: 'CONFIRMED',
            bookingRequestId: bookingRequest._id.toString(),
            message: 'Giao dịch thu thêm đã được ghi nhận ngoại lệ cho admin xử lý hoàn tiền.',
          },
        },
      };
    }

    // 5. Payment Failure handling (Criterion 50, Section 8.6 item 9)
    const isSuccessCallback =
      queryParams.vnp_ResponseCode === '00' && queryParams.vnp_TransactionStatus === '00';

    if (!isSuccessCallback) {
      // Failed payment callback
      if (paymentOrder.status === 'PENDING') {
        await withTransaction(async (session) => {
          await this.courtScheduleRepo.acquireCoordinationLock(
            bookingRequest.courtId,
            bookingRequest.bookingDate,
            session
          );

          await this.paymentOrderRepo.updateById(
            paymentOrder._id,
            {
              $set: {
                status: 'CLOSED',
                closedReason: 'FAILED_PAYMENT',
                updatedAt: new Date(),
              },
              $inc: { processingVersion: 1 },
            },
            session
          );

          await this.bookingRepo.updateManyByRequestId(
            bookingRequest._id,
            {
              $set: {
                status: 'CANCELLED',
                cancellation: {
                  cancelledAt: new Date(),
                  reason: `Thanh toán VNPay thất bại (Mã: ${queryParams.vnp_ResponseCode || 'UNKNOWN'}).`,
                },
                updatedAt: new Date(),
              },
              $inc: { statusVersion: 1 },
            },
            session
          );

          await this.paymentTxnRepo.create(
            {
              paymentOrderId: paymentOrder._id,
              vnpayTransactionNo: queryParams.vnp_TransactionNo || null,
              vnpayTxnRef,
              amountVnd: callbackAmountVnd,
              bankCode: queryParams.vnp_BankCode || null,
              responseCode: queryParams.vnp_ResponseCode || '',
              transactionStatus: queryParams.vnp_TransactionStatus || '',
              payDate: parseVnpayDate(queryParams.vnp_PayDate),
              isAccepted: false,
              exceptionType: null,
              rawCallbackData: queryParams,
            },
            session
          );

          await this.actionLogRepo.create(
            {
              actorId: bookingRequest.createdBy,
              actorRole: 'SYSTEM',
              targetType: 'PAYMENT_ORDER',
              targetId: paymentOrder._id,
              action: 'PAYMENT_FAILED',
              previousState: { status: 'PENDING' },
              newState: { status: 'CLOSED', closedReason: 'FAILED_PAYMENT' },
              reason: `VNPay callback failed with response code ${queryParams.vnp_ResponseCode}.`,
            },
            session
          );
        });
      }

      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '00', Message: 'Confirm Success' },
        };
      }

      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            status: 'FAILED',
            bookingRequestId: bookingRequest._id.toString(),
            message: 'Thanh toán VNPay không thành công hoặc giao dịch đã bị hủy.',
          },
        },
      };
    }

    // 6. Success Callback Execution within MongoDB ACID Transaction
    return withTransaction(async (session) => {
      // 6.1. Acquire atomic coordination lock on court and bookingDate (Section 8.3.3)
      await this.courtScheduleRepo.acquireCoordinationLock(
        bookingRequest.courtId,
        bookingRequest.bookingDate,
        session
      );

      // 6.2. Re-read PaymentOrder and child Bookings within session
      const currentOrder = await this.paymentOrderRepo.findById(paymentOrder._id, session);
      const childBookings = await this.bookingRepo.findByRequestId(bookingRequest._id, session);

      // Check if another concurrent callback already won
      if (currentOrder.status === 'PAID') {
        if (isIpn) {
          return {
            httpStatus: 200,
            body: { RspCode: '02', Message: 'Order already confirmed' },
          };
        }
        return {
          httpStatus: 200,
          body: {
            success: true,
            data: {
              status: 'CONFIRMED',
              bookingRequestId: bookingRequest._id.toString(),
              message: 'Giao dịch đã được xác nhận thành công.',
            },
          },
        };
      }

      const now = new Date();
      const isExpiredOrClosed =
        currentOrder.status === 'CLOSED' || now > new Date(currentOrder.expiresAt);

      // 6.3. Late Payment Handling (Section 8.6 item 10, Criterion 49)
      if (isExpiredOrClosed) {
        // Transition pending bookings to EXPIRED if still pending
        const hasPending = childBookings.some((b) => b.status === 'PENDING_PAYMENT');
        if (hasPending) {
          await this.bookingRepo.updateManyByRequestId(
            bookingRequest._id,
            {
              $set: {
                status: 'EXPIRED',
                updatedAt: new Date(),
              },
              $inc: { statusVersion: 1 },
            },
            session
          );
        }

        // Transition PaymentOrder to REVIEW
        await this.paymentOrderRepo.updateById(
          currentOrder._id,
          {
            $set: {
              status: 'REVIEW',
              updatedAt: new Date(),
            },
            $inc: { processingVersion: 1 },
          },
          session
        );

        // Record PaymentTransaction with exceptionType = 'LATE_PAYMENT'
        await this.paymentTxnRepo.create(
          {
            paymentOrderId: currentOrder._id,
            vnpayTransactionNo: queryParams.vnp_TransactionNo || null,
            vnpayTxnRef,
            amountVnd: callbackAmountVnd,
            bankCode: queryParams.vnp_BankCode || null,
            responseCode: queryParams.vnp_ResponseCode,
            transactionStatus: queryParams.vnp_TransactionStatus,
            payDate: parseVnpayDate(queryParams.vnp_PayDate),
            isAccepted: false,
            exceptionType: 'LATE_PAYMENT',
            rawCallbackData: queryParams,
          },
          session
        );

        await this.actionLogRepo.create(
          {
            actorId: bookingRequest.createdBy,
            actorRole: 'SYSTEM',
            targetType: 'PAYMENT_ORDER',
            targetId: currentOrder._id,
            action: 'PAYMENT_LATE_REVIEW',
            previousState: { status: currentOrder.status },
            newState: { status: 'REVIEW', exceptionType: 'LATE_PAYMENT' },
            reason: 'Thanh toán thành công đến sau khi hạn giữ chỗ đã hết hoặc đơn đã bị hủy.',
          },
          session
        );

        if (isIpn) {
          return {
            httpStatus: 200,
            body: { RspCode: '00', Message: 'Confirm Success' },
          };
        }

        return {
          httpStatus: 200,
          body: {
            success: true,
            data: {
              status: 'REVIEW',
              bookingRequestId: bookingRequest._id.toString(),
              message:
                'Thanh toán nhận được sau khi thời gian giữ chỗ đã hết hạn. Đơn được chuyển sang trạng thái chờ admin đối soát hoàn tiền.',
            },
          },
        };
      }

      // 6.4. ELIGIBLE SUCCESSFUL PAYMENT CONFIRMATION (Section 8.6 item 6, Criteria 39, 44, 46)
      // Update PaymentOrder to PAID
      await this.paymentOrderRepo.updateById(
        currentOrder._id,
        {
          $set: {
            status: 'PAID',
            updatedAt: new Date(),
          },
          $inc: { processingVersion: 1 },
        },
        session
      );

      // Allocate exact amounts and transition all child bookings to CONFIRMED / PAID
      for (const booking of childBookings) {
        await this.bookingRepo.updateById(
          booking._id,
          {
            $set: {
              status: 'CONFIRMED',
              paymentStatus: 'PAID',
              allocatedAmountVnd: booking.totalPriceVnd,
              updatedAt: new Date(),
            },
            $inc: { statusVersion: 1 },
          },
          session
        );
      }

      // Create PaymentTransaction (isAccepted = true)
      await this.paymentTxnRepo.create(
        {
          paymentOrderId: currentOrder._id,
          vnpayTransactionNo: queryParams.vnp_TransactionNo || null,
          vnpayTxnRef,
          amountVnd: callbackAmountVnd,
          bankCode: queryParams.vnp_BankCode || null,
          responseCode: queryParams.vnp_ResponseCode,
          transactionStatus: queryParams.vnp_TransactionStatus,
          payDate: parseVnpayDate(queryParams.vnp_PayDate),
          isAccepted: true,
          exceptionType: null,
          rawCallbackData: queryParams,
        },
        session
      );

      // 6.5. Enqueue single BOOKING_CONFIRMED email in EmailOutbox (Criteria 39, 41, 42)
      let recipientEmail = null;
      if (bookingRequest.source === 'CUSTOMER_ONLINE' && bookingRequest.customerId) {
        const customer = await User.findById(bookingRequest.customerId).session(session);
        if (customer) recipientEmail = customer.email;
      } else if (bookingRequest.source === 'OWNER_ON_BEHALF' && bookingRequest.createdBy) {
        // Criterion 42: On-behalf bookings send confirmation email exclusively to the owner
        const owner = await User.findById(bookingRequest.createdBy).session(session);
        if (owner) recipientEmail = owner.email;
      }

      if (recipientEmail) {
        await this.emailOutboxRepo.createMessage(
          {
            eventKey: `BOOKING_CONFIRMED_${bookingRequest._id}`,
            eventType: 'BOOKING_CONFIRMED',
            recipientEmail,
            recipientName: bookingRequest.contactName || '',
            subject: `[SportBooking] Xác nhận đặt sân thành công - ${bookingRequest.requestNumber}`,
            templateName: 'booking-confirmed',
            templateData: {
              name: bookingRequest.contactName || '',
              requestNumber: bookingRequest.requestNumber,
              vnpayTxnRef: currentOrder.vnpayTxnRef,
              vnpayTransactionNo: queryParams.vnp_TransactionNo || '',
              totalAmountVnd: currentOrder.expectedAmountVnd,
              bookingDate: bookingRequest.bookingDate,
              facilityName: childBookings[0]?.snapshot?.facilityName || '',
              courtName: childBookings[0]?.snapshot?.courtName || '',
              bookings: childBookings.map((b) => ({
                bookingCode: b.bookingCode,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
                totalPriceVnd: b.totalPriceVnd,
              })),
            },
          },
          { session }
        );
      }

      // Also send notification to facility owner if customer booked online (AUTH-05)
      if (bookingRequest.source === 'CUSTOMER_ONLINE' && bookingRequest.facilityId) {
        const facility = await facilityRepository.findById(bookingRequest.facilityId);
        if (facility && facility.ownerId) {
          const owner = await User.findById(facility.ownerId).session(session);
          if (owner && owner.email && owner.email !== recipientEmail) {
            await this.emailOutboxRepo.createMessage(
              {
                eventKey: `BOOKING_CONFIRMED_OWNER_${bookingRequest._id}`,
                eventType: 'BOOKING_CONFIRMED',
                recipientEmail: owner.email,
                recipientName: owner.fullName || 'Chủ sân',
                subject: `[SportBooking] Khách đặt sân mới thành công - ${bookingRequest.requestNumber}`,
                templateName: 'booking-confirmed',
                templateData: {
                  name: owner.fullName || 'Chủ sân',
                  requestNumber: bookingRequest.requestNumber,
                  vnpayTxnRef: currentOrder.vnpayTxnRef,
                  vnpayTransactionNo: queryParams.vnp_TransactionNo || '',
                  totalAmountVnd: currentOrder.expectedAmountVnd,
                  bookingDate: bookingRequest.bookingDate,
                  facilityName: childBookings[0]?.snapshot?.facilityName || '',
                  courtName: childBookings[0]?.snapshot?.courtName || '',
                  bookings: childBookings.map((b) => ({
                    bookingCode: b.bookingCode,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    durationMinutes: b.durationMinutes,
                    totalPriceVnd: b.totalPriceVnd,
                  })),
                },
              },
              { session }
            );
          }
        }
      }

      // 6.6. Record ActionLog audit entry
      await this.actionLogRepo.create(
        {
          actorId: bookingRequest.createdBy,
          actorRole: 'SYSTEM',
          targetType: 'PAYMENT_ORDER',
          targetId: currentOrder._id,
          action: 'PAYMENT_CONFIRMED',
          previousState: { status: 'PENDING' },
          newState: { status: 'PAID', vnpayTransactionNo: queryParams.vnp_TransactionNo },
          reason: 'VNPay payment verified successfully and all child bookings confirmed.',
        },
        session
      );

      if (isIpn) {
        return {
          httpStatus: 200,
          body: { RspCode: '00', Message: 'Confirm Success' },
        };
      }

      return {
        httpStatus: 200,
        body: {
          success: true,
          data: {
            status: 'CONFIRMED',
            bookingRequestId: bookingRequest._id.toString(),
            message: 'Thanh toán thành công. Lịch đặt sân đã được xác nhận.',
          },
        },
      };
    });
  }

  /**
   * Retrieves PaymentOrder details for guests without an account via secret accessCode (Criterion 52).
   *
   * @param {string} paymentOrderId
   * @param {string} accessCode
   * @returns {Promise<Object>} GuestPaymentOrderDTO
   */
  async getGuestPaymentOrder(paymentOrderId, accessCode) {
    if (!paymentOrderId || !mongoose.Types.ObjectId.isValid(paymentOrderId)) {
      throw AppError.badRequest('ID đơn thanh toán không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!accessCode || typeof accessCode !== 'string' || !accessCode.trim()) {
      throw AppError.forbidden('Mã truy cập bí mật là bắt buộc.', ERROR_CODES.FORBIDDEN);
    }

    const paymentOrder = await this.paymentOrderRepo.findById(paymentOrderId);
    if (!paymentOrder) {
      throw AppError.notFound('Không tìm thấy đơn thanh toán.', ERROR_CODES.NOT_FOUND);
    }

    const bookingRequest = await this.bookingRequestRepo.findById(paymentOrder.bookingRequestId);
    if (!bookingRequest) {
      throw AppError.notFound('Không tìm thấy yêu cầu đặt sân liên quan.', ERROR_CODES.NOT_FOUND);
    }

    // Verify secret access code hash (Criterion 52)
    const codeHash = crypto.createHash('sha256').update(accessCode.trim()).digest('hex');
    if (codeHash !== bookingRequest.guestAccessCodeHash) {
      throw AppError.forbidden('Mã truy cập bí mật không hợp lệ.', ERROR_CODES.FORBIDDEN);
    }

    const [childBookings, facility, court] = await Promise.all([
      this.bookingRepo.findByRequestId(bookingRequest._id),
      facilityRepository.findById(bookingRequest.facilityId),
      courtRepository.findById(bookingRequest.courtId),
    ]);

    let paymentUrl = '';
    const now = new Date();
    if (paymentOrder.status === 'PENDING' && now < new Date(paymentOrder.expiresAt)) {
      paymentUrl = this.vnpayClient.createPaymentUrl({
        txnRef: paymentOrder.vnpayTxnRef,
        amountVnd: paymentOrder.expectedAmountVnd,
        orderInfo: `Thanh toan don dat san ${bookingRequest.requestNumber}`,
        createDate: paymentOrder.createdAt,
        expireDate: paymentOrder.expiresAt,
      });
    }

    const firstBooking = childBookings[0] || {};
    const lastBooking = childBookings[childBookings.length - 1] || {};

    return {
      paymentOrderId: paymentOrder._id.toString(),
      requestNumber: bookingRequest.requestNumber,
      facilityName: facility?.name || '',
      courtName: court?.name || '',
      bookingDate: bookingRequest.bookingDate,
      startTime: firstBooking.startTime || '',
      endTime: lastBooking.endTime || '',
      totalAmountVnd: paymentOrder.expectedAmountVnd,
      status: paymentOrder.status,
      paymentUrl,
      expiresAt: paymentOrder.expiresAt.toISOString(),
    };
  }

  /**
   * Retrieves PaymentOrder details by associated bookingRequestId
   * @param {Object} actorUser
   * @param {string} bookingRequestId
   */
  async getPaymentOrderByBookingRequestId(actorUser, bookingRequestId) {
    if (!bookingRequestId || !mongoose.Types.ObjectId.isValid(bookingRequestId)) {
      throw AppError.badRequest('ID yêu cầu đặt sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const bookingRequest = await this.bookingRequestRepo.findById(bookingRequestId);
    if (!bookingRequest) {
      throw AppError.notFound('Không tìm thấy yêu cầu đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    if (actorUser.role === 'CUSTOMER') {
      const isOwner =
        (bookingRequest.customerId && bookingRequest.customerId.toString() === actorUser.id) ||
        (bookingRequest.createdBy && bookingRequest.createdBy.toString() === actorUser.id);
      if (!isOwner) {
        throw AppError.forbidden('Bạn không có quyền xem thông tin thanh toán của đơn này.', ERROR_CODES.FORBIDDEN);
      }
    } else if (actorUser.role === 'OWNER') {
      const facility = await facilityRepository.findById(bookingRequest.facilityId);
      if (!facility || facility.ownerId.toString() !== actorUser.id) {
        throw AppError.forbidden('Chủ sân chỉ được xem đơn thanh toán của cơ sở mình.', ERROR_CODES.FORBIDDEN);
      }
    }

    const [paymentOrder, transactions] = await Promise.all([
      this.paymentOrderRepo.findByBookingRequestId(bookingRequest._id),
      this.paymentTxnRepo.findByPaymentOrderId(bookingRequest._id),
    ]);

    if (!paymentOrder) {
      throw AppError.notFound('Không tìm thấy đơn thanh toán liên quan.', ERROR_CODES.NOT_FOUND);
    }

    return {
      paymentOrderId: paymentOrder._id.toString(),
      bookingRequestId: bookingRequest._id.toString(),
      requestNumber: bookingRequest.requestNumber,
      vnpayTxnRef: paymentOrder.vnpayTxnRef,
      expectedAmountVnd: paymentOrder.expectedAmountVnd,
      status: paymentOrder.status,
      closedReason: paymentOrder.closedReason,
      expiresAt: paymentOrder.expiresAt.toISOString(),
      transactions: transactions.map((t) => ({
        id: t._id.toString(),
        vnpayTransactionNo: t.vnpayTransactionNo,
        amountVnd: t.amountVnd,
        bankCode: t.bankCode,
        responseCode: t.responseCode,
        isAccepted: t.isAccepted,
        exceptionType: t.exceptionType,
        payDate: t.payDate ? t.payDate.toISOString() : null,
        createdAt: t.createdAt.toISOString(),
      })),
    };
  }
}

export const paymentService = new PaymentService();
export default paymentService;
