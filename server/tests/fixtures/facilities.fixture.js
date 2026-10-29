import mongoose from 'mongoose';
import { ownerUser1Fixture, ownerUser2Fixture } from './users.fixture.js';

export const facility1Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000201'),
  ownerId: ownerUser1Fixture._id,
  name: 'Cụm Sân Thể Thao Ngôi Sao (Cầu Giấy)',
  description: 'Trung tâm thể thao hiện đại với sân cầu lông và tennis trong nhà',
  address: 'Số 10 Dịch Vọng Hậu, Cầu Giấy',
  province: 'Hà Nội',
  phoneNumber: '0243123456',
  openTime: '06:00',
  closeTime: '22:00',
  operatingHoursVersion: 1,
  status: 'PUBLISHED',
  isLockedByAdmin: false,
  lockReason: null,
  images: [
    {
      id: 'img-fac1-cover',
      url: 'https://cdn.sportbooking.local/facilities/star-cover.jpg',
      isCover: true,
      order: 1,
    },
  ],
};

export const facility2Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000202'),
  ownerId: ownerUser2Fixture._id,
  name: 'Sân Vận Động Sài Gòn Sport (Quận 7)',
  description: 'Tổ hợp sân bóng đá và pickleball ngoài trời có đèn chiếu sáng',
  address: '100 Nguyễn Thị Thập, Tân Phú, Quận 7',
  province: 'Hồ Chí Minh',
  phoneNumber: '0283987654',
  openTime: '06:00',
  closeTime: '23:00',
  operatingHoursVersion: 1,
  status: 'PUBLISHED',
  isLockedByAdmin: false,
  lockReason: null,
  images: [
    {
      id: 'img-fac2-cover',
      url: 'https://cdn.sportbooking.local/facilities/saigon-cover.jpg',
      isCover: true,
      order: 1,
    },
  ],
};

export const allFacilityFixtures = [
  facility1Fixture,
  facility2Fixture,
];
