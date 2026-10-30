import mongoose from 'mongoose';

const { Schema } = mongoose;

export const pricingRuleSchema = new Schema(
  {
    dayType: {
      type: String,
      enum: ['WEEKDAY', 'WEEKEND'],
      required: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    pricePerHourVnd: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const courtSchema = new Schema(
  {
    facilitySportId: {
      type: Schema.Types.ObjectId,
      ref: 'FacilitySport',
      required: true,
    },
    facilityId: {
      type: Schema.Types.ObjectId,
      ref: 'Facility',
      required: true,
    },
    sportId: {
      type: Schema.Types.ObjectId,
      ref: 'Sport',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    pricePerHourVnd: {
      type: Number,
      required: true,
      min: 1,
    },
    priceVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    pricingRules: {
      type: [pricingRuleSchema],
      default: () => [],
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    bookingCoordinationVersion: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    collection: 'courts',
    timestamps: true,
  }
);

courtSchema.index({ facilitySportId: 1, name: 1 }, { unique: true });
courtSchema.index({ facilityId: 1, isActive: 1 });
courtSchema.index({ sportId: 1, isActive: 1, pricePerHourVnd: 1 });

export const Court = mongoose.model('Court', courtSchema);
export default Court;
