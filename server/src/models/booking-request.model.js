import mongoose from 'mongoose';

const { Schema } = mongoose;

const bookingRequestSchema = new Schema(
  {
    requestNumber: {
      type: String,
      required: true,
      trim: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    source: {
      type: String,
      required: true,
      enum: ['CUSTOMER_ONLINE', 'OWNER_ON_BEHALF'],
      default: 'CUSTOMER_ONLINE',
    },
    courtId: {
      type: Schema.Types.ObjectId,
      ref: 'Court',
      required: true,
    },
    facilityId: {
      type: Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
    },
    bookingDate: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'bookingDate must be in YYYY-MM-DD format'],
    },
    totalAmountVnd: {
      type: Number,
      required: true,
      min: 0,
    },
    holdExpiresAt: {
      type: Date,
      required: true,
    },
    contactName: {
      type: String,
      required: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },
    guestAccessCodeHash: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    payloadFingerprint: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    collection: 'booking_requests',
    timestamps: true,
  }
);

bookingRequestSchema.index({ requestNumber: 1 }, { unique: true });
bookingRequestSchema.index({ createdBy: 1, idempotencyKey: 1 }, { unique: true });
bookingRequestSchema.index({ customerId: 1, createdAt: -1 });
bookingRequestSchema.index({ holdExpiresAt: 1 }); // Query index only - NO TTL

export const BookingRequest = mongoose.model('BookingRequest', bookingRequestSchema);
export default BookingRequest;
