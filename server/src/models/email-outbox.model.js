import mongoose from 'mongoose';

const { Schema } = mongoose;

const emailOutboxSchema = new Schema(
  {
    eventKey: {
      type: String,
      required: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        'VERIFY_EMAIL',
        'ACTIVATE_OWNER',
        'RESET_PASSWORD',
        'BOOKING_CONFIRMED',
        'BOOKING_CANCELLED',
        'HOLD_EXPIRED',
        'BOOKING_COMPLETED',
        'BOOKING_NO_SHOW',
        'REFUND_PROCESSED',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED',
      ],
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    recipientName: {
      type: String,
      default: '',
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    templateName: {
      type: String,
      required: true,
      trim: true,
    },
    templateData: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
    },
    retryCount: {
      type: Number,
      required: true,
      default: 0,
    },
    nextRetryAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: null,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'email_outbox',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

emailOutboxSchema.index({ eventKey: 1 }, { unique: true });
emailOutboxSchema.index({ status: 1, nextRetryAt: 1, lockedUntil: 1 });

export const EmailOutbox = mongoose.model('EmailOutbox', emailOutboxSchema);
export default EmailOutbox;
