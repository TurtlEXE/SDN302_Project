import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['CUSTOMER', 'OWNER', 'ADMIN'],
      default: 'CUSTOMER',
    },
    isLocked: {
      type: Boolean,
      required: true,
      default: false,
    },
    lockReason: {
      type: String,
      default: null,
    },
    tokenVersion: {
      type: Number,
      required: true,
      default: 0,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    activatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'users',
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isLocked: 1 });

export const User = mongoose.model('User', userSchema);
export default User;
