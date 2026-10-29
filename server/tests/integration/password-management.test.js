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

test('Password Management & Session Revocation API (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await disconnectDB();
  });

  const testEmail = `pwd-p04-${Date.now()}@sportbooking.local`;
  const initialPassword = 'InitialPassword@123';
  let initialPasswordHash = null;

  t.beforeEach(async () => {
    // Scoped cleanup
    await User.deleteMany({ email: testEmail });
    await EmailOutbox.deleteMany({ recipientEmail: testEmail });

    initialPasswordHash = await bcrypt.hash(initialPassword, 10);
  });

  await t.test('POST /api/v1/auth/forgot-password should return generic 200 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: 'non-existent-user@sportbooking.local' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.message.includes('Nếu địa chỉ email tồn tại'));
  });

  await t.test('POST /api/v1/auth/forgot-password should queue RESET_PASSWORD outbox email for valid user', async () => {
    await User.create({
      email: testEmail,
      passwordHash: initialPasswordHash,
      fullName: 'Người Dùng Test Quên MK',
      phoneNumber: '0911223344',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: testEmail });

    assert.strictEqual(res.status, 200);

    const outboxEmail = await EmailOutbox.findOne({ recipientEmail: testEmail });
    assert.ok(outboxEmail, 'Outbox email must be queued');
    assert.strictEqual(outboxEmail.templateName, 'RESET_PASSWORD');
    assert.ok(outboxEmail.templateData?.resetUrl.includes('token='));
  });

  await t.test('POST /api/v1/auth/reset-password should update password and revoke all active sessions', async () => {
    // 1. Create user and active session
    const user = await User.create({
      email: testEmail,
      passwordHash: initialPasswordHash,
      fullName: 'Người Dùng Test Quên MK',
      phoneNumber: '0911223344',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    const session = await AuthSession.create({
      userId: user._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });

    const { accessToken: oldAccessToken } = jwtService.signAccessToken(user, session);

    // Verify old access token works
    const profileResBefore = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    assert.strictEqual(profileResBefore.status, 200);

    // 2. Request forgot password
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: testEmail });

    const outboxEmail = await EmailOutbox.findOne({ recipientEmail: testEmail });
    const tokenMatch = outboxEmail.templateData?.resetUrl.match(/token=([a-f0-9]+)/);
    const resetToken = tokenMatch[1];

    // 3. Reset password
    const newPassword = 'NewSecretPassword@123';
    const resetRes = await request(app)
      .post('/api/v1/auth/reset-password')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        token: resetToken,
        newPassword,
      });

    assert.strictEqual(resetRes.status, 200);

    // 4. Old access token MUST now be revoked immediately (SESSION_REVOKED)
    const profileResAfter = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${oldAccessToken}`);
    assert.strictEqual(profileResAfter.status, 401);
    assert.strictEqual(profileResAfter.body.error?.code, 'SESSION_REVOKED');

    // 5. Old session in DB must be revoked
    const sessionInDb = await AuthSession.findById(session._id);
    assert.ok(sessionInDb.revokedAt, 'Session must have revokedAt set');
    assert.strictEqual(sessionInDb.revokedReason, 'PASSWORD_CHANGED');

    // 6. User can log in with new password
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: newPassword,
      });
    assert.strictEqual(loginRes.status, 200);
    assert.ok(loginRes.body.data.accessToken);
  });

  await t.test('POST /api/v1/auth/change-password should require authentication and invalidate prior sessions', async () => {
    // 1. Create user
    const user = await User.create({
      email: testEmail,
      passwordHash: initialPasswordHash,
      fullName: 'Người Dùng Đổi MK',
      phoneNumber: '0911223344',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });

    // 2. Login to get session & token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: testEmail,
        password: initialPassword,
      });

    const activeToken = loginRes.body.data.accessToken;

    // 3. Change password with wrong old password -> 400
    const failRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${activeToken}`)
      .send({
        oldPassword: 'WrongOldPassword',
        newPassword: 'BrandNewPassword@123',
      });

    assert.strictEqual(failRes.status, 400);
    assert.strictEqual(failRes.body.error?.code, 'INVALID_CREDENTIALS');

    // 4. Change password with correct old password -> 200
    const successRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${activeToken}`)
      .send({
        oldPassword: initialPassword,
        newPassword: 'BrandNewPassword@123',
      });

    assert.strictEqual(successRes.status, 200);

    // 5. Subsequent request with the active token MUST be rejected
    const testOldTokenRes = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${activeToken}`);

    assert.strictEqual(testOldTokenRes.status, 401);
    assert.strictEqual(testOldTokenRes.body.error?.code, 'SESSION_REVOKED');
  });
});
