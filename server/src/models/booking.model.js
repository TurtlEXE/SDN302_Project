import mongoose from 'mongoose';

const { Schema } = mongoose;

const bookingSnapshotSchema = new Schema(
  {
    facilityName: { type: String, required: true },
    facilityAddress: { type: String, required: true },
    courtName: { type: String, required: true },
    sportName: { type: String, required: true },
    slotStepMinutes: { type: Number, required: true },
  },
  { _id: false }
);

const cancellationSchema = new Schema(
  {
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: null },
  },
  { _id: false }
);

const completionSchema = new Schema(
  {
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: null },
  },
  { _id: false }
);

const bookingSchema = new Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      trim: true,
    },
    bookingRequestId: {
      type: Schema.Types.ObjectId,
      ref: 'BookingRequest',
      required: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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
    startTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'startTime must be in HH:mm format'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^\d{2}:\d{2}$/, 'endTime must be in HH:mm format'],
    },
    startMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 1440,
    },
    endMinutes: {
      type: Number,
      required: true,
      min: 0,
      max: 1440,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 30,
    },
    pricePerHourVnd: {
      type: Number,
      required: true,
      min: 1,
    },
    totalPriceVnd: {
      type: Number,
      required: true,
      min: 0,
    },
    allocatedAmountVnd: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'COMPLETED', 'NO_SHOW'],
      default: 'PENDING_PAYMENT',
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['UNPAID', 'PAID', 'REFUND_PENDING', 'REFUNDED'],
      default: 'UNPAID',
    },
    holdExpiresAt: {
      type: Date,
      required: true,
    },
    snapshot: {
      type: bookingSnapshotSchema,
      required: true,
    },
    cancellation: {
      type: cancellationSchema,
      default: null,
    },
    completion: {
      type: completionSchema,
      default: null,
    },
    statusVersion: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    collection: 'bookings',
    timestamps: true,
  }
);

bookingSchema.index({ bookingCode: 1 }, { unique: true });
bookingSchema.index({
  courtId: 1,
  bookingDate: 1,
  status: 1,
  startMinutes: 1,
  endMinutes: 1,
});
bookingSchema.index({ bookingRequestId: 1 });
bookingSchema.index({ customerId: 1, bookingDate: 1 });
bookingSchema.index({ facilityId: 1, bookingDate: 1 });
// STRICT: NO TTL index on bookings

export const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
