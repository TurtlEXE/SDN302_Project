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

test('Booking Operations, Lifecycle & Query APIs (Integration - P10)', async (t) => {
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
    await User.deleteMany({ email: { $regex: /p10-ops-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let customerA = null;
  let customerB = null;
  let ownerA = null;
  let ownerB = null;
  let admin = null;

  let customerAToken = null;
  let customerBToken = null;
  let ownerAToken = null;
  let ownerBToken = null;
  let adminToken = null;

  let facilityA = null;
  let facilitySportA = null;
  let courtA = null;
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
    await User.deleteMany({ email: { $regex: /p10-ops-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    customerA = await User.create({
      email: `customerA-p10-ops-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng A',
      phoneNumber: '0901000031',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s1 = await AuthSession.create({
      userId: customerA._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerAToken = jwtService.signAccessToken(customerA, s1).accessToken;

    customerB = await User.create({
      email: `customerB-p10-ops-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng B',
      phoneNumber: '0901000032',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s2 = await AuthSession.create({
      userId: customerB._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerBToken = jwtService.signAccessToken(customerB, s2).accessToken;

    ownerA = await User.create({
      email: `ownerA-p10-ops-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân A',
      phoneNumber: '0901000033',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
      emailVerifiedAt: now,
    });
    const s3 = await AuthSession.create({
      userId: ownerA._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerAToken = jwtService.signAccessToken(ownerA, s3).accessToken;

    ownerB = await User.create({
      email: `ownerB-p10-ops-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân B',
      phoneNumber: '0901000034',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
      emailVerifiedAt: now,
    });
    const s4 = await AuthSession.create({
      userId: ownerB._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerBToken = jwtService.signAccessToken(ownerB, s4).accessToken;

    admin = await User.create({
      email: `admin-p10-ops-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Viên',
      phoneNumber: '0901000035',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s5 = await AuthSession.create({
      userId: admin._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    adminToken = jwtService.signAccessToken(admin, s5).accessToken;

    sport = await Sport.create({
      name: `Bóng Đá P10 ${Date.now()}`,
      normalizedName: `bong da p10 ${Date.now()}`,
      isActive: true,
    });

    facilityA = await Facility.create({
      ownerId: ownerA._id,
      name: 'Sân Bóng Đá Mini A P10',
      address: '101 Đường Cầu Giấy',
      province: 'Hà Nội',
      phoneNumber: '0906666666',
      openTime: '06:00',
      closeTime: '23:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    facilitySportA = await FacilitySport.create({
      facilityId: facilityA._id,
      sportId: sport._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });

    courtA = await Court.create({
      facilityId: facilityA._id,
      facilitySportId: facilitySportA._id,
      sportId: sport._id,
      name: 'Sân Bóng 1',
      pricePerHourVnd: 300000,
      isActive: true,
    });
  });

  const getYesterdayDate = () => addDaysToDateVN(getCurrentDateVN(), -1);
  const getTomorrowDate = () => addDaysToDateVN(getCurrentDateVN(), 1);

  await t.test('1. Complete Booking requires CONFIRMED/PAID and currentTime >= endTime (Criteria 17, 18)', async () => {
    // 1. Create a future booking request
    const futureDate = getTomorrowDate();
    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        courtId: courtA._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '08:00', endTime: '09:00' }],
        contactName: 'Khách Hàng A',
        contactPhone: '0901000031',
        idempotencyKey: 'complete-test-key-1',
      });
    assert.equal(createRes.status, 201);
    const bookingId = createRes.body.data.bookings[0].bookingId;

    // Try to complete while PENDING_PAYMENT -> 400
    const failPendingRes = await request(app)
      .post(`/api/v1/owner/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ note: 'Phục vụ xong' });
    assert.equal(failPendingRes.status, 400);
    assert.ok(failPendingRes.body.error.message.includes('chưa thanh toán'));

    // Set to CONFIRMED / PAID, but date is future (before endTime) -> 400
    await Booking.findByIdAndUpdate(bookingId, { status: 'CONFIRMED', paymentStatus: 'PAID' });

    const failTimeRes = await request(app)
      .post(`/api/v1/owner/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ note: 'Phục vụ trước giờ kết thúc' });
    assert.equal(failTimeRes.status, 400);
    assert.ok(failTimeRes.body.error.message.includes('Chưa đến giờ kết thúc'));

    // Now set bookingDate to yesterday (past endTime)
    const pastDate = getYesterdayDate();
    await Booking.findByIdAndUpdate(bookingId, { bookingDate: pastDate });

    // Owner completes booking -> 200
    const successRes = await request(app)
      .post(`/api/v1/owner/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ note: 'Khách chơi rất vui vẻ' });

    assert.equal(successRes.status, 200);
    assert.equal(successRes.body.message, 'Đã xác nhận phục vụ hoàn tất buổi chơi.');

    const updatedBooking = await Booking.findById(bookingId);
    assert.equal(updatedBooking.status, 'COMPLETED');
    assert.equal(updatedBooking.paymentStatus, 'PAID');
    assert.equal(updatedBooking.completion.note, 'Khách chơi rất vui vẻ');
    assert.equal(updatedBooking.completion.completedBy.toString(), ownerA._id.toString());

    // ActionLog recorded
    const log = await ActionLog.findOne({ action: 'COMPLETE_BOOKING', targetId: bookingId });
    assert.ok(log);
    assert.equal(log.actorRole, 'OWNER');
  });

  await t.test('2. Mark No-Show requires CONFIRMED/PAID and currentTime >= endTime (Criteria 17, 18)', async () => {
    const futureDate = getTomorrowDate();
    const createRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        courtId: courtA._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '11:00' }],
        contactName: 'Khách Hàng A',
        contactPhone: '0901000031',
        idempotencyKey: 'noshow-test-key-2',
      });
    const bookingId = createRes.body.data.bookings[0].bookingId;

    // Fail if PENDING_PAYMENT
    const failPendingRes = await request(app)
      .post(`/api/v1/owner/bookings/${bookingId}/no-show`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ note: 'Khách vắng mặt' });
    assert.equal(failPendingRes.status, 400);

    // Set to CONFIRMED / PAID, but booking is in the future
    await Booking.findByIdAndUpdate(bookingId, { status: 'CONFIRMED', paymentStatus: 'PAID' });
    const failTimeRes = await request(app)
      .post(`/api/v1/owner/bookings/${bookingId}/no-show`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ note: 'Khách vắng mặt' });
    assert.equal(failTimeRes.status, 400);
    assert.ok(failTimeRes.body.error.message.includes('Chưa đến giờ kết thúc'));

    // Set to yesterday
    await Booking.findByIdAndUpdate(bookingId, { bookingDate: getYesterdayDate() });

    // Successfully mark NO_SHOW
    const successRes = await request(app)
      .post(`/api/v1/owner/bookings/${bookingId}/no-show`)
      .set('Authorization', `Bearer ${ownerAToken}`)
      .send({ note: 'Gọi điện không nghe máy' });

    assert.equal(successRes.status, 200);
    assert.equal(successRes.body.message, 'Đã ghi nhận khách không đến. Tiền thanh toán không tự hoàn.');

    const updatedBooking = await Booking.findById(bookingId);
    assert.equal(updatedBooking.status, 'NO_SHOW');
    assert.equal(updatedBooking.paymentStatus, 'PAID'); // Payment remains PAID, no refund
    assert.equal(updatedBooking.completion.note, 'Gọi điện không nghe máy');

    const log = await ActionLog.findOne({ action: 'NO_SHOW_BOOKING', targetId: bookingId });
    assert.ok(log);
  });

  await t.test('3. Customer Bookings Listing, Filters & Privacy Isolation (CUS-02, Criterion 5)', async () => {
    const futureDate = getTomorrowDate();

    // Customer A creates booking
    const resA = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        courtId: courtA._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '12:00', endTime: '13:00' }],
        contactName: 'Khách Hàng A',
        contactPhone: '0901000031',
        idempotencyKey: 'list-cust-test-1',
      });
    const bookingIdA = resA.body.data.bookings[0].bookingId;

    // Customer B creates booking
    const resB = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerBToken}`)
      .send({
        courtId: courtA._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '13:00', endTime: '14:00' }],
        contactName: 'Khách Hàng B',
        contactPhone: '0901000032',
        idempotencyKey: 'list-cust-test-2',
      });
    const bookingIdB = resB.body.data.bookings[0].bookingId;

    // Customer A lists UPCOMING bookings: must see bookingIdA, NOT bookingIdB
    const listResA = await request(app)
      .get('/api/v1/bookings?status=UPCOMING')
      .set('Authorization', `Bearer ${customerAToken}`);

    assert.equal(listResA.status, 200);
    assert.ok(listResA.body.data.length >= 1);
    const ids = listResA.body.data.map((b) => b.id);
    assert.ok(ids.includes(bookingIdA));
    assert.ok(!ids.includes(bookingIdB)); // Strict isolation

    // Customer B attempts to get Customer A's booking detail -> 403 Forbidden (Criterion 5)
    const detailFailRes = await request(app)
      .get(`/api/v1/bookings/${bookingIdA}`)
      .set('Authorization', `Bearer ${customerBToken}`);
    assert.equal(detailFailRes.status, 403);

    // Customer A gets own detail -> 200
    const detailSuccessRes = await request(app)
      .get(`/api/v1/bookings/${bookingIdA}`)
      .set('Authorization', `Bearer ${customerAToken}`);
    assert.equal(detailSuccessRes.status, 200);
    assert.equal(detailSuccessRes.body.data.id, bookingIdA);
  });

  await t.test('4. Owner Bookings Listing & Isolation (OWN-07, Criterion 4)', async () => {
    const futureDate = getTomorrowDate();

    const resA = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        courtId: courtA._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '15:00', endTime: '16:00' }],
        contactName: 'Khách Hàng A',
        contactPhone: '0901000031',
        idempotencyKey: 'owner-list-test-1',
      });
    const bookingIdA = resA.body.data.bookings[0].bookingId;

    // Owner A views bookings at their facility
    const ownerListRes = await request(app)
      .get('/api/v1/owner/bookings')
      .set('Authorization', `Bearer ${ownerAToken}`);

    assert.equal(ownerListRes.status, 200);
    const item = ownerListRes.body.data.find((b) => b.id === bookingIdA);
    assert.ok(item);
    assert.equal(item.contactName, 'Khách Hàng A'); // Contact info populated for owner
    assert.equal(item.contactPhone, '0901000031');

    // Owner B lists bookings -> empty (does not own facilityA - Criterion 4)
    const ownerBListRes = await request(app)
      .get('/api/v1/owner/bookings')
      .set('Authorization', `Bearer ${ownerBToken}`);

    assert.equal(ownerBListRes.status, 200);
    const itemB = ownerBListRes.body.data.find((b) => b.id === bookingIdA);
    assert.equal(itemB, undefined);

    // Owner B tries to get detail of bookingIdA -> 403 Forbidden
    const detailFailRes = await request(app)
      .get(`/api/v1/owner/bookings/${bookingIdA}`)
      .set('Authorization', `Bearer ${ownerBToken}`);
    assert.equal(detailFailRes.status, 403);
  });

  await t.test('5. Admin Bookings Listing & Detail (ADM-03)', async () => {
    const futureDate = getTomorrowDate();

    const resA = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerAToken}`)
      .send({
        courtId: courtA._id.toString(),
        bookingDate: futureDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '17:00', endTime: '18:00' }],
        contactName: 'Khách Hàng A',
        contactPhone: '0901000031',
        idempotencyKey: 'admin-list-test-1',
      });
    const bookingIdA = resA.body.data.bookings[0].bookingId;

    // Admin lists all bookings
    const adminListRes = await request(app)
      .get('/api/v1/admin/bookings')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(adminListRes.status, 200);
    const found = adminListRes.body.data.find((b) => b.id === bookingIdA);
    assert.ok(found);

    // Admin gets detail
    const adminDetailRes = await request(app)
      .get(`/api/v1/admin/bookings/${bookingIdA}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(adminDetailRes.status, 200);
    assert.equal(adminDetailRes.body.data.id, bookingIdA);
  });
});
