import { RefundCase } from '../models/refund-case.model.js';

export class RefundCaseRepository {
  /**
   * Creates a new RefundCase record within an optional transaction session
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<import('../models/refund-case.model.js').RefundCase>}
   */
  async create(data, session = null) {
    const [created] = await RefundCase.create([data], { session });
    return created;
  }

  /**
   * Finds a RefundCase by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return RefundCase.findById(id).session(session);
  }

  /**
   * Finds a RefundCase by its unique refundCaseCode
   * @param {string} refundCaseCode
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByCode(refundCaseCode, session = null) {
    return RefundCase.findOne({ refundCaseCode }).session(session);
  }

  /**
   * Finds all RefundCases associated with a bookingId
   * @param {string|import('mongoose').Types.ObjectId} bookingId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByBookingId(bookingId, session = null) {
    return RefundCase.find({ bookingId }).session(session);
  }

  /**
   * Finds all RefundCases associated with a paymentTransactionId
   * @param {string|import('mongoose').Types.ObjectId} paymentTransactionId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByPaymentTransactionId(paymentTransactionId, session = null) {
    return RefundCase.find({ paymentTransactionId }).session(session);
  }

  /**
   * Calculates total amount already refunded or pending refund for a paymentTransactionId (Criterion 54)
   * @param {string|import('mongoose').Types.ObjectId} paymentTransactionId
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<number>}
   */
  async getTotalRefundedAndPending(paymentTransactionId, session = null) {
    const cases = await RefundCase.find({
      paymentTransactionId,
      status: { $in: ['PENDING', 'REFUNDED'] },
    }).session(session);

    return cases.reduce((acc, curr) => acc + (curr.refundAmountVnd || 0), 0);
  }

  /**
   * Updates a RefundCase by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    return RefundCase.findByIdAndUpdate(id, updateData, { new: true, session });
  }

  /**
   * Retrieves paginated list of RefundCases with optional filtering
   * @param {Object} filter
   * @param {Object} [options]
   */
  async findPaginated(filter = {}, { page = 1, limit = 20, sort = { createdAt: -1 } } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      RefundCase.find(filter)
        .populate('bookingId')
        .populate('paymentTransactionId')
        .populate('processedBy', 'fullName email')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      RefundCase.countDocuments(filter),
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

export const refundCaseRepository = new RefundCaseRepository();
export default refundCaseRepository;

