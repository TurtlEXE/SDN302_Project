import mongoose from 'mongoose';

export const adminUserFixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000001'),
  email: 'admin@sportbooking.local',
  fullName: 'Hệ Thống Quản Trị Viên',
  phoneNumber: '0901234567',
  role: 'ADMIN',
  isLocked: false,
  tokenVersion: 0,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const ownerUser1Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000011'),
  email: 'owner1@sportbooking.local',
  fullName: 'Chủ Sân Số Một (Cầu Lông & Tennis)',
  phoneNumber: '0912345678',
  role: 'OWNER',
  isLocked: false,
  tokenVersion: 0,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  activatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const ownerUser2Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000012'),
  email: 'owner2@sportbooking.local',
  fullName: 'Chủ Sân Số Hai (Bóng Đá & Pickleball)',
  phoneNumber: '0923456789',
  role: 'OWNER',
  isLocked: false,
  tokenVersion: 0,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
  activatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const customerUser1Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000021'),
  email: 'customer1@gmail.com',
  fullName: 'Khách Hàng Nguyễn Văn A',
  phoneNumber: '0934567890',
  role: 'CUSTOMER',
  isLocked: false,
  tokenVersion: 0,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const customerUser2Fixture = {
  _id: new mongoose.Types.ObjectId('650000000000000000000022'),
  email: 'customer2@gmail.com',
  fullName: 'Khách Hàng Trần Thị B',
  phoneNumber: '0945678901',
  role: 'CUSTOMER',
  isLocked: false,
  tokenVersion: 0,
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
};

export const allUserFixtures = [
  adminUserFixture,
  ownerUser1Fixture,
  ownerUser2Fixture,
  customerUser1Fixture,
  customerUser2Fixture,
];
