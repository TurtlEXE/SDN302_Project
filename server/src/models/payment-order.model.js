import mongoose from 'mongoose';

const { Schema } = mongoose;

const paymentOrderSchema = new Schema(
  {
    bookingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'BookingRequest',
      required: true,
    },
    vnpayTxnRef: {
      type: String,
      required: true,
      trim: true,
    },
    expectedAmountVnd: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PAID', 'CLOSED', 'REVIEW'],
      default: 'PENDING',
    },
    closedReason: {
      type: String,
      default: null,
      enum: [null, 'EXPIRED', 'CUSTOMER_CANCELLED', 'FAILED_PAYMENT'],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    processingVersion: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    collection: 'payment_orders',
    timestamps: true,
  }
);

paymentOrderSchema.index({ bookingRequestId: 1 }, { unique: true });
paymentOrderSchema.index({ vnpayTxnRef: 1 }, { unique: true });
paymentOrderSchema.index({ status: 1, expiresAt: 1 }); // Query index only - NO TTL

export const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema);
export default PaymentOrder;
