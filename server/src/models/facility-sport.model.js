import mongoose from 'mongoose';

const { Schema } = mongoose;

const facilitySportSchema = new Schema(
  {
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
    slotStepMinutes: {
      type: Number,
      required: true,
      enum: [30, 60, 90],
      default: 60,
    },
    configVersion: {
      type: Number,
      required: true,
      default: 1,
    },
  },
  {
    collection: 'facility_sports',
    timestamps: true,
  }
);

facilitySportSchema.index({ facilityId: 1, sportId: 1 }, { unique: true });

export const FacilitySport = mongoose.model('FacilitySport', facilitySportSchema);
export default FacilitySport;
