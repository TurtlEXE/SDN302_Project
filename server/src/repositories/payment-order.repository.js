import { PaymentOrder } from '../models/payment-order.model.js';

export class PaymentOrderRepository {
  /**
   * Finds a PaymentOrder by ID
   * @param {string} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return PaymentOrder.findById(id).session(session);
  }

  /**
   * Finds a PaymentOrder by its associated bookingRequestId
   * @param {string|import('mongoose').Types.ObjectId} bookingRequestId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByBookingRequestId(bookingRequestId, session = null) {
    return PaymentOrder.findOne({ bookingRequestId }).session(session);
  }

  /**
   * Finds a PaymentOrder by vnpayTxnRef
   * @param {string} vnpayTxnRef
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByVnpayTxnRef(vnpayTxnRef, session = null) {
    return PaymentOrder.findOne({ vnpayTxnRef }).session(session);
  }

  /**
   * Creates a PaymentOrder within an optional transaction session
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async create(data, session = null) {
    const [created] = await PaymentOrder.create([data], { session });
    return created;
  }

  /**
   * Updates a PaymentOrder by ID
   * @param {string} id
   * @param {Object} updateData
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async updateById(id, updateData, session = null) {
    return PaymentOrder.findByIdAndUpdate(id, updateData, { new: true, session });
  }
}

export const paymentOrderRepository = new PaymentOrderRepository();
export default paymentOrderRepository;

