import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { AuthToken } from '../../src/models/auth-token.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { RefreshToken } from '../../src/models/refresh-token.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Auth Registration, Verification, Login & Profile API (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await disconnectDB();
  });

  const testEmail = `cust-p04-${Date.now()}@sportbooking.local`;
  const testPassword = 'Password@123';
  let verifyRawToken = null;
  let authAccessToken = null;

  t.beforeEach(async () => {
    // Scoped cleanup
    await User.deleteMany({ email: { $regex: /cust-p04-/ } });
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: /cust-p04-/ } });
    await AuthToken.deleteMany({});
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});
  });

  await t.test('POST /api/v1/auth/register should create unverified CUSTOMER and queue verification email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Nguyễn Khách Hàng',
        phoneNumber: '0912345678',
        role: 'ADMIN', // Tampering attempt: should be overridden to CUSTOMER
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);

    // Verify DB user
    const userInDb = await User.findOne({ email: testEmail });
    assert.ok(userInDb, 'User must exist in DB');
    assert.strictEqual(userInDb.role, 'CUSTOMER', 'Role must always be CUSTOMER');
    assert.strictEqual(userInDb.emailVerifiedAt, null, 'Email must not be verified initially');
    assert.strictEqual(userInDb.isLocked, false);

    // Verify Email Outbox
    const outboxEmail = await EmailOutbox.findOne({ recipientEmail: testEmail });
    assert.ok(outboxEmail, 'Email outbox record must be created');
    assert.strictEqual(outboxEmail.templateName, 'VERIFY_EMAIL');

    // Extract verify token from verificationUrl
    const url = outboxEmail.templateData?.verificationUrl;
    assert.ok(url);
    const tokenMatch = url.match(/token=([a-f0-9]+)/);
    assert.ok(tokenMatch);
    verifyRawToken = tokenMatch[1];
  });

  await t.test('POST /api/v1/auth/register should reject duplicate email', async () => {
    // First registration
    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Nguyễn Khách Hàng',
        phoneNumber: '0912345678',
      });

    // Duplicate registration
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Khách Hàng Trùng',
        phoneNumber: '0999999999',
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error?.code, 'USER_ALREADY_EXISTS');
  });

  await t.test('POST /api/v1/auth/login should reject unverified customer account', async () => {
    // Create unverified user
    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Nguyễn Khách Hàng',
        phoneNumber: '0912345678',
      });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.error?.code, 'ACCOUNT_NOT_VERIFIED');
  });

  await t.test('POST /api/v1/auth/login should succeed after customer email verification and set HttpOnly cookie', async () => {
    // 1. Register
    await request(app)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
        fullName: 'Nguyễn Khách Hàng',
        phoneNumber: '0912345678',
      });

    // 2. Extract verification token from outbox
    const outboxEmail = await EmailOutbox.findOne({ recipientEmail: testEmail });
    const tokenMatch = outboxEmail.templateData?.verificationUrl.match(/token=([a-f0-9]+)/);
    const token = tokenMatch[1];

    // 3. Verify Email
    const verifyRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ token });

    assert.strictEqual(verifyRes.status, 200);

    // 4. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: testPassword,
      });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.success, true);
    assert.ok(loginRes.body.data.accessToken, 'Access token must be returned in JSON');
    assert.strictEqual(loginRes.body.data.expiresInSeconds, 600);
    assert.strictEqual(loginRes.body.data.user.email, testEmail);
    assert.strictEqual(loginRes.body.data.user.role, 'CUSTOMER');

    authAccessToken = loginRes.body.data.accessToken;

    // Check Set-Cookie header
    const cookies = loginRes.headers['set-cookie'];
    assert.ok(cookies && cookies.length > 0, 'Set-Cookie header must be present');
    const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
    assert.ok(refreshCookie, 'refresh_token cookie must be set');
    assert.ok(refreshCookie.includes('HttpOnly'), 'Cookie must be HttpOnly');
    assert.ok(refreshCookie.includes('Path=/api/v1/auth'), 'Cookie Path must be /api/v1/auth');
    assert.ok(refreshCookie.includes('SameSite=Lax'), 'Cookie SameSite must be Lax');

    // Check AuthSession in DB
    const sessionInDb = await AuthSession.findOne({ userId: loginRes.body.data.user.id });
    assert.ok(sessionInDb, 'AuthSession must be stored in DB');
    assert.strictEqual(sessionInDb.revokedAt, null);

    // Check RefreshToken in DB
    const refreshTokenInDb = await RefreshToken.findOne({ sessionId: sessionInDb._id });
    assert.ok(refreshTokenInDb, 'RefreshToken record must be stored in DB');
  });

  await t.test('GET /api/v1/users/me should return current user profile with valid Bearer token', async () => {
    const user = await User.create({
      email: `profile-${Date.now()}@sportbooking.local`,
      passwordHash: 'dummy',
      fullName: 'Khách Hàng Xem Profile',
      phoneNumber: '0912345678',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const session = await AuthSession.create({
      userId: user._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });

    const { accessToken } = jwtService.signAccessToken(user, session);

    const res = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.email, user.email);
    assert.strictEqual(res.body.data.role, 'CUSTOMER');
    assert.strictEqual(res.body.data.isLocked, false);
  });

  await t.test('PATCH /api/v1/users/me should update fullName and phoneNumber, but reject role modification', async () => {
    const user = await User.create({
      email: `patch-${Date.now()}@sportbooking.local`,
      passwordHash: 'dummy',
      fullName: 'Tên Ban Đầu',
      phoneNumber: '0911111111',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const session = await AuthSession.create({
      userId: user._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });

    const { accessToken } = jwtService.signAccessToken(user, session);

    const res = await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName: 'Nguyễn Khách Hàng Đã Đổi Tên',
        phoneNumber: '0988888888',
        role: 'ADMIN', // Tampering attempt: should NOT change role
        isLocked: true, // Tampering attempt
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.fullName, 'Nguyễn Khách Hàng Đã Đổi Tên');
    assert.strictEqual(res.body.data.phoneNumber, '0988888888');
    assert.strictEqual(res.body.data.role, 'CUSTOMER', 'Role must remain CUSTOMER');
    assert.strictEqual(res.body.data.isLocked, false, 'isLocked must remain false');
  });
});
