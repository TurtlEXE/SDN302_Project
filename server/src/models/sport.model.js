import mongoose from 'mongoose';

const { Schema } = mongoose;

const sportSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    collection: 'sports',
    timestamps: true,
  }
);

sportSchema.index({ normalizedName: 1 }, { unique: true });
sportSchema.index({ isActive: 1 });

export const Sport = mongoose.model('Sport', sportSchema);
export default Sport;
