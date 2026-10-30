import mongoose from 'mongoose';
import { bookingRepository } from '../../repositories/booking.repository.js';
import { bookingRequestRepository } from '../../repositories/booking-request.repository.js';
import { paymentOrderRepository } from '../../repositories/payment-order.repository.js';
import { courtDayScheduleRepository } from '../../repositories/court-day-schedule.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { actionLogRepository } from '../../repositories/action-log.repository.js';
import { emailOutboxRepository } from '../../repositories/email-outbox.repository.js';
import { User } from '../../models/user.model.js';
import { withTransaction } from '../../database/transaction.js';
import { validatePastEndTime } from './booking-policy.js';
import { getCurrentDateVN, getCurrentTimeVN, parseTimeToMinutes } from '../../utils/date-time.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

export class BookingLifecycleService {
  /**
   * Transforms a raw Booking document into standard BookingDTO
   * @param {Object} booking
   * @param {Object} [extraData={}]
   * @returns {Object} BookingDTO
   */
  toBookingDTO(booking, extraData = {}) {
    return {
      id: booking._id ? booking._id.toString() : booking.id,
      bookingCode: booking.bookingCode,
      facilityId: booking.facilityId ? booking.facilityId.toString() : undefined,
      courtId: booking.courtId ? booking.courtId.toString() : undefined,
      facilityName: booking.snapshot?.facilityName || '',
      courtName: booking.snapshot?.courtName || '',
      sportName: booking.snapshot?.sportName || '',
      facilityAddress: booking.snapshot?.facilityAddress || '',
      bookingDate: booking.bookingDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      durationMinutes: booking.durationMinutes,
      pricePerHourVnd: booking.pricePerHourVnd,
      totalPriceVnd: booking.totalPriceVnd,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      holdExpiresAt: booking.holdExpiresAt ? new Date(booking.holdExpiresAt).toISOString() : null,
      cancellation: booking.cancellation || null,
      completion: booking.completion || null,
      createdAt: booking.createdAt ? new Date(booking.createdAt).toISOString() : null,
      ...extraData,
    };
  }

  /**
   * Cancels a pending BookingRequest and its child Bookings atomically (CUS-03, OWN-07, Criteria 12, 13).
   * - Prohibits canceling single interval (atomic cancellation of entire request)
   * - Prohibits canceling already PAID or CONFIRMED bookings (Criterion 12)
   * - Closes PaymentOrder with closedReason
   * - Releases schedule via CourtDaySchedule coordination lock
   * - Records ActionLog and enqueues EmailOutbox event
   *
   * @param {Object} actorUser - Authenticated user initiating cancellation
   * @param {string} bookingRequestId
   * @param {string} [reason='']
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async cancelBookingRequest(actorUser, bookingRequestId, reason = '') {
    if (!bookingRequestId || !mongoose.Types.ObjectId.isValid(bookingRequestId)) {
      throw AppError.badRequest('ID yêu cầu đặt không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const bookingRequest = await bookingRequestRepository.findById(bookingRequestId);
    if (!bookingRequest) {
      throw AppError.notFound('Không tìm thấy yêu cầu đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    // Authorization check
    if (actorUser.role === 'CUSTOMER') {
      const isOwnerOfRequest =
        (bookingRequest.customerId && bookingRequest.customerId.toString() === actorUser._id.toString()) ||
        (bookingRequest.createdBy && bookingRequest.createdBy.toString() === actorUser._id.toString());
      if (!isOwnerOfRequest) {
        throw AppError.forbidden('Bạn không có quyền hủy yêu cầu đặt của người khác.', ERROR_CODES.FORBIDDEN);
      }
    } else if (actorUser.role === 'OWNER') {
      const facility = await facilityRepository.findById(bookingRequest.facilityId);
      if (!facility || facility.ownerId.toString() !== actorUser._id.toString()) {
        throw AppError.forbidden('Bạn chỉ có quyền hủy đơn thuộc cơ sở của mình.', ERROR_CODES.FORBIDDEN);
      }
    } else if (actorUser.role !== 'ADMIN') {
      throw AppError.forbidden('Bạn không có quyền thực hiện thao tác này.', ERROR_CODES.FORBIDDEN);
    }

    return withTransaction(async (session) => {
      // 1. Acquire coordination lock on CourtDaySchedule
      await courtDayScheduleRepository.acquireCoordinationLock(
        bookingRequest.courtId,
        bookingRequest.bookingDate,
        session
      );

      // 2. Fetch current child bookings and payment order within session
      const childBookings = await bookingRepository.findByRequestId(bookingRequestId, session);
      const paymentOrder = await paymentOrderRepository.findByBookingRequestId(bookingRequestId, session);

      if (!childBookings || childBookings.length === 0) {
        throw AppError.notFound('Không tìm thấy danh sách đơn đặt của yêu cầu này.', ERROR_CODES.NOT_FOUND);
      }

      // Check if already paid or confirmed (Criterion 12)
      const anyConfirmedOrPaid = childBookings.some(
        (b) => b.status === 'CONFIRMED' || b.paymentStatus === 'PAID'
      );
      if (anyConfirmedOrPaid || (paymentOrder && paymentOrder.status === 'PAID')) {
        throw AppError.badRequest(
          'Đơn đã thanh toán thành công, không thể tự hủy. Vui lòng liên hệ quản trị viên để được hỗ trợ.',
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // If all are already CANCELLED, return success (idempotent)
      const allCancelled = childBookings.every((b) => b.status === 'CANCELLED');
      if (allCancelled) {
        return { success: true, message: 'Yêu cầu đặt đã được hủy trước đó.' };
      }

      // Check if already expired
      const allExpired = childBookings.every((b) => b.status === 'EXPIRED');
      if (allExpired) {
        throw AppError.badRequest('Yêu cầu giữ chỗ đã hết hạn, không thể hủy.', ERROR_CODES.VALIDATION_ERROR);
      }

      // Check that all bookings are PENDING_PAYMENT
      const hasNonPending = childBookings.some((b) => b.status !== 'PENDING_PAYMENT');
      if (hasNonPending) {
        throw AppError.badRequest('Chỉ có thể hủy yêu cầu đang ở trạng thái chờ thanh toán.', ERROR_CODES.VALIDATION_ERROR);
      }

      const cancellationReason =
        reason && reason.trim()
          ? reason.trim()
          : actorUser.role === 'CUSTOMER'
            ? 'Khách hàng tự hủy yêu cầu'
            : 'Chủ sân hủy yêu cầu';

      const cancellationData = {
        cancelledAt: new Date(),
        cancelledBy: actorUser._id,
        reason: cancellationReason,
      };

      // 3. Atomically update child Bookings to CANCELLED
      await bookingRepository.updateManyByRequestId(
        bookingRequestId,
        {
          $set: {
            status: 'CANCELLED',
            cancellation: cancellationData,
            updatedAt: new Date(),
          },
          $inc: { statusVersion: 1 },
        },
        session
      );

      // 4. Close PaymentOrder
      const closedReason = actorUser.role === 'OWNER' ? 'OWNER_CANCELLED' : 'CUSTOMER_CANCELLED';
      if (paymentOrder && paymentOrder.status === 'PENDING') {
        await paymentOrderRepository.updateById(
          paymentOrder._id,
          {
            $set: {
              status: 'CLOSED',
              closedReason,
              updatedAt: new Date(),
            },
            $inc: { processingVersion: 1 },
          },
          session
        );
      }

      // 5. Record ActionLog audit entry
      await actionLogRepository.create(
        {
          actorId: actorUser._id,
          actorRole: actorUser.role,
          targetType: 'BOOKING',
          targetId: childBookings[0]._id,
          action: 'CANCEL_BOOKING_REQUEST',
          reason: cancellationReason,
          previousState: { status: 'PENDING_PAYMENT' },
          newState: { status: 'CANCELLED', closedReason },
        },
        session
      );

      // 6. Enqueue EmailOutbox event for customer and owner
      let recipientEmail = null;
      let recipientName = bookingRequest.contactName || '';
      if (bookingRequest.customerId) {
        const customer = await User.findById(bookingRequest.customerId).session(session);
        if (customer) {
          recipientEmail = customer.email;
          recipientName = customer.fullName || bookingRequest.contactName || '';
        }
      }

      if (recipientEmail) {
        await emailOutboxRepository.createMessage(
          {
            eventKey: `CANCEL_BR_CUSTOMER_${bookingRequest._id}`,
            eventType: 'BOOKING_CANCELLED',
            recipientEmail,
            recipientName,
            subject: `[SportBooking] Thông báo hủy yêu cầu đặt sân - ${bookingRequest.requestNumber}`,
            templateName: 'booking-cancelled',
            templateData: {
              name: recipientName,
              requestNumber: bookingRequest.requestNumber,
              reason: cancellationReason,
            },
          },
          { session }
        );
      }

      // Also notify owner if customer cancelled
      if (bookingRequest.facilityId) {
        const facility = await facilityRepository.findById(bookingRequest.facilityId);
        if (facility && facility.ownerId) {
          const owner = await User.findById(facility.ownerId).session(session);
          if (owner && owner.email && owner.email !== recipientEmail) {
            await emailOutboxRepository.createMessage(
              {
                eventKey: `CANCEL_BR_OWNER_${bookingRequest._id}`,
                eventType: 'BOOKING_CANCELLED',
                recipientEmail: owner.email,
                recipientName: owner.fullName || 'Chủ sân',
                subject: `[SportBooking] Thông báo khách hủy yêu cầu đặt sân - ${bookingRequest.requestNumber}`,
                templateName: 'booking-cancelled',
                templateData: {
                  name: owner.fullName || 'Chủ sân',
                  requestNumber: bookingRequest.requestNumber,
                  reason: cancellationReason,
                },
              },
              { session }
            );
          }
        }
      }

      return {
        success: true,
        message: 'Đã hủy yêu cầu đặt và giải phóng lịch.',
      };
    });
  }

  /**
   * Confirms successful completion of a booking after endTime (OWN-09, Criteria 17, 18).
   * - Must be CONFIRMED/PAID
   * - Must be at or past endTime in Asia/Ho_Chi_Minh
   * - Updates status to COMPLETED/PAID
   * - Records completion metadata and ActionLog
   *
   * @param {Object} actorUser - Authenticated owner
   * @param {string} bookingId
   * @param {string} [note=null]
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async completeBooking(actorUser, bookingId, note = null) {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw AppError.badRequest('ID đơn đặt sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw AppError.notFound('Không tìm thấy đơn đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    // Verify facility ownership
    const facility = await facilityRepository.findById(booking.facilityId);
    if (!facility || facility.ownerId.toString() !== actorUser._id.toString()) {
      throw AppError.forbidden('Bạn chỉ có quyền hoàn tất đơn tại cơ sở của mình.', ERROR_CODES.FORBIDDEN);
    }

    // Validate status: must be CONFIRMED and PAID (Criterion 17)
    if (booking.status === 'PENDING_PAYMENT') {
      throw AppError.badRequest('Đơn chưa thanh toán thành công, không thể hoàn tất.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') {
      throw AppError.badRequest(
        `Đơn đang ở trạng thái ${booking.status}/${booking.paymentStatus}, không thể hoàn tất.`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate endTime: must be >= endTime (Criterion 17)
    validatePastEndTime(booking.bookingDate, booking.endTime, new Date(), 'xác nhận hoàn tất buổi chơi');

    return withTransaction(async (session) => {
      const completionData = {
        completedAt: new Date(),
        completedBy: actorUser._id,
        note: note ? note.trim() : null,
      };

      await bookingRepository.updateById(
        bookingId,
        {
          $set: {
            status: 'COMPLETED',
            completion: completionData,
            updatedAt: new Date(),
          },
          $inc: { statusVersion: 1 },
        },
        session
      );

      await actionLogRepository.create(
        {
          actorId: actorUser._id,
          actorRole: actorUser.role,
          targetType: 'BOOKING',
          targetId: booking._id,
          action: 'COMPLETE_BOOKING',
          reason: note ? note.trim() : 'Xác nhận đã phục vụ thành công',
          previousState: { status: 'CONFIRMED' },
          newState: { status: 'COMPLETED' },
        },
        session
      );

      // Enqueue BOOKING_COMPLETED email for customer if available
      if (booking.customerId) {
        const customer = await User.findById(booking.customerId).session(session);
        if (customer && customer.email) {
          await emailOutboxRepository.createMessage(
            {
              eventKey: `BOOKING_COMPLETED_${booking._id}`,
              eventType: 'BOOKING_COMPLETED',
              recipientEmail: customer.email,
              recipientName: customer.fullName || booking.contactName || '',
              subject: `[SportBooking] Buổi chơi đã hoàn tất - ${booking.bookingCode}`,
              templateName: 'booking-completed',
              templateData: {
                name: customer.fullName || booking.contactName || '',
                bookingCode: booking.bookingCode,
                facilityName: booking.snapshot?.facilityName || '',
                courtName: booking.snapshot?.courtName || '',
                bookingDate: booking.bookingDate,
                startTime: booking.startTime,
                endTime: booking.endTime,
                note: note ? note.trim() : null,
              },
            },
            { session }
          );
        }
      }

      return {
        success: true,
        message: 'Đã xác nhận phục vụ hoàn tất buổi chơi.',
      };
    });
  }

  /**
   * Marks a booking as NO_SHOW after endTime (OWN-09, Criteria 17, 18).
   * - Must be CONFIRMED/PAID
   * - Must be at or past endTime in Asia/Ho_Chi_Minh
   * - Updates status to NO_SHOW/PAID (payment is retained, no refund)
   * - Records completion metadata and ActionLog
   *
   * @param {Object} actorUser - Authenticated owner
   * @param {string} bookingId
   * @param {string} [note=null]
   * @returns {Promise<{ success: boolean, message: string }>}
   */
  async markNoShowBooking(actorUser, bookingId, note = null) {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw AppError.badRequest('ID đơn đặt sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw AppError.notFound('Không tìm thấy đơn đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    // Verify facility ownership
    const facility = await facilityRepository.findById(booking.facilityId);
    if (!facility || facility.ownerId.toString() !== actorUser._id.toString()) {
      throw AppError.forbidden('Bạn chỉ có quyền cập nhật đơn tại cơ sở của mình.', ERROR_CODES.FORBIDDEN);
    }

    // Validate status: must be CONFIRMED and PAID (Criterion 17)
    if (booking.status === 'PENDING_PAYMENT') {
      throw AppError.badRequest('Đơn chưa thanh toán thành công, không thể đánh dấu vắng mặt.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (booking.status !== 'CONFIRMED' || booking.paymentStatus !== 'PAID') {
      throw AppError.badRequest(
        `Đơn đang ở trạng thái ${booking.status}/${booking.paymentStatus}, không thể đánh dấu vắng mặt.`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate endTime: must be >= endTime (Criterion 17)
    validatePastEndTime(booking.bookingDate, booking.endTime, new Date(), 'đánh dấu khách không đến');

    return withTransaction(async (session) => {
      const completionData = {
        completedAt: new Date(),
        completedBy: actorUser._id,
        note: note ? note.trim() : 'Khách không đến',
      };

      await bookingRepository.updateById(
        bookingId,
        {
          $set: {
            status: 'NO_SHOW',
            completion: completionData,
            updatedAt: new Date(),
          },
          $inc: { statusVersion: 1 },
        },
        session
      );

      await actionLogRepository.create(
        {
          actorId: actorUser._id,
          actorRole: actorUser.role,
          targetType: 'BOOKING',
          targetId: booking._id,
          action: 'NO_SHOW_BOOKING',
          reason: note ? note.trim() : 'Khách không đến',
          previousState: { status: 'CONFIRMED' },
          newState: { status: 'NO_SHOW' },
        },
        session
      );

      // Enqueue BOOKING_NO_SHOW email for customer if available
      if (booking.customerId) {
        const customer = await User.findById(booking.customerId).session(session);
        if (customer && customer.email) {
          await emailOutboxRepository.createMessage(
            {
              eventKey: `BOOKING_NO_SHOW_${booking._id}`,
              eventType: 'BOOKING_NO_SHOW',
              recipientEmail: customer.email,
              recipientName: customer.fullName || booking.contactName || '',
              subject: `[SportBooking] Xác nhận không đến sân (No-show) - ${booking.bookingCode}`,
              templateName: 'booking-no-show',
              templateData: {
                name: customer.fullName || booking.contactName || '',
                bookingCode: booking.bookingCode,
                facilityName: booking.snapshot?.facilityName || '',
                courtName: booking.snapshot?.courtName || '',
                bookingDate: booking.bookingDate,
                startTime: booking.startTime,
                endTime: booking.endTime,
                note: note ? note.trim() : 'Khách không đến',
              },
            },
            { session }
          );
        }
      }

      return {
        success: true,
        message: 'Đã ghi nhận khách không đến. Tiền thanh toán không tự hoàn.',
      };
    });
  }

  /**
   * Lists customer bookings with UPCOMING / HISTORY filters (CUS-02)
   * @param {Object} actorUser
   * @param {Object} queryParams
   * @param {string} [queryParams.status] - 'UPCOMING' | 'HISTORY' | specific status
   * @param {number} [queryParams.page=1]
   * @param {number} [queryParams.limit=10]
   */
  async listCustomerBookings(actorUser, queryParams = {}) {
    const { status, page = 1, limit = 10 } = queryParams;

    const baseFilter = {
      $or: [
        { customerId: actorUser._id },
        { createdBy: actorUser._id },
      ],
    };

    const todayVN = getCurrentDateVN();
    const nowMinutes = parseTimeToMinutes(getCurrentTimeVN());

    if (status === 'UPCOMING') {
      baseFilter.status = { $in: ['CONFIRMED', 'PENDING_PAYMENT'] };
      baseFilter.$and = [
        {
          $or: [
            { bookingDate: { $gt: todayVN } },
            { bookingDate: todayVN, endMinutes: { $gt: nowMinutes } },
          ],
        },
      ];
    } else if (status === 'HISTORY') {
      baseFilter.$or = [
        { customerId: actorUser._id, status: { $in: ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED'] } },
        { customerId: actorUser._id, bookingDate: { $lt: todayVN } },
        { customerId: actorUser._id, bookingDate: todayVN, endMinutes: { $lte: nowMinutes } },
        { createdBy: actorUser._id, status: { $in: ['COMPLETED', 'NO_SHOW', 'CANCELLED', 'EXPIRED'] } },
        { createdBy: actorUser._id, bookingDate: { $lt: todayVN } },
        { createdBy: actorUser._id, bookingDate: todayVN, endMinutes: { $lte: nowMinutes } },
      ];
    } else if (status) {
      baseFilter.status = status;
    }

    const { items, total, totalPages } = await bookingRepository.findPaginated(
      baseFilter,
      {
        page,
        limit,
        sort: { bookingDate: -1, startMinutes: -1 },
      }
    );

    return {
      items: items.map((b) => this.toBookingDTO(b)),
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        total,
        totalPages,
      },
    };
  }

  /**
   * Gets booking detail for a customer (CUS-02, Criterion 5)
   * @param {Object} actorUser
   * @param {string} bookingId
   */
  async getCustomerBookingById(actorUser, bookingId) {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw AppError.badRequest('ID đơn đặt không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw AppError.notFound('Không tìm thấy đơn đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    // Verify customer ownership (Criterion 5: Customer A cannot view Customer B)
    if (actorUser.role === 'CUSTOMER') {
      const isOwner =
        (booking.customerId && booking.customerId.toString() === actorUser._id.toString()) ||
        (booking.createdBy && booking.createdBy.toString() === actorUser._id.toString());
      if (!isOwner) {
        throw AppError.forbidden('Bạn không có quyền xem đơn đặt của khách hàng khác.', ERROR_CODES.FORBIDDEN);
      }
    }

    const paymentOrder = await paymentOrderRepository.findByBookingRequestId(booking.bookingRequestId);

    return this.toBookingDTO(booking, {
      paymentOrder: paymentOrder
        ? {
            id: paymentOrder._id.toString(),
            vnpayTxnRef: paymentOrder.vnpayTxnRef,
            status: paymentOrder.status,
            expectedAmountVnd: paymentOrder.expectedAmountVnd,
            expiresAt: paymentOrder.expiresAt ? paymentOrder.expiresAt.toISOString() : null,
          }
        : null,
    });
  }

  /**
   * Lists bookings for facility owner with filters & customer contact details (OWN-07, Criterion 4)
   * @param {Object} actorUser
   * @param {Object} queryParams
   */
  async listOwnerBookings(actorUser, queryParams = {}) {
    const { facilityId, courtId, date, status, page = 1, limit = 10 } = queryParams;

    // 1. Find all facilities belonging to owner
    const facilities = await facilityRepository.findByOwner(actorUser._id);
    const ownerFacilityIds = facilities.map((f) => f._id.toString());

    if (ownerFacilityIds.length === 0) {
      return {
        items: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      };
    }

    const filter = {};

    if (facilityId) {
      if (!ownerFacilityIds.includes(facilityId.toString())) {
        throw AppError.forbidden('Bạn không có quyền xem đơn của cơ sở khác.', ERROR_CODES.FORBIDDEN);
      }
      filter.facilityId = facilityId;
    } else {
      filter.facilityId = { $in: ownerFacilityIds };
    }

    if (courtId) {
      if (!mongoose.Types.ObjectId.isValid(courtId)) {
        throw AppError.badRequest('ID sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
      }
      filter.courtId = courtId;
    }

    if (date) {
      filter.bookingDate = date;
    }

    if (status) {
      filter.status = status;
    }

    const { items, total, totalPages } = await bookingRepository.findPaginated(
      filter,
      {
        page,
        limit,
        sort: { bookingDate: -1, startMinutes: -1 },
      }
    );

    // Populate customer contact details from BookingRequest for owner service (OWN-07)
    const requestIds = [...new Set(items.map((b) => b.bookingRequestId.toString()))];
    const requests = await bookingRequestRepository.findById
      ? await Promise.all(requestIds.map((id) => bookingRequestRepository.findById(id)))
      : [];
    const requestMap = new Map();
    for (const req of requests) {
      if (req) requestMap.set(req._id.toString(), req);
    }

    const populatedItems = items.map((b) => {
      const bReq = requestMap.get(b.bookingRequestId.toString());
      return this.toBookingDTO(b, {
        contactName: bReq?.contactName || '',
        contactPhone: bReq?.contactPhone || '',
      });
    });

    return {
      items: populatedItems,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        total,
        totalPages,
      },
    };
  }

  /**
   * Gets booking detail for owner (OWN-07, Criterion 4)
   * @param {Object} actorUser
   * @param {string} bookingId
   */
  async getOwnerBookingById(actorUser, bookingId) {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw AppError.badRequest('ID đơn đặt không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw AppError.notFound('Không tìm thấy đơn đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    const facility = await facilityRepository.findById(booking.facilityId);
    if (!facility || facility.ownerId.toString() !== actorUser._id.toString()) {
      throw AppError.forbidden('Bạn không có quyền xem đơn thuộc cơ sở của chủ sân khác.', ERROR_CODES.FORBIDDEN);
    }

    const [bookingRequest, paymentOrder] = await Promise.all([
      bookingRequestRepository.findById(booking.bookingRequestId),
      paymentOrderRepository.findByBookingRequestId(booking.bookingRequestId),
    ]);

    return this.toBookingDTO(booking, {
      contactName: bookingRequest?.contactName || '',
      contactPhone: bookingRequest?.contactPhone || '',
      paymentOrder: paymentOrder
        ? {
            id: paymentOrder._id.toString(),
            vnpayTxnRef: paymentOrder.vnpayTxnRef,
            status: paymentOrder.status,
            expectedAmountVnd: paymentOrder.expectedAmountVnd,
            expiresAt: paymentOrder.expiresAt ? paymentOrder.expiresAt.toISOString() : null,
          }
        : null,
    });
  }

  /**
   * Lists all bookings for Admin (ADM-03)
   * @param {Object} queryParams
   */
  async listAdminBookings(queryParams = {}) {
    const { bookingCode, status, facilityId, courtId, date, page = 1, limit = 10 } = queryParams;

    const filter = {};
    if (bookingCode) {
      filter.bookingCode = { $regex: bookingCode.trim(), $options: 'i' };
    }
    if (status) {
      filter.status = status;
    }
    if (facilityId) {
      filter.facilityId = facilityId;
    }
    if (courtId) {
      filter.courtId = courtId;
    }
    if (date) {
      filter.bookingDate = date;
    }

    const { items, total, totalPages } = await bookingRepository.findPaginated(
      filter,
      {
        page,
        limit,
        sort: { createdAt: -1 },
      }
    );

    return {
      items: items.map((b) => this.toBookingDTO(b)),
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        total,
        totalPages,
      },
    };
  }

  /**
   * Gets booking detail for Admin
   * @param {string} bookingId
   */
  async getAdminBookingById(bookingId) {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      throw AppError.badRequest('ID đơn đặt không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw AppError.notFound('Không tìm thấy đơn đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    const [bookingRequest, paymentOrder] = await Promise.all([
      bookingRequestRepository.findById(booking.bookingRequestId),
      paymentOrderRepository.findByBookingRequestId(booking.bookingRequestId),
    ]);

    return this.toBookingDTO(booking, {
      contactName: bookingRequest?.contactName || '',
      contactPhone: bookingRequest?.contactPhone || '',
      paymentOrder: paymentOrder
        ? {
            id: paymentOrder._id.toString(),
            vnpayTxnRef: paymentOrder.vnpayTxnRef,
            status: paymentOrder.status,
            expectedAmountVnd: paymentOrder.expectedAmountVnd,
            expiresAt: paymentOrder.expiresAt ? paymentOrder.expiresAt.toISOString() : null,
          }
        : null,
    });
  }
}

export const bookingLifecycleService = new BookingLifecycleService();
export default bookingLifecycleService;
