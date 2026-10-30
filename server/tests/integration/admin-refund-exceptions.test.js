import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
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
import { PaymentTransaction } from '../../src/models/payment-transaction.model.js';
import { RefundCase } from '../../src/models/refund-case.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Admin Refund Exceptions & Edge Cases (Integration - P12)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await RefundCase.deleteMany({});
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
    await User.deleteMany({ email: { $regex: /p12-exc-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let admin = null;
  let adminToken = null;
  let customer = null;
  let customerToken = null;
  let owner = null;
  let ownerToken = null;
  let facility = null;
  let facilitySport = null;
  let court = null;
  let sport = null;
  let targetDate = null;

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

  t.beforeEach(async () => {
    await RefundCase.deleteMany({});
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
    await User.deleteMany({ email: { $regex: /p12-exc-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    targetDate = addDaysToDateVN(getCurrentDateVN(), 2);
    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    admin = await User.create({
      email: `admin-p12-exc-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Viên P12 Exc',
      phoneNumber: '0900000013',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sAdmin = await AuthSession.create({
      userId: admin._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    adminToken = jwtService.signAccessToken(admin, sAdmin).accessToken;

    customer = await User.create({
      email: `customer-p12-exc-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P12 Exc',
      phoneNumber: '0901111113',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sCust = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, sCust).accessToken;

    owner = await User.create({
      email: `owner-p12-exc-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P12 Exc',
      phoneNumber: '0902222213',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
    });
    const sOwner = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, sOwner).accessToken;

    sport = await Sport.create({
      name: `Cầu lông P12 Exc ${Date.now()}`,
      normalizedName: `cau long p12 exc ${Date.now()}`.toLowerCase(),
      description: 'Môn cầu lông',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Trung Tâm Thể Thao P12 Exc',
      description: 'Cơ sở P12 Exc',
      address: '101 Đường Võ Văn Kiệt, Q1, TP.HCM',
      province: 'Thành phố Hồ Chí Minh',
      phoneNumber: '0902222213',
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
      name: 'Sân 1 - Exc',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });
  });

  await t.test('1. Role-based access control enforces ADMIN-only access', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();

    // CUSTOMER calling cancel-and-refund -> 403
    const c1 = await request(app)
      .post(`/api/v1/admin/bookings/${fakeId}/cancel-and-refund`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Hủy đơn' });
    assert.equal(c1.status, 403);

    // OWNER calling cancel-and-refund -> 403
    const o1 = await request(app)
      .post(`/api/v1/admin/bookings/${fakeId}/cancel-and-refund`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Hủy đơn' });
    assert.equal(o1.status, 403);

    // Unauthenticated calling cancel-and-refund -> 401
    const u1 = await request(app)
      .post(`/api/v1/admin/bookings/${fakeId}/cancel-and-refund`)
      .send({ reason: 'Hủy đơn' });
    assert.equal(u1.status, 401);

    // CUSTOMER calling record-manual-refund -> 403
    const c2 = await request(app)
      .post(`/api/v1/admin/refunds/${fakeId}/record-manual-refund`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ proofReference: 'REF123' });
    assert.equal(c2.status, 403);

    // CUSTOMER calling list refunds -> 403
    const c3 = await request(app)
      .get('/api/v1/admin/refunds')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(c3.status, 403);

    // CUSTOMER calling exception-refund -> 403
    const c4 = await request(app)
      .post('/api/v1/admin/refunds/exception-refund')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentTransactionId: fakeId, reason: 'Ngoại lệ' });
    assert.equal(c4.status, 403);

    // CUSTOMER calling list payment-transactions -> 403
    const c5 = await request(app)
      .get('/api/v1/admin/payment-transactions')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(c5.status, 403);
  });

  await t.test('2. Rejects cancellation when booking is after endTime (Section 8.7, Criterion 17)', async () => {
    // Past booking date (2 days ago)
    const pastDate = '2026-10-01';
    const bReqId = new mongoose.Types.ObjectId();
    const pastBooking = await Booking.create({
      bookingCode: `BK-PAST-${Date.now()}`,
      bookingRequestId: bReqId,
      facilityId: facility._id,
      courtId: court._id,
      sportId: sport._id,
      customerId: customer._id,
      bookingDate: pastDate,
      startTime: '08:00',
      endTime: '09:00',
      startMinutes: 480,
      endMinutes: 540,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      allocatedAmountVnd: 120000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      statusVersion: 1,
      holdExpiresAt: new Date(Date.now() + 600000),
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: sport.name,
        slotStepMinutes: 30,
      },
    });

    // Create associated PaymentOrder and PaymentTransaction
    const paymentOrder = await PaymentOrder.create({
      bookingRequestId: bReqId,
      expectedAmountVnd: 120000,
      status: 'PAID',
      vnpayTxnRef: `TXN-PAST-${Date.now()}`,
      expiresAt: new Date(Date.now() + 600000),
    });

    await PaymentTransaction.create({
      paymentOrderId: paymentOrder._id,
      vnpayTransactionNo: `VN-PAST-${Date.now()}`,
      vnpayTxnRef: paymentOrder.vnpayTxnRef,
      amountVnd: 120000,
      bankCode: 'NCB',
      responseCode: '00',
      transactionStatus: '00',
      rawCallbackData: { note: 'test past booking' },
      isAccepted: true,
    });

    const res = await request(app)
      .post(`/api/v1/admin/bookings/${pastBooking._id}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Yêu cầu hoàn sau khi giờ đã qua' });

    assert.equal(res.status, 400);
    assert.match(res.body.error.message, /quá giờ kết thúc/);
  });

  await t.test('3. Rejects cancellation when booking is not CONFIRMED / PAID', async () => {
    // 3a. Booking in PENDING_PAYMENT
    const pendingBooking = await Booking.create({
      bookingCode: `BK-PEND-${Date.now()}`,
      bookingRequestId: new mongoose.Types.ObjectId(),
      facilityId: facility._id,
      courtId: court._id,
      sportId: sport._id,
      customerId: customer._id,
      bookingDate: targetDate,
      startTime: '08:00',
      endTime: '09:00',
      startMinutes: 480,
      endMinutes: 540,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      allocatedAmountVnd: 0,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      statusVersion: 1,
      holdExpiresAt: new Date(Date.now() + 600000),
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: sport.name,
        slotStepMinutes: 30,
      },
    });

    const res1 = await request(app)
      .post(`/api/v1/admin/bookings/${pendingBooking._id}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Hủy đơn chưa trả tiền' });

    assert.equal(res1.status, 400);
    assert.match(res1.body.error.message, /CONFIRMED\/PAID/);

    // 3b. Missing reason validation
    const res2 = await request(app)
      .post(`/api/v1/admin/bookings/${pendingBooking._id}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    assert.equal(res2.status, 400);
    assert.match(res2.body.error.message, /Lý do/);
  });

  await t.test('4. Rejects duplicate refund creation for the same booking', async () => {
    // Create confirmed booking
    const bReqId = new mongoose.Types.ObjectId();
    const booking = await Booking.create({
      bookingCode: `BK-DUP-${Date.now()}`,
      bookingRequestId: bReqId,
      facilityId: facility._id,
      courtId: court._id,
      sportId: sport._id,
      customerId: customer._id,
      bookingDate: targetDate,
      startTime: '10:00',
      endTime: '11:00',
      startMinutes: 600,
      endMinutes: 660,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      allocatedAmountVnd: 120000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      statusVersion: 1,
      holdExpiresAt: new Date(Date.now() + 600000),
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: sport.name,
        slotStepMinutes: 30,
      },
    });

    const paymentOrder = await PaymentOrder.create({
      bookingRequestId: bReqId,
      expectedAmountVnd: 120000,
      status: 'PAID',
      vnpayTxnRef: `TXN-DUP-${Date.now()}`,
      expiresAt: new Date(Date.now() + 600000),
    });

    await PaymentTransaction.create({
      paymentOrderId: paymentOrder._id,
      vnpayTransactionNo: `VN-DUP-${Date.now()}`,
      vnpayTxnRef: paymentOrder.vnpayTxnRef,
      amountVnd: 120000,
      bankCode: 'NCB',
      responseCode: '00',
      transactionStatus: '00',
      rawCallbackData: { note: 'test dup' },
      isAccepted: true,
    });

    // First cancellation succeeds
    const res1 = await request(app)
      .post(`/api/v1/admin/bookings/${booking._id}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Hủy lần 1' });
    assert.equal(res1.status, 200);

    // Second cancellation fails
    const res2 = await request(app)
      .post(`/api/v1/admin/bookings/${booking._id}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Hủy lần 2' });
    assert.equal(res2.status, 400);
  });

  await t.test('5. Rejects recordManualRefund without proofReference or if already REFUNDED', async () => {
    const refundCase = await RefundCase.create({
      refundCaseCode: `RF-TEST-${Date.now()}`,
      paymentTransactionId: new mongoose.Types.ObjectId(),
      refundAmountVnd: 120000,
      reason: 'Hoàn tiền thử nghiệm',
      status: 'PENDING',
    });

    // 5a. Missing proofReference -> 400
    const resMissing = await request(app)
      .post(`/api/v1/admin/refunds/${refundCase._id}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(resMissing.status, 400);
    assert.match(resMissing.body.error.message, /proofReference/);

    // 5b. Valid record -> 200
    const resValid = await request(app)
      .post(`/api/v1/admin/refunds/${refundCase._id}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proofReference: 'UNC-123456' });
    assert.equal(resValid.status, 200);
    assert.equal(resValid.body.data.status, 'REFUNDED');

    // 5c. Second record call on already REFUNDED -> 400
    const resAlready = await request(app)
      .post(`/api/v1/admin/refunds/${refundCase._id}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proofReference: 'UNC-RETRY' });
    assert.equal(resAlready.status, 400);
    assert.match(resAlready.body.error.message, /hoàn tất trước đó/);
  });

  await t.test('6. Handles exception payment transactions (LATE_PAYMENT / WRONG_AMOUNT) via exception refund (Criteria 49, 55)', async () => {
    // 6a. Create an unallocated / exception payment transaction
    const lateTxn = await PaymentTransaction.create({
      paymentOrderId: null,
      vnpayTransactionNo: `VN-LATE-${Date.now()}`,
      vnpayTxnRef: `TXN-LATE-${Date.now()}`,
      amountVnd: 180000,
      bankCode: 'NCB',
      responseCode: '00',
      transactionStatus: '00',
      rawCallbackData: { note: 'IPN received after 15m hold expired' },
      isAccepted: false,
      exceptionType: 'LATE_PAYMENT',
    });

    // 6b. Admin lists exception transactions
    const listTxnRes = await request(app)
      .get('/api/v1/admin/payment-transactions?exceptionOnly=true')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(listTxnRes.status, 200);
    assert.ok(listTxnRes.body.data.some((t) => t.vnpayTransactionNo === lateTxn.vnpayTransactionNo));

    // 6c. Admin creates exception refund case
    const excRefundRes = await request(app)
      .post('/api/v1/admin/refunds/exception-refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentTransactionId: lateTxn._id.toString(),
        reason: 'Khách hàng thanh toán sau khi phiên giữ chỗ đã hết hạn 15 phút',
      });

    assert.equal(excRefundRes.status, 201);
    assert.equal(excRefundRes.body.success, true);
    assert.equal(excRefundRes.body.data.status, 'PENDING');
    assert.equal(excRefundRes.body.data.refundAmountVnd, 180000);
    assert.equal(excRefundRes.body.data.bookingId, null);

    const excRefundCaseId = excRefundRes.body.data._id || excRefundRes.body.data.id;

    // 6d. Admin records manual refund proof for exception case
    const recordExcRes = await request(app)
      .post(`/api/v1/admin/refunds/${excRefundCaseId}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        proofReference: 'UNC-EXC-LATE-7788',
        proofImageUrl: 'https://cdn.sportbooking.local/proofs/exc-7788.jpg',
      });

    assert.equal(recordExcRes.status, 200);
    assert.equal(recordExcRes.body.data.status, 'REFUNDED');
    assert.equal(recordExcRes.body.data.proofReference, 'UNC-EXC-LATE-7788');

    // 6e. Trying to refund again on fully refunded exception transaction -> 400
    const overRefundRes = await request(app)
      .post('/api/v1/admin/refunds/exception-refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        paymentTransactionId: lateTxn._id.toString(),
        reason: 'Hoàn tiền trùng lặp',
      });

    assert.equal(overRefundRes.status, 400);
    assert.match(overRefundRes.body.error.message, /được tạo hồ sơ hoàn đủ 100%/);
  });
});
