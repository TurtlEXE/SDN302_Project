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
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { CourtBlock } from '../../src/models/court-block.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { jwtService } from '../../src/services/jwt.service.js';
import {
  getCurrentDateVN,
  getDayType,
  getDayOfWeekKey,
} from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';

test('Facility Schedule API - GET /api/v1/facilities/:id/schedule (B04 Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await CourtBlock.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await AuthSession.deleteMany({});
    await User.deleteMany({ email: { $regex: /b04-sched-/ } });
    await disconnectDB();
  });

  let owner = null;
  let customer = null;
  let customerToken = null;
  let facility = null;
  let sportBadminton = null;
  let sportFootball = null;
  let fsBadminton = null;
  let fsFootball = null;
  let courtBadminton1 = null;
  let courtBadminton2 = null;
  let courtFootball1 = null;

  function findDateByType(dayType, minDaysAhead = 1) {
    const today = getCurrentDateVN();
    for (let i = minDaysAhead; i <= 20; i++) {
      const candidate = addDaysToDateVN(today, i);
      if (getDayType(candidate) === dayType) {
        return candidate;
      }
    }
    throw new Error(`Could not find date with type ${dayType}`);
  }

  function findDateByDayKey(dayKey, minDaysAhead = 1) {
    const today = getCurrentDateVN();
    for (let i = minDaysAhead; i <= 20; i++) {
      const candidate = addDaysToDateVN(today, i);
      if (getDayOfWeekKey(candidate) === dayKey) {
        return candidate;
      }
    }
    throw new Error(`Could not find date with day key ${dayKey}`);
  }

  t.beforeEach(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await CourtBlock.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await AuthSession.deleteMany({});
    await User.deleteMany({ email: { $regex: /b04-sched-/ } });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    owner = await User.create({
      fullName: 'B04 Owner',
      email: `b04-sched-owner-${Date.now()}@sportbooking.local`,
      phoneNumber: '0901234567',
      passwordHash,
      role: 'OWNER',
      isLocked: false,
      activatedAt: new Date(),
      emailVerifiedAt: new Date(),
    });

    customer = await User.create({
      fullName: 'B04 Customer',
      email: `b04-sched-cust-${Date.now()}@sportbooking.local`,
      phoneNumber: '0912345678',
      passwordHash,
      role: 'CUSTOMER',
      isLocked: false,
      emailVerifiedAt: new Date(),
    });

    const custSession = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, custSession).accessToken;

    sportBadminton = await Sport.create({
      name: `Cầu lông B04 ${Date.now()}`,
      normalizedName: `cau long b04 ${Date.now()}`,
      isActive: true,
    });

    sportFootball = await Sport.create({
      name: `Bóng đá B04 ${Date.now()}`,
      normalizedName: `bong da b04 ${Date.now()}`,
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Trung tâm Thể thao B04',
      address: '123 Cầu Giấy, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0901234567',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
      operatingHoursVersion: 1,
      weeklySchedule: {
        monday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
        tuesday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
        wednesday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
        thursday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
        friday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
        saturday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
        sunday: { isOpen: false, openTime: null, closeTime: null }, // Closed on Sundays
      },
    });

    fsBadminton = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sportBadminton._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    fsFootball = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sportFootball._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });

    courtBadminton1 = await Court.create({
      facilityId: facility._id,
      facilitySportId: fsBadminton._id,
      sportId: sportBadminton._id,
      name: 'Sân Cầu Lông 1',
      pricePerHourVnd: 100000,
      priceVersion: 1,
      isActive: true,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '18:00', pricePerHourVnd: 80000 },
        { dayType: 'WEEKDAY', startTime: '18:00', endTime: '22:00', pricePerHourVnd: 120000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 150000 },
      ],
    });

    courtBadminton2 = await Court.create({
      facilityId: facility._id,
      facilitySportId: fsBadminton._id,
      sportId: sportBadminton._id,
      name: 'Sân Cầu Lông 2',
      pricePerHourVnd: 90000,
      priceVersion: 1,
      isActive: true,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 90000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 140000 },
      ],
    });

    courtFootball1 = await Court.create({
      facilityId: facility._id,
      facilitySportId: fsFootball._id,
      sportId: sportFootball._id,
      name: 'Sân Bóng Đá 1',
      pricePerHourVnd: 200000,
      priceVersion: 1,
      isActive: true,
      pricingRules: [
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 200000 },
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 300000 },
      ],
    });
  });

  // 1. Valid future date: returns all sports & courts grouped with correct steps and slots
  await t.test('1. Returns 200 with all sports and courts grouped for valid future date', async () => {
    const weekdayDate = findDateByType('WEEKDAY', 2);

    const res = await request(app)
      .get(`/api/v1/facilities/${facility._id}/schedule`)
      .query({ date: weekdayDate });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.facilityId, facility._id.toString());
    assert.strictEqual(res.body.data.bookingDate, weekdayDate);
    assert.strictEqual(res.body.data.isOpen, true);
    assert.strictEqual(res.body.data.dayType, 'WEEKDAY');

    const sports = res.body.data.sports;
    assert.strictEqual(sports.length, 2, 'Must return 2 sports');

    // Badminton sport (step 30)
    const bdmSport = sports.find((s) => s.facilitySportId === fsBadminton._id.toString());
    assert.ok(bdmSport);
    assert.strictEqual(bdmSport.slotStepMinutes, 30);
    assert.strictEqual(bdmSport.courts.length, 2, 'Badminton must have 2 courts');

    const c1 = bdmSport.courts.find((c) => c.courtId === courtBadminton1._id.toString());
    assert.ok(c1);
    // 06:00 to 22:00 at 30 min step = 16 hours * 2 = 32 slots
    assert.strictEqual(c1.slots.length, 32);
    // Check tier pricing for 06:00-06:30 (80k/h -> 40k VND) and 18:00-18:30 (120k/h -> 60k VND)
    assert.strictEqual(c1.slots[0].startTime, '06:00');
    assert.strictEqual(c1.slots[0].priceVnd, 40000);
    const eveningSlot = c1.slots.find((s) => s.startTime === '18:00');
    assert.ok(eveningSlot);
    assert.strictEqual(eveningSlot.priceVnd, 60000);

    // Football sport (step 60)
    const fbSport = sports.find((s) => s.facilitySportId === fsFootball._id.toString());
    assert.ok(fbSport);
    assert.strictEqual(fbSport.slotStepMinutes, 60);
    assert.strictEqual(fbSport.courts.length, 1);
    // 06:00 to 22:00 at 60 min step = 16 slots
    assert.strictEqual(fbSport.courts[0].slots.length, 16);
    assert.strictEqual(fbSport.courts[0].slots[0].priceVnd, 200000);
  });

  // 2. Closed day (Sunday): returns isOpen: false and slots: []
  await t.test('2. Closed day returns isOpen: false and empty slots', async () => {
    const sundayDate = findDateByDayKey('sunday', 2);

    const res = await request(app)
      .get(`/api/v1/facilities/${facility._id}/schedule`)
      .query({ date: sundayDate });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.isOpen, false);
    assert.strictEqual(res.body.data.dayOfWeek, 'sunday');
    assert.ok(res.body.data.message);

    for (const sport of res.body.data.sports) {
      for (const court of sport.courts) {
        assert.strictEqual(court.slots.length, 0);
      }
    }
  });

  // 3. Status resolution: BOOKED, HOLD, BLOCKED across courts
  await t.test('3. Distinguishes BOOKED, HOLD, and BLOCKED statuses across courts', async () => {
    const weekdayDate = findDateByType('WEEKDAY', 2);

    // Confirmed booking on courtBadminton1 at 08:00-09:00
    await Booking.create({
      bookingCode: 'BK-TEST-B04-1',
      bookingRequestId: courtBadminton1._id,
      facilityId: facility._id,
      courtId: courtBadminton1._id,
      sportId: sportBadminton._id,
      customerId: customer._id,
      bookingDate: weekdayDate,
      startTime: '08:00',
      endTime: '09:00',
      startMinutes: 480,
      endMinutes: 540,
      durationMinutes: 60,
      pricePerHourVnd: 80000,
      totalPriceVnd: 80000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      source: 'CUSTOMER_ONLINE',
      holdExpiresAt: new Date(Date.now() + 600000),
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: courtBadminton1.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    // Unexpired HOLD on courtBadminton2 at 09:00-10:00
    await Booking.create({
      bookingCode: 'BK-TEST-B04-2',
      bookingRequestId: courtBadminton2._id,
      facilityId: facility._id,
      courtId: courtBadminton2._id,
      sportId: sportBadminton._id,
      customerId: customer._id,
      bookingDate: weekdayDate,
      startTime: '09:00',
      endTime: '10:00',
      startMinutes: 540,
      endMinutes: 600,
      durationMinutes: 60,
      pricePerHourVnd: 90000,
      totalPriceVnd: 90000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      source: 'CUSTOMER_ONLINE',
      holdExpiresAt: new Date(Date.now() + 600000), // active hold
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: courtBadminton2.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    // BLOCKED on courtFootball1 at 10:00-12:00
    await CourtBlock.create({
      facilityId: facility._id,
      courtId: courtFootball1._id,
      bookingDate: weekdayDate,
      startTime: '10:00',
      endTime: '12:00',
      startMinutes: 600,
      endMinutes: 720,
      reason: 'Bảo trì mặt cỏ',
      isActive: true,
      createdBy: owner._id,
    });

    const res = await request(app)
      .get(`/api/v1/facilities/${facility._id}/schedule`)
      .query({ date: weekdayDate });

    assert.strictEqual(res.status, 200);

    const bdmSport = res.body.data.sports.find((s) => s.facilitySportId === fsBadminton._id.toString());
    const c1 = bdmSport.courts.find((c) => c.courtId === courtBadminton1._id.toString());
    const c2 = bdmSport.courts.find((c) => c.courtId === courtBadminton2._id.toString());
    const fbSport = res.body.data.sports.find((s) => s.facilitySportId === fsFootball._id.toString());
    const fb1 = fbSport.courts.find((c) => c.courtId === courtFootball1._id.toString());

    // c1 08:00-08:30 and 08:30-09:00 should be BOOKED
    const c1Slot1 = c1.slots.find((s) => s.startTime === '08:00');
    const c1Slot2 = c1.slots.find((s) => s.startTime === '08:30');
    assert.strictEqual(c1Slot1.status, 'BOOKED');
    assert.strictEqual(c1Slot2.status, 'BOOKED');

    // c2 09:00-09:30 should be HOLD
    const c2Slot = c2.slots.find((s) => s.startTime === '09:00');
    assert.strictEqual(c2Slot.status, 'HOLD');

    // fb1 10:00-11:00 should be BLOCKED
    const fbSlot = fb1.slots.find((s) => s.startTime === '10:00');
    assert.strictEqual(fbSlot.status, 'BLOCKED');

    // Other slots should be AVAILABLE
    const c1Avail = c1.slots.find((s) => s.startTime === '06:00');
    assert.strictEqual(c1Avail.status, 'AVAILABLE');
  });

  // 4. Strict Privacy: Zero customer or private info leaked in schedule
  await t.test('4. Strict Privacy: zero customer info leaked in facility schedule', async () => {
    const weekdayDate = findDateByType('WEEKDAY', 2);

    const res = await request(app)
      .get(`/api/v1/facilities/${facility._id}/schedule`)
      .query({ date: weekdayDate });

    const str = JSON.stringify(res.body);
    assert.strictEqual(str.includes('BK-TEST-B04'), false);
    assert.strictEqual(str.includes(customer.email), false);
    assert.strictEqual(str.includes(customer.phoneNumber), false);

    // Slots only have startTime, endTime, status, priceVnd
    for (const sport of res.body.data.sports) {
      for (const court of sport.courts) {
        for (const slot of court.slots) {
          const keys = Object.keys(slot).sort();
          assert.deepStrictEqual(keys, ['endTime', 'priceVnd', 'startTime', 'status']);
        }
      }
    }
  });

  // 5. Input validation & error responses
  await t.test('5. Rejects missing date with 400 and past date with 400', async () => {
    // Missing date
    const noDateRes = await request(app).get(`/api/v1/facilities/${facility._id}/schedule`);
    assert.strictEqual(noDateRes.status, 400);

    // Past date
    const pastRes = await request(app)
      .get(`/api/v1/facilities/${facility._id}/schedule`)
      .query({ date: '2020-01-01' });
    assert.strictEqual(pastRes.status, 400);

    // Beyond 30 days
    const beyondRes = await request(app)
      .get(`/api/v1/facilities/${facility._id}/schedule`)
      .query({ date: '2026-12-31' });
    assert.strictEqual(beyondRes.status, 400);
  });
});

