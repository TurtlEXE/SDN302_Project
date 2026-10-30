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
import { AuthSession } from '../../src/models/auth-session.model.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { getCurrentDateVN, getCurrentTimeVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { scheduleService } from '../../src/services/booking/schedule.service.js';

test('Logic Fix B01 - Booking & Payment Flow Real Verification', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await PaymentOrder.deleteMany({});
    await BookingRequest.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await AuthSession.deleteMany({});
    await User.deleteMany({ email: { $regex: /b01-test-/ } });
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
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await AuthSession.deleteMany({});
    await User.deleteMany({ email: { $regex: /b01-test-/ } });

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    owner = await User.create({
      email: `owner-b01-test-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân B01',
      phoneNumber: '0988111222',
      role: 'OWNER',
      isLocked: false,
      emailVerifiedAt: now,
      activatedAt: now,
    });

    customer = await User.create({
      email: `customer-b01-test-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng B01',
      phoneNumber: '0977333444',
      role: 'CUSTOMER',
      isLocked: false,
      emailVerifiedAt: now,
    });

    const ownerSession = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, ownerSession).accessToken;

    const customerSession = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, customerSession).accessToken;

    sport = await Sport.create({
      name: `Cầu Lông B01 ${Date.now()}`,
      normalizedName: `CAU LONG B01 ${Date.now()}`,
      description: 'Môn cầu lông cho test B01',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'CLB Cầu Lông Ánh Sáng B01',
      description: 'Cơ sở chuẩn',
      address: '456 Phố Cầu Lông',
      province: 'Hà Nội',
      phoneNumber: '0988111222',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    facilitySport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 2, // configVersion = 2 to ensure we test dynamic versions
    });

    court = await Court.create({
      facilityId: facility._id,
      facilitySportId: facilitySport._id,
      sportId: sport._id,
      name: 'Sân 1 B01',
      pricePerHourVnd: 120000,
      isActive: true,
    });
  });

  await t.test('1. Issue 1 & 2: Schedule -> Draft -> Checkout Flow with Single, Contiguous & Disjoint Slots', async () => {
    const todayStr = getCurrentDateVN();
    const testDate = addDaysToDateVN(todayStr, 3);

    // 1. Fetch real schedule
    const schedRes = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${testDate}`)
      .expect(200);

    const scheduleData = schedRes.body.data;
    assert.equal(scheduleData.configVersion, 2);
    assert.equal(scheduleData.slotStepMinutes, 30);

    // 2. Scenario A: Single Slot (06:00 - 06:30)
    const singlePayload = {
      courtId: court._id.toString(),
      bookingDate: testDate,
      configVersion: scheduleData.configVersion, // exact from API
      selectedSlots: [{ startTime: '06:00', endTime: '06:30' }], // raw step slot
      contactName: 'Khách Hàng B01',
      contactPhone: '0977333444',
      idempotencyKey: `idemp-single-${Date.now()}`,
    };

    const singleRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(singlePayload)
      .expect(201);

    assert.equal(singleRes.body.success, true);
    assert.equal(singleRes.body.data.bookings.length, 1);
    assert.equal(singleRes.body.data.totalAmountVnd, 60000);

    // 3. Scenario B: Multiple Contiguous Slots (07:00 - 07:30, 07:30 - 08:00, 08:00 - 08:30 = 90 min)
    // CheckoutPage sends raw slots matching slotStepMinutes; backend merges them into 1 Booking
    const contiguousPayload = {
      courtId: court._id.toString(),
      bookingDate: testDate,
      configVersion: scheduleData.configVersion,
      selectedSlots: [
        { startTime: '07:00', endTime: '07:30' },
        { startTime: '07:30', endTime: '08:00' },
        { startTime: '08:00', endTime: '08:30' },
      ],
      contactName: 'Khách Hàng B01',
      contactPhone: '0977333444',
      idempotencyKey: `idemp-contiguous-${Date.now()}`,
    };

    const contigRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(contiguousPayload)
      .expect(201);

    assert.equal(contigRes.body.success, true);
    // Merged into single Booking 07:00 - 08:30 (90 min)
    assert.equal(contigRes.body.data.bookings.length, 1);
    assert.equal(contigRes.body.data.bookings[0].startTime, '07:00');
    assert.equal(contigRes.body.data.bookings[0].endTime, '08:30');
    assert.equal(contigRes.body.data.bookings[0].durationMinutes, 90);
    assert.equal(contigRes.body.data.totalAmountVnd, 180000);

    // 4. Scenario C: Multiple Disjoint Slots (09:00 - 09:30 and 11:00 - 12:00)
    const disjointPayload = {
      courtId: court._id.toString(),
      bookingDate: testDate,
      configVersion: scheduleData.configVersion,
      selectedSlots: [
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '11:00', endTime: '11:30' },
        { startTime: '11:30', endTime: '12:00' },
      ],
      contactName: 'Khách Hàng B01',
      contactPhone: '0977333444',
      idempotencyKey: `idemp-disjoint-${Date.now()}`,
    };

    const disjointRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(disjointPayload)
      .expect(201);

    assert.equal(disjointRes.body.success, true);
    // 2 child bookings: 09:00 - 09:30 (30m) and 11:00 - 12:00 (60m)
    assert.equal(disjointRes.body.data.bookings.length, 2);
    assert.equal(disjointRes.body.data.bookings[0].startTime, '09:00');
    assert.equal(disjointRes.body.data.bookings[0].endTime, '09:30');
    assert.equal(disjointRes.body.data.bookings[1].startTime, '11:00');
    assert.equal(disjointRes.body.data.bookings[1].endTime, '12:00');
    assert.equal(disjointRes.body.data.totalAmountVnd, 180000);
  });

  await t.test('2. Issue 4 & 6: Network Drop Simulation, Page Reload & Idempotent Resume', async () => {
    const todayStr = getCurrentDateVN();
    const testDate = addDaysToDateVN(todayStr, 4);

    const stableKey = `idemp-stable-key-${Date.now()}`;
    const payload = {
      courtId: court._id.toString(),
      bookingDate: testDate,
      configVersion: 2,
      selectedSlots: [{ startTime: '14:00', endTime: '14:30' }],
      contactName: 'Khách Hàng B01',
      contactPhone: '0977333444',
      idempotencyKey: stableKey,
    };

    // Attempt 1: Server successfully processes and creates order
    const res1 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload)
      .expect(201);

    const initialOrderId = res1.body.data.bookingRequestId;
    const initialPaymentUrl = res1.body.data.paymentOrder.paymentUrl;
    const initialHoldExpiry = res1.body.data.holdExpiresAt;

    assert.ok(initialPaymentUrl);

    // Attempt 2: Client lost response, page reloads or user retries with SAME stable key
    const res2 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload)
      .expect(201);

    // Exactly same order ID returned
    assert.equal(res2.body.data.bookingRequestId, initialOrderId);
    // Verified: No duplicate BookingRequest was created in DB
    const dbCount = await BookingRequest.countDocuments({ idempotencyKey: stableKey });
    assert.equal(dbCount, 1);

    // Verified: paymentUrl is active (not empty string!)
    assert.ok(res2.body.data.paymentOrder.paymentUrl);
    assert.match(res2.body.data.paymentOrder.paymentUrl, /vnpay/);

    // Verified: Hold was NOT extended (holdExpiresAt is unchanged)
    assert.equal(res2.body.data.holdExpiresAt, initialHoldExpiry);
  });

  await t.test('3. Issue 3, 4 & 5: Owner On-Behalf Flow, Idempotency & GuestPay Details with Intervals', async () => {
    const todayStr = getCurrentDateVN();
    const testDate = addDaysToDateVN(todayStr, 2);

    // 1. Verify owner facilities & courts return 'id'
    const facRes = await request(app)
      .get('/api/v1/owner/facilities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const facilities = facRes.body.data.facilities || facRes.body.data;
    assert.ok(facilities.length > 0);
    const facId = facilities[0].id || facilities[0]._id;
    assert.ok(facId);

    const courtRes = await request(app)
      .get(`/api/v1/owner/courts?facilityId=${facId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    const courts = courtRes.body.data.courts || courtRes.body.data;
    assert.ok(courts.length > 0);
    const courtId = courts[0].id || courts[0]._id;
    assert.ok(courtId);

    // 2. Owner creates on-behalf booking for disjoint intervals
    const onBehalfKey = `idemp-owner-onbehalf-${Date.now()}`;
    const onBehalfPayload = {
      courtId: courtId.toString(),
      bookingDate: testDate,
      configVersion: 2,
      selectedSlots: [
        { startTime: '16:00', endTime: '16:30' },
        { startTime: '18:00', endTime: '18:30' },
      ],
      customerName: 'Anh Vũ Vãng Lai',
      customerPhone: '0933888999',
      idempotencyKey: onBehalfKey,
    };

    const obhRes1 = await request(app)
      .post('/api/v1/owner/bookings/on-behalf')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(onBehalfPayload)
      .expect(201);

    const link1 = obhRes1.body.data.guestAccessLink;
    assert.ok(link1);
    assert.match(link1, /\/guest-pay\/[a-f0-9]+\?code=[a-f0-9]{32}/);

    // Retry with SAME idempotencyKey
    const obhRes2 = await request(app)
      .post('/api/v1/owner/bookings/on-behalf')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(onBehalfPayload)
      .expect(201);

    const link2 = obhRes2.body.data.guestAccessLink;
    assert.equal(link1, link2); // Exactly same derived access code and payment link

    // Extract paymentOrderId & code
    const match = link2.match(/\/guest-pay\/([^?]+)\?code=(.+)/);
    assert.ok(match);
    const [, poId, accessCode] = match;

    // 3. GuestPay endpoint verification
    const guestOrderRes = await request(app)
      .get(`/api/v1/payments/guest-order/${poId}?accessCode=${accessCode}`)
      .expect(200);

    const orderData = guestOrderRes.body.data;
    assert.equal(orderData.requestNumber, obhRes1.body.data.requestNumber);
    assert.equal(orderData.contactName, 'Anh Vũ Vãng Lai');
    assert.equal(orderData.contactPhone, '0933888999');
    assert.equal(orderData.totalAmountVnd, 120000); // 2 slots of 60k
    assert.equal(orderData.status, 'PENDING');
    assert.ok(orderData.paymentUrl);

    // Verified: Disjoint intervals are returned separately (NOT a single 16:00-18:30 range!)
    assert.ok(Array.isArray(orderData.intervals));
    assert.equal(orderData.intervals.length, 2);
    assert.equal(orderData.intervals[0].startTime, '16:00');
    assert.equal(orderData.intervals[0].endTime, '16:30');
    assert.equal(orderData.intervals[1].startTime, '18:00');
    assert.equal(orderData.intervals[1].endTime, '18:30');
  });

  await t.test('4. Issue 6: Expired, Paid, and Cancelled Orders Cannot Be Resumed or Extended', async () => {
    const todayStr = getCurrentDateVN();
    const testDate = addDaysToDateVN(todayStr, 5);

    // Case A: Expired hold
    const expiredKey = `idemp-expired-${Date.now()}`;
    const expPayload = {
      courtId: court._id.toString(),
      bookingDate: testDate,
      configVersion: 2,
      selectedSlots: [{ startTime: '19:00', endTime: '19:30' }],
      contactName: 'Khách Hết Hạn',
      contactPhone: '0911222333',
      idempotencyKey: expiredKey,
    };

    const expRes1 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(expPayload)
      .expect(201);

    const expReqId = expRes1.body.data.bookingRequestId;

    // Manually mark expired in DB
    const pastTime = new Date(Date.now() - 5 * 60 * 1000);
    await BookingRequest.findByIdAndUpdate(expReqId, { holdExpiresAt: pastTime });
    await PaymentOrder.findOneAndUpdate({ bookingRequestId: expReqId }, { status: 'EXPIRED' });

    // Retry with SAME key
    const expRes2 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(expPayload)
      .expect(201);

    assert.equal(expRes2.body.data.status, 'EXPIRED');
    assert.equal(expRes2.body.data.isExpired, true);
    assert.equal(expRes2.body.data.paymentOrder.paymentUrl, '');

    // Case B: Cancelled order
    const cancelKey = `idemp-cancel-${Date.now()}`;
    const cancelPayload = {
      courtId: court._id.toString(),
      bookingDate: testDate,
      configVersion: 2,
      selectedSlots: [{ startTime: '20:00', endTime: '20:30' }],
      contactName: 'Khách Đã Hủy',
      contactPhone: '0911222333',
      idempotencyKey: cancelKey,
    };

    const cancelRes1 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(cancelPayload)
      .expect(201);

    const cancelReqId = cancelRes1.body.data.bookingRequestId;
    await BookingRequest.findByIdAndUpdate(cancelReqId, { status: 'CANCELLED' });
    await PaymentOrder.findOneAndUpdate({ bookingRequestId: cancelReqId }, { status: 'CANCELLED' });

    const cancelRes2 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(cancelPayload)
      .expect(201);

    assert.equal(cancelRes2.body.data.status, 'CANCELLED');
    assert.equal(cancelRes2.body.data.isCancelled, true);
    assert.equal(cancelRes2.body.data.paymentOrder.paymentUrl, '');
  });

  await t.test('5. Issue 7: 15-Minute Advance Notice Synchronized between Schedule and Booking API', async () => {
    const todayStr = '2026-11-02';
    // Fix current time at 07:48 (468 minutes)
    // Slot 08:00 - 08:30 starts at 480 minutes (12 minutes ahead -> < 15 min!)
    // Slot 08:30 - 09:00 starts at 510 minutes (42 minutes ahead -> >= 15 min!)
    const customOverrides = {
      customTodayStr: todayStr,
      customNowTimeStr: '07:48',
      customNowDate: new Date('2026-11-02T07:48:00+07:00'),
    };

    // 1. Customer Schedule: Slot starting in 12 minutes must be marked PAST
    const custSched = await scheduleService.getCourtSchedule(court._id.toString(), todayStr, {
      ...customOverrides,
      role: 'CUSTOMER',
    });

    const custSlotMap = new Map(custSched.slots.map((s) => [`${s.startTime}-${s.endTime}`, s.status]));
    assert.equal(custSlotMap.get('08:00-08:30'), 'PAST'); // 12 min < 15 min -> PAST
    assert.equal(custSlotMap.get('08:30-09:00'), 'AVAILABLE'); // 42 min >= 15 min -> AVAILABLE

    // 2. Owner Schedule: Slot starting in 12 minutes is in future (> 07:48), so must be AVAILABLE
    const ownerSched = await scheduleService.getCourtSchedule(court._id.toString(), todayStr, {
      ...customOverrides,
      role: 'OWNER',
    });

    const ownerSlotMap = new Map(ownerSched.slots.map((s) => [`${s.startTime}-${s.endTime}`, s.status]));
    assert.equal(ownerSlotMap.get('08:00-08:30'), 'AVAILABLE'); // Owner can book!
    assert.equal(ownerSlotMap.get('08:30-09:00'), 'AVAILABLE');

    // 3. Customer Booking Policy directly rejects slot < 15 min (validateAdvanceNotice)
    const { validateAdvanceNotice } = await import(
      '../../src/services/booking/booking-policy.js'
    );

    // Customer: requires 15 min advance notice. At 07:48, slot 08:00 is only 12 min away -> throws Error
    assert.throws(
      () => {
        validateAdvanceNotice(todayStr, '08:00', 15, todayStr, '07:48');
      },
      (err) => {
        assert.ok(err.message.includes('15') || err.errorCode === 'VALIDATION_ERROR');
        return true;
      }
    );

    // Owner: requires 0 min advance notice. At 07:48, slot 08:00 is valid upcoming slot -> succeeds
    const ownerAllowed = validateAdvanceNotice(todayStr, '08:00', 0, todayStr, '07:48');
    assert.equal(ownerAllowed, true);

    // Slot 08:30 (42 min away) is valid for both Customer and Owner
    const custAllowed42 = validateAdvanceNotice(todayStr, '08:30', 15, todayStr, '07:48');
    assert.equal(custAllowed42, true);
  });
});
