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
import { RefundCase } from '../../src/models/refund-case.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Admin Refund & Cancellation Flow (Integration - P12)', async (t) => {
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
    await User.deleteMany({ email: { $regex: /p12-flow-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let admin = null;
  let adminToken = null;
  let customer = null;
  let customerToken = null;
  let customer2 = null;
  let customer2Token = null;
  let owner = null;
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
    await User.deleteMany({ email: { $regex: /p12-flow-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    targetDate = addDaysToDateVN(getCurrentDateVN(), 2);
    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    admin = await User.create({
      email: `admin-p12-flow-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Viên P12',
      phoneNumber: '0900000012',
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
      email: `customer-p12-flow-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P12 Flow',
      phoneNumber: '0901111112',
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

    customer2 = await User.create({
      email: `customer2-p12-flow-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng 2 P12 Flow',
      phoneNumber: '0903333333',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sCust2 = await AuthSession.create({
      userId: customer2._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customer2Token = jwtService.signAccessToken(customer2, sCust2).accessToken;

    owner = await User.create({
      email: `owner-p12-flow-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P12 Flow',
      phoneNumber: '0902222212',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
    });

    sport = await Sport.create({
      name: `Cầu lông P12 Flow ${Date.now()}`,
      normalizedName: `cau long p12 flow ${Date.now()}`.toLowerCase(),
      description: 'Môn cầu lông',
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Trung Tâm Thể Thao P12 Flow',
      description: 'Cơ sở hiện đại P12',
      address: '789 Đường Thể Thao, Q1, TP.HCM',
      province: 'Thành phố Hồ Chí Minh',
      phoneNumber: '0902222212',
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
      name: 'Sân 1 - P12',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });
  });

  await t.test('1. Admin cancels confirmed/paid booking, creates RefundCase (PENDING), releases schedule so slot is re-bookable', async () => {
    // Step 1: Customer creates booking request (08:00 - 09:00 = 60 min -> 120,000 VND)
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
        idempotencyKey: `idemp-p12-1-${Date.now()}`,
      });

    assert.equal(bookingRes.status, 201);
    const { bookingRequestId, paymentOrder } = bookingRes.body.data;
    const dbBookings = await Booking.find({ bookingRequestId });
    assert.equal(dbBookings.length, 1);
    const bookingId = dbBookings[0]._id.toString();

    // Step 2: VNPay IPN webhook confirms payment
    const ipnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '12000000', // 120,000 * 100
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '99881122',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261030100000',
      vnp_OrderInfo: 'Thanh toan don dat san P12',
    });

    const ipnRes = await request(app).get('/api/v1/payments/vnpay-ipn').query(ipnParams);
    assert.equal(ipnRes.status, 200);

    // Verify booking is CONFIRMED and PAID
    const confirmedBooking = await Booking.findById(bookingId);
    assert.equal(confirmedBooking.status, 'CONFIRMED');
    assert.equal(confirmedBooking.paymentStatus, 'PAID');
    assert.equal(confirmedBooking.allocatedAmountVnd, 120000);

    // Step 3: Admin cancels booking and creates refund case
    const cancelRes = await request(app)
      .post(`/api/v1/admin/bookings/${bookingId}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Sân bị hư hỏng trần nhà đột xuất do mưa lớn',
      });

    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.success, true);
    assert.ok(cancelRes.body.data.refundCaseId);
    assert.ok(cancelRes.body.data.refundCaseCode.startsWith('RF'));
    assert.equal(cancelRes.body.data.refundAmountVnd, 120000);
    assert.equal(cancelRes.body.data.status, 'PENDING');

    // Step 4: Verify Database State
    const cancelledBooking = await Booking.findById(bookingId);
    assert.equal(cancelledBooking.status, 'CANCELLED');
    assert.equal(cancelledBooking.paymentStatus, 'REFUND_PENDING');
    assert.equal(cancelledBooking.cancellation.reason, 'Sân bị hư hỏng trần nhà đột xuất do mưa lớn');
    assert.equal(cancelledBooking.cancellation.cancelledBy.toString(), admin._id.toString());
    assert.ok(cancelledBooking.cancellation.cancelledAt);

    const refundCase = await RefundCase.findById(cancelRes.body.data.refundCaseId);
    assert.ok(refundCase);
    assert.equal(refundCase.status, 'PENDING');
    assert.equal(refundCase.refundAmountVnd, 120000);
    assert.equal(refundCase.bookingId.toString(), bookingId);
    assert.equal(refundCase.proofReference, null);

    // Verify ActionLog audit
    const actionLog = await ActionLog.findOne({
      targetType: 'BOOKING',
      targetId: bookingId,
      action: 'ADMIN_CANCEL_BOOKING',
    });
    assert.ok(actionLog);
    assert.equal(actionLog.actorRole, 'ADMIN');
    assert.equal(actionLog.actorId.toString(), admin._id.toString());

    // Verify Outbox Email queued for customer
    const outboxEmail = await EmailOutbox.findOne({
      eventType: 'BOOKING_CANCELLED',
      recipientEmail: customer.email,
    });
    assert.ok(outboxEmail);
    assert.equal(outboxEmail.templateData.bookingCode, confirmedBooking.bookingCode);
    assert.equal(outboxEmail.templateData.refundCaseCode, refundCase.refundCaseCode);

    // Step 5: Verify schedule slot is released!
    // Customer 2 can now successfully book the EXACT same slot (08:00 - 09:00 on targetDate)
    const rebookRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '08:00', endTime: '08:30' },
          { startTime: '08:30', endTime: '09:00' },
        ],
        contactName: 'Khach Hang 2',
        contactPhone: '0903333333',
        idempotencyKey: `idemp-p12-rebook-${Date.now()}`,
      });

    assert.equal(rebookRes.status, 201);
    assert.equal(rebookRes.body.data.bookings.length, 1);
  });

  await t.test('2. Sibling booking under same BookingRequest remains CONFIRMED/PAID when one booking is cancelled (Criterion 53)', async () => {
    // Step 1: Customer books 2 separate blocks in the same request:
    // Slot 1: 10:00 - 11:00 (120,000 VND)
    // Slot 2: 14:00 - 15:00 (120,000 VND) -> Total 240,000 VND
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '10:00', endTime: '10:30' },
          { startTime: '10:30', endTime: '11:00' },
          { startTime: '14:00', endTime: '14:30' },
          { startTime: '14:30', endTime: '15:00' },
        ],
        contactName: 'Nguyen Van A',
        contactPhone: '0901234567',
        idempotencyKey: `idemp-p12-sibling-${Date.now()}`,
      });

    assert.equal(bookingRes.status, 201);
    const { bookingRequestId, paymentOrder } = bookingRes.body.data;
    const dbBookings = await Booking.find({ bookingRequestId }).sort({ startMinutes: 1 });
    assert.equal(dbBookings.length, 2);
    const booking1Id = dbBookings[0]._id.toString();
    const booking2Id = dbBookings[1]._id.toString();

    // Step 2: Confirm payment via IPN
    const ipnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '24000000', // 240,000 * 100
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '99882233',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261030110000',
      vnp_OrderInfo: 'Thanh toan 2 don P12',
    });

    const ipnRes = await request(app).get('/api/v1/payments/vnpay-ipn').query(ipnParams);
    assert.equal(ipnRes.status, 200);

    // Verify both bookings are CONFIRMED / PAID
    const b1Confirmed = await Booking.findById(booking1Id);
    const b2Confirmed = await Booking.findById(booking2Id);
    assert.equal(b1Confirmed.status, 'CONFIRMED');
    assert.equal(b1Confirmed.paymentStatus, 'PAID');
    assert.equal(b2Confirmed.status, 'CONFIRMED');
    assert.equal(b2Confirmed.paymentStatus, 'PAID');

    // Step 3: Admin cancels Booking 1 ONLY
    const cancelRes = await request(app)
      .post(`/api/v1/admin/bookings/${booking1Id}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Sự cố thiết bị buổi sáng',
      });

    assert.equal(cancelRes.status, 200);

    // Step 4: Verify Booking 1 is CANCELLED / REFUND_PENDING, Booking 2 is STILL CONFIRMED / PAID
    const b1After = await Booking.findById(booking1Id);
    assert.equal(b1After.status, 'CANCELLED');
    assert.equal(b1After.paymentStatus, 'REFUND_PENDING');

    const b2After = await Booking.findById(booking2Id);
    assert.equal(b2After.status, 'CONFIRMED');
    assert.equal(b2After.paymentStatus, 'PAID');

    // Step 5: Verify PaymentOrder remains PAID and expectedAmountVnd is unchanged (Criterion 53)
    const pOrderAfter = await PaymentOrder.findById(paymentOrder.paymentOrderId);
    assert.equal(pOrderAfter.status, 'PAID');
    assert.equal(pOrderAfter.expectedAmountVnd, 240000);
  });

  await t.test('3. Admin records manual refund proof -> transitions RefundCase to REFUNDED, booking to REFUNDED, queues outbox email (Criterion 54)', async () => {
    // Step 1: Create and confirm booking
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '16:00', endTime: '16:30' },
          { startTime: '16:30', endTime: '17:00' },
        ],
        contactName: 'Nguyen Van A',
        contactPhone: '0901234567',
        idempotencyKey: `idemp-p12-record-${Date.now()}`,
      });

    assert.equal(bookingRes.status, 201);
    const { bookingRequestId, paymentOrder } = bookingRes.body.data;
    const dbBookings = await Booking.find({ bookingRequestId });
    assert.equal(dbBookings.length, 1);
    const bookingId = dbBookings[0]._id.toString();

    const ipnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '12000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '99883344',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261030120000',
      vnp_OrderInfo: 'Thanh toan don P12 record',
    });
    await request(app).get('/api/v1/payments/vnpay-ipn').query(ipnParams);

    // Cancel booking to produce PENDING RefundCase
    const cancelRes = await request(app)
      .post(`/api/v1/admin/bookings/${bookingId}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Bảo trì khẩn cấp' });

    assert.equal(cancelRes.status, 200);
    const refundCaseId = cancelRes.body.data.refundCaseId;

    // Step 2: Admin records manual refund proof
    const recordRes = await request(app)
      .post(`/api/v1/admin/refunds/${refundCaseId}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        proofReference: 'UNC-VNPAY-20261030-8899',
        proofImageUrl: 'https://cdn.sportbooking.local/proofs/unc-8899.jpg',
      });

    assert.equal(recordRes.status, 200);
    assert.equal(recordRes.body.success, true);
    assert.equal(recordRes.body.data.status, 'REFUNDED');
    assert.equal(recordRes.body.data.proofReference, 'UNC-VNPAY-20261030-8899');
    assert.equal(recordRes.body.data.proofImageUrl, 'https://cdn.sportbooking.local/proofs/unc-8899.jpg');
    assert.equal(recordRes.body.data.processedBy.toString(), admin._id.toString());
    assert.ok(recordRes.body.data.processedAt);

    // Step 3: Verify Booking paymentStatus transitioned to REFUNDED (pair: CANCELLED / REFUNDED)
    const finalBooking = await Booking.findById(bookingId);
    assert.equal(finalBooking.status, 'CANCELLED');
    assert.equal(finalBooking.paymentStatus, 'REFUNDED');

    // Step 4: Verify ActionLog RECORD_REFUND
    const actionLog = await ActionLog.findOne({
      targetType: 'REFUND',
      targetId: refundCaseId,
      action: 'RECORD_REFUND',
    });
    assert.ok(actionLog);
    assert.equal(actionLog.actorId.toString(), admin._id.toString());
    assert.equal(actionLog.newState.proofReference, 'UNC-VNPAY-20261030-8899');

    // Step 5: Verify Outbox Email queued with REFUND_PROCESSED template
    const refundEmail = await EmailOutbox.findOne({
      eventType: 'REFUND_PROCESSED',
      recipientEmail: customer.email,
    });
    assert.ok(refundEmail);
    assert.equal(refundEmail.templateName, 'refund-processed');
    assert.equal(refundEmail.templateData.proofReference, 'UNC-VNPAY-20261030-8899');
    assert.equal(refundEmail.templateData.refundAmountVnd, 120000);
  });

  await t.test('4. Admin lists and retrieves RefundCase details with filtering and pagination', async () => {
    // Setup a refund case first
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate: targetDate,
        configVersion: 1,
        selectedSlots: [
          { startTime: '18:00', endTime: '18:30' },
          { startTime: '18:30', endTime: '19:00' },
        ],
        contactName: 'Nguyen Van A',
        contactPhone: '0901234567',
        idempotencyKey: `idemp-p12-list-${Date.now()}`,
      });

    const { bookingRequestId, paymentOrder } = bookingRes.body.data;
    const dbBookings = await Booking.find({ bookingRequestId });
    const bookingId = dbBookings[0]._id.toString();

    const ipnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '12000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: '99884455',
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261030130000',
      vnp_OrderInfo: 'Thanh toan don P12 list',
    });
    await request(app).get('/api/v1/payments/vnpay-ipn').query(ipnParams);

    const cancelRes = await request(app)
      .post(`/api/v1/admin/bookings/${bookingId}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Hoàn tiền để kiểm tra danh sách' });

    const refundCaseId = cancelRes.body.data.refundCaseId;

    // Record manual refund so it becomes REFUNDED
    await request(app)
      .post(`/api/v1/admin/refunds/${refundCaseId}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ proofReference: 'UNC-LIST-001' });

    // List all refunds
    const listRes = await request(app)
      .get('/api/v1/admin/refunds')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.success, true);
    assert.ok(Array.isArray(listRes.body.data));
    assert.ok(listRes.body.pagination);
    assert.ok(listRes.body.data.length >= 1);

    // Filter by status=REFUNDED
    const filteredRes = await request(app)
      .get('/api/v1/admin/refunds?status=REFUNDED')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(filteredRes.status, 200);
    for (const item of filteredRes.body.data) {
      assert.equal(item.status, 'REFUNDED');
    }

    // Detail of single case
    const targetCaseId = filteredRes.body.data[0].id;
    const detailRes = await request(app)
      .get(`/api/v1/admin/refunds/${targetCaseId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.success, true);
    assert.equal(detailRes.body.data.id, targetCaseId);
    assert.equal(detailRes.body.data.status, 'REFUNDED');
    assert.ok(detailRes.body.data.refundCaseCode);
  });
});
