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
      enum: ['USER', 'FACILITY', 'COURT', 'BOOKING', 'REFUND'],
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
        'ADMIN_CANCEL_BOOKING',
        'COMPLETE_BOOKING',
        'RECORD_REFUND',
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
