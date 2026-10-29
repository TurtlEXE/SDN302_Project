import mongoose from 'mongoose';

const { Schema } = mongoose;

const authTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['VERIFY_EMAIL', 'ACTIVATE_OWNER', 'RESET_PASSWORD'],
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'auth_tokens',
    timestamps: { createdAt: true, updatedAt: false },
  }
);

authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ userId: 1, type: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 }); // 7 days TTL after expiry

export const AuthToken = mongoose.model('AuthToken', authTokenSchema);
export default AuthToken;
