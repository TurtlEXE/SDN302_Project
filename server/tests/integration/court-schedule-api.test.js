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
import { User } from '../../src/models/user.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { CourtBlock } from '../../src/models/court-block.model.js';
import { getCurrentDateVN, getCurrentTimeVN, parseTimeToMinutes } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';

test('Court Schedule API - GET /api/v1/courts/:id/schedule (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await CourtBlock.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p08-schedule-/ } });
    await disconnectDB();
  });

  let owner = null;
  let sportBadminton = null;
  let sportFootball = null;
  let facilityBadminton = null;
  let facilityFootball = null;
  let fsBadminton = null;
  let fsFootball = null;
  let court1 = null;
  let courtFootball = null;
  let inactiveCourt = null;

  t.beforeEach(async () => {
    await Booking.deleteMany({});
    await CourtBlock.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p08-schedule-/ } });

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    owner = await User.create({
      email: `owner-p08-schedule-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P08',
      phoneNumber: '0988111222',
      role: 'OWNER',
      isLocked: false,
      emailVerifiedAt: now,
      activatedAt: now,
    });

    sportBadminton = await Sport.create({
      name: `Cầu Lông P08 ${Date.now()}`,
      normalizedName: `CAU LONG P08 ${Date.now()}`,
      description: 'Môn cầu lông',
      isActive: true,
    });

    sportFootball = await Sport.create({
      name: `Bóng Đá P08 ${Date.now()}`,
      normalizedName: `BONG DA P08 ${Date.now()}`,
      description: 'Môn bóng đá 90m step',
      isActive: true,
    });

    // Facility 1: Badminton, 06:00 to 22:00, 30m step
    facilityBadminton = await Facility.create({
      ownerId: owner._id,
      name: 'CLB Cầu Lông Mặt Trời',
      description: 'Cơ sở cầu lông chuẩn thi đấu',
      address: '123 Đường Số 1',
      province: 'Hà Nội',
      phoneNumber: '0988111222',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    fsBadminton = await FacilitySport.create({
      facilityId: facilityBadminton._id,
      sportId: sportBadminton._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court1 = await Court.create({
      facilitySportId: fsBadminton._id,
      facilityId: facilityBadminton._id,
      sportId: sportBadminton._id,
      name: 'Sân 1',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });

    inactiveCourt = await Court.create({
      facilitySportId: fsBadminton._id,
      facilityId: facilityBadminton._id,
      sportId: sportBadminton._id,
      name: 'Sân 2 Đang Sửa',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: false,
    });

    // Facility 2: Football, 06:00 to 23:00, 90m step (Remainder 30 min at end of day)
    facilityFootball = await Facility.create({
      ownerId: owner._id,
      name: 'Sân Bóng Mini Sao Vàng',
      description: 'Sân bóng đá nhân tạo',
      address: '456 Đường Số 2',
      province: 'Hà Nội',
      phoneNumber: '0988111333',
      openTime: '06:00',
      closeTime: '23:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    fsFootball = await FacilitySport.create({
      facilityId: facilityFootball._id,
      sportId: sportFootball._id,
      slotStepMinutes: 90,
      configVersion: 2,
    });

    courtFootball = await Court.create({
      facilitySportId: fsFootball._id,
      facilityId: facilityFootball._id,
      sportId: sportFootball._id,
      name: 'Sân Bóng 7 Người A',
      pricePerHourVnd: 300000,
      priceVersion: 1,
      isActive: true,
    });
  });

  await t.test('1. Returns 200 with CourtScheduleDTO for valid future date', async () => {
    const todayStr = getCurrentDateVN();
    const futureDate = addDaysToDateVN(todayStr, 2);

    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${futureDate}`)
      .expect(200);

    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.equal(data.courtId, court1._id.toString());
    assert.equal(data.courtName, 'Sân 1');
    assert.equal(data.bookingDate, futureDate);
    assert.equal(data.openTime, '06:00');
    assert.equal(data.closeTime, '22:00');
    assert.equal(data.slotStepMinutes, 30);
    assert.equal(data.pricePerHourVnd, 120000);
    assert.equal(data.configVersion, 1);
    assert.ok(Array.isArray(data.slots));
    // 06:00 to 22:00 with 30m step = 16 hours * 2 = 32 slots
    assert.equal(data.slots.length, 32);

    // All slots should be AVAILABLE since there are no bookings/blocks
    assert.ok(data.slots.every((s) => s.status === 'AVAILABLE'));
  });

  await t.test('2. Truncates remainder not fitting a full step (Criterion 30)', async () => {
    const todayStr = getCurrentDateVN();
    const futureDate = addDaysToDateVN(todayStr, 5);

    // Football facility: 06:00 to 23:00, 90m step
    // 06:00 to 22:30 fits 11 slots of 90 min (16.5h = 990 min). 22:30 to 23:00 (30 min) is truncated.
    const res = await request(app)
      .get(`/api/v1/courts/${courtFootball._id}/schedule?date=${futureDate}`)
      .expect(200);

    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.equal(data.slots.length, 11);
    assert.equal(data.slots[0].startTime, '06:00');
    assert.equal(data.slots[0].endTime, '07:30');
    assert.equal(data.slots[10].startTime, '21:00');
    assert.equal(data.slots[10].endTime, '22:30');

    // Make sure no slot exceeds 22:30 or extends to 23:00
    const hasSlotPast2230 = data.slots.some((s) => s.endTime > '22:30');
    assert.equal(hasSlotPast2230, false);
  });

  await t.test('3. Distinguishes BLOCKED, BOOKED, HOLD, and AVAILABLE statuses', async () => {
    const todayStr = getCurrentDateVN();
    const testDate = addDaysToDateVN(todayStr, 3);
    const now = new Date();

    // 1. BLOCKED slot: CourtBlock on 07:00-08:00 (2x 30m slots: 07:00-07:30, 07:30-08:00)
    await CourtBlock.create({
      courtId: court1._id,
      bookingDate: testDate,
      startTime: '07:00',
      endTime: '08:00',
      startMinutes: 420,
      endMinutes: 480,
      reason: 'Bảo trì đèn chiếu sáng',
      createdBy: owner._id,
      isActive: true,
    });

    // 2. BOOKED slot: Booking CONFIRMED on 09:00-10:00 (2x 30m slots: 09:00-09:30, 09:30-10:00)
    const mockBookingRequestId = new mongoose.Types.ObjectId();
    await Booking.create({
      bookingCode: 'BK-TEST-CONFIRMED',
      bookingRequestId: mockBookingRequestId,
      courtId: court1._id,
      facilityId: facilityBadminton._id,
      bookingDate: testDate,
      startTime: '09:00',
      endTime: '10:00',
      startMinutes: 540,
      endMinutes: 600,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      snapshot: {
        facilityName: 'CLB Cầu Lông Mặt Trời',
        facilityAddress: '123 Đường Số 1',
        courtName: 'Sân 1',
        sportName: 'Cầu Lông',
        slotStepMinutes: 30,
      },
    });

    // 3. HOLD slot: Booking PENDING_PAYMENT with active hold (expires 10 min in the future) on 11:00-12:00
    await Booking.create({
      bookingCode: 'BK-TEST-HOLD-ACTIVE',
      bookingRequestId: new mongoose.Types.ObjectId(),
      courtId: court1._id,
      facilityId: facilityBadminton._id,
      bookingDate: testDate,
      startTime: '11:00',
      endTime: '12:00',
      startMinutes: 660,
      endMinutes: 720,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // active hold
      snapshot: {
        facilityName: 'CLB Cầu Lông Mặt Trời',
        facilityAddress: '123 Đường Số 1',
        courtName: 'Sân 1',
        sportName: 'Cầu Lông',
        slotStepMinutes: 30,
      },
    });

    // 4. EXPIRED HOLD slot: Booking PENDING_PAYMENT with expired hold on 14:00-15:00
    await Booking.create({
      bookingCode: 'BK-TEST-HOLD-EXPIRED',
      bookingRequestId: new mongoose.Types.ObjectId(),
      courtId: court1._id,
      facilityId: facilityBadminton._id,
      bookingDate: testDate,
      startTime: '14:00',
      endTime: '15:00',
      startMinutes: 840,
      endMinutes: 900,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      holdExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired hold
      snapshot: {
        facilityName: 'CLB Cầu Lông Mặt Trời',
        facilityAddress: '123 Đường Số 1',
        courtName: 'Sân 1',
        sportName: 'Cầu Lông',
        slotStepMinutes: 30,
      },
    });

    // 5. CANCELLED booking on 16:00-17:00
    await Booking.create({
      bookingCode: 'BK-TEST-CANCELLED',
      bookingRequestId: new mongoose.Types.ObjectId(),
      courtId: court1._id,
      facilityId: facilityBadminton._id,
      bookingDate: testDate,
      startTime: '16:00',
      endTime: '17:00',
      startMinutes: 960,
      endMinutes: 1020,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      status: 'CANCELLED',
      paymentStatus: 'UNPAID',
      holdExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
      snapshot: {
        facilityName: 'CLB Cầu Lông Mặt Trời',
        facilityAddress: '123 Đường Số 1',
        courtName: 'Sân 1',
        sportName: 'Cầu Lông',
        slotStepMinutes: 30,
      },
    });

    // Fetch schedule
    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${testDate}`)
      .expect(200);

    const slots = res.body.data.slots;
    const slotMap = new Map(slots.map((s) => [`${s.startTime}-${s.endTime}`, s.status]));

    // Check BLOCKED (07:00-08:00)
    assert.equal(slotMap.get('07:00-07:30'), 'BLOCKED');
    assert.equal(slotMap.get('07:30-08:00'), 'BLOCKED');

    // Check BOOKED (09:00-10:00)
    assert.equal(slotMap.get('09:00-09:30'), 'BOOKED');
    assert.equal(slotMap.get('09:30-10:00'), 'BOOKED');

    // Check HOLD (11:00-12:00)
    assert.equal(slotMap.get('11:00-11:30'), 'HOLD');
    assert.equal(slotMap.get('11:30-12:00'), 'HOLD');

    // Check EXPIRED HOLD (14:00-15:00) -> Released, shows AVAILABLE
    assert.equal(slotMap.get('14:00-14:30'), 'AVAILABLE');
    assert.equal(slotMap.get('14:30-15:00'), 'AVAILABLE');

    // Check CANCELLED (16:00-17:00) -> Released, shows AVAILABLE
    assert.equal(slotMap.get('16:00-16:30'), 'AVAILABLE');
    assert.equal(slotMap.get('16:30-17:00'), 'AVAILABLE');

    // Check standard free slot (06:00-06:30)
    assert.equal(slotMap.get('06:00-06:30'), 'AVAILABLE');
  });

  await t.test('4. Resolves PAST status for earlier slots on current day (Criterion 11)', async () => {
    const todayStr = getCurrentDateVN();

    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${todayStr}`)
      .expect(200);

    const slots = res.body.data.slots;
    const nowTimeStr = getCurrentTimeVN();
    const nowMinutes = parseTimeToMinutes(nowTimeStr);

    for (const slot of slots) {
      const slotStartMin = parseTimeToMinutes(slot.startTime);
      if (slotStartMin <= nowMinutes) {
        // If not booked or blocked, must be PAST
        if (slot.status !== 'BOOKED' && slot.status !== 'BLOCKED') {
          assert.equal(slot.status, 'PAST');
        }
      }
    }
  });

  await t.test('5. Strict Privacy Protection: zero customer or booking info leaked (Criterion 22)', async () => {
    const todayStr = getCurrentDateVN();
    const testDate = addDaysToDateVN(todayStr, 4);

    // Create booking with sensitive contact details
    await Booking.create({
      bookingCode: 'BK-SECRET-CUSTOMER',
      bookingRequestId: new mongoose.Types.ObjectId(),
      courtId: court1._id,
      facilityId: facilityBadminton._id,
      bookingDate: testDate,
      startTime: '10:00',
      endTime: '11:00',
      startMinutes: 600,
      endMinutes: 660,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      snapshot: {
        facilityName: 'CLB Cầu Lông Mặt Trời',
        facilityAddress: '123 Đường Số 1',
        courtName: 'Sân 1',
        sportName: 'Cầu Lông',
        slotStepMinutes: 30,
      },
    });

    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${testDate}`)
      .expect(200);

    const jsonStr = JSON.stringify(res.body);
    // Ensure sensitive terms are NOT leaked
    assert.equal(jsonStr.includes('BK-SECRET-CUSTOMER'), false);
    assert.equal(jsonStr.includes('0988111222'), false); // user phone
    assert.equal(jsonStr.includes('Chủ Sân P08'), false); // user name

    // Verify slots only have startTime, endTime, status
    for (const slot of res.body.data.slots) {
      const keys = Object.keys(slot).sort();
      assert.deepEqual(keys, ['endTime', 'startTime', 'status']);
    }
  });

  await t.test('6. Rejects past dates with 400 Bad Request (Criterion 11)', async () => {
    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=2020-01-01`)
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /không thể ở trong quá khứ/);
  });

  await t.test('7. Rejects dates beyond 30 days with 400 Bad Request (Criterion 11)', async () => {
    const todayStr = getCurrentDateVN();
    const farFutureDate = addDaysToDateVN(todayStr, 35);

    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${farFutureDate}`)
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /Chỉ được đặt sân trước tối đa 30 ngày/);
  });

  await t.test('8. Rejects missing date parameter with 400 Bad Request', async () => {
    const res = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule`)
      .expect(400);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  await t.test('9. Returns 404 for non-existent or inactive court', async () => {
    const todayStr = getCurrentDateVN();
    const fakeId = new mongoose.Types.ObjectId();

    // Non-existent court
    const res1 = await request(app)
      .get(`/api/v1/courts/${fakeId}/schedule?date=${todayStr}`)
      .expect(404);
    assert.equal(res1.body.error.code, 'COURT_NOT_FOUND');

    // Inactive court
    const res2 = await request(app)
      .get(`/api/v1/courts/${inactiveCourt._id}/schedule?date=${todayStr}`)
      .expect(404);
    assert.equal(res2.body.error.code, 'COURT_NOT_FOUND');
  });

  await t.test('10. Returns 404 if facility is DRAFT, PAUSED, or admin-locked', async () => {
    const todayStr = getCurrentDateVN();

    // Admin locks facility
    await Facility.findByIdAndUpdate(facilityBadminton._id, { isLockedByAdmin: true });
    const resLock = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${todayStr}`)
      .expect(404);
    assert.equal(resLock.body.error.code, 'FACILITY_NOT_FOUND');

    // Restore lock, set status to PAUSED
    await Facility.findByIdAndUpdate(facilityBadminton._id, { isLockedByAdmin: false, status: 'PAUSED' });
    const resPaused = await request(app)
      .get(`/api/v1/courts/${court1._id}/schedule?date=${todayStr}`)
      .expect(404);
    assert.equal(resPaused.body.error.code, 'FACILITY_NOT_FOUND');
  });
});
