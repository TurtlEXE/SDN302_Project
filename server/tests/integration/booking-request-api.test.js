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
import { AuthSession } from '../../src/models/auth-session.model.js';
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { PaymentOrder } from '../../src/models/payment-order.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Booking Request API - Customer & Owner On-Behalf (Integration)', async (t) => {
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
    await User.deleteMany({ email: { $regex: /p09-api-/ } });
    await AuthSession.deleteMany({});
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let verifiedCustomer = null;
  let unverifiedCustomer = null;
  let otherCustomer = null;
  let owner = null;
  let otherOwner = null;

  let customerToken = null;
  let unverifiedCustomerToken = null;
  let otherCustomerToken = null;
  let ownerToken = null;
  let otherOwnerToken = null;

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
    await User.deleteMany({ email: { $regex: /p09-api-/ } });
    await AuthSession.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    // 1. Verified Customer
    verifiedCustomer = await User.create({
      email: `customer-p09-api-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Đã Xác Thực',
      phoneNumber: '0901000001',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s1 = await AuthSession.create({
      userId: verifiedCustomer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(verifiedCustomer, s1).accessToken;

    // 2. Unverified Customer
    unverifiedCustomer = await User.create({
      email: `unverified-p09-api-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Chưa Xác Thực',
      phoneNumber: '0901000002',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: null,
    });
    const s2 = await AuthSession.create({
      userId: unverifiedCustomer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    unverifiedCustomerToken = jwtService.signAccessToken(unverifiedCustomer, s2).accessToken;

    // 3. Other Customer
    otherCustomer = await User.create({
      email: `other-customer-p09-api-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Khác',
      phoneNumber: '0901000003',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s3 = await AuthSession.create({
      userId: otherCustomer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    otherCustomerToken = jwtService.signAccessToken(otherCustomer, s3).accessToken;

    // 4. Owner
    owner = await User.create({
      email: `owner-p09-api-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 1',
      phoneNumber: '0902000001',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const s4 = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, s4).accessToken;

    // 5. Other Owner
    otherOwner = await User.create({
      email: `other-owner-p09-api-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 2',
      phoneNumber: '0902000002',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const s5 = await AuthSession.create({
      userId: otherOwner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    otherOwnerToken = jwtService.signAccessToken(otherOwner, s5).accessToken;

    // Sport, Facility, Court setup
    sport = await Sport.create({
      name: `Cầu Lông P09 ${Date.now()}`,
      normalizedName: `CAU LONG P09 ${Date.now()}`,
      description: 'Môn cầu lông',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'CLB Cầu Lông Tân Bình',
      description: 'Cơ sở hiện đại',
      address: '789 Đường Lê Văn Sỹ',
      province: 'TP. Hồ Chí Minh',
      phoneNumber: '0902000001',
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
      name: 'Sân Số 1',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });
  });

  await t.test('1. Customer creates booking request: merges contiguous slots into 1 Booking (Criteria 6, 26, 46)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 2);

    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '06:00', endTime: '06:30' },
          { startTime: '06:30', endTime: '07:00' },
        ],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'key-test-01',
      })
      .expect(201);

    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.ok(data.bookingRequestId);
    assert.match(data.requestNumber, /^BR/);
    assert.equal(data.totalAmountVnd, 120000); // 60 min at 120,000 VND/h
    assert.equal(data.bookings.length, 1); // Contiguous slots merged into 1 Booking

    const booking = data.bookings[0];
    assert.equal(booking.startTime, '06:00');
    assert.equal(booking.endTime, '07:00');
    assert.equal(booking.durationMinutes, 60);
    assert.equal(booking.totalPriceVnd, 120000);

    // Verify PaymentOrder created with 100% total amount
    assert.ok(data.paymentOrder);
    assert.equal(data.paymentOrder.amountVnd, 120000);
    assert.match(data.paymentOrder.vnpayTxnRef, /^PO/);

    // Verify 10-minute hold
    const holdDate = new Date(data.holdExpiresAt);
    const diffMinutes = Math.round((holdDate.getTime() - Date.now()) / (60 * 1000));
    assert.ok(diffMinutes >= 9 && diffMinutes <= 11);

    // Verify DB records
    const dbReq = await BookingRequest.findById(data.bookingRequestId);
    assert.equal(dbReq.source, 'CUSTOMER_ONLINE');
    assert.equal(dbReq.customerId.toString(), verifiedCustomer._id.toString());

    const dbBookings = await Booking.find({ bookingRequestId: data.bookingRequestId });
    assert.equal(dbBookings.length, 1);
    assert.equal(dbBookings[0].status, 'PENDING_PAYMENT');
    assert.equal(dbBookings[0].paymentStatus, 'UNPAID');

    const dbPO = await PaymentOrder.findOne({ bookingRequestId: data.bookingRequestId });
    assert.equal(dbPO.expectedAmountVnd, 120000);
    assert.equal(dbPO.status, 'PENDING');
  });

  await t.test('2. Customer creates request with disjoint slots: 2 Bookings & 1 PaymentOrder (Criteria 27, 35)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 3);

    // Select 06:00-06:30, 06:30-07:00 (contiguous 60m) and 08:00-08:30 (disjoint 30m)
    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '06:00', endTime: '06:30' },
          { startTime: '06:30', endTime: '07:00' },
          { startTime: '08:00', endTime: '08:30' },
        ],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'key-test-02',
      })
      .expect(201);

    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.equal(data.bookings.length, 2); // 2 separate Booking records
    assert.equal(data.totalAmountVnd, 180000); // 120,000 + 60,000 = 180,000 VND

    // Single PaymentOrder for 180,000 VND
    assert.equal(data.paymentOrder.amountVnd, 180000);

    const booking1 = data.bookings[0];
    assert.equal(booking1.startTime, '06:00');
    assert.equal(booking1.endTime, '07:00');
    assert.equal(booking1.durationMinutes, 60);
    assert.equal(booking1.totalPriceVnd, 120000);

    const booking2 = data.bookings[1];
    assert.equal(booking2.startTime, '08:00');
    assert.equal(booking2.endTime, '08:30');
    assert.equal(booking2.durationMinutes, 30);
    assert.equal(booking2.totalPriceVnd, 60000);
  });

  await t.test('3. Idempotent retry returns existing booking without duplicating (Criterion 10)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 4);

    const payload = {
      courtId: court._id.toString(),
      bookingDate,
      configVersion: 1,
      selectedSlots: [{ startTime: '09:00', endTime: '09:30' }],
      contactName: 'Nguyễn Văn A',
      contactPhone: '0901234567',
      idempotencyKey: 'idempotent-key-01',
    };

    // First request
    const res1 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload)
      .expect(201);

    // Second request with SAME idempotencyKey and SAME payload
    const res2 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(payload)
      .expect(201);

    // Must return the exact same bookingRequestId and requestNumber
    assert.equal(res1.body.data.bookingRequestId, res2.body.data.bookingRequestId);
    assert.equal(res1.body.data.requestNumber, res2.body.data.requestNumber);

    // Verify DB count: only 1 BookingRequest was created
    const countReq = await BookingRequest.countDocuments({ idempotencyKey: 'idempotent-key-01' });
    assert.equal(countReq, 1);
  });

  await t.test('4. Idempotency collision with different payload is rejected (Criterion 10)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 4);

    // First request with 09:00-09:30
    await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '09:00', endTime: '09:30' }],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'idempotent-collision-key',
      })
      .expect(201);

    // Second request with SAME idempotencyKey but DIFFERENT slot
    const resConflict = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'idempotent-collision-key',
      })
      .expect(400);

    assert.equal(resConflict.body.success, false);
    assert.equal(resConflict.body.error.code, 'VALIDATION_ERROR');
    assert.match(resConflict.body.error.message, /đã được dùng cho một yêu cầu có nội dung khác/);
  });

  await t.test('5. Rejects booking with 409 when configVersion mismatches (Criteria 33, 34)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 5);

    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 99, // Mismatched config version
        selectedSlots: [{ startTime: '06:00', endTime: '06:30' }],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'key-mismatch-version',
      })
      .expect(409);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'CONFIG_VERSION_MISMATCH');
  });

  await t.test('6. Unverified customer is forbidden from booking (Criterion 36)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 5);

    const res = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${unverifiedCustomerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '06:00', endTime: '06:30' }],
        contactName: 'Khách Chưa Xác Thực',
        contactPhone: '0901000002',
        idempotencyKey: 'key-unverified',
      })
      .expect(403);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'ACCOUNT_NOT_VERIFIED');
  });

  await t.test('7. Owner creates on-behalf booking request (Criterion 16, OWN-08)', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 2);

    const res = await request(app)
      .post('/api/v1/owner/bookings/on-behalf')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '15:00', endTime: '15:30' },
          { startTime: '15:30', endTime: '16:00' },
          { startTime: '16:00', endTime: '16:30' },
        ],
        customerName: 'Khách Gọi Điện',
        customerPhone: '0912345678',
        idempotencyKey: 'owner-on-behalf-01',
      })
      .expect(201);

    assert.equal(res.body.success, true);
    const data = res.body.data;
    assert.ok(data.bookingRequestId);
    assert.ok(data.guestAccessLink);
    assert.match(data.guestAccessLink, /^\/guest-pay\//);

    // Verify DB record
    const dbReq = await BookingRequest.findById(data.bookingRequestId);
    assert.equal(dbReq.source, 'OWNER_ON_BEHALF');
    assert.equal(dbReq.customerId, null); // No customer account attached
    assert.equal(dbReq.contactName, 'Khách Gọi Điện');
    assert.ok(dbReq.guestAccessCodeHash);
  });

  await t.test('8. Owner cannot create on-behalf booking on another owner facility', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 2);

    const res = await request(app)
      .post('/api/v1/owner/bookings/on-behalf')
      .set('Authorization', `Bearer ${otherOwnerToken}`) // Other owner
      .send({
        courtId: court._id.toString(), // belongs to owner 1
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '17:00', endTime: '17:30' }],
        customerName: 'Khách Gọi Điện',
        customerPhone: '0912345678',
        idempotencyKey: 'owner-wrong-facility',
      })
      .expect(403);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  await t.test('9. Customer views details of their booking request', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 2);

    // Create booking request first
    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '19:00', endTime: '19:30' },
          { startTime: '19:30', endTime: '20:00' },
        ],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'key-view-detail',
      })
      .expect(201);

    const reqId = createRes.body.data.bookingRequestId;

    // View detail
    const res = await request(app)
      .get(`/api/v1/booking-requests/${reqId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, reqId);
    assert.equal(res.body.data.bookings.length, 1);
    assert.equal(res.body.data.bookings[0].startTime, '19:00');
    assert.equal(res.body.data.bookings[0].endTime, '20:00');
  });

  await t.test('10. Customer cannot view detail of another customer booking request', async () => {
    const todayStr = getCurrentDateVN();
    const bookingDate = addDaysToDateVN(todayStr, 2);

    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '20:00', endTime: '20:30' }],
        contactName: 'Nguyễn Văn A',
        contactPhone: '0901234567',
        idempotencyKey: 'key-cross-customer',
      })
      .expect(201);

    const reqId = createRes.body.data.bookingRequestId;

    // Other customer attempts to view
    const res = await request(app)
      .get(`/api/v1/booking-requests/${reqId}`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .expect(403);

    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});
