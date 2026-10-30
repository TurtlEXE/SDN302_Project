import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { Facility } from '../../src/models/facility.model.js';
import { FacilitySport } from '../../src/models/facility-sport.model.js';
import { Court } from '../../src/models/court.model.js';
import { Sport } from '../../src/models/sport.model.js';
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { PaymentOrder } from '../../src/models/payment-order.model.js';
import { PaymentTransaction } from '../../src/models/payment-transaction.model.js';
import { RefundCase } from '../../src/models/refund-case.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';

test('BE-READY Final Backend Verification & Audit Suite (P14)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: /p14-audit-/ } });
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await RefundCase.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p14-audit-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let adminUser = null;
  let adminToken = null;
  let owner1 = null;
  let owner1Token = null;
  let owner2 = null;
  let owner2Token = null;
  let customer1 = null;
  let customer1Token = null;
  let customer2 = null;
  let customer2Token = null;

  let sport = null;
  let facility1 = null;
  let facility2 = null;
  let court1 = null;
  let court2 = null;

  const todayStr = getCurrentDateVN();

  await t.test('0. Setup audit actors, facilities, courts', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const now = new Date();

    // Admin
    adminUser = await User.create({
      email: `admin-p14-audit-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Viên P14',
      phoneNumber: '0901000001',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sAdmin = await AuthSession.create({
      userId: adminUser._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    adminToken = jwtService.signAccessToken(adminUser, sAdmin).accessToken;

    // Owner 1
    owner1 = await User.create({
      email: `owner1-p14-audit-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 1 P14',
      phoneNumber: '0902000001',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const sOwner1 = await AuthSession.create({
      userId: owner1._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    owner1Token = jwtService.signAccessToken(owner1, sOwner1).accessToken;

    // Owner 2
    owner2 = await User.create({
      email: `owner2-p14-audit-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 2 P14',
      phoneNumber: '0902000002',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const sOwner2 = await AuthSession.create({
      userId: owner2._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    owner2Token = jwtService.signAccessToken(owner2, sOwner2).accessToken;

    // Customer 1
    customer1 = await User.create({
      email: `cust1-p14-audit-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng 1 P14',
      phoneNumber: '0903000001',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sCust1 = await AuthSession.create({
      userId: customer1._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customer1Token = jwtService.signAccessToken(customer1, sCust1).accessToken;

    // Customer 2
    customer2 = await User.create({
      email: `cust2-p14-audit-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng 2 P14',
      phoneNumber: '0903000002',
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

    // Sport
    sport = await Sport.create({
      name: `Cầu Lông P14 ${Date.now()}`,
      normalizedName: `CAU LONG P14 ${Date.now()}`,
      isActive: true,
    });

    // Facility 1 (Owner 1)
    facility1 = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở 1 P14 Audit',
      address: '100 Phố Vận Hành, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902000001',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      images: [{ id: 'img-1', url: 'https://example.com/f1.jpg', isCover: true }],
    });

    const fs1 = await FacilitySport.create({
      facilityId: facility1._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court1 = await Court.create({
      facilityId: facility1._id,
      facilitySportId: fs1._id,
      sportId: sport._id,
      name: 'Sân 1 - Cơ Sở 1',
      pricePerHourVnd: 100000,
      isActive: true,
    });

    // Facility 2 (Owner 2)
    facility2 = await Facility.create({
      ownerId: owner2._id,
      name: 'Cơ Sở 2 P14 Audit',
      address: '200 Phố Kiểm Toán, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902000002',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      images: [{ id: 'img-2', url: 'https://example.com/f2.jpg', isCover: true }],
    });

    const fs2 = await FacilitySport.create({
      facilityId: facility2._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court2 = await Court.create({
      facilityId: facility2._id,
      facilitySportId: fs2._id,
      sportId: sport._id,
      name: 'Sân 1 - Cơ Sở 2',
      pricePerHourVnd: 120000,
      isActive: true,
    });
  });

  await t.test('1. API Envelope & Standard Error Response Consistency', async () => {
    // 401 Unauthorized
    const res401 = await request(app).get('/api/v1/users/me');
    assert.equal(res401.status, 401);
    assert.equal(res401.body.success, false);
    assert.equal(res401.body.error.code, 'UNAUTHORIZED');
    assert.ok(typeof res401.body.error.message === 'string');
    assert.ok(Array.isArray(res401.body.error.details));

    // 403 Forbidden
    const res403 = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customer1Token}`);
    assert.equal(res403.status, 403);
    assert.equal(res403.body.success, false);
    assert.equal(res403.body.error.code, 'FORBIDDEN');
    assert.ok(typeof res403.body.error.message === 'string');

    // 404 Not Found
    const res404 = await request(app).get('/api/v1/non-existent-route-p14');
    assert.equal(res404.status, 404);
    assert.equal(res404.body.success, false);
    assert.equal(res404.body.error.code, 'NOT_FOUND');

    // 400 Validation Error
    const res400 = await request(app)
      .post('/api/v1/auth/register')
      .set('X-CSRF-Guard', '1')
      .set('Origin', env.CLIENT_ORIGIN)
      .send({ email: 'not-an-email', password: '123' });
    assert.equal(res400.status, 400);
    assert.equal(res400.body.success, false);
    assert.equal(res400.body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res400.body.error.details));

    // Success Envelope
    const res200 = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${customer1Token}`);
    assert.equal(res200.status, 200);
    assert.equal(res200.body.success, true);
    assert.ok(res200.body.data);
    assert.equal(res200.body.data.email, customer1.email);
  });

  await t.test('2. Stack Trace Isolation: no internal stack leaked to client (Security)', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await request(app).get('/api/v1/non-existent-route-for-stack-check');
      assert.equal(res.status, 404);
      assert.equal(res.body.error.stack, undefined);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  await t.test('3. Parameter Tampering & Role Injection Resistance (Criterion 1, 24, 52)', async () => {
    // 3.1. Self-registering with role 'ADMIN' or 'OWNER' is ignored and assigned CUSTOMER
    const tamperedEmail = `tampered-role-${Date.now()}@sportbooking.local`;
    const resReg = await request(app)
      .post('/api/v1/auth/register')
      .set('X-CSRF-Guard', '1')
      .set('Origin', env.CLIENT_ORIGIN)
      .send({
        email: tamperedEmail,
        password: 'Password123!',
        fullName: 'Hacker Wants Admin',
        phoneNumber: '0909999999',
        role: 'ADMIN', // Injection attempt
      });

    assert.equal(resReg.status, 201);
    const createdUser = await User.findOne({ email: tamperedEmail });
    assert.ok(createdUser);
    assert.equal(createdUser.role, 'CUSTOMER'); // Must be CUSTOMER!

    // 3.2. Updating profile cannot modify role
    const resPatch = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({ role: 'OWNER', fullName: 'Customer Modified' });

    assert.equal(resPatch.status, 200);
    const refreshedCustomer = await User.findById(customer1._id);
    assert.equal(refreshedCustomer.role, 'CUSTOMER'); // Role remains CUSTOMER!

    // 3.3. Booking calculation is authoritative on server: client cannot inject custom price
    const resBooking = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        courtId: court1._id.toString(),
        bookingDate: todayStr,
        configVersion: 1,
        selectedSlots: [
          { startTime: '19:00', endTime: '19:30' },
          { startTime: '19:30', endTime: '20:00' },
        ],
        contactName: customer1.fullName,
        contactPhone: customer1.phoneNumber,
        idempotencyKey: `IDEMP-TAMPER-${Date.now()}`,
        totalAmountVnd: 1000, // Client tries to pay 1,000 VND instead of 100,000 VND
        totalPriceVnd: 1000,
      });

    assert.equal(resBooking.status, 201);
    const { paymentOrder, bookings } = resBooking.body.data;
    // Server computes authoritative 100.000 VND based on 60 min * 100k/hr
    assert.equal(paymentOrder.amountVnd, 100000);
    assert.equal(bookings[0].totalPriceVnd, 100000);
  });

  await t.test('4. Multi-Tenant Isolation & Cross-Role Guards (Criterion 4, 5)', async () => {
    // 4.1. Owner 1 cannot access Owner 2 facility dashboard (403 FORBIDDEN)
    const resOwnerCross = await request(app)
      .get(`/api/v1/owner/dashboard?facilityId=${facility2._id}`)
      .set('Authorization', `Bearer ${owner1Token}`);
    assert.equal(resOwnerCross.status, 403);
    assert.equal(resOwnerCross.body.error.code, 'FORBIDDEN');

    // 4.2. Owner 1 cannot upload images to Owner 2 facility (403 FORBIDDEN)
    const resImageCross = await request(app)
      .post(`/api/v1/owner/facilities/${facility2._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', Buffer.from('fake image content'), 'test.jpg');
    assert.equal(resImageCross.status, 403);
    assert.equal(resImageCross.body.error.code, 'FORBIDDEN');

    // 4.3. Customer 1 cannot view Customer 2 bookings
    // Create booking for Customer 2
    const brCust2 = await BookingRequest.create({
      requestNumber: `REQ-CUST2-${Date.now()}`,
      customerId: customer2._id,
      createdBy: customer2._id,
      courtId: court2._id,
      facilityId: facility2._id,
      bookingDate: todayStr,
      totalAmountVnd: 120000,
      contactName: customer2.fullName,
      contactPhone: customer2.phoneNumber,
      idempotencyKey: `IDEMP-CUST2-${Date.now()}`,
      payloadFingerprint: `FP-CUST2-${Date.now()}`,
      holdExpiresAt: new Date(Date.now() + 600000),
    });
    const bkCust2 = await Booking.create({
      bookingRequestId: brCust2._id,
      bookingCode: `BK-CUST2-${Date.now()}`,
      customerId: customer2._id,
      facilityId: facility2._id,
      courtId: court2._id,
      bookingDate: todayStr,
      startTime: '14:00',
      endTime: '15:00',
      startMinutes: 840,
      endMinutes: 900,
      durationMinutes: 60,
      pricePerHourVnd: 120000,
      totalPriceVnd: 120000,
      allocatedAmountVnd: 120000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: brCust2.holdExpiresAt,
      contactName: customer2.fullName,
      contactPhone: customer2.phoneNumber,
      snapshot: {
        facilityName: facility2.name,
        facilityAddress: facility2.address,
        courtName: court2.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    const resCustCross = await request(app)
      .get(`/api/v1/bookings/${bkCust2._id}`)
      .set('Authorization', `Bearer ${customer1Token}`);
    assert.equal(resCustCross.status, 403);
    assert.equal(resCustCross.body.error.code, 'FORBIDDEN');
  });

  await t.test('5. Sensitive Data Scrubbing in Audit Logs and DTOs (Criterion 43)', async () => {
    // 5.1. Admin Email Outbox DTO must strictly omit raw templateData secrets
    const fakeToken = `SECRET_TOKEN_${crypto.randomBytes(8).toString('hex')}`;
    const outboxMsg = await EmailOutbox.create({
      eventKey: `EVT_LEAK_CHECK_${Date.now()}`,
      eventType: 'VERIFY_EMAIL',
      recipientEmail: 'p14-audit-leak@sportbooking.local',
      recipientName: 'Check Token Leak',
      subject: 'Xác thực tài khoản',
      templateName: 'verify-email',
      templateData: { token: fakeToken, password: 'PlainTextPassword123' },
      status: 'FAILED',
      retryCount: 1,
      lastError: 'Mock test error',
    });

    const resOutbox = await request(app)
      .get('/api/v1/admin/email-outbox')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resOutbox.status, 200);
    const responseJson = JSON.stringify(resOutbox.body);
    assert.equal(responseJson.includes(fakeToken), false);
    assert.equal(responseJson.includes('PlainTextPassword123'), false);

    // 5.2. ActionLog records must never store plaintext passwords
    const actionLogEntries = await ActionLog.find({}).lean();
    for (const entry of actionLogEntries) {
      const entryStr = JSON.stringify(entry);
      assert.equal(entryStr.includes('PlainTextPassword123'), false);
    }
  });

  await t.test('6. Browser Cookie, SameSite & CSRF Protection (Criteria 58, 62)', async () => {
    // 6.1. Login sets HttpOnly refresh_token cookie with SameSite=Lax and Path=/api/v1/auth
    const resLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-CSRF-Guard', '1')
      .set('Origin', env.CLIENT_ORIGIN)
      .send({ email: customer1.email, password: 'Password123!' });

    assert.equal(resLogin.status, 200);
    const cookies = resLogin.headers['set-cookie'];
    assert.ok(cookies);
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    assert.ok(refreshCookie);
    assert.ok(refreshCookie.includes('HttpOnly'));
    assert.ok(refreshCookie.includes('SameSite=Lax'));
    assert.ok(refreshCookie.includes('Path=/api/v1/auth'));

    // 6.2. Missing X-CSRF-Guard is rejected with 403 CSRF_GUARD_TRIGGERED
    const resNoGuard = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', env.CLIENT_ORIGIN)
      .send({ email: customer1.email, password: 'Password123!' });
    assert.equal(resNoGuard.status, 403);
    assert.equal(resNoGuard.body.error.code, 'CSRF_GUARD_TRIGGERED');

    // 6.3. Untrusted Origin is rejected with 403 CSRF_GUARD_TRIGGERED
    const resBadOrigin = await request(app)
      .post('/api/v1/auth/login')
      .set('X-CSRF-Guard', '1')
      .set('Origin', 'http://malicious-attacker.com')
      .send({ email: customer1.email, password: 'Password123!' });
    assert.equal(resBadOrigin.status, 403);
    assert.equal(resBadOrigin.body.error.code, 'CSRF_GUARD_TRIGGERED');
  });

  await t.test('7. End-to-End VNPay Payment, Idempotency & Clean Lifecycle Commitment', async () => {
    // 7.1. Create clean booking
    const bookingRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customer1Token}`)
      .send({
        courtId: court1._id.toString(),
        bookingDate: todayStr,
        configVersion: 1,
        selectedSlots: [{ startTime: '20:00', endTime: '20:30' }],
        contactName: customer1.fullName,
        contactPhone: customer1.phoneNumber,
        idempotencyKey: `IDEMP-P14-E2E-${Date.now()}`,
      });

    assert.equal(bookingRes.status, 201);
    const { bookingRequestId, paymentOrder } = bookingRes.body.data;

    // Helper to generate signature
    function signParams(params) {
      const fields = {};
      for (const [k, v] of Object.entries(params)) {
        if (k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType' && v != null && v !== '') {
          fields[k] = String(v);
        }
      }
      const sortedKeys = Object.keys(fields).sort();
      const hashParts = sortedKeys.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(fields[k]).replace(/%20/g, '+')}`);
      const signData = hashParts.join('&');
      const hmac = crypto.createHmac('sha512', env.VNPAY_HASH_SECRET);
      const vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
      return { ...fields, vnp_SecureHash };
    }

    const ipnParams = signParams({
      vnp_TmnCode: env.VNPAY_TMN_CODE,
      vnp_TxnRef: paymentOrder.vnpayTxnRef,
      vnp_Amount: '5000000', // 50,000 VND * 100
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: `VNPAY-P14-${Date.now()}`,
      vnp_PayDate: '20261030200000',
    });

    // 7.2. IPN Callback executes without auth/cookie
    const ipnRes = await request(app)
      .get('/api/v1/payments/vnpay-ipn')
      .query(ipnParams);

    assert.equal(ipnRes.status, 200);
    assert.equal(ipnRes.body.RspCode, '00');

    // 7.3. Duplicate IPN callback returns RspCode 02 idempotently without duplicate email
    const dupRes = await request(app)
      .get('/api/v1/payments/vnpay-ipn')
      .query(ipnParams);

    assert.equal(dupRes.status, 200);
    assert.equal(dupRes.body.RspCode, '02');

    // 7.4. Verify exactly 1 confirmation email queued for Customer 1
    const emails = await EmailOutbox.find({ eventKey: `BOOKING_CONFIRMED_${bookingRequestId}` });
    assert.equal(emails.length, 1);
    assert.equal(emails[0].status, 'PENDING');
  });
});
