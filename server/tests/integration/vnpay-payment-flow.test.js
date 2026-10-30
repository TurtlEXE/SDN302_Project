import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
import { PaymentTransaction } from '../../src/models/payment-transaction.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { vnpayClient } from '../../src/integrations/vnpay.client.js';

test('VNPay Payment Flow & IPN Callback (Integration - P11)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await EmailOutbox.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p11-flow-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let customer = null;
  let owner = null;
  let customerToken = null;
  let ownerToken = null;
  let facility = null;
  let facilitySport = null;
  let court = null;
  let sport = null;
  let targetDate = null;

  t.beforeEach(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await EmailOutbox.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p11-flow-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    targetDate = addDaysToDateVN(getCurrentDateVN(), 2);
    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    customer = await User.create({
      email: `customer-p11-flow-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P11 Flow',
      phoneNumber: '0901111111',
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

    owner = await User.create({
      email: `owner-p11-flow-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P11 Flow',
      phoneNumber: '0902222222',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
    });
    const s2 = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, s2).accessToken;

    sport = await Sport.create({
      name: `Cầu lông P11 Flow ${Date.now()}`,
      normalizedName: `cau long p11 flow ${Date.now()}`.toLowerCase(),
      description: 'Môn cầu lông',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Trung Tâm Thể Thao P11 Flow',
      description: 'Cơ sở hiện đại',
      address: '456 Đường Thể Thao, Q1, TP.HCM',
      province: 'Thành phố Hồ Chí Minh',
      phoneNumber: '0902222222',
      openTime: '06:00',
      closeTime: '23:00',
      operatingHoursVersion: 1,
      configVersion: 1,
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
      name: 'Sân 1',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });
  });

  /**
   * Helper to sign VNPay callback query params using configured test credentials
   */
  function signParams(params) {
    const fields = {};
    for (const [key, val] of Object.entries(params)) {
      if (
        key.startsWith('vnp_') &&
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        val !== undefined &&
        val !== null &&
        val !== ''
      ) {
        fields[key] = String(val);
      }
    }

    const sortedKeys = Object.keys(fields).sort();
    const hashParts = [];
    for (const k of sortedKeys) {
      hashParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(fields[k]).replace(/%20/g, '+')}`);
    }

    const signData = hashParts.join('&');
    const hmac = crypto.createHmac('sha512', env.VNPAY_HASH_SECRET);
    const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return { ...fields, vnp_SecureHash };
  }

  await t.test('1. End-to-end customer booking -> VNPay URL -> IPN callback confirms bookings and enqueues outbox email', async () => {
    // 1. Create booking request with 2 contiguous slots (08:00 - 09:00 = 60 min -> 120,000 VND)
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '08:00', endTime: '08:30' },
          { startTime: '08:30', endTime: '09:00' },
        ],
        contactName: 'Nguyen Van A',
        contactPhone: '0901234567',
        idempotencyKey: `idemp-p11-flow-1-${Date.now()}`,
      });

    assert.equal(bookingRes.status, 201);
    const { bookingRequestId, paymentOrder, bookings } = bookingRes.body.data;
    assert.equal(paymentOrder.amountVnd, 120000);
    assert.ok(paymentOrder.paymentUrl); // Auto-populated via vnpayClient
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].totalPriceVnd, 120000);

    // 2. Call POST /api/v1/payments/create-url to reissue/verify URL
    const createUrlRes = await request(app)
      .post('/api/v1/payments/create-url')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentOrderId: paymentOrder.paymentOrderId });

    assert.equal(createUrlRes.status, 200);
    assert.ok(createUrlRes.body.data.paymentUrl.includes('vnp_Amount=12000000')); // Criterion 44
    assert.ok(createUrlRes.body.data.paymentUrl.includes(`vnp_TxnRef=${paymentOrder.vnpayTxnRef}`));

    // 3. Simulate VNPay IPN webhook call
    const ipnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '12000000', // 120,000 VND * 100
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14888999',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261029193000',
      vnp_OrderInfo: 'Thanh toan don dat san',
    });

    const ipnRes = await request(app).get('/api/v1/payments/vnpay-ipn').query(ipnParams);
    assert.equal(ipnRes.status, 200);
    assert.deepEqual(ipnRes.body, { RspCode: '00', Message: 'Confirm Success' });

    // 4. Verify Database State
    const updatedPaymentOrder = await PaymentOrder.findById(paymentOrder.paymentOrderId);
    assert.equal(updatedPaymentOrder.status, 'PAID');

    const updatedBookings = await Booking.find({ bookingRequestId });
    assert.equal(updatedBookings.length, 1);
    assert.equal(updatedBookings[0].status, 'CONFIRMED');
    assert.equal(updatedBookings[0].paymentStatus, 'PAID');
    assert.equal(updatedBookings[0].allocatedAmountVnd, 120000);

    // 5. Verify PaymentTransaction record
    const paymentTxn = await PaymentTransaction.findOne({ paymentOrderId: paymentOrder.paymentOrderId });
    assert.ok(paymentTxn);
    assert.equal(paymentTxn.vnpayTransactionNo, '14888999');
    assert.equal(paymentTxn.amountVnd, 120000);
    assert.equal(paymentTxn.isAccepted, true);
    assert.equal(paymentTxn.exceptionType, null);

    // 6. Verify EmailOutbox queued confirmation email (Criteria 39, 41)
    const emailEntry = await EmailOutbox.findOne({ eventKey: `BOOKING_CONFIRMED_${bookingRequestId}` });
    assert.ok(emailEntry);
    assert.equal(emailEntry.eventType, 'BOOKING_CONFIRMED');
    assert.equal(emailEntry.recipientEmail, customer.email);
    assert.equal(emailEntry.status, 'PENDING');
    assert.equal(emailEntry.templateData.totalAmountVnd, 120000);
  });

  await t.test('2. Browser Return flow supports both JSON and HTML test fixture page', async () => {
    // 1. Create booking
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Le Thi B',
        contactPhone: '0909876543',
        idempotencyKey: `idemp-p11-flow-2-${Date.now()}`,
      });

    const { paymentOrder } = bookingRes.body.data;

    const returnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '6000000', // 60,000 VND * 100 (30 min)
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14999111',
      vnp_PayDate: '20261029200000',
      vnp_OrderInfo: 'Thanh toan don dat san',
    });

    // Test with text/html header (simulating browser return redirect)
    const htmlRes = await request(app)
      .get('/api/v1/payments/vnpay-return')
      .set('Accept', 'text/html')
      .query(returnParams);

    assert.equal(htmlRes.status, 200);
    assert.ok(htmlRes.text.includes('Thanh toán thành công'));
    assert.ok(htmlRes.text.includes('CONFIRMED'));

    // Test with application/json header (simulating API caller)
    const jsonRes = await request(app)
      .get('/api/v1/payments/vnpay-return')
      .set('Accept', 'application/json')
      .query(returnParams);

    assert.equal(jsonRes.status, 200);
    assert.equal(jsonRes.body.success, true);
    assert.equal(jsonRes.body.data.status, 'CONFIRMED');
  });

  await t.test('3. Guest payment link access with secret accessCode (OWN-08, Criterion 52)', async () => {
    // Owner creates booking on behalf of guest
    const guestBookingRes = await request(app)
      .post('/api/v1/owner/bookings/on-behalf')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '14:00', endTime: '14:30' },
          { startTime: '14:30', endTime: '15:00' },
        ],
        contactName: 'Khach Vang Lai C',
        contactPhone: '0912345678',
        idempotencyKey: `idemp-p11-guest-${Date.now()}`,
      });

    assert.equal(guestBookingRes.status, 201);
    const { paymentOrder, guestAccessLink } = guestBookingRes.body.data;
    assert.ok(guestAccessLink);

    // Parse access code from generated guestAccessLink
    const urlParts = new URL(`http://localhost${guestAccessLink}`);
    const accessCode = urlParts.searchParams.get('code');
    assert.ok(accessCode);

    // Call GET /api/v1/payments/guest-order/:id without code -> 403
    const forbiddenRes1 = await request(app).get(
      `/api/v1/payments/guest-order/${paymentOrder.paymentOrderId}`
    );
    assert.equal(forbiddenRes1.status, 403);

    // Call with incorrect code -> 403
    const forbiddenRes2 = await request(app).get(
      `/api/v1/payments/guest-order/${paymentOrder.paymentOrderId}?accessCode=wrong_code`
    );
    assert.equal(forbiddenRes2.status, 403);

    // Call with valid code -> 200 with GuestPaymentOrderDTO
    const successRes = await request(app).get(
      `/api/v1/payments/guest-order/${paymentOrder.paymentOrderId}?accessCode=${accessCode}`
    );

    assert.equal(successRes.status, 200);
    assert.equal(successRes.body.success, true);
    assert.equal(successRes.body.data.paymentOrderId, paymentOrder.paymentOrderId);
    assert.equal(successRes.body.data.totalAmountVnd, 120000);
    assert.equal(successRes.body.data.status, 'PENDING');
    assert.ok(successRes.body.data.paymentUrl.includes('vnp_Amount=12000000'));
  });
});
