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
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { PaymentOrder } from '../../src/models/payment-order.model.js';
import { CourtBlock } from '../../src/models/court-block.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { jwtService } from '../../src/services/jwt.service.js';
import {
  getCurrentDateVN,
  getDayType,
  getDayOfWeekKey,
} from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { migrateB03PricingAndWeeklySchedule } from '../../scripts/migrations/migrate-b03-pricing-weekly.js';

test('Logic Fix B03 - Multi-tier Pricing & Weekly Operating Hours Flow', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await PaymentOrder.deleteMany({});
    await BookingRequest.deleteMany({});
    await CourtBlock.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await AuthSession.deleteMany({});
    await User.deleteMany({ email: { $regex: /b03-test-/ } });
    await disconnectDB();
  });

  let owner = null;
  let customer = null;
  let ownerToken = null;
  let customerToken = null;
  let sport = null;
  let facility = null;
  let facilitySport = null;
  let court = null;

  // Helper to find date of specific type (WEEKDAY or WEEKEND)
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

  // Helper to find date of specific day key (e.g. 'sunday')
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
    await PaymentOrder.deleteMany({});
    await BookingRequest.deleteMany({});
    await CourtBlock.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await AuthSession.deleteMany({});
    await User.deleteMany({ email: { $regex: /b03-test-/ } });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    owner = await User.create({
      fullName: 'B03 Test Owner',
      email: `b03-test-owner-${Date.now()}@sportbooking.local`,
      phoneNumber: '0901234567',
      passwordHash,
      role: 'OWNER',
      isLocked: false,
      activatedAt: new Date(),
      emailVerifiedAt: new Date(),
    });

    customer = await User.create({
      fullName: 'B03 Test Customer',
      email: `b03-test-cust-${Date.now()}@sportbooking.local`,
      phoneNumber: '0912345678',
      passwordHash,
      role: 'CUSTOMER',
      isLocked: false,
      emailVerifiedAt: new Date(),
    });

    const ownerSession = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, ownerSession).accessToken;

    const custSession = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, custSession).accessToken;

    sport = await Sport.create({
      name: `Cầu lông B03 ${Date.now()}`,
      normalizedName: `cau long b03 ${Date.now()}`,
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Cơ sở Thể thao B03',
      address: '200 Kim Mã, Hà Nội',
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
        sunday: { isOpen: true, openTime: '06:00', closeTime: '22:00' },
      },
    });

    facilitySport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court = await Court.create({
      facilityId: facility._id,
      facilitySportId: facilitySport._id,
      sportId: sport._id,
      name: 'Sân Cầu Lông B03-1',
      pricePerHourVnd: 80000,
      priceVersion: 1,
      bookingCoordinationVersion: 1,
      isActive: true,
      pricingRules: [
        // Weekday rules
        { dayType: 'WEEKDAY', startTime: '06:00', endTime: '17:00', pricePerHourVnd: 80000 },
        { dayType: 'WEEKDAY', startTime: '17:00', endTime: '18:00', pricePerHourVnd: 100000 },
        { dayType: 'WEEKDAY', startTime: '18:00', endTime: '20:00', pricePerHourVnd: 150000 },
        { dayType: 'WEEKDAY', startTime: '20:00', endTime: '22:00', pricePerHourVnd: 120000 },
        // Weekend rules
        { dayType: 'WEEKEND', startTime: '06:00', endTime: '12:00', pricePerHourVnd: 120000 },
        { dayType: 'WEEKEND', startTime: '12:00', endTime: '22:00', pricePerHourVnd: 200000 },
      ],
    });
  });

  // =========================================================================
  // Subtest 1: Multi-tier pricing calculation across boundaries & required example
  // 17:30 - 18:30 on Weekday = 125,000 VND (30m @ 100k + 30m @ 150k)
  // Verify merged interval in Booking and pricingSnapshot segments
  // =========================================================================
  await t.test('1. Multi-tier pricing calculation across boundaries & required example (17:30-18:30 = 125k VND)', async () => {
    const weekdayDate = findDateByType('WEEKDAY', 2);

    // Selected slots: 17:30-18:00 and 18:00-18:30
    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: weekdayDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        priceVersion: court.priceVersion,
        expectedAmountVnd: 125000,
        selectedSlots: [
          { startTime: '17:30', endTime: '18:00' },
          { startTime: '18:00', endTime: '18:30' },
        ],
        contactName: 'Nguyen Van A',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b03_sub1_${Date.now()}`,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.totalAmountVnd, 125000);

    // Verify Booking in database
    const bookingRequestId = res.body.data.bookingRequestId;
    const bookings = await Booking.find({ bookingRequestId });
    assert.strictEqual(bookings.length, 1, 'Adjacent slots must be merged into 1 continuous booking interval');

    const booking = bookings[0];
    assert.strictEqual(booking.startTime, '17:30');
    assert.strictEqual(booking.endTime, '18:30');
    assert.strictEqual(booking.totalPriceVnd, 125000);

    // Verify pricingSnapshot stored in Booking
    assert.ok(Array.isArray(booking.pricingSnapshot), 'pricingSnapshot must be an array');
    assert.strictEqual(booking.pricingSnapshot.length, 2, 'Must have 2 segments');

    const seg1 = booking.pricingSnapshot[0];
    assert.strictEqual(seg1.startTime, '17:30');
    assert.strictEqual(seg1.endTime, '18:00');
    assert.strictEqual(seg1.pricePerHourVnd, 100000);
    assert.strictEqual(seg1.durationMinutes, 30);
    assert.strictEqual(seg1.segmentAmountVnd, 50000);

    const seg2 = booking.pricingSnapshot[1];
    assert.strictEqual(seg2.startTime, '18:00');
    assert.strictEqual(seg2.endTime, '18:30');
    assert.strictEqual(seg2.pricePerHourVnd, 150000);
    assert.strictEqual(seg2.durationMinutes, 30);
    assert.strictEqual(seg2.segmentAmountVnd, 75000);

    assert.strictEqual(seg1.segmentAmountVnd + seg2.segmentAmountVnd, booking.totalPriceVnd);
  });

  // =========================================================================
  // Subtest 2: Weekend pricing rule distinction for same time slot
  // 17:30 - 18:30 on Weekend = 200,000 VND (60m @ 200k)
  // =========================================================================
  await t.test('2. Weekend pricing rule distinction for same time slot (17:30-18:30 = 200k VND)', async () => {
    const weekendDate = findDateByType('WEEKEND', 2);

    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: weekendDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        priceVersion: court.priceVersion,
        expectedAmountVnd: 200000,
        selectedSlots: [
          { startTime: '17:30', endTime: '18:00' },
          { startTime: '18:00', endTime: '18:30' },
        ],
        contactName: 'Tran Van B',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b03_sub2_${Date.now()}`,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.totalAmountVnd, 200000);

    const booking = await Booking.findOne({ bookingRequestId: res.body.data.bookingRequestId });
    assert.strictEqual(booking.totalPriceVnd, 200000);
    assert.strictEqual(booking.pricingSnapshot.length, 1);
    assert.strictEqual(booking.pricingSnapshot[0].pricePerHourVnd, 200000);
    assert.strictEqual(booking.pricingSnapshot[0].segmentAmountVnd, 200000);
  });

  // =========================================================================
  // Subtest 3: Missing pricing rule rejection & overlapping rules validation
  // =========================================================================
  await t.test('3. Missing pricing rule gap rejects booking with 400; overlapping rules update rejected with 400', async () => {
    // 3a. Court with gap: remove 20:00-22:00 from weekday rules
    court.pricingRules = court.pricingRules.filter(
      (r) => !(r.dayType === 'WEEKDAY' && r.startTime === '20:00')
    );
    await court.save();

    const weekdayDate = findDateByType('WEEKDAY', 2);

    // Attempting to book 20:00-21:00 (which has no pricing rule)
    const gapRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: weekdayDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        priceVersion: court.priceVersion,
        expectedAmountVnd: 120000,
        selectedSlots: [
          { startTime: '20:00', endTime: '20:30' },
          { startTime: '20:30', endTime: '21:00' },
        ],
        contactName: 'Le Van C',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b03_sub3_gap_${Date.now()}`,
      });

    assert.strictEqual(gapRes.status, 400, 'Must reject booking when pricing rule is missing');
    assert.strictEqual(gapRes.body.success, false);
    assert.ok(
      gapRes.body.error?.message?.includes('chưa có bảng giá') ||
      gapRes.body.error?.code === 'PRICE_RULE_MISSING',
      'Should mention missing pricing rule'
    );

    // 3b. Owner tries to update court with overlapping pricing rules in same dayType
    const overlapRes = await request(app)
      .patch(`/api/v1/owner/courts/${court._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: court.name,
        pricingRules: [
          { dayType: 'WEEKDAY', startTime: '06:00', endTime: '12:00', pricePerHourVnd: 80000 },
          { dayType: 'WEEKDAY', startTime: '10:00', endTime: '15:00', pricePerHourVnd: 100000 }, // Overlaps 10:00-12:00!
        ],
      });

    assert.strictEqual(overlapRes.status, 400, 'Must reject overlapping pricing rules');
    assert.strictEqual(overlapRes.body.success, false);
    assert.ok(
      overlapRes.body.error?.message?.includes('chồng lấn') ||
      overlapRes.body.error?.code === 'VALIDATION_ERROR',
      'Should indicate overlapping pricing rules'
    );
  });

  // =========================================================================
  // Subtest 4: Facility weekly operating hours & closed day
  // =========================================================================
  await t.test('4. Facility weekly schedule: closed day returns isOpen:false, rejects booking with 400', async () => {
    // Set Sunday to isOpen: false
    facility.weeklySchedule.sunday = {
      isOpen: false,
      openTime: null,
      closeTime: null,
    };
    await facility.save();

    const sundayDate = findDateByDayKey('sunday', 2);

    // 4a. Check public schedule API
    const schedRes = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule`)
      .query({ date: sundayDate });

    assert.strictEqual(schedRes.status, 200);
    assert.strictEqual(schedRes.body.success, true);
    assert.strictEqual(schedRes.body.data.isOpen, false);
    assert.strictEqual(schedRes.body.data.dayOfWeek, 'sunday');
    assert.strictEqual(schedRes.body.data.slots.length, 0);

    // 4b. Customer attempt to book on Sunday
    const bookRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: sundayDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        priceVersion: court.priceVersion,
        expectedAmountVnd: 120000,
        selectedSlots: [{ startTime: '08:00', endTime: '08:30' }],
        contactName: 'Sunday Booker',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b03_sub4_${Date.now()}`,
      });

    assert.strictEqual(bookRes.status, 400);
    assert.strictEqual(bookRes.body.success, false);
    assert.ok(
      bookRes.body.error?.message?.includes('mở cửa') ||
      bookRes.body.error?.message?.includes('đóng cửa') ||
      bookRes.body.error?.code === 'FACILITY_CLOSED',
      'Should reject booking on closed day'
    );

    // 4c. Owner attempt to create CourtBlock on Sunday
    const blockRes = await request(app)
      .post('/api/v1/owner/court-blocks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: sundayDate,
        operatingHoursVersion: 1,
        configVersion: 1,
        selectedSlots: [{ startTime: '08:00', endTime: '08:30' }],
        reason: 'Bảo trì',
      });

    assert.strictEqual(blockRes.status, 400);
    assert.strictEqual(blockRes.body.success, false);
    assert.ok(
      blockRes.body.error?.message?.includes('mở cửa') ||
      blockRes.body.error?.message?.includes('đóng cửa')
    );
  });

  // =========================================================================
  // Subtest 5: Quote endpoint POST /api/v1/booking-requests/quote
  // =========================================================================
  await t.test('5. Quote endpoint POST /api/v1/booking-requests/quote calculates official breakdown', async () => {
    const weekdayDate = findDateByType('WEEKDAY', 2);

    // 5a. Unauthorized request rejected with 401
    const unauthRes = await request(app)
      .post('/api/v1/booking-requests/quote')
      .send({
        courtId: court._id.toString(),
        bookingDate: weekdayDate,
        selectedSlots: [{ startTime: '17:30', endTime: '18:30' }],
      });
    assert.strictEqual(unauthRes.status, 401);

    // 5b. Authenticated quote for 17:30-18:30
    const quoteRes = await request(app)
      .post('/api/v1/booking-requests/quote')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: weekdayDate,
        selectedSlots: [
          { startTime: '17:30', endTime: '18:00' },
          { startTime: '18:00', endTime: '18:30' },
        ],
      });

    assert.strictEqual(quoteRes.status, 200);
    assert.strictEqual(quoteRes.body.success, true);
    assert.strictEqual(quoteRes.body.data.totalAmountVnd, 125000);
    assert.strictEqual(quoteRes.body.data.dayType, 'WEEKDAY');
    assert.strictEqual(quoteRes.body.data.priceVersion, court.priceVersion);
    assert.strictEqual(quoteRes.body.data.intervals.length, 1);
    assert.strictEqual(quoteRes.body.data.intervals[0].pricingSnapshot.length, 2);
  });

  // =========================================================================
  // Subtest 6: Price version mismatch & expectedAmountVnd mismatch prompt
  // =========================================================================
  await t.test('6. Stale priceVersion or mismatched expectedAmountVnd returns 409 CONFIG_VERSION_MISMATCH', async () => {
    const weekdayDate = findDateByType('WEEKDAY', 2);

    // 6a. Stale priceVersion
    const staleVerRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: weekdayDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        priceVersion: 9999, // Stale!
        expectedAmountVnd: 125000,
        selectedSlots: [
          { startTime: '17:30', endTime: '18:00' },
          { startTime: '18:00', endTime: '18:30' },
        ],
        contactName: 'Price Checker',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b03_sub6_ver_${Date.now()}`,
      });

    assert.strictEqual(staleVerRes.status, 409);
    assert.strictEqual(staleVerRes.body.error?.code, 'CONFIG_VERSION_MISMATCH');

    // 6b. Mismatched expectedAmountVnd
    const staleAmountRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: weekdayDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        priceVersion: court.priceVersion,
        expectedAmountVnd: 100000, // Should be 125000!
        selectedSlots: [
          { startTime: '17:30', endTime: '18:00' },
          { startTime: '18:00', endTime: '18:30' },
        ],
        contactName: 'Price Checker',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b03_sub6_amt_${Date.now()}`,
      });

    assert.strictEqual(staleAmountRes.status, 409);
    assert.strictEqual(staleAmountRes.body.error?.code, 'CONFIG_VERSION_MISMATCH');
    assert.ok(staleAmountRes.body.error?.message?.includes('Báo giá đã thay đổi'));
  });

  // =========================================================================
  // Subtest 7: Idempotent migration script execution (migrateB03PricingAndWeeklySchedule)
  // =========================================================================
  await t.test('7. Migration script initializes weeklySchedule and pricingRules idempotently without touching bookings', async () => {
    // Create legacy facility without weeklySchedule
    const legacyFac = await Facility.create({
      ownerId: owner._id,
      name: 'Cơ sở Cũ B03',
      address: '50 Phố Huế, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0901234567',
      openTime: '07:00',
      closeTime: '21:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });
    // Remove weeklySchedule explicitly if mongoose default set it
    await Facility.collection.updateOne(
      { _id: legacyFac._id },
      { $unset: { weeklySchedule: '' } }
    );

    // Create legacy court without pricingRules
    const legacyCourt = await Court.create({
      facilityId: legacyFac._id,
      facilitySportId: facilitySport._id,
      sportId: sport._id,
      name: 'Sân Cũ B03',
      pricePerHourVnd: 110000,
      priceVersion: 1,
      isActive: true,
    });
    await Court.collection.updateOne(
      { _id: legacyCourt._id },
      { $unset: { pricingRules: '' } }
    );

    // Create existing confirmed booking to verify financial integrity
    const existingBooking = await Booking.create({
      bookingCode: 'BK-20261101-0001',
      bookingRequestId: new mongoose.Types.ObjectId(),
      facilityId: legacyFac._id,
      courtId: legacyCourt._id,
      sportId: sport._id,
      customerId: customer._id,
      bookingDate: '2026-11-01',
      startTime: '08:00',
      endTime: '09:00',
      startMinutes: 480,
      endMinutes: 540,
      durationMinutes: 60,
      pricePerHourVnd: 110000,
      totalPriceVnd: 110000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      source: 'CUSTOMER_ONLINE',
      holdExpiresAt: new Date(Date.now() + 600000),
      snapshot: {
        facilityName: legacyFac.name,
        facilityAddress: legacyFac.address,
        courtName: legacyCourt.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    // Run migration 1st time
    const result1 = await migrateB03PricingAndWeeklySchedule({ verbose: false });
    assert.ok(result1.migratedFacilitiesCount >= 1);
    assert.ok(result1.migratedCourtsCount >= 1);

    // Check facility has weeklySchedule populated
    const updatedFac = await Facility.findById(legacyFac._id);
    assert.ok(updatedFac.weeklySchedule);
    assert.strictEqual(updatedFac.weeklySchedule.monday.isOpen, true);
    assert.strictEqual(updatedFac.weeklySchedule.monday.openTime, '07:00');
    assert.strictEqual(updatedFac.weeklySchedule.monday.closeTime, '21:00');

    // Check court has pricingRules populated
    const updatedCourt = await Court.findById(legacyCourt._id);
    assert.ok(updatedCourt.pricingRules.length >= 2);
    const weekdayRule = updatedCourt.pricingRules.find((r) => r.dayType === 'WEEKDAY');
    assert.ok(weekdayRule);
    assert.strictEqual(weekdayRule.pricePerHourVnd, 110000);
    assert.strictEqual(weekdayRule.startTime, '07:00');
    assert.strictEqual(weekdayRule.endTime, '21:00');

    // Check existing booking is completely untouched
    const checkBooking = await Booking.findById(existingBooking._id);
    assert.strictEqual(checkBooking.totalPriceVnd, 110000);
    assert.strictEqual(checkBooking.status, 'CONFIRMED');

    // Run migration 2nd time (Idempotent test)
    const result2 = await migrateB03PricingAndWeeklySchedule({ verbose: false });
    assert.strictEqual(result2.migratedFacilitiesCount, 0, 'Second run should not migrate facilities');
    assert.strictEqual(result2.migratedCourtsCount, 0, 'Second run should not migrate courts');
  });

  // =========================================================================
  // Subtest 8: Minimum price synchronization & filter
  // =========================================================================
  await t.test('8. Court pricePerHourVnd synchronizes to minimum rule price for search and filter', async () => {
    // Update court with new pricing rules where minimum is 70,000 VND
    const updateRes = await request(app)
      .patch(`/api/v1/owner/courts/${court._id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sân Cầu Lông Đổi Bảng Giá',
        pricingRules: [
          { dayType: 'WEEKDAY', startTime: '06:00', endTime: '12:00', pricePerHourVnd: 70000 },
          { dayType: 'WEEKDAY', startTime: '12:00', endTime: '22:00', pricePerHourVnd: 130000 },
          { dayType: 'WEEKEND', startTime: '06:00', endTime: '22:00', pricePerHourVnd: 180000 },
        ],
      });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.pricePerHourVnd, 70000, 'pricePerHourVnd must reflect min rule price');
    assert.strictEqual(updateRes.body.data.priceVersion, court.priceVersion + 1);

    // Verify in database
    const dbCourt = await Court.findById(court._id);
    assert.strictEqual(dbCourt.pricePerHourVnd, 70000);

    // Public facility detail lists courts with pricePerHourVnd = 70000
    const facDetailRes = await request(app).get(`/api/v1/facilities/${facility._id}`);
    assert.strictEqual(facDetailRes.status, 200);
    const courtInFac = facDetailRes.body.data.courts.find((c) => c.id === court._id.toString());
    assert.strictEqual(courtInFac.pricePerHourVnd, 70000);
  });
});
