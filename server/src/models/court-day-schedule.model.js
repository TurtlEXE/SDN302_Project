import mongoose from 'mongoose';

const { Schema } = mongoose;

const courtDayScheduleSchema = new Schema(
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
    scheduleVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'court_day_schedules',
    timestamps: false,
  }
);

courtDayScheduleSchema.index({ courtId: 1, bookingDate: 1 }, { unique: true });

export const CourtDaySchedule = mongoose.model('CourtDaySchedule', courtDayScheduleSchema);
export default CourtDaySchedule;
