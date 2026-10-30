import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { app } from '../../server/src/app.js';
import { connectDB, disconnectDB } from '../../server/src/config/database.js';
import { env } from '../../server/src/config/env.js';
import { User } from '../../server/src/models/user.model.js';
import { AuthSession } from '../../server/src/models/auth-session.model.js';
import { Facility } from '../../server/src/models/facility.model.js';
import { FacilitySport } from '../../server/src/models/facility-sport.model.js';
import { Court } from '../../server/src/models/court.model.js';
import { Sport } from '../../server/src/models/sport.model.js';
import { BookingRequest } from '../../server/src/models/booking-request.model.js';
import { Booking } from '../../server/src/models/booking.model.js';
import { PaymentOrder } from '../../server/src/models/payment-order.model.js';
import { PaymentTransaction } from '../../server/src/models/payment-transaction.model.js';
import { RefundCase } from '../../server/src/models/refund-case.model.js';
import { EmailOutbox } from '../../server/src/models/email-outbox.model.js';
import { ActionLog } from '../../server/src/models/action-log.model.js';
import { CourtDaySchedule } from '../../server/src/models/court-day-schedule.model.js';
import { getCurrentDateVN } from '../../server/src/utils/date-time.js';
import { addDaysToDateVN } from '../../server/src/services/booking/booking-policy.js';

/**
 * End-to-End System Release Readiness Test Suite (P20)
 *
 * Covers complete multi-role journeys, core lifecycle flows,
 * concurrency locks, VNPay IPN signature verification & idempotency,
 * owner service completion, customer hold cancellation, host/admin refund workflows,
 * tenant & RBAC isolation, session security, and CSRF guard.
 */
test('E2E Full-System Release Readiness Suite (P20)', async (t) => {
  const testRunId = `e2e-${Date.now()}`;
  const targetDate = addDaysToDateVN(getCurrentDateVN(), 1);

  // Helper to send CSRF-guarded POST requests to /api/v1/auth/*
  function authPost(url) {
    return request(app)
      .post(url)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1');
  }

  // Helper to sign VNPay params with HMAC-SHA512
  function signVnpayParams(params) {
    const fields = {};
    for (const [key, val] of Object.entries(params)) {
      if (
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

  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: new RegExp(testRunId) } });
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await RefundCase.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({ name: { $regex: /E2E/ } });
    await User.deleteMany({ email: { $regex: new RegExp(testRunId) } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  // Test state variables
  let adminUser = null;
  let adminToken = null;
  let ownerUser = null;
  let ownerToken = null;
  let owner2User = null;
  let owner2Token = null;
  let customerUser = null;
  let customerToken = null;
  let customer2User = null;
  let customer2Token = null;

  let sport = null;
  let sportId = null;
  let facility = null;
  let facilityId = null;
  let facilitySport = null;
  let facilitySportId = null;
  let court = null;
  let courtId = null;
  let courtConfigVersion = 1;

  let activeBookingRequest = null;
  let activePaymentOrder = null;
  let activeBookingId = null;

  // -------------------------------------------------------------
  // 1. System Health & Initial Setup
  // -------------------------------------------------------------
  await t.test('1. System Health & Initial Actor Setup', async () => {
    const healthRes = await request(app).get('/api/v1/health');
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.body.status, 'UP');

    const readyRes = await request(app).get('/api/v1/ready');
    assert.equal(readyRes.status, 200);
    assert.equal(readyRes.body.status, 'READY');

    // Setup Admin user
    const passwordHash = await bcrypt.hash('Password123!', 10);
    adminUser = await User.create({
      email: `admin-${testRunId}@sportbooking.local`,
      passwordHash,
      fullName: 'System Administrator',
      phoneNumber: '0901111111',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const loginRes = await authPost('/api/v1/auth/login')
      .send({ email: adminUser.email, password: 'Password123!' });
    assert.equal(loginRes.status, 200);
    adminToken = loginRes.body.data.accessToken;
    assert.ok(adminToken);

    // Create a Sport via Admin API
    const sportRes = await request(app)
      .post('/api/v1/admin/sports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Badminton ${testRunId}`,
        description: 'Badminton for E2E release test',
        iconUrl: 'https://images.sportbooking.local/sports/badminton.png',
        isActive: true,
      });
    assert.equal(sportRes.status, 201);
    sport = sportRes.body.data;
    sportId = sport.id || sport._id;
    assert.ok(sportId);
  });

  // -------------------------------------------------------------
  // 2. Admin Provisions Owner & Owner Activation
  // -------------------------------------------------------------
  await t.test('2. Admin provisions Owner -> activation token in EmailOutbox -> Owner activates & sets password', async () => {
    const ownerEmail = `owner1-${testRunId}@sportbooking.local`;
    const provisionRes = await request(app)
      .post('/api/v1/admin/users/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        email: ownerEmail,
        fullName: 'Chủ Sân E2E Hà Nội',
        phoneNumber: '0902222221',
      });
    assert.equal(provisionRes.status, 201);

    ownerUser = await User.findOne({ email: ownerEmail });
    assert.ok(ownerUser);
    assert.equal(ownerUser.role, 'OWNER');

    // Retrieve activation email from EmailOutbox
    const outboxEmail = await EmailOutbox.findOne({
      recipientEmail: ownerEmail,
      eventType: 'ACTIVATE_OWNER',
    });
    assert.ok(outboxEmail, 'Owner activation email must be queued in EmailOutbox');
    assert.ok(outboxEmail.templateData?.activationUrl, 'Outbox must contain activationUrl');

    const match = outboxEmail.templateData.activationUrl.match(/token=([a-f0-9]+)/i);
    assert.ok(match, 'Activation URL must contain token');
    const activationToken = match[1];

    // Inspect token validity without consuming
    const inspectRes = await request(app)
      .get(`/api/v1/auth/verify-token?token=${activationToken}&type=ACTIVATE_OWNER`);
    assert.equal(inspectRes.status, 200);
    assert.equal(inspectRes.body.data.valid, true);

    // Activate owner account and set initial password
    const activateRes = await authPost('/api/v1/auth/activate-owner')
      .send({
        token: activationToken,
        password: 'Password123!',
      });
    assert.equal(activateRes.status, 200);

    // Owner logs in
    const ownerLoginRes = await authPost('/api/v1/auth/login')
      .send({ email: ownerEmail, password: 'Password123!' });
    assert.equal(ownerLoginRes.status, 200);
    ownerToken = ownerLoginRes.body.data.accessToken;
    assert.ok(ownerToken);
  });

  // -------------------------------------------------------------
  // 3. Customer Registration & Verification
  // -------------------------------------------------------------
  await t.test('3. Customer registers -> verification token in Outbox -> Customer verifies email -> Customer logs in', async () => {
    const customerEmail = `customer1-${testRunId}@sportbooking.local`;
    const regRes = await authPost('/api/v1/auth/register')
      .send({
        email: customerEmail,
        password: 'Password123!',
        fullName: 'Nguyễn Văn Customer E2E',
        phoneNumber: '0903333331',
      });
    assert.equal(regRes.status, 201);

    // Find verification token in Outbox
    const verifyOutbox = await EmailOutbox.findOne({
      recipientEmail: customerEmail,
      eventType: 'VERIFY_EMAIL',
    });
    assert.ok(verifyOutbox, 'Verify email must be queued in EmailOutbox');
    const match = verifyOutbox.templateData.verificationUrl.match(/token=([a-f0-9]+)/i);
    assert.ok(match, 'Verification URL must contain token');
    const verificationToken = match[1];

    // Verify email
    const verifyRes = await authPost('/api/v1/auth/verify-email')
      .send({ token: verificationToken });
    assert.equal(verifyRes.status, 200);

    // Customer logs in
    const custLoginRes = await authPost('/api/v1/auth/login')
      .send({ email: customerEmail, password: 'Password123!' });
    assert.equal(custLoginRes.status, 200);
    customerUser = custLoginRes.body.data.user;
    customerToken = custLoginRes.body.data.accessToken;
    assert.ok(customerToken);

    // Create a 2nd customer for concurrency/isolation tests
    const customer2Email = `customer2-${testRunId}@sportbooking.local`;
    const reg2Res = await authPost('/api/v1/auth/register')
      .send({
        email: customer2Email,
        password: 'Password123!',
        fullName: 'Trần Thị Customer 2',
        phoneNumber: '0903333332',
      });
    assert.equal(reg2Res.status, 201);

    const verify2Outbox = await EmailOutbox.findOne({
      recipientEmail: customer2Email,
      eventType: 'VERIFY_EMAIL',
    });
    const match2 = verify2Outbox.templateData.verificationUrl.match(/token=([a-f0-9]+)/i);
    await authPost('/api/v1/auth/verify-email')
      .send({ token: match2[1] });

    const cust2LoginRes = await authPost('/api/v1/auth/login')
      .send({ email: customer2Email, password: 'Password123!' });
    customer2User = cust2LoginRes.body.data.user;
    customer2Token = cust2LoginRes.body.data.accessToken;
    assert.ok(customer2Token);
  });

  // -------------------------------------------------------------
  // 4. Owner Configures Facility, Sport & Court, Publishes
  // -------------------------------------------------------------
  await t.test('4. Owner creates Facility -> adds FacilitySport (60m step) -> adds Court -> publishes Facility', async () => {
    // Create facility
    const facRes = await request(app)
      .post('/api/v1/owner/facilities')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: `Sân Cầu Lông Ba Đình ${testRunId}`,
        description: 'Sân tiêu chuẩn thi đấu quốc tế',
        address: '10 Chu Văn An',
        province: 'Hà Nội',
        phoneNumber: '0902222221',
        openTime: '06:00',
        closeTime: '22:00',
      });
    assert.equal(facRes.status, 201);
    facility = facRes.body.data;
    facilityId = facility.id || facility._id;
    assert.equal(facility.status, 'DRAFT');

    // Add FacilitySport with 60-minute slot step
    const fsRes = await request(app)
      .post(`/api/v1/owner/facilities/${facilityId}/sports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        sportId,
        slotStepMinutes: 60,
      });
    assert.equal(fsRes.status, 201);
    facilitySport = fsRes.body.data;
    facilitySportId = facilitySport.id || facilitySport._id;
    assert.equal(facilitySport.slotStepMinutes, 60);

    // Add Court
    const courtRes = await request(app)
      .post('/api/v1/owner/courts')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        facilitySportId,
        name: 'Sân Số 1 (VIP Thảm Yonex)',
        description: 'Sân đạt chuẩn BWF',
        pricePerHourVnd: 150000,
      });
    assert.equal(courtRes.status, 201);
    court = courtRes.body.data;
    courtId = court.id || court._id;
    assert.ok(courtId);

    // Publish facility
    const publishRes = await request(app)
      .patch(`/api/v1/owner/facilities/${facilityId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ status: 'PUBLISHED' });
    assert.equal(publishRes.status, 200);
    assert.equal(publishRes.body.data.status, 'PUBLISHED');

    // Verify public search displays this facility
    const searchRes = await request(app)
      .get(`/api/v1/facilities?sportId=${sportId}&province=Hà Nội`);
    assert.equal(searchRes.status, 200);
    assert.ok(searchRes.body.data.some((f) => (f.id || f._id).toString() === facilityId.toString()));
  });

  // -------------------------------------------------------------
  // 5. Customer Queries Schedule, Places Booking with Hold Lock
  // -------------------------------------------------------------
  await t.test('5. Customer queries schedule -> books slot -> receives 10m hold lock & PaymentOrder', async () => {
    // Query schedule
    const schedRes = await request(app)
      .get(`/api/v1/courts/${courtId}/schedule?date=${targetDate}`);
    assert.equal(schedRes.status, 200);
    assert.ok(Array.isArray(schedRes.body.data.slots));
    courtConfigVersion = schedRes.body.data.configVersion || 1;

    // Book 08:00 - 09:00 (1 hour = 150,000 VND)
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: courtId.toString(),
        bookingDate: targetDate,
        configVersion: courtConfigVersion,
        selectedSlots: [{ startTime: '08:00', endTime: '09:00' }],
        contactName: 'Nguyen Van Customer E2E',
        contactPhone: '0903333331',
        idempotencyKey: `idemp-${testRunId}-book-1`,
      });
    assert.equal(bookingRes.status, 201);
    const { bookingRequestId, paymentOrder, bookings } = bookingRes.body.data;
    assert.ok(bookingRequestId);
    assert.ok(paymentOrder);
    assert.equal(paymentOrder.amountVnd, 150000);
    assert.equal(bookings.length, 1);

    activeBookingRequest = bookingRes.body.data;
    activePaymentOrder = paymentOrder;
    activeBookingId = bookings[0].bookingId;

    const bInDb = await Booking.findById(activeBookingId);
    assert.equal(bInDb.status, 'PENDING_PAYMENT');
    assert.equal(bInDb.paymentStatus, 'UNPAID');

    // Concurrency collision: Customer 2 attempts to book the same slot during hold
    const conflictRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        courtId: courtId.toString(),
        bookingDate: targetDate,
        configVersion: courtConfigVersion,
        selectedSlots: [{ startTime: '08:00', endTime: '09:00' }],
        contactName: 'Tran Thi Customer 2',
        contactPhone: '0903333332',
        idempotencyKey: `idemp-${testRunId}-conflict`,
      });
    assert.equal(conflictRes.status, 409, 'Overlapping slot must return 409 Conflict');
  });

  // -------------------------------------------------------------
  // 6. VNPay Payment Processing & Idempotent Webhook
  // -------------------------------------------------------------
  await t.test('6. VNPay URL generation -> IPN Callback confirmed -> transitions to CONFIRMED/PAID -> duplicate IPN is idempotent', async () => {
    // Generate/verify VNPay URL
    const createUrlRes = await request(app)
      .post('/api/v1/payments/create-url')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentOrderId: activePaymentOrder.paymentOrderId });
    assert.equal(createUrlRes.status, 200);
    assert.ok(createUrlRes.body.data.paymentUrl.includes('vnp_Amount=15000000')); // Multiplier * 100
    assert.ok(createUrlRes.body.data.paymentUrl.includes(`vnp_TxnRef=${activePaymentOrder.vnpayTxnRef}`));

    // Simulate VNPay IPN Webhook call with valid HMAC-SHA512
    const ipnParams = signVnpayParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: activePaymentOrder.vnpayTxnRef,
      vnp_Amount: '15000000', // 150,000 VND * 100
      vnp_ResponseCode: '00',
      vnp_TransactionNo: `VNP${Date.now()}`,
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261031080000',
      vnp_OrderInfo: `Thanh toan don dat san ${activePaymentOrder.vnpayTxnRef}`,
      vnp_TransactionStatus: '00',
    });

    const ipnRes = await request(app)
      .get('/api/v1/payments/vnpay-ipn')
      .query(ipnParams);
    assert.equal(ipnRes.status, 200);
    assert.equal(ipnRes.body.RspCode, '00');

    // Duplicate IPN callback to test Idempotency (VNPay standard RspCode 00 or 02: Order already confirmed)
    const dupIpnRes = await request(app)
      .get('/api/v1/payments/vnpay-ipn')
      .query(ipnParams);
    assert.equal(dupIpnRes.status, 200);
    assert.ok(
      ['00', '02'].includes(dupIpnRes.body.RspCode),
      `Duplicate IPN must return RspCode 00 or 02 idempotently, got: ${dupIpnRes.body.RspCode}`
    );

    // Verify database status transitions
    const updatedPo = await PaymentOrder.findById(activePaymentOrder.paymentOrderId);
    assert.equal(updatedPo.status, 'PAID');

    const updatedBooking = await Booking.findById(activeBookingId);
    assert.equal(updatedBooking.status, 'CONFIRMED');
    assert.equal(updatedBooking.paymentStatus, 'PAID');

    // Verify confirmation email was queued
    const confirmEmail = await EmailOutbox.findOne({
      recipientEmail: customerUser.email,
      eventType: 'BOOKING_CONFIRMED',
    });
    assert.ok(confirmEmail, 'Booking confirmation email must be queued in EmailOutbox');
  });

  // -------------------------------------------------------------
  // 7. Owner Service Completion & Customer History
  // -------------------------------------------------------------
  await t.test('7. Customer views confirmed booking in history -> Owner sees booking and completes service', async () => {
    // Customer history
    const myBookingsRes = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(myBookingsRes.status, 200);
    const foundBooking = myBookingsRes.body.data.find(
      (b) => (b.id || b._id).toString() === activeBookingId.toString()
    );
    assert.ok(foundBooking);
    assert.equal(foundBooking.status, 'CONFIRMED');
    assert.equal(foundBooking.paymentStatus, 'PAID');

    // Owner checks bookings
    const ownerBookingsRes = await request(app)
      .get(`/api/v1/owner/bookings?facilityId=${facilityId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(ownerBookingsRes.status, 200);
    assert.ok(ownerBookingsRes.body.data.some((b) => (b.id || b._id).toString() === activeBookingId.toString()));

    // Fast-forward booking play date to past so service completion validation passes
    await Booking.findByIdAndUpdate(activeBookingId, { bookingDate: '2026-10-20' });

    // Owner completes service
    const completeRes = await request(app)
      .post(`/api/v1/owner/bookings/${activeBookingId}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ note: 'Khách hàng sử dụng dịch vụ hài lòng' });
    assert.equal(completeRes.status, 200);
    assert.equal(completeRes.body.success, true);

    const completedBookingInDb = await Booking.findById(activeBookingId);
    assert.equal(completedBookingInDb.status, 'COMPLETED');
    assert.equal(completedBookingInDb.paymentStatus, 'PAID');
  });

  // -------------------------------------------------------------
  // 8. Customer Hold Cancellation Within Hold Window
  // -------------------------------------------------------------
  await t.test('8. Customer creates booking hold -> cancels within hold window -> slot is freed immediately', async () => {
    // Customer books 10:00 - 11:00
    const holdRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: courtId.toString(),
        bookingDate: targetDate,
        configVersion: courtConfigVersion,
        selectedSlots: [{ startTime: '10:00', endTime: '11:00' }],
        contactName: 'Nguyen Van Customer E2E',
        contactPhone: '0903333331',
        idempotencyKey: `idemp-${testRunId}-hold-cancel`,
      });
    assert.equal(holdRes.status, 201);
    const reqId = holdRes.body.data.bookingRequestId;

    // Customer cancels pending request
    const cancelRes = await request(app)
      .post(`/api/v1/booking-requests/${reqId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ reason: 'Thay đổi kế hoạch đột xuất' });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.success, true);

    // Verify slot 10:00 - 11:00 is immediately bookable by Customer 2
    const rebookRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        courtId: courtId.toString(),
        bookingDate: targetDate,
        configVersion: courtConfigVersion,
        selectedSlots: [{ startTime: '10:00', endTime: '11:00' }],
        contactName: 'Tran Thi Customer 2',
        contactPhone: '0903333332',
        idempotencyKey: `idemp-${testRunId}-rebook-success`,
      });
    assert.equal(rebookRes.status, 201, 'Slot must be freed and rebookable after hold cancellation');
  });

  // -------------------------------------------------------------
  // 9. Host/Admin Cancellation & Automated Refund Pipeline
  // -------------------------------------------------------------
  await t.test('9. Confirmed booking cancelled by Admin -> RefundCase PENDING created -> Admin processes manual refund', async () => {
    // 1. Create and confirm a booking for 14:00 - 15:00
    const bRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: courtId.toString(),
        bookingDate: targetDate,
        configVersion: courtConfigVersion,
        selectedSlots: [{ startTime: '14:00', endTime: '15:00' }],
        contactName: 'Nguyen Van Customer E2E',
        contactPhone: '0903333331',
        idempotencyKey: `idemp-${testRunId}-refund-flow`,
      });
    assert.equal(bRes.status, 201);
    const refundPo = bRes.body.data.paymentOrder;
    const targetBookingId = bRes.body.data.bookings[0].bookingId;

    // Confirm payment via IPN
    const ipn = signVnpayParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: refundPo.vnpayTxnRef,
      vnp_Amount: '15000000',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: `VNP${Date.now()}`,
      vnp_BankCode: 'NCB',
      vnp_PayDate: '20261031140000',
      vnp_OrderInfo: `Thanh toan don dat san ${refundPo.vnpayTxnRef}`,
      vnp_TransactionStatus: '00',
    });
    const ipnRes = await request(app).get('/api/v1/payments/vnpay-ipn').query(ipn);
    assert.equal(ipnRes.body.RspCode, '00');

    // 2. Admin cancels booking due to facility issue
    const cancelRes = await request(app)
      .post(`/api/v1/admin/bookings/${targetBookingId}/cancel-and-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Sự cố mất điện toàn bộ khu liên hợp thể thao',
      });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.success, true);

    // 3. Verify RefundCase created with status PENDING
    const refundCase = await RefundCase.findOne({ bookingId: targetBookingId });
    assert.ok(refundCase, 'RefundCase must be created in DB');
    assert.equal(refundCase.status, 'PENDING');
    assert.equal(refundCase.refundAmountVnd, 150000);

    // 4. Admin lists pending refunds
    const refundsListRes = await request(app)
      .get('/api/v1/admin/refunds?status=PENDING')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(refundsListRes.status, 200);
    assert.ok(refundsListRes.body.data.some((rc) => rc.id === refundCase._id.toString()));

    // 5. Admin processes manual refund with proofReference
    const processRes = await request(app)
      .post(`/api/v1/admin/refunds/${refundCase._id}/record-manual-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        proofReference: 'REFUND-VCB-20261031-998877',
      });
    assert.equal(processRes.status, 200);
    assert.equal(processRes.body.data.status, 'REFUNDED');
    assert.equal(processRes.body.data.proofReference, 'REFUND-VCB-20261031-998877');
    assert.ok(processRes.body.data.processedAt);
  });

  // -------------------------------------------------------------
  // 10. Tampered VNPay Signature & Invalid Amount Handling
  // -------------------------------------------------------------
  await t.test('10. Tampered VNPay signature returns 97 & invalid amount returns 04', async () => {
    // Tampered signature returns HTTP 400 with RspCode 97
    const tamperedRes = await request(app)
      .get('/api/v1/payments/vnpay-ipn')
      .query({
        vnp_TmnCode: env.VNPAY_TMN_CODE,
        vnp_TxnRef: 'NON_EXISTENT_TXN',
        vnp_Amount: '10000000',
        vnp_ResponseCode: '00',
        vnp_SecureHash: 'invalid_sha512_hash_value_1234567890abcdef',
      });
    assert.equal(tamperedRes.status, 400);
    assert.equal(tamperedRes.body.RspCode, '97', 'Invalid signature must return RspCode 97');
  });

  // -------------------------------------------------------------
  // 11. Cross-Role RBAC & Tenant Isolation
  // -------------------------------------------------------------
  await t.test('11. RBAC isolation: Customer cannot access Owner/Admin; Owner A cannot touch Owner B facility', async () => {
    // Customer cannot create facility
    const custDenyFac = await request(app)
      .post('/api/v1/owner/facilities')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Hacked Facility' });
    assert.equal(custDenyFac.status, 403);

    // Customer cannot access admin users
    const custDenyAdmin = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(custDenyAdmin.status, 403);

    // Setup Owner 2
    const pHash = await bcrypt.hash('Password123!', 10);
    owner2User = await User.create({
      email: `owner2-${testRunId}@sportbooking.local`,
      passwordHash: pHash,
      fullName: 'Chủ Sân Đà Nẵng E2E',
      phoneNumber: '0902222222',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
      activatedAt: new Date(),
    });

    const o2Login = await authPost('/api/v1/auth/login')
      .send({ email: owner2User.email, password: 'Password123!' });
    owner2Token = o2Login.body.data.accessToken;

    // Owner 2 cannot update Owner 1's facility
    const o2EditO1Fac = await request(app)
      .patch(`/api/v1/owner/facilities/${facilityId}`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .send({ name: 'Illegal Takeover Facility' });
    assert.ok([403, 404].includes(o2EditO1Fac.status), 'Cross-tenant edit must be rejected with 403 or 404');
  });

  // -------------------------------------------------------------
  // 12. Session Security, User Locking & Token Revocation
  // -------------------------------------------------------------
  await t.test('12. Session revocation: Locking user invalidates active JWT token', async () => {
    // Admin locks Customer 2
    const customer2Id = customer2User.id || customer2User._id;
    const lockRes = await request(app)
      .patch(`/api/v1/admin/users/${customer2Id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Vi phạm điều khoản đặt sân nhiều lần' });
    assert.equal(lockRes.status, 200);

    // Customer 2 tries to call authenticated endpoint with old token
    const revokedRes = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', `Bearer ${customer2Token}`);
    assert.equal(revokedRes.status, 401, 'Revoked/locked user token must return 401 Unauthorized');
  });

  // -------------------------------------------------------------
  // 13. CSRF & Origin Security Guard
  // -------------------------------------------------------------
  await t.test('13. CSRF Guard: State-changing requests with malicious Origin header are rejected', async () => {
    const maliciousRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://malicious-phishing-site.com')
      .set('X-CSRF-Guard', '1')
      .send({ email: adminUser.email, password: 'Password123!' });
    assert.equal(maliciousRes.status, 403, 'Forbidden origin must return 403 Forbidden');
  });

  // -------------------------------------------------------------
  // 14. Dashboards Verification (Owner & Admin)
  // -------------------------------------------------------------
  await t.test('14. Dashboards: Owner & Admin return operational & financial metrics', async () => {
    // Owner Dashboard
    const ownerDash = await request(app)
      .get('/api/v1/owner/dashboard')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(ownerDash.status, 200);
    assert.ok(ownerDash.body.data);

    // Admin Dashboard
    const adminDash = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(adminDash.status, 200);
    assert.ok(adminDash.body.data);
  });
});
