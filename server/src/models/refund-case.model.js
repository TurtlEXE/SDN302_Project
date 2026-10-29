import mongoose from 'mongoose';

const { Schema } = mongoose;

const refundCaseSchema = new Schema(
  {
    refundCaseCode: {
      type: String,
      required: true,
      trim: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
    },
    paymentTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
      required: true,
    },
    refundAmountVnd: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'REFUNDED'],
      default: 'PENDING',
    },
    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    proofReference: {
      type: String,
      default: null,
      trim: true,
    },
    proofImageUrl: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    collection: 'refund_cases',
    timestamps: true,
  }
);

refundCaseSchema.index({ refundCaseCode: 1 }, { unique: true });
refundCaseSchema.index({ bookingId: 1 });
refundCaseSchema.index({ paymentTransactionId: 1 });
refundCaseSchema.index({ status: 1 });
// STRICT: NO TTL index on refund_cases

export const RefundCase = mongoose.model('RefundCase', refundCaseSchema);
export default RefundCase;
