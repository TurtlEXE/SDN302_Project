import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { RefreshToken } from '../../src/models/refresh-token.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Admin Users Management API & Account Lockout Lifecycle (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await User.deleteMany({ email: { $regex: /p06-adm-/ } });
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: /p06-adm-/ } });
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let adminToken = null;
  let adminUser = null;
  let customerUser = null;
  let customerToken = null;
  let customerSession = null;
  let ownerUser = null;

  t.beforeEach(async () => {
    await User.deleteMany({ email: { $regex: /p06-adm-/ } });
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: /p06-adm-/ } });
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});
    await ActionLog.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    // 1. Seed admin
    adminUser = await User.create({
      email: `admin-p06-adm-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Hệ Thống',
      phoneNumber: '0901111111',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const adminSession = await AuthSession.create({
      userId: adminUser._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    adminToken = jwtService.signAccessToken(adminUser, adminSession).accessToken;

    // 2. Seed customer
    customerUser = await User.create({
      email: `customer-p06-adm-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Nguyễn Văn Khách',
      phoneNumber: '0902222222',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    customerSession = await AuthSession.create({
      userId: customerUser._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customerUser, customerSession).accessToken;

    // 3. Seed owner
    ownerUser = await User.create({
      email: `owner-p06-adm-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Trần Văn Chủ Sân',
      phoneNumber: '0903333333',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
  });

  await t.test('GET /api/v1/admin/users should return paginated list with search and filter capabilities', async () => {
    // 1. Unfiltered list
    const res = await request(app)
      .get('/api/v1/admin/users?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items));
    assert.ok(res.body.data.items.length >= 3);
    assert.ok(res.body.data.pagination.total >= 3);

    // 2. Filter by role=CUSTOMER
    const resRole = await request(app)
      .get('/api/v1/admin/users?role=CUSTOMER')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resRole.status, 200);
    const customersOnly = resRole.body.data.items;
    assert.ok(customersOnly.length >= 1);
    assert.ok(customersOnly.every((u) => u.role === 'CUSTOMER'));

    // 3. Search by fullName
    const resSearch = await request(app)
      .get('/api/v1/admin/users?search=Chủ Sân')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resSearch.status, 200);
    assert.ok(resSearch.body.data.items.length >= 1);
    assert.ok(resSearch.body.data.items.some((u) => u.fullName.includes('Chủ Sân')));
  });

  await t.test('GET /api/v1/admin/users/:id should return user details and 404 for unknown user', async () => {
    const res = await request(app)
      .get(`/api/v1/admin/users/${customerUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.id, customerUser._id.toString());
    assert.equal(res.body.data.email, customerUser.email);
    assert.equal(res.body.data.role, 'CUSTOMER');

    // Unknown ID
    const res404 = await request(app)
      .get('/api/v1/admin/users/600000000000000000000000')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res404.status, 404);
  });

  await t.test('PATCH /api/v1/admin/users/:id should update fullName/phoneNumber and strictly ignore extra inputs', async () => {
    const maliciousPayload = {
      fullName: 'Nguyễn Văn Đã Đổi Tên',
      phoneNumber: '0909999999',
      role: 'ADMIN', // Extra field - must NOT alter role!
      email: 'hacker@sportbooking.local', // Extra field - must NOT alter email!
      isLocked: true, // Extra field - must NOT alter isLocked!
      tokenVersion: 99, // Extra field - must NOT alter tokenVersion!
    };

    const res = await request(app)
      .patch(`/api/v1/admin/users/${customerUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(maliciousPayload);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.fullName, 'Nguyễn Văn Đã Đổi Tên');
    assert.equal(res.body.data.phoneNumber, '0909999999');

    // Verify in database: role, email, isLocked remain completely unchanged
    const dbUser = await User.findById(customerUser._id);
    assert.equal(dbUser.fullName, 'Nguyễn Văn Đã Đổi Tên');
    assert.equal(dbUser.phoneNumber, '0909999999');
    assert.equal(dbUser.role, 'CUSTOMER'); // Preserved!
    assert.equal(dbUser.email, customerUser.email); // Preserved!
    assert.equal(dbUser.isLocked, false); // Preserved!
    assert.equal(dbUser.tokenVersion, 0); // Preserved!
  });

  await t.test('PATCH /api/v1/admin/users/:id/lock should lock user, revoke sessions, record ActionLog and queue email', async () => {
    // 1. Missing reason rejected
    const resMissingReason = await request(app)
      .patch(`/api/v1/admin/users/${customerUser._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: '' });

    assert.equal(resMissingReason.status, 400);

    // 2. Cannot lock ADMIN account
    const resLockAdmin = await request(app)
      .patch(`/api/v1/admin/users/${adminUser._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Try to lock admin' });

    assert.equal(resLockAdmin.status, 400);

    // 3. Valid lock
    const resLock = await request(app)
      .patch(`/api/v1/admin/users/${customerUser._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Vi phạm quy định đặt sân' });

    assert.equal(resLock.status, 200);
    assert.equal(resLock.body.success, true);

    // 4. Verify DB changes
    const lockedUser = await User.findById(customerUser._id);
    assert.equal(lockedUser.isLocked, true);
    assert.equal(lockedUser.lockReason, 'Vi phạm quy định đặt sân');
    assert.equal(lockedUser.tokenVersion, 1);

    // 5. Verify sessions revoked
    const revokedSession = await AuthSession.findById(customerSession._id);
    assert.ok(revokedSession.revokedAt);
    assert.equal(revokedSession.revokedReason, 'REVOKED_LOCK');

    // 6. Verify ActionLog recorded
    const actionLog = await ActionLog.findOne({
      targetId: customerUser._id,
      action: 'LOCK_USER',
    });
    assert.ok(actionLog);
    assert.equal(actionLog.actorRole, 'ADMIN');
    assert.equal(actionLog.reason, 'Vi phạm quy định đặt sân');

    // 7. Verify email outbox entry
    const emailEntry = await EmailOutbox.findOne({
      recipientEmail: customerUser.email,
      eventType: 'ACCOUNT_LOCKED',
    });
    assert.ok(emailEntry);
    assert.equal(emailEntry.templateName, 'ACCOUNT_LOCKED');

    // 8. Attempting to use old customer token should be rejected (401 SESSION_REVOKED)
    const resMe = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${customerToken}`);

    assert.equal(resMe.status, 401);
  });

  await t.test('PATCH /api/v1/admin/users/:id/unlock should unlock user, record ActionLog, queue email but NOT restore prior sessions', async () => {
    // Lock user first
    await request(app)
      .patch(`/api/v1/admin/users/${customerUser._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Locking before unlock test' });

    // Unlock user
    const resUnlock = await request(app)
      .patch(`/api/v1/admin/users/${customerUser._id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Đã giải quyết khiếu nại' });

    assert.equal(resUnlock.status, 200);

    // Verify DB
    const unlockedUser = await User.findById(customerUser._id);
    assert.equal(unlockedUser.isLocked, false);
    assert.equal(unlockedUser.lockReason, null);

    // Verify ActionLog
    const actionLog = await ActionLog.findOne({
      targetId: customerUser._id,
      action: 'UNLOCK_USER',
    });
    assert.ok(actionLog);
    assert.equal(actionLog.action, 'UNLOCK_USER');

    // Verify EmailOutbox
    const emailEntry = await EmailOutbox.findOne({
      recipientEmail: customerUser.email,
      eventType: 'ACCOUNT_UNLOCKED',
    });
    assert.ok(emailEntry);

    // CRITICAL (tiêu chí 60, AUTH-06): prior session is NOT restored; old token is STILL rejected!
    const resOldToken = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${customerToken}`);

    assert.equal(resOldToken.status, 401);
  });

  await t.test('POST /api/v1/admin/users/:id/reset-password should trigger reset email for active user', async () => {
    // 1. Success for customer
    const resReset = await request(app)
      .post(`/api/v1/admin/users/${customerUser._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resReset.status, 200);
    assert.equal(resReset.body.success, true);

    const emailEntry = await EmailOutbox.findOne({
      recipientEmail: customerUser.email,
      eventType: 'RESET_PASSWORD',
    });
    assert.ok(emailEntry);

    // 2. Reject unactivated owner
    const unactivatedOwner = await User.create({
      email: `unact-owner-p06-${Date.now()}@sportbooking.local`,
      passwordHash: null,
      fullName: 'Owner Chưa Kích Hoạt',
      phoneNumber: '0904444444',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: null,
      activatedAt: null,
    });

    const resUnact = await request(app)
      .post(`/api/v1/admin/users/${unactivatedOwner._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resUnact.status, 400);
    assert.ok(resUnact.body.error.message.includes('gửi lại lời mời'));

    // 3. Reject locked user
    await User.findByIdAndUpdate(customerUser._id, { isLocked: true });
    const resLocked = await request(app)
      .post(`/api/v1/admin/users/${customerUser._id}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resLocked.status, 403);
  });

  await t.test('GET /api/v1/admin/action-logs should return paginated audit logs', async () => {
    // Generate an action log by locking customer
    await request(app)
      .patch(`/api/v1/admin/users/${customerUser._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Audit trail test' });

    const res = await request(app)
      .get('/api/v1/admin/action-logs?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items));
    assert.ok(res.body.data.items.length >= 1);
    assert.equal(res.body.data.items[0].action, 'LOCK_USER');
  });
});
