import { courtRepository } from '../../repositories/court.repository.js';
import { facilityRepository } from '../../repositories/facility.repository.js';
import { facilitySportRepository } from '../../repositories/facility-sport.repository.js';
import { scheduleRepository } from '../../repositories/schedule.repository.js';
import { User } from '../../models/user.model.js';
import { validateBookingDateRange } from './booking-policy.js';
import {
  calculateAvailableSlots,
  getCurrentDateVN,
  getCurrentTimeVN,
  parseTimeToMinutes,
  getFacilityOperatingHoursForDate,
} from '../../utils/date-time.js';
import { sliceIntervalPricing } from './pricing.js';
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

    // 1. Validate date range (today up to 30 days ahead)
    validateBookingDateRange(dateStr, 30, todayStr);

    // 2. Fetch court
    const court = await courtRepository.findById(courtId);
    if (!court || !court.isActive) {
      throw AppError.notFound('Không tìm thấy sân thể thao.', ERROR_CODES.COURT_NOT_FOUND);
    }

    // 3. Fetch facility and ensure public availability & active owner (PUB-04, Criterion 19, Issue 1)
    const facility = await facilityRepository.findById(court.facilityId);
    if (!facility || facility.status !== 'PUBLISHED' || facility.isLockedByAdmin) {
      throw AppError.notFound(
        'Không tìm thấy cơ sở thể thao công khai.',
        ERROR_CODES.FACILITY_NOT_FOUND
      );
    }

    const owner = await User.findById(facility.ownerId);
    if (!owner || owner.isLocked || !owner.activatedAt) {
      throw AppError.notFound(
        'Không tìm thấy cơ sở thể thao công khai.',
        ERROR_CODES.FACILITY_NOT_FOUND
      );
    }

    // Resolve owner role: verified ownership from authenticated requestingUser, or explicit forRole in unit tests (INT-01 fix)
    let isOwner = false;
    if (options?.requestingUser) {
      isOwner =
        options.requestingUser.role === 'OWNER' &&
        facility.ownerId.toString() === options.requestingUser._id.toString();
    } else if (options?.forRole || timeOverrides?.role) {
      isOwner = (options?.forRole || timeOverrides?.role) === 'OWNER';
    }
    const minAdvanceMinutes = isOwner ? 0 : 15;

    // 4. Fetch facilitySport configuration
    const facilitySport = await facilitySportRepository.findById(court.facilitySportId);
    if (!facilitySport) {
      throw AppError.notFound(
        'Không tìm thấy cấu hình môn thể thao tại cơ sở.',
        ERROR_CODES.FACILITY_SPORT_NOT_FOUND
      );
    }

    // 5. Resolve operating hours for this specific day of week (B03)
    const dayHours = getFacilityOperatingHoursForDate(facility, dateStr);
    const dayType = dayHours.dayType;
    const dayOfWeek = dayHours.dayOfWeek;
    const courtPricingRules = (court.pricingRules || []).filter((r) => r.dayType === dayType);

    if (!dayHours.isOpen) {
      return {
        courtId: court._id.toString(),
        courtName: court.name,
        bookingDate: dateStr,
        dayOfWeek,
        dayType,
        isOpen: false,
        openTime: null,
        closeTime: null,
        operatingHoursVersion: facility.operatingHoursVersion || 1,
        slotStepMinutes: facilitySport.slotStepMinutes,
        pricePerHourVnd: court.pricePerHourVnd,
        priceVersion: court.priceVersion || 1,
        pricingRules: courtPricingRules,
        configVersion: facilitySport.configVersion,
        slots: [],
      };
    }

    const effectiveOpenTime = dayHours.openTime;
    const effectiveCloseTime = dayHours.closeTime;

    // 6. Generate day slots grid (truncates any remainder at end of day)
    const { slots: rawSlots } = calculateAvailableSlots(
      effectiveOpenTime,
      effectiveCloseTime,
      facilitySport.slotStepMinutes
    );

    // 7. Query existing intervals for (courtId, dateStr)
    const [activeBookings, activeBlocks] = await Promise.all([
      scheduleRepository.findActiveBookingsForCourtAndDate(courtId, dateStr),
      scheduleRepository.findActiveCourtBlocksForCourtAndDate(courtId, dateStr),
    ]);

    const nowMinutes = parseTimeToMinutes(nowTimeStr);

    // 8. Resolve status and price for each slot
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

      let slotPriceVnd = null;
      try {
        const slice = sliceIntervalPricing(
          slot.startMinutes,
          slot.endMinutes,
          court.pricingRules,
          dayType,
          court.pricePerHourVnd
        );
        slotPriceVnd = slice.priceVnd;
      } catch {
        slotPriceVnd = null;
      }

      if (status === 'AVAILABLE' && slotPriceVnd === null) {
        status = 'NO_PRICE';
      }

      // Criterion 22: Strict privacy. Only startTime, endTime, and status are returned.
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        status,
        priceVnd: slotPriceVnd,
      };
    });

    return {
      courtId: court._id.toString(),
      courtName: court.name,
      bookingDate: dateStr,
      dayOfWeek,
      dayType,
      isOpen: true,
      openTime: effectiveOpenTime,
      closeTime: effectiveCloseTime,
      operatingHoursVersion: facility.operatingHoursVersion || 1,
      slotStepMinutes: facilitySport.slotStepMinutes,
      pricePerHourVnd: court.pricePerHourVnd,
      priceVersion: court.priceVersion || 1,
      pricingRules: courtPricingRules,
      configVersion: facilitySport.configVersion,
      slots: formattedSlots,
    };
  }

  /**
   * Generates facility-wide schedule for a given date, grouped by sport and court (B04).
   * All active sports and active courts are included in one consolidated response.
   *
   * @param {string} facilityId
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @param {Object} [timeOverrides=null]
   * @param {Object} [options={}]
   * @returns {Promise<Object>} FacilityScheduleDTO
   */
  async getFacilitySchedule(facilityId, dateStr, timeOverrides = null, options = {}) {
    const todayStr = timeOverrides?.customTodayStr || getCurrentDateVN();
    const nowTimeStr = timeOverrides?.customNowTimeStr || getCurrentTimeVN();
    const now = timeOverrides?.customNowDate || new Date();

    // 1. Validate date range (today up to 30 days ahead)
    validateBookingDateRange(dateStr, 30, todayStr);

    // 2. Fetch facility and ensure public availability & active owner
    const facility = await facilityRepository.findById(facilityId);
    if (!facility || facility.status !== 'PUBLISHED' || facility.isLockedByAdmin) {
      throw AppError.notFound(
        'Không tìm thấy cơ sở thể thao công khai.',
        ERROR_CODES.FACILITY_NOT_FOUND
      );
    }

    const owner = await User.findById(facility.ownerId);
    if (!owner || owner.isLocked || !owner.activatedAt) {
      throw AppError.notFound(
        'Không tìm thấy cơ sở thể thao công khai.',
        ERROR_CODES.FACILITY_NOT_FOUND
      );
    }

    // Resolve owner role: verified ownership from authenticated requestingUser, or explicit forRole in unit tests (INT-01 fix)
    let isOwner = false;
    if (options?.requestingUser) {
      isOwner =
        options.requestingUser.role === 'OWNER' &&
        facility.ownerId.toString() === options.requestingUser._id.toString();
    } else if (options?.forRole || timeOverrides?.role) {
      isOwner = (options?.forRole || timeOverrides?.role) === 'OWNER';
    }
    const minAdvanceMinutes = isOwner ? 0 : 15;

    // 3. Resolve operating hours for this specific day of week
    const dayHours = getFacilityOperatingHoursForDate(facility, dateStr);
    const dayType = dayHours.dayType;
    const dayOfWeek = dayHours.dayOfWeek;

    // 4. Fetch all facilitySports and courts for this facility
    const [facilitySports, allCourts] = await Promise.all([
      facilitySportRepository.findByFacility(facilityId),
      courtRepository.findByFacility(facilityId),
    ]);

    const activeCourts = allCourts.filter((c) => c.isActive);

    if (!dayHours.isOpen) {
      return {
        facilityId: facility._id.toString(),
        facilityName: facility.name,
        bookingDate: dateStr,
        dayOfWeek,
        dayType,
        isOpen: false,
        openTime: null,
        closeTime: null,
        operatingHoursVersion: facility.operatingHoursVersion || 1,
        message: 'Cơ sở thể thao không mở cửa vào ngày này.',
        sports: facilitySports.map((fs) => {
          const courtsForSport = activeCourts.filter(
            (c) => c.facilitySportId.toString() === fs._id.toString()
          );
          return {
            facilitySportId: fs._id.toString(),
            sportId: fs.sportId?._id ? fs.sportId._id.toString() : fs.sportId?.toString(),
            sportName: fs.sportId?.name || 'Môn thể thao',
            slotStepMinutes: fs.slotStepMinutes,
            configVersion: fs.configVersion,
            courts: courtsForSport.map((court) => ({
              courtId: court._id.toString(),
              courtName: court.name,
              pricePerHourVnd: court.pricePerHourVnd,
              priceVersion: court.priceVersion || 1,
              pricingRules: (court.pricingRules || []).filter((r) => r.dayType === dayType),
              slots: [],
            })),
          };
        }),
      };
    }

    const effectiveOpenTime = dayHours.openTime;
    const effectiveCloseTime = dayHours.closeTime;
    const nowMinutes = parseTimeToMinutes(nowTimeStr);

    // 5. Query active bookings & blocks for all courts on this date in one go
    const courtIds = activeCourts.map((c) => c._id);
    const [allActiveBookings, allActiveBlocks] = await Promise.all([
      scheduleRepository.findActiveBookingsForCourtsAndDate(courtIds, dateStr),
      scheduleRepository.findActiveCourtBlocksForCourtsAndDate(courtIds, dateStr),
    ]);

    // Group bookings and blocks by courtId string for O(1) lookup
    const bookingsByCourt = new Map();
    const blocksByCourt = new Map();
    for (const b of allActiveBookings) {
      const cId = b.courtId.toString();
      if (!bookingsByCourt.has(cId)) bookingsByCourt.set(cId, []);
      bookingsByCourt.get(cId).push(b);
    }
    for (const blk of allActiveBlocks) {
      const cId = blk.courtId.toString();
      if (!blocksByCourt.has(cId)) blocksByCourt.set(cId, []);
      blocksByCourt.get(cId).push(blk);
    }

    // 6. Build response grouped by facilitySport
    const sports = facilitySports.map((fs) => {
      const fsCourts = activeCourts.filter(
        (c) => c.facilitySportId.toString() === fs._id.toString()
      );

      // Raw slots for this sport's slotStepMinutes
      const { slots: rawSlots } = calculateAvailableSlots(
        effectiveOpenTime,
        effectiveCloseTime,
        fs.slotStepMinutes
      );

      const courtsData = fsCourts.map((court) => {
        const cId = court._id.toString();
        const courtPricingRules = (court.pricingRules || []).filter((r) => r.dayType === dayType);
        const courtBookings = bookingsByCourt.get(cId) || [];
        const courtBlocks = blocksByCourt.get(cId) || [];

        const formattedSlots = rawSlots.map((slot) => {
          const isBlocked = courtBlocks.some(
            (block) => slot.startMinutes < block.endMinutes && slot.endMinutes > block.startMinutes
          );

          const isBooked = courtBookings.some(
            (booking) =>
              ['CONFIRMED', 'COMPLETED', 'NO_SHOW'].includes(booking.status) &&
              slot.startMinutes < booking.endMinutes &&
              slot.endMinutes > booking.startMinutes
          );

          const isHold = courtBookings.some(
            (booking) =>
              booking.status === 'PENDING_PAYMENT' &&
              booking.holdExpiresAt &&
              new Date(booking.holdExpiresAt) > now &&
              slot.startMinutes < booking.endMinutes &&
              slot.endMinutes > booking.startMinutes
          );

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

          let slotPriceVnd = null;
          try {
            const slice = sliceIntervalPricing(
              slot.startMinutes,
              slot.endMinutes,
              court.pricingRules,
              dayType,
              court.pricePerHourVnd
            );
            slotPriceVnd = slice.priceVnd;
          } catch {
            slotPriceVnd = null;
          }

          if (status === 'AVAILABLE' && slotPriceVnd === null) {
            status = 'NO_PRICE';
          }

          return {
            startTime: slot.startTime,
            endTime: slot.endTime,
            status,
            priceVnd: slotPriceVnd,
          };
        });

        return {
          courtId: cId,
          courtName: court.name,
          pricePerHourVnd: court.pricePerHourVnd,
          priceVersion: court.priceVersion || 1,
          pricingRules: courtPricingRules,
          slots: formattedSlots,
        };
      });

      return {
        facilitySportId: fs._id.toString(),
        sportId: fs.sportId?._id ? fs.sportId._id.toString() : fs.sportId?.toString(),
        sportName: fs.sportId?.name || 'Môn thể thao',
        slotStepMinutes: fs.slotStepMinutes,
        configVersion: fs.configVersion,
        courts: courtsData,
      };
    });

    return {
      facilityId: facility._id.toString(),
      facilityName: facility.name,
      bookingDate: dateStr,
      dayOfWeek,
      dayType,
      isOpen: true,
      openTime: effectiveOpenTime,
      closeTime: effectiveCloseTime,
      operatingHoursVersion: facility.operatingHoursVersion || 1,
      sports,
    };
  }
}

export const scheduleService = new ScheduleService();
export default scheduleService;

