import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { Facility } from '../../src/models/facility.model.js';
import { FacilitySport } from '../../src/models/facility-sport.model.js';
import { Court } from '../../src/models/court.model.js';
import { Sport } from '../../src/models/sport.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { CourtBlock } from '../../src/models/court-block.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';

test('FacilitySport, Court Management & Schedule Guards (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Facility.deleteMany({});
    await FacilitySport.deleteMany({});
    await Court.deleteMany({});
    await Sport.deleteMany({});
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await CourtBlock.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-sport-court-/ } });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let owner = null;
  let ownerToken = null;
  let sport1 = null;
  let sport2 = null;
  let inactiveSport = null;
  let facility = null;

  t.beforeEach(async () => {
    await Facility.deleteMany({});
    await FacilitySport.deleteMany({});
    await Court.deleteMany({});
    await Sport.deleteMany({});
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await CourtBlock.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-sport-court-/ } });
    await AuthSession.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    owner = await User.create({
      email: `owner-p07-sport-court-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Thể Thao',
      phoneNumber: '0912345678',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const s = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, s).accessToken;

    sport1 = await Sport.create({
      name: 'Bóng Đá',
      normalizedName: 'BONG DA',
      description: 'Môn bóng đá',
      isActive: true,
    });

    sport2 = await Sport.create({
      name: 'Tennis',
      normalizedName: 'TENNIS',
      description: 'Môn tennis',
      isActive: true,
    });

    inactiveSport = await Sport.create({
      name: 'Bóng Bàn',
      normalizedName: 'BONG BAN',
      description: 'Môn bóng bàn',
      isActive: false,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Trung Tâm Thể Thao Hòa Bình',
      address: '100 Nguyễn Huệ',
      province: 'TP. Hồ Chí Minh',
      phoneNumber: '0901234567',
      openTime: '06:00',
      closeTime: '22:00',
      operatingHoursVersion: 1,
      status: 'DRAFT',
    });
  });

  await t.test('POST /api/v1/owner/facilities/:id/sports should configure sport and step (30, 60, 90)', async () => {
    // 1. Add sport1 with 90 min step
    const res1 = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sportId: sport1._id.toString(),
        slotStepMinutes: 90,
      });

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.data.slotStepMinutes, 90);
    assert.strictEqual(res1.body.data.configVersion, 1);

    // 2. Add same sport again -> duplicate 409
    const dupRes = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sportId: sport1._id.toString(),
        slotStepMinutes: 60,
      });

    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.error.code, 'FACILITY_SPORT_ALREADY_EXISTS');

    // 3. Add inactive sport -> rejected 400
    const inactRes = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sportId: inactiveSport._id.toString(),
        slotStepMinutes: 30,
      });

    assert.strictEqual(inactRes.status, 400);
    assert.strictEqual(inactRes.body.error.code, 'SPORT_NOT_FOUND');

    // 4. Invalid step (e.g. 45 min) -> rejected 400
    const invStepRes = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sportId: sport2._id.toString(),
        slotStepMinutes: 45,
      });

    assert.strictEqual(invStepRes.status, 400);
    assert.strictEqual(invStepRes.body.error.code, 'VALIDATION_ERROR');

    // 5. Add sport2 with 60 min step -> succeeds
    const res2 = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sportId: sport2._id.toString(),
        slotStepMinutes: 60,
      });

    assert.strictEqual(res2.status, 201);
    assert.strictEqual(res2.body.data.slotStepMinutes, 60);

    // List facility sports
    const listRes = await request(app)
      .get(`/api/v1/owner/facilities/${facility._id}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.data.length, 2);
  });

  await t.test('Court Creation & Validation: Unique name per facility, inherits links, positive price', async () => {
    // Setup FacilitySport
    const facSport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport1._id,
      slotStepMinutes: 90,
      configVersion: 1,
    });

    // 1. Create Court 1
    const res1 = await request(app)
      .post('/api/v1/owner/courts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        facilitySportId: facSport._id.toString(),
        name: 'Sân Bóng Đá Số 1',
        description: 'Mặt cỏ nhân tạo tiêu chuẩn FIFA',
        pricePerHourVnd: 250000,
      });

    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.body.success, true);
    assert.strictEqual(res1.body.data.name, 'Sân Bóng Đá Số 1');
    assert.strictEqual(res1.body.data.facilityId, facility._id.toString());
    assert.strictEqual(res1.body.data.sportId, sport1._id.toString());
    assert.strictEqual(res1.body.data.pricePerHourVnd, 250000);
    assert.strictEqual(res1.body.data.priceVersion, 1);
    assert.strictEqual(res1.body.data.isActive, true);

    // 2. Duplicate court name in same facility -> 409
    const dupRes = await request(app)
      .post('/api/v1/owner/courts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        facilitySportId: facSport._id.toString(),
        name: '  sân bóng đá số 1  ', // Case-insensitive trim duplicate
        pricePerHourVnd: 300000,
      });

    assert.strictEqual(dupRes.status, 409);
    assert.strictEqual(dupRes.body.error.code, 'COURT_NAME_ALREADY_EXISTS');

    // 3. Invalid price (0 or negative) -> 400
    const invPriceRes = await request(app)
      .post('/api/v1/owner/courts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        facilitySportId: facSport._id.toString(),
        name: 'Sân Giá 0',
        pricePerHourVnd: 0,
      });

    assert.strictEqual(invPriceRes.status, 400);
    assert.strictEqual(invPriceRes.body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('Court Update: price update increments priceVersion, active toggle works', async () => {
    const facSport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport1._id,
      slotStepMinutes: 90,
      configVersion: 1,
    });

    const court = await Court.create({
      facilitySportId: facSport._id,
      facilityId: facility._id,
      sportId: sport1._id,
      name: 'Sân Cần Cập Nhật',
      pricePerHourVnd: 150000,
      priceVersion: 1,
      isActive: true,
    });

    // Update court price and status
    const updateRes = await request(app)
      .patch(`/api/v1/owner/courts/${court._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pricePerHourVnd: 180000,
        isActive: false,
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.pricePerHourVnd, 180000);
    assert.strictEqual(updateRes.body.data.priceVersion, 2); // Incremented!
    assert.strictEqual(updateRes.body.data.isActive, false);
  });

  await t.test('Guard Criterion 15: Changing slotStepMinutes is blocked when active bookings/blocks exist', async () => {
    const facSport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport1._id,
      slotStepMinutes: 90,
      configVersion: 1,
    });

    const court = await Court.create({
      facilitySportId: facSport._id,
      facilityId: facility._id,
      sportId: sport1._id,
      name: 'Sân Đang Có Lịch',
      pricePerHourVnd: 200000,
      priceVersion: 1,
      isActive: true,
    });

    const todayStr = getCurrentDateVN();

    // Create an unexpired PENDING_PAYMENT booking
    await Booking.create({
      bookingCode: 'BK-GUARD-01',
      bookingRequestId: new mongoose.Types.ObjectId(),
      courtId: court._id,
      facilityId: facility._id,
      bookingDate: todayStr,
      startTime: '18:00',
      endTime: '19:30',
      startMinutes: 1080,
      endMinutes: 1170,
      durationMinutes: 90,
      pricePerHourVnd: 200000,
      totalPriceVnd: 300000,
      holdExpiresAt: new Date(Date.now() + 600000),
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      snapshot: {
        facilityName: 'Trung Tâm Thể Thao Hòa Bình',
        facilityAddress: '100 Nguyễn Huệ',
        courtName: 'Sân Đang Có Lịch',
        sportName: 'Bóng Đá',
        slotStepMinutes: 90,
      },
    });

    // Attempt to update slot step from 90 to 60 -> must be rejected with 409!
    const stepRes = await request(app)
      .patch(`/api/v1/owner/facilities/${facility._id}/sports/${facSport._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ slotStepMinutes: 60 });

    assert.strictEqual(stepRes.status, 409);
    assert.strictEqual(stepRes.body.error.code, 'FACILITY_HAS_ACTIVE_BOOKINGS');

    // Clean up booking
    await Booking.deleteMany({});

    // Now update succeeds!
    const stepSuccessRes = await request(app)
      .patch(`/api/v1/owner/facilities/${facility._id}/sports/${facSport._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ slotStepMinutes: 60 });

    assert.strictEqual(stepSuccessRes.status, 200);
    assert.strictEqual(stepSuccessRes.body.data.slotStepMinutes, 60);
    assert.strictEqual(stepSuccessRes.body.data.configVersion, 2);
  });

  await t.test('Guard Criterion 15: Changing facility operating hours is blocked when active bookings exist', async () => {
    const facSport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport1._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });

    const court = await Court.create({
      facilitySportId: facSport._id,
      facilityId: facility._id,
      sportId: sport1._id,
      name: 'Sân Khóa Giờ',
      pricePerHourVnd: 200000,
      priceVersion: 1,
      isActive: true,
    });

    // Add active CourtBlock in future
    await CourtBlock.create({
      courtId: court._id,
      bookingDate: '2029-12-31',
      startTime: '08:00',
      endTime: '10:00',
      startMinutes: 480,
      endMinutes: 600,
      reason: 'Bảo trì định kỳ',
      createdBy: owner._id,
      isActive: true,
    });

    // Attempt to update operating hours -> must be rejected with 409!
    const hoursRes = await request(app)
      .patch(`/api/v1/owner/facilities/${facility._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ openTime: '07:00', closeTime: '21:00' });

    assert.strictEqual(hoursRes.status, 409);
    assert.strictEqual(hoursRes.body.error.code, 'FACILITY_HAS_ACTIVE_BOOKINGS');

    // Remove active block
    await CourtBlock.deleteMany({});

    // Now update operating hours succeeds!
    const hoursSuccessRes = await request(app)
      .patch(`/api/v1/owner/facilities/${facility._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ openTime: '07:00', closeTime: '21:00' });

    assert.strictEqual(hoursSuccessRes.status, 200);
    assert.strictEqual(hoursSuccessRes.body.data.openTime, '07:00');
    assert.strictEqual(hoursSuccessRes.body.data.closeTime, '21:00');
    assert.strictEqual(hoursSuccessRes.body.data.operatingHoursVersion, 2);
  });
});
