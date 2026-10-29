import mongoose from 'mongoose';
import { facility1Fixture, facility2Fixture } from './facilities.fixture.js';
import { badmintonSportFixture, tennisSportFixture, footballSportFixture } from './sports.fixture.js';

export const facilitySport1Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000301'),
  facilityId: facility1Fixture._id,
  sportId: badmintonSportFixture._id,
  slotStepMinutes: 60, // Step 60 minutes
  configVersion: 1,
};

export const facilitySport2Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000302'),
  facilityId: facility1Fixture._id,
  sportId: tennisSportFixture._id,
  slotStepMinutes: 60, // Step 60 minutes
  configVersion: 1,
};

export const facilitySport3Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000303'),
  facilityId: facility2Fixture._id,
  sportId: footballSportFixture._id,
  slotStepMinutes: 90, // Step 90 minutes
  configVersion: 1,
};

export const court1BadmintonFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000401'),
  facilitySportId: facilitySport1Fixture._id,
  facilityId: facility1Fixture._id,
  sportId: badmintonSportFixture._id,
  name: 'Sân Cầu Lông Số 1 (VIP)',
  description: 'Thảm thi đấu Yonex, điều hòa 24/7',
  pricePerHourVnd: 150000,
  priceVersion: 1,
  isActive: true,
};

export const court2BadmintonFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000402'),
  facilitySportId: facilitySport1Fixture._id,
  facilityId: facility1Fixture._id,
  sportId: badmintonSportFixture._id,
  name: 'Sân Cầu Lông Số 2',
  description: 'Thảm tiêu chuẩn',
  pricePerHourVnd: 120000,
  priceVersion: 1,
  isActive: true,
};

export const court3FootballFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000403'),
  facilitySportId: facilitySport3Fixture._id,
  facilityId: facility2Fixture._id,
  sportId: footballSportFixture._id,
  name: 'Sân Bóng Đá 7 Người A',
  description: 'Cỏ nhân tạo chất lượng cao, thoát nước tốt',
  pricePerHourVnd: 400000,
  priceVersion: 1,
  isActive: true,
};

export const allFacilitySportFixtures = [
  facilitySport1Fixture,
  facilitySport2Fixture,
  facilitySport3Fixture,
];

export const allCourtFixtures = [
  court1BadmintonFixture,
  court2BadmintonFixture,
  court3FootballFixture,
];
