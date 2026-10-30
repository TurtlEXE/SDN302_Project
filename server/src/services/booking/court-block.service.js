import mongoose from 'mongoose';
import { CourtBlock } from '../../models/court-block.model.js';
import { courtBlockRepository } from '../../repositories/court-block.repository.js';
import { courtRepository } from '../../repositories/court.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { facilitySportRepository } from '../../repositories/facility-sport.repository.js';
import { bookingRepository } from '../../repositories/booking.repository.js';
import { courtDayScheduleRepository } from '../../repositories/court-day-schedule.repository.js';
import { actionLogRepository } from '../../repositories/action-log.repository.js';
import { withTransaction } from '../../database/transaction.js';
import { mergeContiguousSlots, isOverlapping } from './slot-merger.js';
import { validateBookingDateRange, validateAdvanceNotice } from './booking-policy.js';
import { getFacilityOperatingHoursForDate } from '../../utils/date-time.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

export class CourtBlockService {
  /**
   * Creates one or more continuous CourtBlock entries for maintenance/blocking (OWN-06, Criteria 9, 31).
   * Validates contiguous intervals and merges them.
   * Acquires atomic write lock on CourtDaySchedule within transaction.
   * Rejects conflicts with active bookings or existing active blocks.
   *
   * @param {Object} actorUser - Authenticated owner
   * @param {Object} inputData
   * @param {string} inputData.courtId
   * @param {string} inputData.bookingDate - 'YYYY-MM-DD'
   * @param {Array<{ startTime: string, endTime: string }>} inputData.selectedSlots
   * @param {string} inputData.reason
   * @returns {Promise<Array<Object>>} Created CourtBlock DTOs
   */
  async createCourtBlock(actorUser, inputData) {
    const { courtId, bookingDate, selectedSlots, reason } = inputData;

    // 1. Validation
    if (!courtId || !mongoose.Types.ObjectId.isValid(courtId)) {
      throw AppError.badRequest('ID sân thể thao không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!bookingDate) {
      throw AppError.badRequest('Ngày khóa lịch là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!Array.isArray(selectedSlots) || selectedSlots.length === 0) {
      throw AppError.badRequest('Danh sách ô giờ được chọn không được để trống.', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      throw AppError.badRequest('Lý do khóa sân là bắt buộc.', ERROR_CODES.VALIDATION_ERROR);
    }

    // 2. Date range validation (today up to 30 days ahead)
    validateBookingDateRange(bookingDate, 30);

    // 3. Authorization & Court/Facility validation
    const court = await courtRepository.findById(courtId);
    if (!court || !court.isActive) {
      throw AppError.notFound('Không tìm thấy sân thể thao.', ERROR_CODES.COURT_NOT_FOUND);
    }

    const facility = await facilityRepository.findById(court.facilityId);
    if (!facility) {
      throw AppError.notFound('Không tìm thấy cơ sở thể thao.', ERROR_CODES.FACILITY_NOT_FOUND);
    }

    if (facility.ownerId.toString() !== actorUser._id.toString()) {
      throw AppError.forbidden('Bạn chỉ có quyền quản lý sân tại cơ sở của mình.', ERROR_CODES.FORBIDDEN);
    }

    if (facility.isLockedByAdmin) {
      throw AppError.forbidden('Cơ sở thể thao đã bị quản trị viên khóa.', ERROR_CODES.FACILITY_LOCKED);
    }

    const facilitySport = await facilitySportRepository.findById(court.facilitySportId);
    if (!facilitySport) {
      throw AppError.notFound('Không tìm thấy cấu hình môn thể thao tại cơ sở.', ERROR_CODES.FACILITY_SPORT_NOT_FOUND);
    }

    // 4. Resolve weekly operating hours and merge contiguous slots (B03)
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

    // 5. Advance notice check: minAdvance = 0 for court blocking (cannot block slots already in the past)
    const earliestStartTime = mergedIntervals[0].startTime;
    validateAdvanceNotice(bookingDate, earliestStartTime, 0);

    // 6. Execute atomic creation within MongoDB ACID transaction
    return withTransaction(async (session) => {
      // 6.1. Acquire coordination write lock on Court document (Issue 2) and CourtDaySchedule
      await courtRepository.touchCoordination(courtId, session);
      await courtDayScheduleRepository.acquireCoordinationLock(courtId, bookingDate, session);

      // Verify that facilitySport configuration has not changed concurrently (Issue 2)
      const liveFS = await facilitySportRepository.findById(court.facilitySportId, session);
      if (liveFS && liveFS.configVersion !== facilitySport.configVersion) {
        throw AppError.conflict(
          'Cấu hình bước giờ đã thay đổi. Vui lòng tải lại thông tin sân.',
          ERROR_CODES.CONFIG_VERSION_MISMATCH
        );
      }

      const now = new Date();

      // 6.2. Fetch existing active bookings and active blocks
      const [activeBookings, activeBlocks] = await Promise.all([
        bookingRepository.findActiveByCourtAndDate(courtId, bookingDate, session),
        CourtBlock.find({
          courtId,
          bookingDate,
          isActive: true,
        }).session(session),
      ]);

      // Collect all occupied intervals
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

      // 6.3. Check conflict for each merged interval (Criterion 9, Criterion 31)
      for (const interval of mergedIntervals) {
        for (const occupied of occupiedIntervals) {
          if (isOverlapping(interval, occupied)) {
            throw AppError.conflict(
              `Khung giờ khóa ${interval.startTime}–${interval.endTime} bị trùng với đơn đang giữ chỗ hoặc đã xác nhận hoặc lịch khóa khác.`,
              ERROR_CODES.SCHEDULE_CONFLICT
            );
          }
        }
      }

      // 6.4. Create CourtBlock documents
      const blocksToCreate = mergedIntervals.map((interval) => ({
        courtId,
        bookingDate,
        startTime: interval.startTime,
        endTime: interval.endTime,
        startMinutes: interval.startMinutes,
        endMinutes: interval.endMinutes,
        reason: reason.trim(),
        createdBy: actorUser._id,
        isActive: true,
      }));

      const createdBlocks = await CourtBlock.create(blocksToCreate, { session, ordered: true });

      // 6.5. Record ActionLog audit entry
      await actionLogRepository.create(
        {
          actorId: actorUser._id,
          actorRole: actorUser.role,
          targetType: 'COURT',
          targetId: court._id,
          action: 'CREATE_COURT_BLOCK',
          reason: reason.trim(),
          newState: {
            bookingDate,
            intervals: mergedIntervals.map((i) => `${i.startTime}-${i.endTime}`),
            blockIds: createdBlocks.map((b) => b._id.toString()),
          },
        },
        session
      );

      return createdBlocks.map((b) => ({
        id: b._id.toString(),
        courtId: b.courtId.toString(),
        bookingDate: b.bookingDate,
        startTime: b.startTime,
        endTime: b.endTime,
        reason: b.reason,
        isActive: b.isActive,
      }));
    });
  }

  /**
   * Deletes (deactivates) a CourtBlock to reopen schedule (OWN-06).
   * Verifies court ownership and acquires coordination lock on CourtDaySchedule.
   *
   * @param {Object} actorUser - Authenticated owner
   * @param {string} blockId
   * @returns {Promise<boolean>}
   */
  async deleteCourtBlock(actorUser, blockId) {
    if (!blockId || !mongoose.Types.ObjectId.isValid(blockId)) {
      throw AppError.badRequest('ID lịch khóa không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }

    const block = await courtBlockRepository.findById(blockId);
    if (!block) {
      throw AppError.notFound('Không tìm thấy lịch khóa sân.', ERROR_CODES.NOT_FOUND);
    }

    // Verify ownership
    const court = await courtRepository.findById(block.courtId);
    if (!court) {
      throw AppError.notFound('Không tìm thấy sân thể thao liên quan.', ERROR_CODES.COURT_NOT_FOUND);
    }

    const facility = await facilityRepository.findById(court.facilityId);
    if (!facility || facility.ownerId.toString() !== actorUser._id.toString()) {
      throw AppError.forbidden('Bạn chỉ có quyền mở khóa lịch tại cơ sở của mình.', ERROR_CODES.FORBIDDEN);
    }

    if (!block.isActive) {
      return true; // Already deactivated (idempotent)
    }

    return withTransaction(async (session) => {
      // Acquire coordination lock
      await courtDayScheduleRepository.acquireCoordinationLock(block.courtId, block.bookingDate, session);

      await courtBlockRepository.updateById(
        blockId,
        { $set: { isActive: false } },
        session
      );

      // Record ActionLog
      await actionLogRepository.create(
        {
          actorId: actorUser._id,
          actorRole: actorUser.role,
          targetType: 'COURT',
          targetId: block.courtId,
          action: 'DELETE_COURT_BLOCK',
          reason: 'Mở lại khung giờ đã khóa',
          previousState: { blockId: block._id.toString(), isActive: true },
          newState: { blockId: block._id.toString(), isActive: false },
        },
        session
      );

      return true;
    });
  }

  /**
   * Lists court blocks for owner
   * @param {Object} actorUser
   * @param {Object} queryParams
   * @param {string} [queryParams.courtId]
   * @param {string} [queryParams.bookingDate]
   * @param {string} [queryParams.isActive]
   */
  async listCourtBlocks(actorUser, queryParams = {}) {
    const { courtId, bookingDate, isActive } = queryParams;

    // Find all facilities belonging to owner
    const facilities = await facilityRepository.findByOwner(actorUser._id);
    const facilityIds = facilities.map((f) => f._id);

    let courtFilter = { facilityId: { $in: facilityIds } };
    if (courtId) {
      if (!mongoose.Types.ObjectId.isValid(courtId)) {
        throw AppError.badRequest('ID sân không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
      }
      courtFilter._id = courtId;
    }

    const courts = await courtRepository.find(courtFilter);
    const validCourtIds = courts.map((c) => c._id);

    const blockFilter = { courtId: { $in: validCourtIds } };
    if (bookingDate) {
      blockFilter.bookingDate = bookingDate;
    }
    if (isActive !== undefined) {
      blockFilter.isActive = isActive === 'true' || isActive === true;
    }

    return courtBlockRepository.find(blockFilter);
  }
}

export const courtBlockService = new CourtBlockService();
export default courtBlockService;
