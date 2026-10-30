import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { bookingRequestRepository } from '../../repositories/booking-request.repository.js';
import { bookingRepository } from '../../repositories/booking.repository.js';
import { paymentOrderRepository } from '../../repositories/payment-order.repository.js';
import { courtDayScheduleRepository } from '../../repositories/court-day-schedule.repository.js';
import { courtRepository } from '../../repositories/court.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { facilitySportRepository } from '../../repositories/facility-sport.repository.js';
import { CourtBlock } from '../../models/court-block.model.js';
import { User } from '../../models/user.model.js';
import { withTransaction } from '../../database/transaction.js';
import { mergeContiguousSlots, isOverlapping } from './slot-merger.js';
import { calculateBookingRequestTotal } from './pricing.js';
import {
  validateBookingDateRange,
  validateAdvanceNotice,
  validateConfigVersion,
  validatePriceVersion,
} from './booking-policy.js';
import { getFacilityOperatingHoursForDate } from '../../utils/date-time.js';
import { bookingCleanupService } from './booking-cleanup.service.js';
import { vnpayClient } from '../../integrations/vnpay.client.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

/**
 * Computes a deterministic SHA-256 fingerprint for a booking request payload.
 * Used for Idempotency Key validation (Section 8.3.3, Criterion 10).
 *
 * @param {Object} params
 * @param {string} params.courtId
 * @param {string} params.bookingDate
 * @param {number} params.configVersion
 * @param {Array<{ startTime: string, endTime: string }>} params.selectedSlots
 * @param {string} params.contactName
 * @param {string} params.contactPhone
 * @returns {string} SHA-256 hex string
 */
export function computePayloadFingerprint({
  courtId,
  bookingDate,
  configVersion,
  operatingHoursVersion,
  priceVersion,
  selectedSlots,
  contactName,
  contactPhone,
}) {
  const sortedSlots = [...selectedSlots].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
  const slotsString = sortedSlots.map((s) => `${s.startTime.trim()}-${s.endTime.trim()}`).join(',');
  const canonicalString = [
    courtId.toString().trim(),
    bookingDate.trim(),
    configVersion.toString().trim(),
    operatingHoursVersion !== undefined && operatingHoursVersion !== null
      ? operatingHoursVersion.toString().trim()
      : '',
    priceVersion !== undefined && priceVersion !== null
      ? priceVersion.toString().trim()
      : '',
    slotsString,
    contactName.trim().toLowerCase(),
    contactPhone.trim(),
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

/**
 * Computes a deterministic guest access code derived from a server-side HMAC secret
 * and unique bookingRequestId + idempotencyKey (Section 8.3.3, Criterion 52).
 * Plaintext secret is NEVER stored in database; sha256 hash is stored.
 *
 * @param {string|mongoose.Types.ObjectId} bookingRequestId
 * @param {string} idempotencyKey
 * @returns {string} 32-character hexadecimal code
 */
export function deriveGuestAccessCode(bookingRequestId, idempotencyKey) {
  const secret = env.JWT_ACCESS_SECRET || 'sport-booking-guest-secret-min32chars';
  return crypto
    .createHmac('sha256', secret)
    .update(`guest-access:${bookingRequestId.toString()}:${idempotencyKey.trim()}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Generates human-readable unique business identifiers
 */
export function generateRequestNumber(bookingDate) {
  const dateCompact = bookingDate.replace(/-/g, '');
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BR${dateCompact}-${randomHex}`;
}

export function generateBookingCode(bookingDate, index = 1) {
  const dateCompact = bookingDate.replace(/-/g, '');
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `BK${dateCompact}-${randomHex}${index}`;
}

export function generateVnpayTxnRef() {
  const timestamp = Date.now().toString().slice(-8);
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `PO${timestamp}${randomHex}`;
}

export class BookingRequestService {
  /**
   * Creates a BookingRequest, child Bookings, and PaymentOrder atomically.
   * Core workflow shared by Customer and Owner on-behalf (Section 8.3, CUS-01, OWN-08).
   *
   * @param {Object} actorUser - Authenticated user initiating request
   * @param {Object} inputData
   * @param {'CUSTOMER_ONLINE'|'OWNER_ON_BEHALF'} source
   * @returns {Promise<Object>} Created DTO
   */
  async createBookingRequest(actorUser, inputData, source = 'CUSTOMER_ONLINE') {
    const {
      courtId,
      bookingDate,
      configVersion,
      operatingHoursVersion,
      priceVersion,
      expectedAmountVnd,
      selectedSlots,
      contactName,
      contactPhone,
      idempotencyKey,
    } = inputData;

    // 1. Basic validation
    if (!courtId || !mongoose.Types.ObjectId.isValid(courtId)) {
      throw AppError.badRequest('ID sân thể thao không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!bookingDate) {
      throw AppError.badRequest('Ngày đặt sân là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!Array.isArray(selectedSlots) || selectedSlots.length === 0) {
      throw AppError.badRequest('Danh sách ô giờ được chọn không được để trống.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!contactName || typeof contactName !== 'string' || !contactName.trim()) {
      throw AppError.badRequest('Họ tên người liên hệ là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!contactPhone || typeof contactPhone !== 'string' || !contactPhone.trim()) {
      throw AppError.badRequest('Số điện thoại người liên hệ là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      throw AppError.badRequest('Mã chống lặp (idempotencyKey) là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (typeof configVersion !== 'number') {
      throw AppError.badRequest('Phiên bản cấu hình (configVersion) là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (operatingHoursVersion !== undefined && operatingHoursVersion !== null && typeof operatingHoursVersion !== 'number') {
      throw AppError.badRequest('Phiên bản giờ hoạt động (operatingHoursVersion) không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (priceVersion !== undefined && priceVersion !== null && typeof priceVersion !== 'number') {
      throw AppError.badRequest('Phiên bản bảng giá (priceVersion) không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    // 2. Booking date range check (today up to 30 days ahead)
    validateBookingDateRange(bookingDate, 30);

    // 3. Compute deterministic fingerprint for idempotency checking (Criterion 10)
    const payloadFingerprint = computePayloadFingerprint({
      courtId,
      bookingDate,
      configVersion,
      operatingHoursVersion,
      priceVersion,
      selectedSlots,
      contactName,
      contactPhone,
    });

    // 4. Execute creation within a MongoDB ACID transaction
    return withTransaction(async (session) => {
      // 4.1. Check Idempotency Key (Criterion 10)
      const existingRequest = await bookingRequestRepository.findByIdempotencyKey(
        actorUser._id,
        idempotencyKey.trim(),
        session
      );

      if (existingRequest) {
        if (existingRequest.payloadFingerprint === payloadFingerprint) {
          // Idempotent hit: safely resume order without extending hold or creating new records
          const existingBookings = await bookingRepository.findByRequestId(existingRequest._id, session);
          const existingPaymentOrder = await paymentOrderRepository.findByBookingRequestId(existingRequest._id, session);

          const now = new Date();
          const isHoldExpired =
            now >= new Date(existingRequest.holdExpiresAt) ||
            existingPaymentOrder?.status === 'EXPIRED';
          const isPaid =
            existingPaymentOrder?.status === 'PAID' ||
            existingRequest.status === 'CONFIRMED';
          const isCancelled =
            existingRequest.status === 'CANCELLED' ||
            existingPaymentOrder?.status === 'CANCELLED';

          let rawGuestAccessCode = null;
          let guestAccessLink = undefined;
          if (source === 'OWNER_ON_BEHALF' && existingPaymentOrder) {
            rawGuestAccessCode = deriveGuestAccessCode(
              existingRequest._id,
              existingRequest.idempotencyKey
            );
            guestAccessLink = `/guest-pay/${existingPaymentOrder._id}?code=${rawGuestAccessCode}`;
          }

          // Case 1: Already paid
          if (isPaid) {
            return {
              bookingRequestId: existingRequest._id.toString(),
              requestNumber: existingRequest.requestNumber,
              totalAmountVnd: existingRequest.totalAmountVnd,
              holdExpiresAt: existingRequest.holdExpiresAt.toISOString(),
              status: 'PAID',
              isPaid: true,
              bookings: existingBookings.map((b) => ({
                bookingId: b._id.toString(),
                bookingCode: b.bookingCode,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
                totalPriceVnd: b.totalPriceVnd,
              })),
              paymentOrder: existingPaymentOrder
                ? {
                    paymentOrderId: existingPaymentOrder._id.toString(),
                    vnpayTxnRef: existingPaymentOrder.vnpayTxnRef,
                    amountVnd: existingPaymentOrder.expectedAmountVnd,
                    status: 'PAID',
                    paymentUrl: '',
                  }
                : null,
              ...(guestAccessLink ? { guestAccessLink } : {}),
            };
          }

          // Case 2: Cancelled
          if (isCancelled) {
            return {
              bookingRequestId: existingRequest._id.toString(),
              requestNumber: existingRequest.requestNumber,
              totalAmountVnd: existingRequest.totalAmountVnd,
              holdExpiresAt: existingRequest.holdExpiresAt.toISOString(),
              status: 'CANCELLED',
              isCancelled: true,
              bookings: existingBookings.map((b) => ({
                bookingId: b._id.toString(),
                bookingCode: b.bookingCode,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
                totalPriceVnd: b.totalPriceVnd,
              })),
              paymentOrder: existingPaymentOrder
                ? {
                    paymentOrderId: existingPaymentOrder._id.toString(),
                    vnpayTxnRef: existingPaymentOrder.vnpayTxnRef,
                    amountVnd: existingPaymentOrder.expectedAmountVnd,
                    status: 'CANCELLED',
                    paymentUrl: '',
                  }
                : null,
              ...(guestAccessLink ? { guestAccessLink } : {}),
            };
          }

          // Case 3: Hold expired (do not extend hold, do not create new order)
          if (isHoldExpired) {
            return {
              bookingRequestId: existingRequest._id.toString(),
              requestNumber: existingRequest.requestNumber,
              totalAmountVnd: existingRequest.totalAmountVnd,
              holdExpiresAt: existingRequest.holdExpiresAt.toISOString(),
              status: 'EXPIRED',
              isExpired: true,
              bookings: existingBookings.map((b) => ({
                bookingId: b._id.toString(),
                bookingCode: b.bookingCode,
                startTime: b.startTime,
                endTime: b.endTime,
                durationMinutes: b.durationMinutes,
                totalPriceVnd: b.totalPriceVnd,
              })),
              paymentOrder: existingPaymentOrder
                ? {
                    paymentOrderId: existingPaymentOrder._id.toString(),
                    vnpayTxnRef: existingPaymentOrder.vnpayTxnRef,
                    amountVnd: existingPaymentOrder.expectedAmountVnd,
                    status: 'EXPIRED',
                    paymentUrl: '',
                  }
                : null,
              ...(guestAccessLink ? { guestAccessLink } : {}),
            };
          }

          // Case 4: Active unexpired PENDING order -> Generate fresh live paymentUrl preserving original holdExpiresAt
          const paymentUrl = existingPaymentOrder
            ? vnpayClient.createPaymentUrl({
                txnRef: existingPaymentOrder.vnpayTxnRef,
                amountVnd: existingPaymentOrder.expectedAmountVnd,
                orderInfo: `Thanh toan don dat san ${existingRequest.requestNumber}`,
                createDate: existingPaymentOrder.createdAt,
                expireDate: existingRequest.holdExpiresAt, // Preserves original hold!
              })
            : '';

          return {
            bookingRequestId: existingRequest._id.toString(),
            requestNumber: existingRequest.requestNumber,
            totalAmountVnd: existingRequest.totalAmountVnd,
            holdExpiresAt: existingRequest.holdExpiresAt.toISOString(),
            status: 'PENDING',
            bookings: existingBookings.map((b) => ({
              bookingId: b._id.toString(),
              bookingCode: b.bookingCode,
              startTime: b.startTime,
              endTime: b.endTime,
              durationMinutes: b.durationMinutes,
              totalPriceVnd: b.totalPriceVnd,
            })),
            paymentOrder: existingPaymentOrder
              ? {
                  paymentOrderId: existingPaymentOrder._id.toString(),
                  vnpayTxnRef: existingPaymentOrder.vnpayTxnRef,
                  amountVnd: existingPaymentOrder.expectedAmountVnd,
                  status: 'PENDING',
                  paymentUrl,
                }
              : null,
            ...(guestAccessLink ? { guestAccessLink } : {}),
          };
        } else {
          // Same key but different content: reject (Criterion 10)
          throw AppError.badRequest(
            'Mã idempotencyKey này đã được dùng cho một yêu cầu có nội dung khác.',
            ERROR_CODES.VALIDATION_ERROR
          );
        }
      }

      // 4.2. Verify Actor status within transaction
      const liveUser = await User.findById(actorUser._id).session(session);
      if (!liveUser || liveUser.isLocked) {
        throw AppError.forbidden('Tài khoản của bạn đang bị khóa hoặc không khả dụng.', ERROR_CODES.ACCOUNT_LOCKED);
      }

      if (source === 'CUSTOMER_ONLINE') {
        if (!liveUser.emailVerifiedAt) {
          throw AppError.forbidden(
            'Tài khoản chưa xác thực email. Vui lòng xác thực email trước khi đặt sân.',
            ERROR_CODES.ACCOUNT_NOT_VERIFIED
          );
        }
      } else if (source === 'OWNER_ON_BEHALF') {
        if (liveUser.role !== 'OWNER' || !liveUser.activatedAt) {
          throw AppError.forbidden(
            'Chỉ chủ sân đã kích hoạt mới có quyền tạo đơn đặt hộ.',
            ERROR_CODES.FORBIDDEN
          );
        }
      }

      // 4.3. Verify Court, Facility, and FacilitySport within transaction
      const court = await courtRepository.findById(courtId, session);
      if (!court || !court.isActive) {
        throw AppError.notFound('Không tìm thấy sân thể thao hoặc sân đã ngừng nhận đặt.', ERROR_CODES.COURT_NOT_FOUND);
      }

      const facility = await facilityRepository.findById(court.facilityId, session);
      if (!facility || facility.status !== 'PUBLISHED' || facility.isLockedByAdmin) {
        throw AppError.notFound(
          'Cơ sở thể thao không công khai hoặc đang tạm dừng hoạt động.',
          ERROR_CODES.FACILITY_NOT_FOUND
        );
      }

      // Verify facility owner is active and not locked (PUB-01, Criterion 175, Issue 1)
      const facilityOwner = await User.findById(facility.ownerId).session(session);
      if (!facilityOwner || facilityOwner.isLocked || !facilityOwner.activatedAt) {
        throw AppError.forbidden(
          'Cơ sở thể thao hoặc chủ sân đang bị khóa, không thể nhận đặt sân.',
          ERROR_CODES.FACILITY_NOT_FOUND
        );
      }

      if (source === 'OWNER_ON_BEHALF' && facility.ownerId.toString() !== actorUser._id.toString()) {
        throw AppError.forbidden('Chủ sân chỉ được tạo đơn đặt hộ tại cơ sở thuộc quyền sở hữu của mình.', ERROR_CODES.FORBIDDEN);
      }

      const facilitySport = await facilitySportRepository.findById(court.facilitySportId, session);
      if (!facilitySport) {
        throw AppError.notFound('Không tìm thấy cấu hình môn thể thao tại cơ sở.', ERROR_CODES.FACILITY_SPORT_NOT_FOUND);
      }

      // 4.4. Verify configuration and price version match (Criterion 33, Criterion 34, Issue 3, B03)
      validateConfigVersion(configVersion, facilitySport.configVersion);

      if (operatingHoursVersion !== undefined && operatingHoursVersion !== null) {
        if (operatingHoursVersion !== facility.operatingHoursVersion) {
          throw AppError.conflict(
            'Cấu hình giờ hoạt động hoặc bước giờ đã thay đổi. Vui lòng tải lại thông tin sân.',
            ERROR_CODES.CONFIG_VERSION_MISMATCH
          );
        }
      }

      if (priceVersion !== undefined && priceVersion !== null) {
        validatePriceVersion(priceVersion, court.priceVersion);
      }

      // 4.5. Resolve weekly operating hours and merge contiguous slots (B03)
      const dayHours = getFacilityOperatingHoursForDate(facility, bookingDate);
      if (!dayHours.isOpen) {
        throw AppError.badRequest(
          'Cơ sở thể thao không mở cửa vào ngày này.',
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const mergedIntervals = mergeContiguousSlots(
        selectedSlots,
        dayHours.openTime,
        dayHours.closeTime,
        facilitySport.slotStepMinutes
      );

      // 4.6. Validate advance notice (15 min for customer booking, 0 for owner on-behalf - Criterion 11)
      const earliestStartTime = mergedIntervals[0].startTime;
      const minAdvance = source === 'CUSTOMER_ONLINE' ? 15 : 0;
      validateAdvanceNotice(bookingDate, earliestStartTime, minAdvance);

      // 4.7. Calculate pricing for merged intervals using multi-tier pricing rules (B03, Criteria 6, 24, 32)
      const pricingResult = calculateBookingRequestTotal(
        mergedIntervals,
        { pricingRules: court.pricingRules, pricePerHourVnd: court.pricePerHourVnd },
        dayHours.dayType
      );
      const totalAmountVnd = pricingResult.totalPriceVnd;

      // 4.7.1 Verify expected amount if provided by customer (Criterion 5 B03)
      if (expectedAmountVnd !== undefined && expectedAmountVnd !== null && Number(expectedAmountVnd) !== totalAmountVnd) {
        throw AppError.conflict(
          `Báo giá đã thay đổi từ ${Number(expectedAmountVnd).toLocaleString('vi-VN')}đ sang ${totalAmountVnd.toLocaleString('vi-VN')}đ. Vui lòng xác nhận lại số tiền trước khi tiếp tục.`,
          ERROR_CODES.CONFIG_VERSION_MISMATCH
        );
      }

      // 4.8. Acquire atomic write coordination lock on Court document (Issue 2) and CourtDaySchedule (Section 8.3.3)
      await courtRepository.touchCoordination(courtId, session);
      await courtDayScheduleRepository.acquireCoordinationLock(courtId, bookingDate, session);

      // 4.9. Read occupying schedules and check for overlap within the lock
      const now = new Date();
      const holdExpiresAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes hold (Criterion 46)

      // Eagerly cleanup any expired holds for this court/date (Criterion 51)
      await bookingCleanupService.eagerCleanupCourtExpiredHolds(courtId, bookingDate, now, session);

      const activeBookings = await bookingRepository.findActiveByCourtAndDate(courtId, bookingDate, session);
      const activeBlocks = await CourtBlock.find({
        courtId,
        bookingDate,
        isActive: true,
      }).session(session);

      // Filter active occupied intervals:
      // - Confirmed, completed, or no-show bookings
      // - Pending bookings whose hold has NOT yet expired
      const occupiedIntervals = [
        ...activeBookings
          .filter(
            (b) =>
              ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(b.status) ||
              (b.status === 'PENDING_PAYMENT' && b.holdExpiresAt && new Date(b.holdExpiresAt) > now)
          )
          .map((b) => ({
            startTime: b.startTime,
            endTime: b.endTime,
            startMinutes: b.startMinutes,
            endMinutes: b.endMinutes,
          })),
        ...activeBlocks.map((blk) => ({
          startTime: blk.startTime,
          endTime: blk.endTime,
          startMinutes: blk.startMinutes,
          endMinutes: blk.endMinutes,
        })),
      ];

      // Check conflict for each merged interval (Criterion 7, Criterion 8, Criterion 31)
      for (const interval of pricingResult.intervals) {
        for (const occupied of occupiedIntervals) {
          if (isOverlapping(interval, occupied)) {
            throw AppError.conflict(
              `Khoảng thời gian ${interval.startTime}–${interval.endTime} đã có người đặt hoặc bị khóa.`,
              ERROR_CODES.SCHEDULE_CONFLICT
            );
          }
        }
      }

      // 4.10. Generate identifiers
      const requestNumber = generateRequestNumber(bookingDate);
      const vnpayTxnRef = generateVnpayTxnRef();
      const bookingRequestId = new mongoose.Types.ObjectId();

      let guestAccessCodeHash = null;
      let rawGuestAccessCode = null;
      if (source === 'OWNER_ON_BEHALF') {
        rawGuestAccessCode = deriveGuestAccessCode(bookingRequestId, idempotencyKey.trim());
        guestAccessCodeHash = crypto.createHash('sha256').update(rawGuestAccessCode).digest('hex');
      }

      // 4.11. Create BookingRequest record
      const bookingRequest = await bookingRequestRepository.create(
        {
          _id: bookingRequestId,
          requestNumber,
          customerId: source === 'CUSTOMER_ONLINE' ? actorUser._id : null,
          createdBy: actorUser._id,
          source,
          courtId,
          facilityId: court.facilityId,
          bookingDate,
          totalAmountVnd,
          holdExpiresAt,
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim(),
          guestAccessCodeHash,
          idempotencyKey: idempotencyKey.trim(),
          payloadFingerprint,
        },
        session
      );

      // 4.12. Create child Booking records (one per merged interval - Criteria 6, 26, 27)
      const sportName =
        (typeof court.sportId === 'object' && court.sportId?.name) ||
        (typeof facilitySport.sportId === 'object' && facilitySport.sportId?.name) ||
        'Thể thao';

      const bookingsData = pricingResult.intervals.map((interval, index) => ({
        bookingCode: generateBookingCode(bookingDate, index + 1),
        bookingRequestId: bookingRequest._id,
        customerId: source === 'CUSTOMER_ONLINE' ? actorUser._id : null,
        createdBy: actorUser._id,
        source,
        courtId,
        facilityId: court.facilityId,
        bookingDate,
        startTime: interval.startTime,
        endTime: interval.endTime,
        startMinutes: interval.startMinutes,
        endMinutes: interval.endMinutes,
        durationMinutes: interval.durationMinutes,
        pricePerHourVnd: interval.pricingSnapshot?.[0]?.pricePerHourVnd || court.pricePerHourVnd,
        totalPriceVnd: interval.priceVnd,
        pricingSnapshot: interval.pricingSnapshot || [],
        allocatedAmountVnd: 0,
        status: 'PENDING_PAYMENT',
        paymentStatus: 'UNPAID',
        holdExpiresAt,
        snapshot: {
          facilityName: facility.name,
          facilityAddress: facility.address,
          courtName: court.name,
          sportName,
          slotStepMinutes: facilitySport.slotStepMinutes,
        },
      }));

      const createdBookings = await bookingRepository.createMany(bookingsData, session);

      // 4.13. Create PaymentOrder record (Criterion 35: 100% total amount across all intervals)
      const paymentOrder = await paymentOrderRepository.create(
        {
          bookingRequestId: bookingRequest._id,
          vnpayTxnRef,
          expectedAmountVnd: totalAmountVnd,
          status: 'PENDING',
          expiresAt: holdExpiresAt,
          processingVersion: 1,
        },
        session
      );

      // 4.14. Build output DTO
      const outputDTO = {
        bookingRequestId: bookingRequest._id.toString(),
        requestNumber: bookingRequest.requestNumber,
        totalAmountVnd: bookingRequest.totalAmountVnd,
        holdExpiresAt: bookingRequest.holdExpiresAt.toISOString(),
        bookings: createdBookings.map((b) => ({
          bookingId: b._id.toString(),
          bookingCode: b.bookingCode,
          startTime: b.startTime,
          endTime: b.endTime,
          durationMinutes: b.durationMinutes,
          totalPriceVnd: b.totalPriceVnd,
        })),
        paymentOrder: {
          paymentOrderId: paymentOrder._id.toString(),
          vnpayTxnRef: paymentOrder.vnpayTxnRef,
          amountVnd: paymentOrder.expectedAmountVnd,
          paymentUrl: vnpayClient.createPaymentUrl({
            txnRef: paymentOrder.vnpayTxnRef,
            amountVnd: paymentOrder.expectedAmountVnd,
            orderInfo: `Thanh toan don dat san ${bookingRequest.requestNumber}`,
            createDate: paymentOrder.createdAt,
            expireDate: holdExpiresAt,
          }),
        },
      };

      if (source === 'OWNER_ON_BEHALF') {
        outputDTO.guestAccessLink = `/guest-pay/${paymentOrder._id}?code=${rawGuestAccessCode}`;
      }

      return outputDTO;
    });
  }

  /**
   * Retrieves detail of a booking request along with its child bookings
   *
   * @param {Object} actorUser
   * @param {string} id
   * @returns {Promise<Object>} BookingRequestDetailDTO
   */
  async getBookingRequestById(actorUser, id) {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw AppError.badRequest('ID yêu cầu đặt sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const bookingRequest = await bookingRequestRepository.findById(id);
    if (!bookingRequest) {
      throw AppError.notFound('Không tìm thấy yêu cầu đặt sân.', ERROR_CODES.NOT_FOUND);
    }

    // Role-based access control
    if (actorUser.role === 'CUSTOMER') {
      const isOwnerOfRequest =
        (bookingRequest.customerId && bookingRequest.customerId.toString() === actorUser.id) ||
        (bookingRequest.createdBy && bookingRequest.createdBy.toString() === actorUser.id);
      if (!isOwnerOfRequest) {
        throw AppError.forbidden('Bạn không có quyền truy cập yêu cầu đặt sân của người khác.', ERROR_CODES.FORBIDDEN);
      }
    } else if (actorUser.role === 'OWNER') {
      const facility = await facilityRepository.findById(bookingRequest.facilityId);
      if (!facility || facility.ownerId.toString() !== actorUser.id) {
        throw AppError.forbidden('Chủ sân chỉ được xem yêu cầu thuộc các cơ sở của mình.', ERROR_CODES.FORBIDDEN);
      }
    }

    const [bookings, paymentOrder] = await Promise.all([
      bookingRepository.findByRequestId(bookingRequest._id),
      paymentOrderRepository.findByBookingRequestId(bookingRequest._id),
    ]);

    return {
      id: bookingRequest._id.toString(),
      requestNumber: bookingRequest.requestNumber,
      courtId: bookingRequest.courtId.toString(),
      bookingDate: bookingRequest.bookingDate,
      totalAmountVnd: bookingRequest.totalAmountVnd,
      holdExpiresAt: bookingRequest.holdExpiresAt.toISOString(),
      paymentStatus: paymentOrder ? paymentOrder.status : 'PENDING',
      bookings: bookings.map((b) => ({
        id: b._id.toString(),
        bookingCode: b.bookingCode,
        facilityName: b.snapshot?.facilityName || '',
        courtName: b.snapshot?.courtName || '',
        sportName: b.snapshot?.sportName || '',
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        durationMinutes: b.durationMinutes,
        pricePerHourVnd: b.pricePerHourVnd,
        totalPriceVnd: b.totalPriceVnd,
        pricingSnapshot: b.pricingSnapshot || [],
        status: b.status,
        paymentStatus: b.paymentStatus,
        createdAt: b.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Official price quote calculation for a selection of slots on a given court and date (B03)
   * @param {Object} actorUser
   * @param {Object} inputData
   * @returns {Promise<Object>}
   */
  async getBookingQuote(actorUser, inputData) {
    const { courtId, bookingDate, selectedSlots } = inputData;

    if (!courtId || !mongoose.Types.ObjectId.isValid(courtId)) {
      throw AppError.badRequest('ID sân thể thao không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!bookingDate) {
      throw AppError.badRequest('Ngày đặt sân là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!Array.isArray(selectedSlots) || selectedSlots.length === 0) {
      throw AppError.badRequest('Danh sách ô giờ được chọn không được để trống.', ERROR_CODES.VALIDATION_ERROR);
    }

    validateBookingDateRange(bookingDate, 30);

    const court = await courtRepository.findById(courtId);
    if (!court || !court.isActive) {
      throw AppError.notFound('Không tìm thấy sân thể thao.', ERROR_CODES.COURT_NOT_FOUND);
    }

    const facility = await facilityRepository.findById(court.facilityId);
    if (!facility || facility.status !== 'PUBLISHED' || facility.isLockedByAdmin) {
      throw AppError.notFound('Không tìm thấy cơ sở thể thao công khai.', ERROR_CODES.FACILITY_NOT_FOUND);
    }

    const owner = await User.findById(facility.ownerId);
    if (!owner || owner.isLocked || !owner.activatedAt) {
      throw AppError.forbidden('Cơ sở thể thao hoặc chủ sân đang bị khóa, không thể nhận đặt sân.', ERROR_CODES.FACILITY_NOT_FOUND);
    }

    const facilitySport = await facilitySportRepository.findById(court.facilitySportId);
    if (!facilitySport) {
      throw AppError.notFound('Không tìm thấy cấu hình môn thể thao tại cơ sở.', ERROR_CODES.FACILITY_SPORT_NOT_FOUND);
    }

    const dayHours = getFacilityOperatingHoursForDate(facility, bookingDate);
    if (!dayHours.isOpen) {
      throw AppError.badRequest('Cơ sở thể thao không mở cửa vào ngày này.', ERROR_CODES.VALIDATION_ERROR);
    }

    const mergedIntervals = mergeContiguousSlots(
      selectedSlots,
      dayHours.openTime,
      dayHours.closeTime,
      facilitySport.slotStepMinutes
    );

    const pricingResult = calculateBookingRequestTotal(
      mergedIntervals,
      { pricingRules: court.pricingRules, pricePerHourVnd: court.pricePerHourVnd },
      dayHours.dayType
    );

    return {
      courtId: court._id.toString(),
      courtName: court.name,
      facilityId: facility._id.toString(),
      facilityName: facility.name,
      bookingDate,
      dayOfWeek: dayHours.dayOfWeek,
      dayType: dayHours.dayType,
      priceVersion: court.priceVersion || 1,
      operatingHoursVersion: facility.operatingHoursVersion || 1,
      configVersion: facilitySport.configVersion,
      totalAmountVnd: pricingResult.totalPriceVnd,
      totalDurationMinutes: pricingResult.totalDurationMinutes,
      intervals: pricingResult.intervals,
    };
  }
}

export const bookingRequestService = new BookingRequestService();
export default bookingRequestService;

