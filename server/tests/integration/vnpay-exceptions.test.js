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

test('VNPay Payment Exceptions & Edge Cases (Integration - P11)', async (t) => {
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
    await User.deleteMany({ email: { $regex: /p11-exc-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let customer = null;
  let customerToken = null;
  let owner = null;
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
    await User.deleteMany({ email: { $regex: /p11-exc-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    targetDate = addDaysToDateVN(getCurrentDateVN(), 2);
    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    customer = await User.create({
      email: `customer-p11-exc-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P11 Exceptions',
      phoneNumber: '0901239999',
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
      email: `owner-p11-exc-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P11 Exceptions',
      phoneNumber: '0908889999',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
    });

    sport = await Sport.create({
      name: `Cầu lông P11 Exc ${Date.now()}`,
      normalizedName: `cau long p11 exc ${Date.now()}`.toLowerCase(),
      description: 'Môn cầu lông',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Trung Tâm Thể Thao P11 Exceptions',
      description: 'Cơ sở hiện đại',
      address: '789 Đường Thể Thao, Q1, TP.HCM',
      province: 'Thành phố Hồ Chí Minh',
      phoneNumber: '0908889999',
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

  await t.test('1. Invalid signature callback returns 400 with RspCode 97 and does not modify database', async () => {
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '08:00', endTime: '08:30' }],
        contactName: 'Tran Van X',
        contactPhone: '0901112222',
        idempotencyKey: `idemp-exc-1-${Date.now()}`,
      });

    const { paymentOrder } = bookingRes.body.data;

    // Send IPN with tampered signature
    const tamperedParams = {
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14111222',
      vnp_SecureHash: 'invalid_sha512_signature_hash_here',
    };

    const res = await request(app).get('/api/v1/payments/vnpay-ipn').query(tamperedParams);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { RspCode: '97', Message: 'Invalid Signature' });

    // Verify order remains PENDING
    const unchangedOrder = await PaymentOrder.findById(paymentOrder.paymentOrderId);
    assert.equal(unchangedOrder.status, 'PENDING');
  });

  await t.test('2. Idempotent duplicate callback returns RspCode 02 and does not duplicate email or transactions', async () => {
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '09:00', endTime: '09:30' }],
        contactName: 'Tran Van Y',
        contactPhone: '0903334444',
        idempotencyKey: `idemp-exc-2-${Date.now()}`,
      });

    const { paymentOrder, bookingRequestId } = bookingRes.body.data;

    const validParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14333444',
      vnp_PayDate: '20261029193000',
    });

    // First delivery -> Success
    const res1 = await request(app).get('/api/v1/payments/vnpay-ipn').query(validParams);
    assert.equal(res1.status, 200);
    assert.equal(res1.body.RspCode, '00');

    // Second delivery (replay with same transactionNo) -> RspCode 02 (Order already confirmed)
    const res2 = await request(app).get('/api/v1/payments/vnpay-ipn').query(validParams);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.RspCode, '02');

    // Check count of PaymentTransactions and EmailOutbox
    const txnCount = await PaymentTransaction.countDocuments({ paymentOrderId: paymentOrder.paymentOrderId });
    assert.equal(txnCount, 1);

    const emailCount = await EmailOutbox.countDocuments({ eventKey: `BOOKING_CONFIRMED_${bookingRequestId}` });
    assert.equal(emailCount, 1);
  });

  await t.test('3. Duplicate callback with DIFFERENT transactionNo on PAID order records DUPLICATE_PAYMENT exception (Criterion 55)', async () => {
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '10:30' }],
        contactName: 'Tran Van Z',
        contactPhone: '0905556666',
        idempotencyKey: `idemp-exc-3-${Date.now()}`,
      });

    const { paymentOrder } = bookingRes.body.data;

    // First transaction -> Success
    const params1 = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14555001',
      vnp_PayDate: '20261029193000',
    });
    await request(app).get('/api/v1/payments/vnpay-ipn').query(params1);

    // Second transaction with different transaction number
    const params2 = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14555002', // Different transaction
      vnp_PayDate: '20261029193100',
    });
    const res2 = await request(app).get('/api/v1/payments/vnpay-ipn').query(params2);
    assert.equal(res2.status, 200);
    assert.equal(res2.body.RspCode, '02'); // Order already confirmed

    // Assert second transaction is recorded with DUPLICATE_PAYMENT
    const secondTxn = await PaymentTransaction.findOne({ vnpayTransactionNo: '14555002' });
    assert.ok(secondTxn);
    assert.equal(secondTxn.isAccepted, false);
    assert.equal(secondTxn.exceptionType, 'DUPLICATE_PAYMENT');

    // PaymentOrder remains PAID and bookings remain CONFIRMED
    const order = await PaymentOrder.findById(paymentOrder.paymentOrderId);
    assert.equal(order.status, 'PAID');
  });

  await t.test('4. Wrong amount callback triggers REVIEW status, cancels pending bookings, and returns RspCode 04 (Criterion 44, 55)', async () => {
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '11:00', endTime: '11:30' },
          { startTime: '11:30', endTime: '12:00' },
        ], // 60 min -> 120,000 VND
        contactName: 'Pham Van W',
        contactPhone: '0907778888',
        idempotencyKey: `idemp-exc-4-${Date.now()}`,
      });

    const { paymentOrder, bookingRequestId } = bookingRes.body.data;

    // Send callback with wrong amount (e.g. 50,000 VND * 100 instead of 120,000 * 100)
    const wrongAmountParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '5000000', // 50,000 VND
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14777888',
      vnp_PayDate: '20261029193000',
    });

    const res = await request(app).get('/api/v1/payments/vnpay-ipn').query(wrongAmountParams);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { RspCode: '04', Message: 'Invalid amount' });

    // PaymentOrder must be in REVIEW
    const order = await PaymentOrder.findById(paymentOrder.paymentOrderId);
    assert.equal(order.status, 'REVIEW');

    // Child bookings must be CANCELLED to release the held slot
    const bookings = await Booking.find({ bookingRequestId });
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].status, 'CANCELLED');

    // PaymentTransaction must be saved with exceptionType = WRONG_AMOUNT
    const txn = await PaymentTransaction.findOne({ vnpayTransactionNo: '14777888' });
    assert.ok(txn);
    assert.equal(txn.isAccepted, false);
    assert.equal(txn.exceptionType, 'WRONG_AMOUNT');
  });

  await t.test('5. Late payment callback after hold expiration transitions order to REVIEW without re-booking (Criterion 49)', async () => {
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '13:00', endTime: '13:30' }],
        contactName: 'Hoang Van Late',
        contactPhone: '0909990000',
        idempotencyKey: `idemp-exc-5-${Date.now()}`,
      });

    const { paymentOrder, bookingRequestId } = bookingRes.body.data;

    // Simulate hold expired by backdating expiresAt to past
    const pastDate = new Date(Date.now() - 60000); // 1 minute ago
    await PaymentOrder.findByIdAndUpdate(paymentOrder.paymentOrderId, { expiresAt: pastDate });
    await Booking.updateMany({ bookingRequestId }, { holdExpiresAt: pastDate });

    // Late callback arrives from VNPay with success
    const lateParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14999000',
      vnp_PayDate: '20261029193000',
    });

    const res = await request(app).get('/api/v1/payments/vnpay-ipn').query(lateParams);
    assert.equal(res.status, 200);
    assert.equal(res.body.RspCode, '00'); // VNPay notified confirm success so it stops retrying

    // PaymentOrder must transition to REVIEW
    const order = await PaymentOrder.findById(paymentOrder.paymentOrderId);
    assert.equal(order.status, 'REVIEW');

    // Child bookings must be EXPIRED, NEVER confirmed
    const bookings = await Booking.find({ bookingRequestId });
    assert.equal(bookings.length, 1);
    assert.equal(bookings[0].status, 'EXPIRED');

    // Transaction saved with exceptionType = LATE_PAYMENT
    const txn = await PaymentTransaction.findOne({ vnpayTransactionNo: '14999000' });
    assert.ok(txn);
    assert.equal(txn.isAccepted, false);
    assert.equal(txn.exceptionType, 'LATE_PAYMENT');
  });

  await t.test('6. Failed callback closes pending order and does NOT degrade an already PAID order (Criterion 50)', async () => {
    // 6a. Failed callback on PENDING order closes order
    const bookingRes1 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '15:00', endTime: '15:30' }],
        contactName: 'Ngo Van Fail',
        contactPhone: '0901234999',
        idempotencyKey: `idemp-exc-6a-${Date.now()}`,
      });

    const po1 = bookingRes1.body.data.paymentOrder;
    const req1 = bookingRes1.body.data.bookingRequestId;

    const failedParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: po1.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '24', // Customer cancelled
      vnp_TransactionStatus: '02', // Failed
      vnp_TransactionNo: '14000024',
      vnp_PayDate: '20261029193000',
    });

    const failRes = await request(app).get('/api/v1/payments/vnpay-ipn').query(failedParams);
    assert.equal(failRes.status, 200);
    assert.equal(failRes.body.RspCode, '00');

    const closedOrder = await PaymentOrder.findById(po1.paymentOrderId);
    assert.equal(closedOrder.status, 'CLOSED');
    assert.equal(closedOrder.closedReason, 'FAILED_PAYMENT');

    const cancelledBookings = await Booking.find({ bookingRequestId: req1 });
    assert.equal(cancelledBookings[0].status, 'CANCELLED');

    // 6b. Failed callback arriving AFTER success must NOT degrade PAID order (Criterion 50)
    const bookingRes2 = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '16:00', endTime: '16:30' }],
        contactName: 'Ngo Van Success',
        contactPhone: '0901234998',
        idempotencyKey: `idemp-exc-6b-${Date.now()}`,
      });

    const po2 = bookingRes2.body.data.paymentOrder;
    const req2 = bookingRes2.body.data.bookingRequestId;

    // Successful payment arrives first
    const successParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: po2.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '14000099',
      vnp_PayDate: '20261029193000',
    });
    await request(app).get('/api/v1/payments/vnpay-ipn').query(successParams);

    // Failed callback arrives later
    const lateFailedParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: po2.vnpayTxnRef,
      vnp_Amount: '6000000',
      vnp_ResponseCode: '24',
      vnp_TransactionStatus: '02',
      vnp_TransactionNo: '14000025',
      vnp_PayDate: '20261029193500',
    });
    await request(app).get('/api/v1/payments/vnpay-ipn').query(lateFailedParams);

    // Order MUST remain PAID and bookings MUST remain CONFIRMED
    const orderStillPaid = await PaymentOrder.findById(po2.paymentOrderId);
    assert.equal(orderStillPaid.status, 'PAID');

    const bookingsStillConfirmed = await Booking.find({ bookingRequestId: req2 });
    assert.equal(bookingsStillConfirmed[0].status, 'CONFIRMED');
    assert.equal(bookingsStillConfirmed[0].paymentStatus, 'PAID');
  });
});
