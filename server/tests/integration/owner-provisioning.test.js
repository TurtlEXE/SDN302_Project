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
import { jwtService } from '../../src/services/jwt.service.js';

test('Admin Provisioning & Owner Activation API (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await User.deleteMany({ email: { $regex: /p04-prov-/ } });
    await User.deleteMany({ email: ownerEmail });
    await EmailOutbox.deleteMany({ recipientEmail: ownerEmail });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let adminToken = null;
  let customerToken = null;
  let adminUser = null;
  const ownerEmail = `owner-p04-${Date.now()}@sportbooking.local`;

  t.beforeEach(async () => {
    // Scoped cleanup
    await User.deleteMany({ email: { $regex: /p04-prov-/ } });
    await User.deleteMany({ email: ownerEmail });
    await EmailOutbox.deleteMany({ recipientEmail: ownerEmail });
    await AuthSession.deleteMany({});

    // Seed admin user
    const adminPasswordHash = await bcrypt.hash('AdminPassword@123', 10);
    adminUser = await User.create({
      email: `admin-p04-prov-${Date.now()}@sportbooking.local`,
      passwordHash: adminPasswordHash,
      fullName: 'Quản Trị Viên',
      phoneNumber: '0900000001',
      role: 'ADMIN',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const adminSession = await AuthSession.create({
      userId: adminUser._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    adminToken = jwtService.signAccessToken(adminUser, adminSession).accessToken;

    // Seed customer user
    const custUser = await User.create({
      email: `cust-p04-prov-${Date.now()}@sportbooking.local`,
      passwordHash: adminPasswordHash,
      fullName: 'Khách Thường',
      phoneNumber: '0900000002',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const custSession = await AuthSession.create({
      userId: custUser._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(custUser, custSession).accessToken;
  });

  await t.test('POST /api/v1/admin/users/owners should reject non-admin users with 403 FORBIDDEN', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users/owners')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        fullName: 'Chủ Sân Test',
        email: ownerEmail,
        phoneNumber: '0987654321',
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error?.code, 'FORBIDDEN');
  });

  await t.test('POST /api/v1/admin/users/owners should create OWNER and queue ACTIVATE_OWNER email with 24h validity', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Chủ Sân Thể Thao',
        email: ownerEmail,
        phoneNumber: '0987654321',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);

    // Verify DB user
    const ownerInDb = await User.findOne({ email: ownerEmail });
    assert.ok(ownerInDb, 'Owner must exist in DB');
    assert.strictEqual(ownerInDb.role, 'OWNER');
    assert.strictEqual(ownerInDb.passwordHash, null, 'Owner must have null passwordHash until activated');
    assert.strictEqual(ownerInDb.activatedAt, null, 'Owner must not be activated initially');
    assert.strictEqual(ownerInDb.emailVerifiedAt, null);

    // Verify Outbox email
    const outboxEmail = await EmailOutbox.findOne({ recipientEmail: ownerEmail });
    assert.ok(outboxEmail, 'Activation email outbox must be queued');
    assert.strictEqual(outboxEmail.templateName, 'ACTIVATE_OWNER');
    assert.strictEqual(outboxEmail.templateData?.expiresInHours, 24);
  });

  await t.test('Owner cannot login before activation and can activate with single-use token', async () => {
    // 1. Admin provisions owner
    await request(app)
      .post('/api/v1/admin/users/owners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Chủ Sân Thể Thao',
        email: ownerEmail,
        phoneNumber: '0987654321',
      });

    // 2. Try logging in before activation (has no password)
    const loginFailRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: ownerEmail,
        password: 'AnyPassword@123',
      });

    assert.strictEqual(loginFailRes.status, 401);

    // 3. Extract activation token from outbox
    const outboxEmail = await EmailOutbox.findOne({ recipientEmail: ownerEmail });
    const tokenMatch = outboxEmail.templateData?.activationUrl.match(/token=([a-f0-9]+)/);
    const activationToken = tokenMatch[1];

    // 4. Activate owner and set initial password
    const activateRes = await request(app)
      .post('/api/v1/auth/activate-owner')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        token: activationToken,
        password: 'OwnerPassword@123',
      });

    assert.strictEqual(activateRes.status, 200);
    assert.strictEqual(activateRes.body.success, true);

    // Verify DB state
    const activatedOwner = await User.findOne({ email: ownerEmail });
    assert.ok(activatedOwner.passwordHash, 'Password must be set');
    assert.ok(activatedOwner.activatedAt, 'activatedAt must be set');
    assert.ok(activatedOwner.emailVerifiedAt, 'emailVerifiedAt must be set');

    // 5. Try activating again with same token (must fail - single-use)
    const secondActivateRes = await request(app)
      .post('/api/v1/auth/activate-owner')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        token: activationToken,
        password: 'AnotherPassword@123',
      });

    assert.strictEqual(secondActivateRes.status, 400);

    // 6. Login now succeeds for owner
    const loginSuccessRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: ownerEmail,
        password: 'OwnerPassword@123',
      });

    assert.strictEqual(loginSuccessRes.status, 200);
    assert.strictEqual(loginSuccessRes.body.data.user.role, 'OWNER');
    assert.ok(loginSuccessRes.body.data.accessToken);
  });
});
