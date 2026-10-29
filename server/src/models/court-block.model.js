import mongoose from 'mongoose';

const { Schema } = mongoose;

const courtBlockSchema = new Schema(
  {
    courtId: {
      type: Schema.Types.ObjectId,
      ref: 'Court',
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
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    collection: 'court_blocks',
    timestamps: true,
  }
);

courtBlockSchema.index({
  courtId: 1,
  bookingDate: 1,
  isActive: 1,
  startMinutes: 1,
  endMinutes: 1,
});

export const CourtBlock = mongoose.model('CourtBlock', courtBlockSchema);
export default CourtBlock;
