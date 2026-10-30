import { courtRepository } from '../../repositories/court.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { facilitySportRepository } from '../../repositories/facility-sport.repository.js';
import { scheduleRepository } from '../../repositories/schedule.repository.js';
import { validateBookingDateRange } from './booking-policy.js';
import {
  calculateAvailableSlots,
  getCurrentDateVN,
  getCurrentTimeVN,
  parseTimeToMinutes,
} from '../../utils/date-time.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

export class ScheduleService {
  /**
   * Generates court schedule with slot statuses (PUB-04, Criteria 6, 11, 22, 28, 29, 30, 31).
   * Generates slots from facility.openTime using facilitySport.slotStepMinutes up to facility.closeTime.
   * Remainder not fitting a full slot is truncated (Criterion 30).
   * Each slot is assigned one of 5 statuses: AVAILABLE, HOLD, BOOKED, BLOCKED, PAST.
   * Zero customer name or private booking details leaked (Criterion 22).
   *
   * @param {string} courtId
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @param {Object} [timeOverrides=null] - Optional overrides for unit/integration testing { customTodayStr, customNowTimeStr, customNowDate, role }
   * @param {Object} [options={}] - Optional options { forRole: 'CUSTOMER' | 'OWNER' }
   * @returns {Promise<Object>} CourtScheduleDTO
   */
  async getCourtSchedule(courtId, dateStr, timeOverrides = null, options = {}) {
    const todayStr = timeOverrides?.customTodayStr || getCurrentDateVN();
    const nowTimeStr = timeOverrides?.customNowTimeStr || getCurrentTimeVN();
    const now = timeOverrides?.customNowDate || new Date();
    const role = options?.forRole || timeOverrides?.role || 'CUSTOMER';
    const isOwner = role === 'OWNER';
    const minAdvanceMinutes = isOwner ? 0 : 15;

    // 1. Validate date range (today up to 30 days ahead)
    validateBookingDateRange(dateStr, 30, todayStr);

    // 2. Fetch court
    const court = await courtRepository.findById(courtId);
    if (!court || !court.isActive) {
      throw AppError.notFound('Không tìm thấy sân thể thao.', ERROR_CODES.COURT_NOT_FOUND);
    }

    // 3. Fetch facility and ensure public availability
    const facility = await facilityRepository.findById(court.facilityId);
    if (!facility || facility.status !== 'PUBLISHED' || facility.isLockedByAdmin) {
      throw AppError.notFound(
        'Không tìm thấy cơ sở thể thao công khai.',
        ERROR_CODES.FACILITY_NOT_FOUND
      );
    }

    // 4. Fetch facilitySport configuration
    const facilitySport = await facilitySportRepository.findById(court.facilitySportId);
    if (!facilitySport) {
      throw AppError.notFound(
        'Không tìm thấy cấu hình môn thể thao tại cơ sở.',
        ERROR_CODES.FACILITY_SPORT_NOT_FOUND
      );
    }

    // 5. Generate day slots grid (truncates any remainder at end of day)
    const { slots: rawSlots } = calculateAvailableSlots(
      facility.openTime,
      facility.closeTime,
      facilitySport.slotStepMinutes
    );

    // 6. Query existing intervals for (courtId, dateStr)
    const [activeBookings, activeBlocks] = await Promise.all([
      scheduleRepository.findActiveBookingsForCourtAndDate(courtId, dateStr),
      scheduleRepository.findActiveCourtBlocksForCourtAndDate(courtId, dateStr),
    ]);

    const nowMinutes = parseTimeToMinutes(nowTimeStr);

    // 7. Resolve status for each slot
    const formattedSlots = rawSlots.map((slot) => {
      // Check BLOCKED: intersects active CourtBlock
      const isBlocked = activeBlocks.some(
        (block) => slot.startMinutes < block.endMinutes && slot.endMinutes > block.startMinutes
      );

      // Check BOOKED: intersects CONFIRMED, COMPLETED, or NO_SHOW Booking
      const isBooked = activeBookings.some(
        (booking) =>
          ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(booking.status) &&
          slot.startMinutes < booking.endMinutes &&
          slot.endMinutes > booking.startMinutes
      );

      // Check HOLD: intersects unexpired PENDING_PAYMENT Booking
      const isHold = activeBookings.some(
        (booking) =>
          booking.status === 'PENDING_PAYMENT' &&
          booking.holdExpiresAt &&
          new Date(booking.holdExpiresAt) > now &&
          slot.startMinutes < booking.endMinutes &&
          slot.endMinutes > booking.startMinutes
      );

      // Check PAST: date is past or today with startMinutes < nowMinutes + minAdvanceMinutes
      // Owner can book upcoming slots with minAdvance=0 (slot.startMinutes <= nowMinutes is past)
      // Customer requires >= 15 min advance notice (slot.startMinutes < nowMinutes + 15 is past, Criterion 11)
      const isPast =
        dateStr < todayStr ||
        (dateStr === todayStr &&
          (isOwner ? slot.startMinutes <= nowMinutes : slot.startMinutes < nowMinutes + minAdvanceMinutes));

      let status = 'AVAILABLE';
      if (isBlocked) {
        status = 'BLOCKED';
      } else if (isBooked) {
        status = 'BOOKED';
      } else if (isHold) {
        status = 'HOLD';
      } else if (isPast) {
        status = 'PAST';
      }

      // Criterion 22: Strict privacy. Only startTime, endTime, and status are returned.
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        status,
      };
    });

    return {
      courtId: court._id.toString(),
      courtName: court.name,
      bookingDate: dateStr,
      openTime: facility.openTime,
      closeTime: facility.closeTime,
      slotStepMinutes: facilitySport.slotStepMinutes,
      pricePerHourVnd: court.pricePerHourVnd,
      configVersion: facilitySport.configVersion,
      slots: formattedSlots,
    };
  }
}

export const scheduleService = new ScheduleService();
export default scheduleService;

