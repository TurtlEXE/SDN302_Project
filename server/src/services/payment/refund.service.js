import crypto from 'crypto';
import mongoose from 'mongoose';
import { refundCaseRepository } from '../../repositories/refund-case.repository.js';
import { bookingRepository } from '../../repositories/booking.repository.js';
import { paymentOrderRepository } from '../../repositories/payment-order.repository.js';
import { paymentTransactionRepository } from '../../repositories/payment-transaction.repository.js';
import { courtDayScheduleRepository } from '../../repositories/court-day-schedule.repository.js';
import { actionLogRepository } from '../../repositories/action-log.repository.js';
import { emailOutboxRepository } from '../../repositories/email-outbox.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { User } from '../../models/user.model.js';
import { withTransaction } from '../../database/transaction.js';
import { getCurrentDateVN } from '../../utils/date-time.js';
import { isPastEndTime } from '../booking/booking-policy.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

/**
 * Generates a unique business code for a RefundCase (e.g. RF20261030-A1B2C3)
 * @returns {string}
 */
export function generateRefundCaseCode() {
  const dateCompact = getCurrentDateVN().replace(/-/g, '');
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `RF${dateCompact}-${randomHex}`;
}

export class RefundService {
  constructor(
    refundCaseRepo = refundCaseRepository,
    bookingRepo = bookingRepository,
    paymentOrderRepo = paymentOrderRepository,
    paymentTxnRepo = paymentTransactionRepository,
    courtScheduleRepo = courtDayScheduleRepository,
    actionLogRepo = actionLogRepository,
    emailOutboxRepo = emailOutboxRepository
  ) {
    this.refundCaseRepo = refundCaseRepo;
    this.bookingRepo = bookingRepo;
    this.paymentOrderRepo = paymentOrderRepo;
    this.paymentTxnRepo = paymentTxnRepo;
    this.courtScheduleRepo = courtScheduleRepo;
    this.actionLogRepo = actionLogRepo;
    this.emailOutboxRepo = emailOutboxRepo;
  }

  /**
   * Admin cancels a paid booking when facility cannot serve, releasing the schedule atomically
   * and creating a RefundCase for the exact allocated amount (Section 8.7, Criteria 13, 53, 54).
   *
   * @param {Object} adminUser - Authenticated Admin
   * @param {string} bookingId
   * @param {string} reason
   * @returns {Promise<Object>}
   */
  async cancelAndRefundBooking(adminUser, bookingId, reason) {
    if (adminUser.role !== 'ADMIN') {
      throw AppError.forbidden('Chỉ Quản trị viên mới có quyền hủy đơn và tạo hồ sơ hoàn tiền.', ERROR_CODES.FORBIDDEN);
    }
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw AppError.badRequest('ID đơn đặt sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw AppError.badRequest('Lý do hủy đơn và hoàn tiền là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }

    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw AppError.notFound('Không tìm thấy đơn đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    // Must be CONFIRMED and PAID (Section 8.1, 8.7, Criterion 13)
    if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') {
      throw AppError.badRequest(
        `Đơn đặt sân không ở trạng thái CONFIRMED/PAID để thực hiện hủy và hoàn tiền (Trạng thái: ${booking.status}/${booking.paymentStatus}).`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Must be BEFORE endTime (Section 8.7, Criterion 17)
    const now = new Date();
    if (isPastEndTime(booking.bookingDate, booking.endTime, now)) {
      throw AppError.badRequest(
        `Đã quá giờ kết thúc (${booking.endTime}) của đơn đặt sân. Chỉ được hủy và tạo hồ sơ hoàn tiền trước giờ kết thúc (endTime).`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check if this booking already has an existing RefundCase
    const existingRefunds = await this.refundCaseRepo.findByBookingId(booking._id);
    if (existingRefunds && existingRefunds.length > 0) {
      throw AppError.badRequest('Đơn đặt sân này đã có hồ sơ hoàn tiền, không thể tạo thêm.', ERROR_CODES.VALIDATION_ERROR);
    }

    // Find the accepted PaymentTransaction that funded this Booking
    const paymentOrder = await this.paymentOrderRepo.findByBookingRequestId(booking.bookingRequestId);
    if (!paymentOrder) {
      throw AppError.notFound('Không tìm thấy đơn thanh toán liên quan.', ERROR_CODES.NOT_FOUND);
    }
    const paymentTxn = await this.paymentTxnRepo.findAcceptedByPaymentOrderId(paymentOrder._id);
    if (!paymentTxn) {
      throw AppError.badRequest('Không tìm thấy giao dịch thanh toán thành công của đơn.', ERROR_CODES.PAYMENT_FAILED);
    }

    // Ceiling check: total refunded + pending must not exceed actual received amount (Criterion 54)
    const totalRefundedAndPending = await this.refundCaseRepo.getTotalRefundedAndPending(paymentTxn._id);
    if (totalRefundedAndPending + booking.allocatedAmountVnd > paymentTxn.amountVnd) {
      throw AppError.badRequest(
        `Tổng số tiền hoàn (${(totalRefundedAndPending + booking.allocatedAmountVnd).toLocaleString('vi-VN')} VND) vượt quá số tiền thực nhận (${paymentTxn.amountVnd.toLocaleString('vi-VN')} VND).`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return withTransaction(async (session) => {
      // 1. Acquire coordination lock on court and bookingDate (Section 8.3.3)
      await this.courtScheduleRepo.acquireCoordinationLock(booking.courtId, booking.bookingDate, session);

      // 2. Re-read within session to guarantee no concurrent modification
      const currentBooking = await this.bookingRepo.findById(booking._id, session);
      if (currentBooking.status !== 'CONFIRMED' || currentBooking.paymentStatus !== 'PAID') {
        throw AppError.conflict('Trạng thái đơn đặt sân đã bị thay đổi bởi thao tác khác.', ERROR_CODES.SCHEDULE_CONFLICT);
      }

      const currentExistingRefunds = await this.refundCaseRepo.findByBookingId(booking._id, session);
      if (currentExistingRefunds && currentExistingRefunds.length > 0) {
        throw AppError.conflict('Hồ sơ hoàn tiền cho đơn này vừa được tạo bởi một quản trị viên khác.', ERROR_CODES.SCHEDULE_CONFLICT);
      }

      const currentTotalRefunded = await this.refundCaseRepo.getTotalRefundedAndPending(paymentTxn._id, session);
      if (currentTotalRefunded + currentBooking.allocatedAmountVnd > paymentTxn.amountVnd) {
        throw AppError.badRequest('Tổng số tiền hoàn vượt quá số tiền thực nhận của giao dịch.', ERROR_CODES.VALIDATION_ERROR);
      }

      // 3. Create RefundCase (status: PENDING)
      const refundCaseCode = generateRefundCaseCode();
      const refundCase = await this.refundCaseRepo.create(
        {
          refundCaseCode,
          bookingId: currentBooking._id,
          paymentTransactionId: paymentTxn._id,
          refundAmountVnd: currentBooking.allocatedAmountVnd,
          reason: reason.trim(),
          status: 'PENDING',
        },
        session
      );

      // 4. Update Booking to CANCELLED / REFUND_PENDING and release schedule (Criterion 13, 53)
      await this.bookingRepo.updateById(
        currentBooking._id,
        {
          $set: {
            status: 'CANCELLED',
            paymentStatus: 'REFUND_PENDING',
            cancellation: {
              cancelledAt: new Date(),
              cancelledBy: adminUser._id,
              reason: reason.trim(),
            },
            updatedAt: new Date(),
          },
          $inc: { statusVersion: 1 },
        },
        session
      );

      // 5. Enqueue email notification to customer
      let recipientEmail = null;
      if (currentBooking.customerId) {
        const customer = await User.findById(currentBooking.customerId).session(session);
        if (customer) recipientEmail = customer.email;
      }

      if (recipientEmail) {
        await this.emailOutboxRepo.createMessage(
          {
            eventKey: `CANCEL_REFUND_BK_${currentBooking._id}_${Date.now()}`,
            eventType: 'BOOKING_CANCELLED',
            recipientEmail,
            recipientName: currentBooking.snapshot?.facilityName || 'Quý khách',
            subject: `[SportBooking] Thông báo hủy sân và lập hồ sơ hoàn tiền - ${currentBooking.bookingCode}`,
            templateName: 'booking-cancelled',
            templateData: {
              name: currentBooking.snapshot?.facilityName || 'Quý khách',
              bookingCode: currentBooking.bookingCode,
              refundCaseCode,
              refundAmountVnd: currentBooking.allocatedAmountVnd,
              reason: reason.trim(),
            },
          },
          { session }
        );
      }

      // Also notify facility owner
      if (currentBooking.facilityId) {
        const facility = await facilityRepository.findById(currentBooking.facilityId);
        if (facility && facility.ownerId) {
          const owner = await User.findById(facility.ownerId).session(session);
          if (owner && owner.email && owner.email !== recipientEmail) {
            await this.emailOutboxRepo.createMessage(
              {
                eventKey: `CANCEL_REFUND_OWNER_${currentBooking._id}_${Date.now()}`,
                eventType: 'BOOKING_CANCELLED',
                recipientEmail: owner.email,
                recipientName: owner.fullName || 'Chủ sân',
                subject: `[SportBooking] Quản trị viên đã hủy sân và lập hồ sơ hoàn tiền - ${currentBooking.bookingCode}`,
                templateName: 'booking-cancelled',
                templateData: {
                  name: owner.fullName || 'Chủ sân',
                  bookingCode: currentBooking.bookingCode,
                  refundCaseCode,
                  refundAmountVnd: currentBooking.allocatedAmountVnd,
                  reason: reason.trim(),
                },
              },
              { session }
            );
          }
        }
      }

      // 6. ActionLog audit
      await this.actionLogRepo.create(
        {
          actorId: adminUser._id,
          actorRole: 'ADMIN',
          targetType: 'BOOKING',
          targetId: currentBooking._id,
          action: 'ADMIN_CANCEL_BOOKING',
          previousState: { status: 'CONFIRMED', paymentStatus: 'PAID' },
          newState: {
            status: 'CANCELLED',
            paymentStatus: 'REFUND_PENDING',
            refundCaseCode,
            refundAmountVnd: currentBooking.allocatedAmountVnd,
          },
          reason: reason.trim(),
        },
        session
      );

      return {
        success: true,
        message: 'Đã hủy đơn đặt sân và tạo hồ sơ hoàn tiền thành công.',
        data: {
          refundCaseId: refundCase._id.toString(),
          refundCaseCode: refundCase.refundCaseCode,
          bookingId: currentBooking._id.toString(),
          bookingCode: currentBooking.bookingCode,
          refundAmountVnd: refundCase.refundAmountVnd,
          status: refundCase.status,
        },
      };
    });
  }

  /**
   * Admin creates a RefundCase for an exception payment transaction (LATE_PAYMENT, WRONG_AMOUNT, DUPLICATE_PAYMENT)
   * (Section 8.7, Criteria 49, 55).
   *
   * @param {Object} adminUser - Authenticated Admin
   * @param {Object} params
   * @param {string} params.paymentTransactionId
   * @param {string} params.reason
   * @returns {Promise<Object>}
   */
  async createExceptionRefund(adminUser, { paymentTransactionId, reason }) {
    if (adminUser.role !== 'ADMIN') {
      throw AppError.forbidden('Chỉ Quản trị viên mới có quyền tạo hồ sơ hoàn tiền.', ERROR_CODES.FORBIDDEN);
    }
    if (!paymentTransactionId || !mongoose.Types.ObjectId.isValid(paymentTransactionId)) {
      throw AppError.badRequest('ID giao dịch thanh toán không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw AppError.badRequest('Lý do hoàn tiền là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }

    const paymentTxn = await this.paymentTxnRepo.findById(paymentTransactionId);
    if (!paymentTxn) {
      throw AppError.notFound('Không tìm thấy giao dịch thanh toán.', ERROR_CODES.NOT_FOUND);
    }

    // Must be unaccepted or an exception transaction
    if (paymentTxn.isAccepted && !paymentTxn.exceptionType) {
      throw AppError.badRequest(
        'Giao dịch thanh toán này đã được chấp nhận và phân bổ bình thường cho đơn đặt sân. Vui lòng hủy đơn đặt sân tương ứng để hoàn tiền.',
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Calculate total already refunded or pending
    const totalExisting = await this.refundCaseRepo.getTotalRefundedAndPending(paymentTxn._id);
    const remainingAmount = paymentTxn.amountVnd - totalExisting;

    if (remainingAmount <= 0) {
      throw AppError.badRequest(
        `Giao dịch này đã được tạo hồ sơ hoàn đủ 100% số tiền thực nhận (${paymentTxn.amountVnd.toLocaleString('vi-VN')} VND).`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return withTransaction(async (session) => {
      const currentTotal = await this.refundCaseRepo.getTotalRefundedAndPending(paymentTxn._id, session);
      const currentRemaining = paymentTxn.amountVnd - currentTotal;
      if (currentRemaining <= 0) {
        throw AppError.conflict('Hồ sơ hoàn tiền cho giao dịch này vừa được tạo bởi một quản trị viên khác.', ERROR_CODES.SCHEDULE_CONFLICT);
      }

      const refundCaseCode = generateRefundCaseCode();
      const refundCase = await this.refundCaseRepo.create(
        {
          refundCaseCode,
          bookingId: null,
          paymentTransactionId: paymentTxn._id,
          refundAmountVnd: currentRemaining,
          reason: reason.trim(),
          status: 'PENDING',
        },
        session
      );

      await this.actionLogRepo.create(
        {
          actorId: adminUser._id,
          actorRole: 'ADMIN',
          targetType: 'REFUND',
          targetId: refundCase._id,
          action: 'RECORD_REFUND',
          previousState: null,
          newState: {
            refundCaseCode,
            status: 'PENDING',
            refundAmountVnd: currentRemaining,
            paymentTransactionId: paymentTxn._id,
          },
          reason: `Lập hồ sơ hoàn tiền ngoại lệ: ${reason.trim()}`,
        },
        session
      );

      return {
        success: true,
        message: 'Đã lập hồ sơ hoàn tiền ngoại lệ thành công.',
        data: refundCase,
      };
    });
  }

  /**
   * Admin records proof of manual refund execution outside the system, transitioning RefundCase to REFUNDED
   * and updating attached Booking to CANCELLED/REFUNDED (Section 8.7, Criterion 54).
   *
   * @param {Object} adminUser - Authenticated Admin
   * @param {string} refundCaseId
   * @param {Object} proofData
   * @param {string} proofData.proofReference
   * @param {string} [proofData.proofImageUrl=null]
   * @returns {Promise<Object>}
   */
  async recordManualRefund(adminUser, refundCaseId, { proofReference, proofImageUrl = null }) {
    if (adminUser.role !== 'ADMIN') {
      throw AppError.forbidden('Chỉ Quản trị viên mới có quyền ghi nhận hoàn tiền thủ công.', ERROR_CODES.FORBIDDEN);
    }
    if (!refundCaseId || !mongoose.Types.ObjectId.isValid(refundCaseId)) {
      throw AppError.badRequest('ID hồ sơ hoàn tiền không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!proofReference || typeof proofReference !== 'string' || !proofReference.trim()) {
      throw AppError.badRequest('Mã tham chiếu chuyển khoản / ủy nhiệm chi (proofReference) là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }

    const refundCase = await this.refundCaseRepo.findById(refundCaseId);
    if (!refundCase) {
      throw AppError.notFound('Không tìm thấy hồ sơ hoàn tiền.', ERROR_CODES.NOT_FOUND);
    }
    if (refundCase.status === 'REFUNDED') {
      throw AppError.badRequest('Hồ sơ hoàn tiền này đã được xác nhận hoàn tất trước đó.', ERROR_CODES.VALIDATION_ERROR);
    }

    return withTransaction(async (session) => {
      const currentCase = await this.refundCaseRepo.findById(refundCase._id, session);
      if (currentCase.status !== 'PENDING') {
        throw AppError.conflict('Hồ sơ hoàn tiền đã được xử lý bởi thao tác khác.', ERROR_CODES.SCHEDULE_CONFLICT);
      }

      const processedAt = new Date();
      const updatedCase = await this.refundCaseRepo.updateById(
        currentCase._id,
        {
          $set: {
            status: 'REFUNDED',
            proofReference: proofReference.trim(),
            proofImageUrl: proofImageUrl ? proofImageUrl.trim() : null,
            processedBy: adminUser._id,
            processedAt,
            updatedAt: processedAt,
          },
        },
        session
      );

      let bookingCode = null;
      let recipientEmail = null;
      let recipientName = 'Quý khách';

      if (currentCase.bookingId) {
        const booking = await this.bookingRepo.findById(currentCase.bookingId, session);
        if (booking) {
          bookingCode = booking.bookingCode;
          recipientName = booking.snapshot?.facilityName || 'Quý khách';
          await this.bookingRepo.updateById(
            booking._id,
            {
              $set: {
                paymentStatus: 'REFUNDED',
                updatedAt: processedAt,
              },
              $inc: { statusVersion: 1 },
            },
            session
          );

          if (booking.customerId) {
            const customer = await User.findById(booking.customerId).session(session);
            if (customer) recipientEmail = customer.email;
          }
        }
      }

      // Enqueue REFUND_PROCESSED email in EmailOutbox (Criterion 54)
      if (recipientEmail) {
        await this.emailOutboxRepo.createMessage(
          {
            eventKey: `REFUND_PROCESSED_${currentCase._id}`,
            eventType: 'REFUND_PROCESSED',
            recipientEmail,
            recipientName,
            subject: `[SportBooking] Xác nhận hoàn tiền thành công - ${currentCase.refundCaseCode}`,
            templateName: 'refund-processed',
            templateData: {
              name: recipientName,
              refundCaseCode: currentCase.refundCaseCode,
              bookingCode,
              refundAmountVnd: currentCase.refundAmountVnd,
              reason: currentCase.reason,
              proofReference: proofReference.trim(),
              processedAt,
            },
          },
          { session }
        );
      }

      // Record ActionLog audit entry
      await this.actionLogRepo.create(
        {
          actorId: adminUser._id,
          actorRole: 'ADMIN',
          targetType: 'REFUND',
          targetId: currentCase._id,
          action: 'RECORD_REFUND',
          previousState: { status: 'PENDING' },
          newState: {
            status: 'REFUNDED',
            proofReference: proofReference.trim(),
            proofImageUrl: proofImageUrl ? proofImageUrl.trim() : null,
            processedAt,
          },
          reason: 'Xác nhận hoàn tiền thủ công thành công qua kênh vận hành',
        },
        session
      );

      return {
        success: true,
        message: 'Đã ghi nhận bằng chứng chuyển tiền hoàn thành công.',
        data: updatedCase,
      };
    });
  }

  /**
   * Retrieves paginated list of RefundCases for Admin
   * @param {Object} query
   */
  async listRefundCases(query = {}) {
    const { status, bookingId, paymentTransactionId, page = 1, limit = 20 } = query;
    const filter = {};
    if (status && ['PENDING', 'REFUNDED'].includes(status)) {
      filter.status = status;
    }
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      filter.bookingId = bookingId;
    }
    if (paymentTransactionId && mongoose.Types.ObjectId.isValid(paymentTransactionId)) {
      filter.paymentTransactionId = paymentTransactionId;
    }

    return this.refundCaseRepo.findPaginated(filter, { page, limit });
  }

  /**
   * Retrieves detail of a single RefundCase
   * @param {string} id
   */
  async getRefundCaseById(id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('ID hồ sơ hoàn tiền không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    const refundCase = await this.refundCaseRepo.findById(id);
    if (!refundCase) {
      throw AppError.notFound('Không tìm thấy hồ sơ hoàn tiền.', ERROR_CODES.NOT_FOUND);
    }
    return refundCase;
  }

  /**
   * Lists payment transactions and exceptions for Admin inspection (Section 8.7, Criterion 55)
   * @param {Object} query
   */
  async listPaymentTransactions(query = {}) {
    const { hasException, exceptionType, isAccepted, paymentOrderId, page = 1, limit = 20 } = query;
    const filter = {};

    if (hasException === 'true' || hasException === true) {
      filter.exceptionType = { $ne: null };
    } else if (hasException === 'false' || hasException === false) {
      filter.exceptionType = null;
    }

    if (exceptionType) {
      filter.exceptionType = exceptionType;
    }

    if (isAccepted !== undefined && isAccepted !== '') {
      filter.isAccepted = isAccepted === 'true' || isAccepted === true;
    }

    if (paymentOrderId && mongoose.Types.ObjectId.isValid(paymentOrderId)) {
      filter.paymentOrderId = paymentOrderId;
    }

    return this.paymentTxnRepo.findPaginated(filter, { page, limit });
  }
}

export const refundService = new RefundService();
export default refundService;
