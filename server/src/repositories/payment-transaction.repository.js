import { PaymentTransaction } from '../models/payment-transaction.model.js';

export class PaymentTransactionRepository {
  /**
   * Creates a new PaymentTransaction record within an optional transaction session
   * @param {Object} data
   * @param {import('mongoose').ClientSession} [session=null]
   * @returns {Promise<import('../models/payment-transaction.model.js').PaymentTransaction>}
   */
  async create(data, session = null) {
    const [created] = await PaymentTransaction.create([data], { session });
    return created;
  }

  /**
   * Finds a transaction by ID
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findById(id, session = null) {
    return PaymentTransaction.findById(id).session(session);
  }

  /**
   * Finds a transaction by unique VNPay transaction number
   * @param {string} vnpayTransactionNo
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByTransactionNo(vnpayTransactionNo, session = null) {
    if (!vnpayTransactionNo) return null;
    return PaymentTransaction.findOne({ vnpayTransactionNo }).session(session);
  }

  /**
   * Finds all transactions for a given PaymentOrder
   * @param {string|import('mongoose').Types.ObjectId} paymentOrderId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByPaymentOrderId(paymentOrderId, session = null) {
    return PaymentTransaction.find({ paymentOrderId }).sort({ createdAt: 1 }).session(session);
  }

  /**
   * Finds all transactions matching a vnpayTxnRef
   * @param {string} vnpayTxnRef
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findByVnpayTxnRef(vnpayTxnRef, session = null) {
    return PaymentTransaction.find({ vnpayTxnRef }).sort({ createdAt: 1 }).session(session);
  }

  /**
   * Finds the single accepted transaction for a PaymentOrder (Criterion 47, 55)
   * @param {string|import('mongoose').Types.ObjectId} paymentOrderId
   * @param {import('mongoose').ClientSession} [session=null]
   */
  async findAcceptedByPaymentOrderId(paymentOrderId, session = null) {
    return PaymentTransaction.findOne({
      paymentOrderId,
      isAccepted: true,
    }).session(session);
  }

  /**
   * Finds paginated transactions with optional filter
   * @param {Object} filter
   * @param {Object} [options]
   */
  async findPaginated(filter = {}, { page = 1, limit = 20, sort = { createdAt: -1 } } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      PaymentTransaction.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      PaymentTransaction.countDocuments(filter),
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

export const paymentTransactionRepository = new PaymentTransactionRepository();
export default paymentTransactionRepository;

