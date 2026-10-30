import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { Facility } from '../../src/models/facility.model.js';
import { FacilitySport } from '../../src/models/facility-sport.model.js';
import { Court } from '../../src/models/court.model.js';
import { Sport } from '../../src/models/sport.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { PaymentOrder } from '../../src/models/payment-order.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Booking Concurrency & Atomic Race Condition Protection (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p09-concurrency-/ } });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let customer1 = null;
  let customer2 = null;
  let customerToken1 = null;
  let customerToken2 = null;
  let owner = null;
  let facility = null;
  let facilitySport = null;
  let court = null;
  let sport = null;

  t.beforeEach(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p09-concurrency-/ } });
    await AuthSession.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    customer1 = await User.create({
      email: `cust1-p09-concurrency-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Đua Lệnh 1',
      phoneNumber: '0903000001',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s1 = await AuthSession.create({
      userId: customer1._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken1 = jwtService.signAccessToken(customer1, s1).accessToken;

    customer2 = await User.create({
      email: `cust2-p09-concurrency-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Đua Lệnh 2',
      phoneNumber: '0903000002',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s2 = await AuthSession.create({
      userId: customer2._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken2 = jwtService.signAccessToken(customer2, s2).accessToken;

    owner = await User.create({
      email: `owner-p09-concurrency-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Concurrency',
      phoneNumber: '0903000003',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });

    sport = await Sport.create({
      name: `Cầu Lông P09 Concurrency ${Date.now()}`,
      normalizedName: `CAU LONG P09 CONCURRENCY ${Date.now()}`,
      description: 'Môn cầu lông',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'CLB Cầu Lông Đua Lệnh',
      description: 'Sân thử nghiệm concurrency',
      address: '101 Đường Cộng Hòa',
      province: 'TP. Hồ Chí Minh',
      phoneNumber: '0903000003',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    facilitySport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court = await Court.create({
      facilitySportId: facilitySport._id,
      facilityId: facility._id,
      sportId: sport._id,
      name: 'Sân Thi Đấu VIP',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });
  });

  await t.test('1. Two concurrent requests overlapping with different start times: exactly ONE wins (Criterion 7)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 2);

    // Ensure CourtDaySchedule does NOT exist initially (Criterion 7)
    const existingCoord = await CourtDaySchedule.findOne({ courtId: court._id, bookingDate });
    assert.equal(existingCoord, null);

    // Request 1: 08:00 to 09:30 (3x 30m slots: 08:00-08:30, 08:30-09:00, 09:00-09:30)
    const req1 = request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken1}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '08:00', endTime: '08:30' },
          { startTime: '08:30', endTime: '09:00' },
          { startTime: '09:00', endTime: '09:30' },
        ],
        contactName: 'Khách Đua 1',
        contactPhone: '0903000001',
        idempotencyKey: 'race-key-cust1',
      });

    // Request 2: 09:00 to 10:00 (2x 30m slots: 09:00-09:30, 09:30-10:00) -> overlaps on 09:00-09:30
    const req2 = request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken2}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '09:00', endTime: '09:30' },
          { startTime: '09:30', endTime: '10:00' },
        ],
        contactName: 'Khách Đua 2',
        contactPhone: '0903000002',
        idempotencyKey: 'race-key-cust2',
      });

    // Fire both requests concurrently
    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one 201 Created and one 409 Conflict
    assert.deepEqual(statuses, [201, 409]);

    const winner = res1.status === 201 ? res1 : res2;
    const loser = res1.status === 409 ? res1 : res2;

    assert.equal(winner.body.success, true);
    assert.equal(loser.body.success, false);
    assert.equal(loser.body.error.code, 'SCHEDULE_CONFLICT');

    // In DB: exactly 1 BookingRequest was persisted
    const allRequests = await BookingRequest.find({ courtId: court._id, bookingDate });
    assert.equal(allRequests.length, 1);

    // In DB: exactly 1 PaymentOrder was persisted
    const allPO = await PaymentOrder.find({});
    assert.equal(allPO.length, 1);

    // CourtDaySchedule was created and coordinated
    const finalCoord = await CourtDaySchedule.findOne({ courtId: court._id, bookingDate });
    assert.ok(finalCoord);
    assert.ok(finalCoord.scheduleVersion >= 1);
  });

  await t.test('2. Multi-interval request fails atomically if ANY interval is occupied (Criterion 8)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 3);

    // 1. Pre-existing booking occupied: 08:00 to 08:30
    await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken1}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '08:00', endTime: '08:30' }],
        contactName: 'Khách Chiếm Chỗ',
        contactPhone: '0903000001',
        idempotencyKey: 'pre-existing-key',
      })
      .expect(201);

    // 2. Customer 2 requests 2 intervals:
    // Interval 1: 06:00 to 07:00 (completely free)
    // Interval 2: 08:00 to 08:30 (BUSY - occupied)
    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken2}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '06:00', endTime: '06:30' },
          { startTime: '06:30', endTime: '07:00' },
          { startTime: '08:00', endTime: '08:30' },
        ],
        contactName: 'Khách Thất Bại',
        contactPhone: '0903000002',
        idempotencyKey: 'atomic-failure-key',
      })
      .expect(409);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'SCHEDULE_CONFLICT');

    // CRITICAL: Verify atomic rollback - Customer 2 has ZERO booking requests and ZERO bookings
    const cust2Requests = await BookingRequest.find({ customerId: customer2._id });
    assert.equal(cust2Requests.length, 0);

    const freeSlotBookings = await Booking.find({
      courtId: court._id,
      bookingDate,
      startTime: '06:00',
    });
    assert.equal(freeSlotBookings.length, 0); // Not saved partially!
  });
});

