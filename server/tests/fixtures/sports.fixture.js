import mongoose from 'mongoose';

export const footballSportFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000101'),
  name: 'Bóng đá',
  normalizedName: 'BONG DA',
  description: 'Sân bóng đá cỏ nhân tạo 5 người, 7 người',
  isActive: true,
};

export const badmintonSportFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000102'),
  name: 'Cầu lông',
  normalizedName: 'CAU LONG',
  description: 'Sân cầu lông thảm PVC tiêu chuẩn',
  isActive: true,
};

export const tennisSportFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000103'),
  name: 'Tennis',
  normalizedName: 'TENNIS',
  description: 'Sân tennis mặt cứng tiêu chuẩn quốc tế',
  isActive: true,
};

export const pickleballSportFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000104'),
  name: 'Pickleball',
  normalizedName: 'PICKLEBALL',
  description: 'Sân pickleball phong trào và thi đấu',
  isActive: true,
};

export const allSportFixtures = [
  footballSportFixture,
  badmintonSportFixture,
  tennisSportFixture,
  pickleballSportFixture,
];
