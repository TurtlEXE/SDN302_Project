import mongoose from 'mongoose';

const { Schema } = mongoose;

const authSessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    absoluteExpiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
      enum: [null, 'LOGOUT', 'PASSWORD_CHANGED', 'REUSE_DETECTED', 'ADMIN_LOCKED'],
    },
  },
  {
    collection: 'auth_sessions',
    timestamps: true,
  }
);

authSessionSchema.index({ userId: 1, revokedAt: 1 });
authSessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 86400 }); // 1 day TTL after session expiry

export const AuthSession = mongoose.model('AuthSession', authSessionSchema);
export default AuthSession;
