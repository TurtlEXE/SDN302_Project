import mongoose from 'mongoose';

const { Schema } = mongoose;

const actionLogSchema = new Schema(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorRole: {
      type: String,
      required: true,
      enum: ['ADMIN', 'OWNER', 'CUSTOMER', 'SYSTEM'],
    },
    targetType: {
      type: String,
      required: true,
      enum: ['USER', 'FACILITY', 'COURT', 'BOOKING', 'BOOKING_REQUEST', 'COURT_BLOCK', 'REFUND', 'PAYMENT_ORDER', 'EMAIL_OUTBOX'],
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'LOCK_USER',
        'UNLOCK_USER',
        'LOCK_FACILITY',
        'UNLOCK_FACILITY',
        'ADMIN_CANCEL_BOOKING',
        'CANCEL_BOOKING_REQUEST',
        'COMPLETE_BOOKING',
        'NO_SHOW_BOOKING',
        'CREATE_COURT_BLOCK',
        'DELETE_COURT_BLOCK',
        'EXPIRE_BOOKING',
        'RECORD_REFUND',
        'PAYMENT_CONFIRMED',
        'PAYMENT_FAILED',
        'PAYMENT_REVIEW',
        'PAYMENT_LATE_REVIEW',
        'PAYMENT_WRONG_AMOUNT_REVIEW',
        'RETRY_EMAIL_OUTBOX',
      ],
    },
    reason: {
      type: String,
      default: null,
    },
    previousState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    newState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    collection: 'action_logs',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

actionLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
actionLogSchema.index({ actorId: 1, createdAt: -1 });
// STRICT: NO TTL index on action_logs

export const ActionLog = mongoose.model('ActionLog', actionLogSchema);
export default ActionLog;
