import { BookingRequest } from '../models/booking-request.model.js';

export class BookingRequestRepository {
  /**
   * Finds a BookingRequest by ID
   * @param {string} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return BookingRequest.findById(id).session(session);
  }

  /**
   * Finds a BookingRequest by createdBy and idempotencyKey (Criterion 10)
   * @param {string|import('mongoose').Types.ObjectId} createdBy
   * @param {string} idempotencyKey
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByIdempotencyKey(createdBy, idempotencyKey, session = null) {
    return BookingRequest.findOne({ createdBy, idempotencyKey }).session(session);
  }

  /**
   * Finds a BookingRequest by requestNumber
   * @param {string} requestNumber
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByRequestNumber(requestNumber, session = null) {
    return BookingRequest.findOne({ requestNumber }).session(session);
  }

  /**
   * Creates a new BookingRequest within an optional transaction session
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async create(data, session = null) {
    const [created] = await BookingRequest.create([data], { session });
    return created;
  }

  /**
   * Updates a BookingRequest by ID
   * @param {string} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    return BookingRequest.findByIdAndUpdate(id, updateData, { new: true, session });
  }
}

export const bookingRequestRepository = new BookingRequestRepository();
export default bookingRequestRepository;

