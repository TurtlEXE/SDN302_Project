import { Booking } from '../models/booking.model.js';

export class BookingRepository {
  /**
   * Finds a Booking by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return Booking.findById(id).session(session);
  }

  /**
   * Finds all Bookings belonging to a BookingRequest
   * @param {string|import('mongoose').Types.ObjectId} bookingRequestId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByRequestId(bookingRequestId, session = null) {
    return Booking.find({ bookingRequestId }).sort({ startMinutes: 1 }).session(session);
  }

  /**
   * Finds active/occupying Bookings for a court on a date within a transaction
   * Includes:
   * - CONFIRMED, COMPLETED, NO_SHOW
   * - PENDING_PAYMENT (caller will filter by unexpired hold)
   *
   * @param {string|import('mongoose').Types.ObjectId} courtId
   * @param {string} bookingDate - 'YYYY-MM-DD'
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findActiveByCourtAndDate(courtId, bookingDate, session = null) {
    return Booking.find({
      courtId,
      bookingDate,
      status: { $in: ['PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'] },
    }).session(session);
  }

  /**
   * Creates multiple Bookings within a transaction session
   * @param {Array<Object>} bookingsData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async createMany(bookingsData, session = null) {
    return Booking.create(bookingsData, { session, ordered: true });
  }

  /**
   * Finds a Booking by its unique bookingCode
   * @param {string} bookingCode
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByBookingCode(bookingCode, session = null) {
    return Booking.findOne({ bookingCode }).session(session);
  }

  /**
   * Updates a single Booking by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    return Booking.findByIdAndUpdate(id, updateData, { new: true, session });
  }

  /**
   * Updates all Bookings belonging to a BookingRequest
   * @param {string|import('mongoose').Types.ObjectId} bookingRequestId
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateManyByRequestId(bookingRequestId, updateData, session = null) {
    return Booking.updateMany({ bookingRequestId }, updateData, { session });
  }

  /**
   * Finds pending bookings whose hold has expired (Criterion 49, 51)
   * @param {Date} [now=new Date()]
   * @param {number} [limit=100]
   */
  async findExpiredHolds(now = new Date(), limit = 100) {
    return Booking.find({
      status: 'PENDING_PAYMENT',
      holdExpiresAt: { $lte: now },
    })
      .limit(limit)
      .lean();
  }

  /**
   * Finds bookings with filter and pagination
   * @param {Object} filter
   * @param {Object} options
   * @param {number} [options.page=1]
   * @param {number} [options.limit=10]
   * @param {Object} [options.sort={ createdAt: -1 }]
   */
  async findPaginated(filter = {}, { page = 1, limit = 10, sort = { createdAt: -1 } } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Booking.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Booking.countDocuments(filter),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    };
  }
}

export const bookingRepository = new BookingRepository();
export default bookingRepository;
