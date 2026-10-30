import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Admin Email Outbox & Retry API (Integration - P13)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: /p13-outbox-/ } });
    await User.deleteMany({ email: { $regex: /p13-outbox-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({ action: 'RETRY_EMAIL_OUTBOX' });
    await disconnectDB();
  });

  let admin = null;
  let adminToken = null;
  let owner = null;
  let ownerToken = null;
  let customer = null;
  let customerToken = null;

  await t.test('0. Setup users', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const now = new Date();

    admin = await User.create({
      email: `admin-p13-outbox-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Admin Outbox',
      phoneNumber: '0901234567',
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

    owner = await User.create({
      email: `owner-p13-outbox-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Owner Outbox',
      phoneNumber: '0902345678',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const sOwner = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, sOwner).accessToken;

    customer = await User.create({
      email: `cust-p13-outbox-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Customer Outbox',
      phoneNumber: '0903456789',
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
  });

  await t.test('1. Enforces ADMIN-only authorization on email outbox endpoints', async () => {
    // 401 without auth
    const resNoAuth = await request(app).get('/api/v1/admin/email-outbox');
    assert.equal(resNoAuth.status, 401);

    // 403 for OWNER
    const resOwner = await request(app)
      .get('/api/v1/admin/email-outbox')
      .set('Authorization', `Bearer ${ownerToken}`);
    assert.equal(resOwner.status, 403);

    // 403 for CUSTOMER
    const resCust = await request(app)
      .get('/api/v1/admin/email-outbox')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(resCust.status, 403);

    // POST /api/v1/admin/email-outbox/:id/retry 403 for non-admin
    const dummyId = new mongoose.Types.ObjectId();
    const resRetryCust = await request(app)
      .post(`/api/v1/admin/email-outbox/${dummyId}/retry`)
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(resRetryCust.status, 403);
  });

  await t.test('2. GET /api/v1/admin/email-outbox returns paginated entries and filters by status', async () => {
    // Seed 2 outbox entries: 1 FAILED, 1 SENT
    const failedMsg = await EmailOutbox.create({
      eventKey: `EVT_FAIL_${Date.now()}`,
      eventType: 'BOOKING_CONFIRMED',
      recipientEmail: 'p13-outbox-fail@sportbooking.local',
      recipientName: 'Khách Lỗi',
      subject: 'Xác nhận đặt sân (Thử nghiệm)',
      templateName: 'booking-confirmed',
      templateData: { name: 'Khách Lỗi', secretAuthToken: 'VERY_SECRET_RAW_TOKEN' },
      status: 'FAILED',
      retryCount: 3,
      lastError: 'SMTP Connection timeout',
    });

    const sentMsg = await EmailOutbox.create({
      eventKey: `EVT_SENT_${Date.now()}`,
      eventType: 'BOOKING_CONFIRMED',
      recipientEmail: 'p13-outbox-sent@sportbooking.local',
      recipientName: 'Khách Đã Gửi',
      subject: 'Xác nhận đặt sân thành công',
      templateName: 'booking-confirmed',
      templateData: { name: 'Khách Đã Gửi' },
      status: 'SENT',
      retryCount: 0,
      sentAt: new Date(),
    });

    // Query status = FAILED
    const resFailed = await request(app)
      .get('/api/v1/admin/email-outbox?status=FAILED')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resFailed.status, 200);
    assert.equal(resFailed.body.success, true);
    assert.ok(Array.isArray(resFailed.body.data));
    assert.ok(resFailed.body.pagination);
    const foundFailed = resFailed.body.data.find((m) => m.id === failedMsg._id.toString());
    assert.ok(foundFailed);
    assert.equal(foundFailed.status, 'FAILED');
    assert.equal(foundFailed.retryCount, 3);
    assert.equal(foundFailed.lastError, 'SMTP Connection timeout');

    // Criterion 43: nhật ký quản trị không lộ token xác thực/mật khẩu
    assert.equal(foundFailed.templateData, undefined);
    assert.equal(JSON.stringify(foundFailed).includes('VERY_SECRET_RAW_TOKEN'), false);
  });

  await t.test('3. POST /api/v1/admin/email-outbox/:id/retry: rejects resending email with expired link (ADM-07)', async () => {
    // Seed an email with expired token in templateData
    const expiredMsg = await EmailOutbox.create({
      eventKey: `EVT_EXP_${Date.now()}`,
      eventType: 'VERIFY_EMAIL',
      recipientEmail: 'p13-outbox-expired@sportbooking.local',
      recipientName: 'Khách Hết Hạn Token',
      subject: 'Xác thực tài khoản',
      templateName: 'verify-email',
      templateData: {
        name: 'Khách Hết Hạn',
        expiresAt: new Date(Date.now() - 3600000), // Expired 1 hour ago
      },
      status: 'FAILED',
      retryCount: 3,
      lastError: 'Permanent rejection',
    });

    const res = await request(app)
      .post(`/api/v1/admin/email-outbox/${expiredMsg._id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.match(res.body.error.message, /Liên kết trong email đã hết hạn/);
  });

  await t.test('4. POST /api/v1/admin/email-outbox/:id/retry: successfully resets status and records ActionLog', async () => {
    // Seed a failed email with unexpired link (or no expiration)
    const validFailedMsg = await EmailOutbox.create({
      eventKey: `EVT_RETRY_VALID_${Date.now()}`,
      eventType: 'BOOKING_CONFIRMED',
      recipientEmail: 'p13-outbox-retry-ok@sportbooking.local',
      recipientName: 'Khách Thử Lại',
      subject: '[SportBooking] Xác nhận đặt sân thành công',
      templateName: 'booking-confirmed',
      templateData: {
        name: 'Khách Thử Lại',
        requestNumber: 'REQ-RETRY-OK',
        totalAmountVnd: 100000,
        bookingDate: '2026-10-30',
        facilityName: 'Cơ Sở Test',
        courtName: 'Sân 1',
        bookings: [],
      },
      status: 'FAILED',
      retryCount: 3,
      lastError: 'Connection refused',
    });

    const res = await request(app)
      .post(`/api/v1/admin/email-outbox/${validFailedMsg._id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify ActionLog recorded
    const actionLog = await ActionLog.findOne({
      targetType: 'EMAIL_OUTBOX',
      targetId: validFailedMsg._id,
      action: 'RETRY_EMAIL_OUTBOX',
    });
    assert.ok(actionLog);
    assert.equal(actionLog.actorRole, 'ADMIN');
    assert.equal(actionLog.actorId.toString(), admin._id.toString());
  });
});
