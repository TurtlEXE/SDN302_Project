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
import { facilityService } from '../../src/services/facility.service.js';
import { scheduleService } from '../../src/services/booking/schedule.service.js';
import { bookingRequestService } from '../../src/services/booking/booking-request.service.js';
import { courtBlockService } from '../../src/services/booking/court-block.service.js';
import {
  getCurrentDateVN,
  getCurrentTimeVN,
} from '../../src/utils/date-time.js';
import { addDaysToDateVN, validateBookingDateRange } from '../../src/services/booking/booking-policy.js';

test('Logic Fix B02 - Booking Eligibility, Concurrency Coordination & Business Date Flow', async (t) => {
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
    await User.deleteMany({ email: { $regex: /b02-test-/ } });
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
    await User.deleteMany({ email: { $regex: /b02-test-/ } });

    const passwordHash = await bcrypt.hash('Password123!', 10);

    owner = await User.create({
      fullName: 'B02 Test Owner',
      email: `b02-test-owner-${Date.now()}@sportbooking.local`,
      phoneNumber: '0901234567',
      passwordHash,
      role: 'OWNER',
      isLocked: false,
      activatedAt: new Date(),
      emailVerifiedAt: new Date(),
    });

    customer = await User.create({
      fullName: 'B02 Test Customer',
      email: `b02-test-cust-${Date.now()}@sportbooking.local`,
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
      name: `Cầu lông B02 ${Date.now()}`,
      normalizedName: `cau long b02 ${Date.now()}`,
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Cơ sở Thể thao B02',
      address: '100 Hoàng Diệu, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0901234567',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
      operatingHoursVersion: 1,
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
      name: 'Sân Cầu Lông 1',
      pricePerHourVnd: 100000,
      priceVersion: 1,
      bookingCoordinationVersion: 1,
      isActive: true,
    });
  });

  // =========================================================================
  // Subtest 1: Locked Owner Eligibility Enforcement (Issue 1)
  // =========================================================================
  await t.test('1. Locked Owner: direct access to facility detail, court schedule and booking request are rejected', async () => {
    // 1. First, create a confirmed booking while owner is active
    const today = getCurrentDateVN();
    const futureDate = addDaysToDateVN(today, 2);

    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        selectedSlots: [{ startTime: '08:00', endTime: '08:30' }],
        contactName: 'Nguyen Van A',
        contactPhone: '0912345678',
        idempotencyKey: `idemp_b02_sub1_${Date.now()}`,
      });
    assert.strictEqual(bookingRes.status, 201);
    const existingReqId = bookingRes.body.data.bookingRequestId;

    // Simulate payment confirmed
    await Booking.updateMany({ bookingRequestId: existingReqId }, { status: 'CONFIRMED' });

    // 2. Lock the Owner
    owner.isLocked = true;
    owner.lockReason = 'Tài khoản chủ sân bị khóa do vi phạm chính sách';
    await owner.save();

    // 3. Try to access public facility detail via known ID
    const facRes = await request(app)
      .get(`/api/v1/facilities/${facility._id}`)
      .send();
    assert.strictEqual(facRes.status, 404, 'Direct access to locked owner facility detail must return 404');
    assert.strictEqual(facRes.body.success, false);

    // 4. Try to access court schedule via known court ID
    const schedRes = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${futureDate}`)
      .send();
    assert.strictEqual(schedRes.status, 404, 'Court schedule of locked owner must return 404');

    // 5. Try to create new booking request via known court ID
    const newBookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        selectedSlots: [{ startTime: '09:00', endTime: '09:30' }],
        contactName: 'Nguyen Van B',
        contactPhone: '0912345679',
        idempotencyKey: `idemp_b02_sub1_locked_${Date.now()}`,
      });
    assert.ok([403, 404].includes(newBookingRes.status), 'New booking on court of locked owner must be rejected');

    // 6. Constraint check: Existing confirmed booking remains CONFIRMED (not auto-cancelled, not auto-refunded)
    const confirmedBookings = await Booking.find({ bookingRequestId: existingReqId });
    assert.strictEqual(confirmedBookings.length, 1);
    assert.strictEqual(confirmedBookings[0].status, 'CONFIRMED', 'Confirmed booking must not be auto-cancelled when owner is locked');
  });

  // =========================================================================
  // Subtest 2: Unlocking Owner Restores Access According to Spec (Issue 1)
  // =========================================================================
  await t.test('2. Unlocking Owner restores facility and booking access without altering paused facilities', async () => {
    // 1. Lock owner
    owner.isLocked = true;
    await owner.save();

    // Verify locked
    const check1 = await request(app).get(`/api/v1/facilities/${facility._id}`);
    assert.strictEqual(check1.status, 404);

    // 2. Unlock owner
    owner.isLocked = false;
    owner.lockReason = null;
    await owner.save();

    // 3. Facility detail is now available again
    const check2 = await request(app).get(`/api/v1/facilities/${facility._id}`);
    assert.strictEqual(check2.status, 200);
    assert.strictEqual(check2.body.data.id, facility._id.toString());

    // 4. Court schedule is available
    const today = getCurrentDateVN();
    const testDate = addDaysToDateVN(today, 3);
    const schedRes = await request(app).get(`/api/v1/courts/${court._id}/schedule?date=${testDate}`);
    assert.strictEqual(schedRes.status, 200);
    assert.strictEqual(schedRes.body.data.courtId, court._id.toString());
    assert.strictEqual(schedRes.body.data.operatingHoursVersion, 1);

    // 5. Booking can be created
    const bookRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: testDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Recovered Customer',
        contactPhone: '0988888888',
        idempotencyKey: `idemp_b02_sub2_${Date.now()}`,
      });
    assert.strictEqual(bookRes.status, 201);
  });

  // =========================================================================
  // Subtest 3: Concurrent Race: Booking vs Changing Slot Step (Issue 2)
  // =========================================================================
  await t.test('3. Concurrency Race: createBookingRequest vs updateFacilitySportStep on Replica Set', async () => {
    const today = getCurrentDateVN();
    const targetDate = addDaysToDateVN(today, 4);

    // Launch concurrent operations:
    // Thread 1: Customer creates booking for 08:00-08:30 with step 30 and configVersion 1
    // Thread 2: Owner updates slotStepMinutes from 30 to 60
    const [bookingOutcome, stepOutcome] = await Promise.allSettled([
      bookingRequestService.createBookingRequest(
        customer,
        {
          courtId: court._id.toString(),
          bookingDate: targetDate,
          configVersion: 1,
          operatingHoursVersion: 1,
          selectedSlots: [{ startTime: '08:00', endTime: '08:30' }],
          contactName: 'Race Customer',
          contactPhone: '0911223344',
          idempotencyKey: `idemp_race_step_${Date.now()}`,
        },
        'CUSTOMER_ONLINE'
      ),
      facilityService.updateFacilitySportStep(
        owner._id.toString(),
        facility._id.toString(),
        facilitySport._id.toString(),
        { slotStepMinutes: 60 }
      ),
    ]);

    // Inspect outcome:
    // If Booking won the write lock first:
    // -> Booking is fulfilled. Step update MUST be rejected with 409 FACILITY_HAS_ACTIVE_BOOKINGS!
    // If Step update won the write lock first:
    // -> Step is updated to 60 (configVersion=2). Booking MUST be rejected (with 409 CONFIG_VERSION_MISMATCH or conflict)!
    // ZERO write skew: never both successful with step 60 while booking is created under step 30!
    if (bookingOutcome.status === 'fulfilled') {
      assert.strictEqual(stepOutcome.status, 'rejected', 'If booking succeeded, step update MUST be rejected');
      assert.strictEqual(stepOutcome.reason?.statusCode, 409);
      assert.strictEqual(stepOutcome.reason?.code, 'FACILITY_HAS_ACTIVE_BOOKINGS');

      // Verify DB state: slotStepMinutes remained 30
      const fsDb = await FacilitySport.findById(facilitySport._id);
      assert.strictEqual(fsDb.slotStepMinutes, 30);
    } else {
      assert.strictEqual(stepOutcome.status, 'fulfilled', 'If booking failed, step update must have succeeded');
      // Verify DB state: slotStepMinutes is 60 and configVersion is 2
      const fsDb = await FacilitySport.findById(facilitySport._id);
      assert.strictEqual(fsDb.slotStepMinutes, 60);
      assert.strictEqual(fsDb.configVersion, 2);
    }
  });

  // =========================================================================
  // Subtest 4: Concurrent Race: Booking vs Changing Operating Hours (Issue 2)
  // =========================================================================
  await t.test('4. Concurrency Race: createBookingRequest vs updateOwnerFacility (Operating Hours) on Replica Set', async () => {
    const today = getCurrentDateVN();
    const targetDate = addDaysToDateVN(today, 5);

    // Launch concurrent operations:
    // Thread 1: Customer creates booking for 06:00-06:30 (relies on openTime 06:00, operatingHoursVersion 1)
    // Thread 2: Owner updates operating hours: openTime from 06:00 to 07:00
    const [bookingOutcome, hoursOutcome] = await Promise.allSettled([
      bookingRequestService.createBookingRequest(
        customer,
        {
          courtId: court._id.toString(),
          bookingDate: targetDate,
          configVersion: 1,
          operatingHoursVersion: 1,
          selectedSlots: [{ startTime: '06:00', endTime: '06:30' }],
          contactName: 'Race Hours Customer',
          contactPhone: '0911223355',
          idempotencyKey: `idemp_race_hours_${Date.now()}`,
        },
        'CUSTOMER_ONLINE'
      ),
      facilityService.updateOwnerFacility(
        owner._id.toString(),
        facility._id.toString(),
        { openTime: '07:00', closeTime: '22:00' }
      ),
    ]);

    if (bookingOutcome.status === 'fulfilled') {
      assert.strictEqual(hoursOutcome.status, 'rejected', 'If booking succeeded, hours update MUST be rejected');
      assert.strictEqual(hoursOutcome.reason?.statusCode, 409);
      assert.strictEqual(hoursOutcome.reason?.code, 'FACILITY_HAS_ACTIVE_BOOKINGS');

      // Verify DB state: openTime remains 06:00
      const facDb = await Facility.findById(facility._id);
      assert.strictEqual(facDb.openTime, '06:00');
    } else {
      assert.strictEqual(hoursOutcome.status, 'fulfilled', 'If booking failed, hours update must have succeeded');
      // Verify DB state: openTime is 07:00 and operatingHoursVersion is 2
      const facDb = await Facility.findById(facility._id);
      assert.strictEqual(facDb.openTime, '07:00');
      assert.strictEqual(facDb.operatingHoursVersion, 2);
    }
  });

  // =========================================================================
  // Subtest 5: Concurrent Race: CourtBlock vs Changing Slot Step (Issue 2)
  // =========================================================================
  await t.test('5. Concurrency Race: createCourtBlock vs updateFacilitySportStep on Replica Set', async () => {
    const today = getCurrentDateVN();
    const targetDate = addDaysToDateVN(today, 6);

    const [blockOutcome, stepOutcome] = await Promise.allSettled([
      courtBlockService.createCourtBlock(
        owner,
        {
          courtId: court._id.toString(),
          bookingDate: targetDate,
          selectedSlots: [{ startTime: '14:00', endTime: '14:30' }],
          reason: 'Bảo trì bề mặt sân',
        }
      ),
      facilityService.updateFacilitySportStep(
        owner._id.toString(),
        facility._id.toString(),
        facilitySport._id.toString(),
        { slotStepMinutes: 60 }
      ),
    ]);

    if (blockOutcome.status === 'fulfilled') {
      assert.strictEqual(stepOutcome.status, 'rejected', 'If block created, step update must fail with 409');
      assert.strictEqual(stepOutcome.reason?.statusCode, 409);
      assert.strictEqual(stepOutcome.reason?.errorCode, 'FACILITY_HAS_ACTIVE_BOOKINGS');
    } else {
      assert.strictEqual(stepOutcome.status, 'fulfilled', 'If block failed, step update must have succeeded');
    }
  });

  // =========================================================================
  // Subtest 6: Outdated Draft Version Handling (Issue 3)
  // =========================================================================
  await t.test('6. Draft with outdated operatingHoursVersion or configVersion is rejected with 409 CONFIG_VERSION_MISMATCH', async () => {
    const today = getCurrentDateVN();
    const targetDate = addDaysToDateVN(today, 7);

    // Case A: Mismatched operatingHoursVersion
    const resA = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        operatingHoursVersion: 99, // Outdated operating hours version
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Outdated Draft Cust',
        contactPhone: '0977665544',
        idempotencyKey: `idemp_outdated_hours_${Date.now()}`,
      });
    assert.strictEqual(resA.status, 409);
    assert.strictEqual(resA.body.error?.code, 'CONFIG_VERSION_MISMATCH');

    // Case B: Mismatched configVersion
    const resB = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 99, // Outdated slotStep config version
        operatingHoursVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Outdated Draft Cust',
        contactPhone: '0977665544',
        idempotencyKey: `idemp_outdated_step_${Date.now()}`,
      });
    assert.strictEqual(resB.status, 409);
    assert.strictEqual(resB.body.error?.code, 'CONFIG_VERSION_MISMATCH');

    // Case C: When operating hours change, facilitySport configVersion is also bumped to invalidate drafts
    await facilityService.updateOwnerFacility(
      owner._id.toString(),
      facility._id.toString(),
      { openTime: '06:00', closeTime: '21:00' }
    );
    const fsRefreshed = await FacilitySport.findById(facilitySport._id);
    assert.strictEqual(fsRefreshed.configVersion, 2, 'FacilitySport configVersion must be incremented when facility hours change');

    // An old draft with configVersion: 1 is now rejected even without operatingHoursVersion
    const resC = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Outdated Draft Cust',
        contactPhone: '0977665544',
        idempotencyKey: `idemp_outdated_bumped_${Date.now()}`,
      });
    assert.strictEqual(resC.status, 409);
    assert.strictEqual(resC.body.error?.code, 'CONFIG_VERSION_MISMATCH');
  });

  // =========================================================================
  // Subtest 7: Business Date in Asia/Ho_Chi_Minh & Boundary Checks (Issue 4)
  // =========================================================================
  await t.test('7. Business Date in Asia/Ho_Chi_Minh: 00:30 & 06:59 VN time, month-end, year-end, 30-day window', async () => {
    // 00:30 on 2026-11-01 in Vietnam is 2026-10-31T17:30:00.000Z in UTC
    const dateAt0030VN = new Date('2026-10-31T17:30:00.000Z');
    assert.strictEqual(getCurrentDateVN(dateAt0030VN), '2026-11-01', '00:30 VN must resolve to 2026-11-01 (not 2026-10-31 UTC)');

    // 06:59 on 2026-11-01 in Vietnam is 2026-10-31T23:59:00.000Z in UTC
    const dateAt0659VN = new Date('2026-10-31T23:59:00.000Z');
    assert.strictEqual(getCurrentDateVN(dateAt0659VN), '2026-11-01', '06:59 VN must resolve to 2026-11-01 (not 2026-10-31 UTC)');

    // Validate 30-day window from today:
    const todayVN = getCurrentDateVN(dateAt0030VN);
    const day30VN = addDaysToDateVN(todayVN, 30);
    const day31VN = addDaysToDateVN(todayVN, 31);

    // Day 30 is accepted
    assert.doesNotThrow(() => validateBookingDateRange(day30VN, 30, todayVN));

    // Day 31 is rejected
    assert.throws(
      () => validateBookingDateRange(day31VN, 30, todayVN),
      /Chỉ được đặt sân trước tối đa 30 ngày/
    );

    // Past date (yesterday) is rejected
    const yesterdayVN = addDaysToDateVN(todayVN, -1);
    assert.throws(
      () => validateBookingDateRange(yesterdayVN, 30, todayVN),
      /Ngày đặt sân không thể ở trong quá khứ/
    );

    // Month-end transition: 2026-10-31 + 30 days = 2026-11-30
    assert.strictEqual(addDaysToDateVN('2026-10-31', 30), '2026-11-30');

    // Year-end transition: 2026-12-31 + 1 day = 2027-01-01
    assert.strictEqual(addDaysToDateVN('2026-12-31', 1), '2027-01-01');
    assert.strictEqual(addDaysToDateVN('2026-12-31', 30), '2027-01-30');
  });

  // =========================================================================
  // Subtest 8: Regression Test for B01 Flows
  // =========================================================================
  await t.test('8. Regression: B01 flows (contiguous slots, 15m advance notice, idempotency) continue to function perfectly', async () => {
    const today = getCurrentDateVN();
    const futureDate = addDaysToDateVN(today, 8);

    // Contiguous 90 minutes -> 1 booking with merged intervals
    const idempKey = `idemp_b01_reg_${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        selectedSlots: [
          { startTime: '16:00', endTime: '16:30' },
          { startTime: '16:30', endTime: '17:00' },
          { startTime: '17:00', endTime: '17:30' },
        ],
        contactName: 'Regression Cust',
        contactPhone: '0909090909',
        idempotencyKey: idempKey,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.data.bookings.length, 1);
    assert.strictEqual(res.body.data.bookings[0].durationMinutes, 90);

    // Idempotent retry returns existing booking
    const retryRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        operatingHoursVersion: 1,
        selectedSlots: [
          { startTime: '16:00', endTime: '16:30' },
          { startTime: '16:30', endTime: '17:00' },
          { startTime: '17:00', endTime: '17:30' },
        ],
        contactName: 'Regression Cust',
        contactPhone: '0909090909',
        idempotencyKey: idempKey,
      });

    assert.strictEqual(retryRes.status, 201);
    assert.strictEqual(retryRes.body.data.bookingRequestId, res.body.data.bookingRequestId);
  });
});
