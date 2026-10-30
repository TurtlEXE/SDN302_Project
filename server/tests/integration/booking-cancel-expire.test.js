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
import { ActionLog } from '../../src/models/action-log.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { bookingCleanupService } from '../../src/services/booking/booking-cleanup.service.js';

test('Booking Cancellation & Expiry Lifecycle (Integration - P10)', async (t) => {
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
    await User.deleteMany({ email: { $regex: /p10-cancel-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let customer = null;
  let otherCustomer = null;
  let owner = null;
  let otherOwner = null;

  let customerToken = null;
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
    await User.deleteMany({ email: { $regex: /p10-cancel-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    customer = await User.create({
      email: `customer-p10-cancel-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P10',
      phoneNumber: '0901000010',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s1 = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, s1).accessToken;

    otherCustomer = await User.create({
      email: `other-p10-cancel-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng Khác P10',
      phoneNumber: '0901000011',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s2 = await AuthSession.create({
      userId: otherCustomer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    otherCustomerToken = jwtService.signAccessToken(otherCustomer, s2).accessToken;

    owner = await User.create({
      email: `owner-p10-cancel-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P10',
      phoneNumber: '0901000012',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
      emailVerifiedAt: now,
    });
    const s3 = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, s3).accessToken;

    otherOwner = await User.create({
      email: `other-owner-p10-cancel-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Khác P10',
      phoneNumber: '0901000013',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
      emailVerifiedAt: now,
    });
    const s4 = await AuthSession.create({
      userId: otherOwner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    otherOwnerToken = jwtService.signAccessToken(otherOwner, s4).accessToken;

    sport = await Sport.create({
      name: `Cầu Lông P10 ${Date.now()}`,
      normalizedName: `cau long p10 ${Date.now()}`,
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'CLB Cầu Lông Ba Sao P10',
      address: '456 Đường Nguyễn Trãi',
      province: 'Hà Nội',
      phoneNumber: '0908888888',
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
      facilityId: facility._id,
      facilitySportId: facilitySport._id,
      sportId: sport._id,
      name: 'Sân Số 1',
      pricePerHourVnd: 100000,
      isActive: true,
    });
  });

  const getTargetDate = () => addDaysToDateVN(getCurrentDateVN(), 2);

  await t.test('1. Customer cancels pending booking request, closes paymentOrder and releases slots (Criteria 12, 13)', async () => {
    const bookingDate = getTargetDate();

    // 1. Customer creates booking request
    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '08:00', endTime: '08:30' },
          { startTime: '08:30', endTime: '09:00' },
        ],
        contactName: 'Khách Hàng P10',
        contactPhone: '0901000010',
        idempotencyKey: 'cancel-test-key-1',
      });

    assert.equal(createRes.status, 201);
    const reqId = createRes.body.data.bookingRequestId;

    // 2. Verify schedule shows HOLD
    const schedBefore = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${bookingDate}`);
    assert.equal(schedBefore.status, 200);
    const slot0800Before = schedBefore.body.data.slots.find((s) => s.startTime === '08:00');
    assert.equal(slot0800Before.status, 'HOLD');

    // 3. Customer cancels request
    const cancelRes = await request(app)
      .post(`/api/v1/booking-requests/${reqId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Bận việc đột xuất' });

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.success, true);
    assert.equal(cancelRes.body.message, 'Đã hủy yêu cầu đặt và giải phóng lịch.');

    // 4. Verify DB state: Bookings CANCELLED, PaymentOrder CLOSED
    const childBookings = await Booking.find({ bookingRequestId: reqId });
    assert.equal(childBookings.length, 1);
    assert.equal(childBookings[0].status, 'CANCELLED');
    assert.equal(childBookings[0].cancellation.reason, 'Bận việc đột xuất');
    assert.equal(childBookings[0].cancellation.cancelledBy.toString(), customer._id.toString());

    const paymentOrder = await PaymentOrder.findOne({ bookingRequestId: reqId });
    assert.equal(paymentOrder.status, 'CLOSED');
    assert.equal(paymentOrder.closedReason, 'CUSTOMER_CANCELLED');

    // 5. Verify ActionLog recorded
    const log = await ActionLog.findOne({
      action: 'CANCEL_BOOKING_REQUEST',
      targetId: childBookings[0]._id,
    });
    assert.ok(log);
    assert.equal(log.actorRole, 'CUSTOMER');
    assert.equal(log.reason, 'Bận việc đột xuất');

    // 6. Verify schedule is now AVAILABLE
    const schedAfter = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${bookingDate}`);
    assert.equal(schedAfter.status, 200);
    const slot0800After = schedAfter.body.data.slots.find((s) => s.startTime === '08:00');
    assert.equal(slot0800After.status, 'AVAILABLE');
  });

  await t.test('2. Customer CANNOT cancel CONFIRMED / PAID booking (Criterion 12)', async () => {
    const bookingDate = getTargetDate();

    // Create booking request
    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Khách Hàng P10',
        contactPhone: '0901000010',
        idempotencyKey: 'cancel-paid-test-key-2',
      });

    assert.equal(createRes.status, 201);
    const reqId = createRes.body.data.bookingRequestId;

    // Simulate payment completion
    await Booking.updateMany({ bookingRequestId: reqId }, { status: 'CONFIRMED', paymentStatus: 'PAID' });
    await PaymentOrder.updateOne({ bookingRequestId: reqId }, { status: 'PAID' });

    // Customer attempts to cancel
    const cancelRes = await request(app)
      .post(`/api/v1/booking-requests/${reqId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Muốn hủy sau khi đã thanh toán' });

    assert.equal(cancelRes.status, 400);
    assert.ok(cancelRes.body.error.message.includes('Đơn đã thanh toán'));
  });

  await t.test('3. Cross-customer isolation: Customer A cannot cancel Customer B request (Criterion 5)', async () => {
    const bookingDate = getTargetDate();

    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '14:00', endTime: '14:30' }],
        contactName: 'Khách Hàng P10',
        contactPhone: '0901000010',
        idempotencyKey: 'cancel-cross-test-key-3',
      });

    const reqId = createRes.body.data.bookingRequestId;

    // otherCustomer attempts to cancel
    const cancelRes = await request(app)
      .post(`/api/v1/booking-requests/${reqId}/cancel`)
      .set('Authorization', `Bearer ${otherCustomerToken}`)
      .send({ reason: 'Hủy phá hoại' });

    assert.equal(cancelRes.status, 403);
    assert.ok(cancelRes.body.error.message.includes('không có quyền'));
  });

  await t.test('4. Owner cancels pending request on their facility (OWN-07)', async () => {
    const bookingDate = getTargetDate();

    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '15:00', endTime: '15:30' }],
        contactName: 'Khách Hàng P10',
        contactPhone: '0901000010',
        idempotencyKey: 'cancel-owner-test-key-4',
      });

    const reqId = createRes.body.data.bookingRequestId;

    // Owner cancels
    const cancelRes = await request(app)
      .post(`/api/v1/owner/booking-requests/${reqId}/cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Sân cần sửa chữa đột xuất' });

    assert.equal(cancelRes.status, 200);

    const paymentOrder = await PaymentOrder.findOne({ bookingRequestId: reqId });
    assert.equal(paymentOrder.status, 'CLOSED');
    assert.equal(paymentOrder.closedReason, 'OWNER_CANCELLED');

    const booking = await Booking.findOne({ bookingRequestId: reqId });
    assert.equal(booking.status, 'CANCELLED');
    assert.equal(booking.cancellation.reason, 'Sân cần sửa chữa đột xuất');
  });

  await t.test('5. Hold Expiration & Background Cleanup (Criteria 49, 51)', async () => {
    const bookingDate = getTargetDate();

    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '16:00', endTime: '16:30' }],
        contactName: 'Khách Hàng P10',
        contactPhone: '0901000010',
        idempotencyKey: 'cancel-expire-test-key-5',
      });

    const reqId = createRes.body.data.bookingRequestId;

    // Manually expire hold (10 minutes ago)
    const expiredTime = new Date(Date.now() - 10000);
    await Booking.updateMany({ bookingRequestId: reqId }, { holdExpiresAt: expiredTime });
    await BookingRequest.updateOne({ _id: reqId }, { holdExpiresAt: expiredTime });

    // Schedule query immediately treats expired hold as AVAILABLE (Criterion 51)
    const schedRes = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${bookingDate}`);
    const slot1600 = schedRes.body.data.slots.find((s) => s.startTime === '16:00');
    assert.equal(slot1600.status, 'AVAILABLE');

    // Run background cleanup task
    const cleanupResult = await bookingCleanupService.cleanupExpiredHolds(new Date());
    assert.ok(cleanupResult.expiredBookingsCount >= 1);

    // Verify DB updated to EXPIRED and PaymentOrder CLOSED
    const b = await Booking.findOne({ bookingRequestId: reqId });
    assert.equal(b.status, 'EXPIRED');

    const po = await PaymentOrder.findOne({ bookingRequestId: reqId });
    assert.equal(po.status, 'CLOSED');
    assert.equal(po.closedReason, 'EXPIRED');

    // Verify PAID/CONFIRMED booking is NEVER expired (Criterion 49)
    const paidBooking = await Booking.create({
      bookingCode: `BK-TEST-PAID-${Date.now()}`,
      bookingRequestId: reqId,
      customerId: customer._id,
      courtId: court._id,
      facilityId: facility._id,
      bookingDate,
      startTime: '17:00',
      endTime: '17:30',
      startMinutes: 1020,
      endMinutes: 1050,
      durationMinutes: 30,
      pricePerHourVnd: 100000,
      totalPriceVnd: 50000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: expiredTime, // Expired hold timestamp
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: sport.name,
        slotStepMinutes: 30,
      },
      statusVersion: 1,
    });

    // Run cleanup again
    await bookingCleanupService.cleanupExpiredHolds(new Date());

    const checkPaid = await Booking.findById(paidBooking._id);
    assert.equal(checkPaid.status, 'CONFIRMED');
    assert.equal(checkPaid.paymentStatus, 'PAID');
  });
});
