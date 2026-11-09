import { Booking } from '../models/booking.model.js';
import { CourtBlock } from '../models/court-block.model.js';

/**
 * Schedule Repository
 * Queries raw interval records (Bookings and CourtBlocks) for a specific court and date.
 * Strictly adheres to Criterion 186 / Section 8.3: No slot collections or individual slot docs in DB.
 */
export class ScheduleRepository {
  /**
   * Finds bookings on a specific court and date that occupy or hold schedule slots.
   * Only returns statuses that can occupy the schedule:
   * - PENDING_PAYMENT (if hold has not expired)
   * - CONFIRMED, COMPLETED, NO_SHOW
   * CANCELLED and EXPIRED bookings are excluded.
   *
   * @param {string} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<Array<Object>>}
   */
  async findActiveBookingsForCourtAndDate(courtId, bookingDate, session = null) {
    return Booking.find({
      courtId,
      bookingDate,
      status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
    })
      .select('courtId bookingDate startTime endTime startMinutes endMinutes durationMinutes status holdExpiresAt')
      .session(session)
      .lean();
  }

  /**
   * Finds active court maintenance/admin blocks on a specific court and date.
   *
   * @param {string} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<Array<Object>>}
   */
  async findActiveCourtBlocksForCourtAndDate(courtId, bookingDate, session = null) {
    return CourtBlock.find({
      courtId,
      bookingDate,
      isActive: true,
    })
      .select('courtId bookingDate startTime endTime startMinutes endMinutes reason isActive')
      .session(session)
      .lean();
  }

  /**
   * Finds active bookings across multiple courts on a given date (B04 batching).
   *
   * @param {Array<string|import('mongoose').Types.ObjectId>} courtIds
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<Array<Object>>}
   */
  async findActiveBookingsForCourtsAndDate(courtIds, bookingDate, session = null) {
    if (!courtIds || courtIds.length === 0) return [];
    return Booking.find({
      courtId: { $in: courtIds },
      bookingDate,
      status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
    })
      .select('courtId bookingCode bookingDate startTime endTime startMinutes endMinutes durationMinutes status holdExpiresAt customerId bookingRequestId totalPriceVnd paymentStatus')
      .populate('customerId', 'fullName phoneNumber email')
      .populate('bookingRequestId', 'contactName contactPhone source')
      .session(session)
      .lean();
  }

  /**
   * Finds active court blocks across multiple courts on a given date (B04 batching).
   *
   * @param {Array<string|import('mongoose').Types.ObjectId>} courtIds
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<Array<Object>>}
   */
  async findActiveCourtBlocksForCourtsAndDate(courtIds, bookingDate, session = null) {
    if (!courtIds || courtIds.length === 0) return [];
    return CourtBlock.find({
      courtId: { $in: courtIds },
      bookingDate,
      isActive: true,
    })
      .select('courtId bookingDate startTime endTime startMinutes endMinutes reason isActive')
      .session(session)
      .lean();
  }
}

export const scheduleRepository = new ScheduleRepository();
export default scheduleRepository;

