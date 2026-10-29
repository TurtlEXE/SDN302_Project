import mongoose from 'mongoose';

const { Schema } = mongoose;

const facilityImageSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    isCover: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const facilitySchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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
    address: {
      type: String,
      required: true,
      trim: true,
    },
    province: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    openTime: {
      type: String,
      required: true,
      default: '06:00',
    },
    closeTime: {
      type: String,
      required: true,
      default: '22:00',
    },
    operatingHoursVersion: {
      type: Number,
      required: true,
      default: 1,
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'PUBLISHED', 'PAUSED'],
      default: 'DRAFT',
    },
    isLockedByAdmin: {
      type: Boolean,
      required: true,
      default: false,
    },
    lockReason: {
      type: String,
      default: null,
    },
    images: {
      type: [facilityImageSchema],
      default: [],
      validate: [
        (val) => val.length <= 10,
        '{PATH} exceeds the limit of 10 images',
      ],
    },
  },
  {
    collection: 'facilities',
    timestamps: true,
  }
);

facilitySchema.index({ ownerId: 1 });
facilitySchema.index({ status: 1, isLockedByAdmin: 1, province: 1 });
facilitySchema.index({ name: 'text', address: 'text' });

export const Facility = mongoose.model('Facility', facilitySchema);
export default Facility;
