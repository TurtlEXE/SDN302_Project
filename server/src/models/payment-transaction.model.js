import mongoose from 'mongoose';

const { Schema } = mongoose;

const paymentTransactionSchema = new Schema(
  {
    paymentOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentOrder',
      default: null,
    },
    vnpayTransactionNo: {
      type: String,
      default: null,
      trim: true,
    },
    vnpayTxnRef: {
      type: String,
      required: true,
      trim: true,
    },
    amountVnd: {
      type: Number,
      required: true,
    },
    bankCode: {
      type: String,
      default: null,
      trim: true,
    },
    responseCode: {
      type: String,
      required: true,
      trim: true,
    },
    transactionStatus: {
      type: String,
      required: true,
      trim: true,
    },
    payDate: {
      type: Date,
      default: null,
    },
    isAccepted: {
      type: Boolean,
      required: true,
    },
    exceptionType: {
      type: String,
      default: null,
      enum: [null, 'LATE_PAYMENT', 'WRONG_AMOUNT', 'DUPLICATE_PAYMENT', 'UNKNOWN_ORDER'],
    },
    rawCallbackData: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  {
    collection: 'payment_transactions',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

paymentTransactionSchema.index(
  { vnpayTransactionNo: 1 },
  {
    unique: true,
    partialFilterExpression: {
      vnpayTransactionNo: { $exists: true, $type: 'string' },
    },
  }
);
paymentTransactionSchema.index({ paymentOrderId: 1 });
paymentTransactionSchema.index({ isAccepted: 1, exceptionType: 1 });
// STRICT: NO TTL index on payment_transactions

export const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;
