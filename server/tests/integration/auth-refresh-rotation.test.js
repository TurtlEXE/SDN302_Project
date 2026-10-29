import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { RefreshToken } from '../../src/models/refresh-token.model.js';
import { refreshTokenRepository } from '../../src/repositories/refresh-token.repository.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Auth Refresh Rotation, Session Revocation & Cookie Security (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await User.deleteMany({ email: { $regex: /p05-rot-/ } });
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});
    await disconnectDB();
  });

  const testEmail = `cust-p05-rot-${Date.now()}@sportbooking.local`;
  const testPassword = 'PasswordP05@123';
  let userId = null;

  t.beforeEach(async () => {
    // Scoped cleanup
    await User.deleteMany({ email: testEmail });
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});

    // Seed verified active customer
    const passwordHash = await bcrypt.hash(testPassword, 10);
    const user = await User.create({
      email: testEmail,
      passwordHash,
      fullName: 'Khách Hàng Phase 05',
      phoneNumber: '0977665544',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: new Date(),
    });
    userId = user._id;
  });

  await t.test('POST /api/v1/auth/refresh should rotate refresh token and issue new access JWT', async () => {
    // 1. Login to obtain initial cookie and token
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: testEmail, password: testPassword });

    assert.strictEqual(loginRes.status, 200);
    const initialAccessToken = loginRes.body.data.accessToken;

    // Extract cookie
    const setCookieHeaders = loginRes.headers['set-cookie'];
    assert.ok(setCookieHeaders);
    const rawCookie = setCookieHeaders.find((c) => c.startsWith('refresh_token='));
    assert.ok(rawCookie);
    const rawInitialToken = rawCookie.split(';')[0].split('=')[1];

    // Verify initial token in DB
    const initialTokenHash = refreshTokenRepository.hashToken(rawInitialToken);
    const initialTokenDoc = await RefreshToken.findOne({ tokenHash: initialTokenHash });
    assert.ok(initialTokenDoc);
    assert.strictEqual(initialTokenDoc.usedAt, null);
    assert.strictEqual(initialTokenDoc.revokedAt, null);

    // Wait 1.1s so JWT issued-at (iat in seconds) is different
    await new Promise((r) => setTimeout(r, 1100));

    // 2. Perform POST /api/v1/auth/refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .set('Cookie', [`refresh_token=${rawInitialToken}`]);

    assert.strictEqual(refreshRes.status, 200);
    assert.strictEqual(refreshRes.body.success, true);
    assert.ok(refreshRes.body.data.accessToken);
    assert.notStrictEqual(refreshRes.body.data.accessToken, initialAccessToken, 'New access token must be issued');

    // Check new Set-Cookie header
    const newSetCookie = refreshRes.headers['set-cookie'];
    assert.ok(newSetCookie);
    const newCookieHeader = newSetCookie.find((c) => c.startsWith('refresh_token='));
    assert.ok(newCookieHeader);
    assert.ok(newCookieHeader.includes('HttpOnly'));
    assert.ok(newCookieHeader.includes('Path=/api/v1/auth'));
    assert.ok(newCookieHeader.includes('SameSite=Lax'));

    const rawNewToken = newCookieHeader.split(';')[0].split('=')[1];
    assert.notStrictEqual(rawNewToken, rawInitialToken, 'New refresh token must be rotated');

    // 3. Verify DB state after rotation
    const updatedOldToken = await RefreshToken.findById(initialTokenDoc._id);
    assert.ok(updatedOldToken.usedAt !== null, 'Old token must be marked as used');
    assert.ok(updatedOldToken.replacedByTokenId !== null, 'Old token must link to replacement');

    const newTokenHash = refreshTokenRepository.hashToken(rawNewToken);
    const newTokenDoc = await RefreshToken.findOne({ tokenHash: newTokenHash });
    assert.ok(newTokenDoc, 'New refresh token must exist in DB');
    assert.strictEqual(newTokenDoc.usedAt, null);
    assert.strictEqual(newTokenDoc.revokedAt, null);
    assert.strictEqual(updatedOldToken.replacedByTokenId.toString(), newTokenDoc._id.toString());
  });

  await t.test('POST /api/v1/auth/refresh should detect token reuse, revoke the entire session and all its tokens', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: testEmail, password: testPassword });

    const rawCookie = loginRes.headers['set-cookie'].find((c) => c.startsWith('refresh_token='));
    const rawOldToken = rawCookie.split(';')[0].split('=')[1];

    // 2. First refresh (legitimate rotation)
    const firstRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .set('Cookie', [`refresh_token=${rawOldToken}`]);

    assert.strictEqual(firstRefreshRes.status, 200);
    const rawNewToken = firstRefreshRes.headers['set-cookie']
      .find((c) => c.startsWith('refresh_token='))
      .split(';')[0]
      .split('=')[1];

    // 3. Second refresh using the ALREADY USED old token (Token Reuse Attack!)
    const reuseAttackRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .set('Cookie', [`refresh_token=${rawOldToken}`]);

    assert.strictEqual(reuseAttackRes.status, 401);
    assert.strictEqual(reuseAttackRes.body.error?.code, 'SESSION_REVOKED');
    assert.ok(reuseAttackRes.body.error?.message.includes('tái sử dụng'));

    // Check DB: Session must be revoked with REUSE_DETECTED
    const session = await AuthSession.findOne({ userId });
    assert.ok(session.revokedAt !== null, 'Session must be immediately revoked');
    assert.strictEqual(session.revokedReason, 'REUSE_DETECTED');

    // Check DB: All refresh tokens for this session must be revoked
    const unrevokedTokens = await RefreshToken.find({ sessionId: session._id, revokedAt: null });
    assert.strictEqual(unrevokedTokens.length, 0, 'All tokens in session must be revoked');

    // 4. Even the newest token is now dead because the session was compromised and revoked!
    const followUpRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .set('Cookie', [`refresh_token=${rawNewToken}`]);

    assert.strictEqual(followUpRes.status, 401);
    assert.strictEqual(followUpRes.body.error?.code, 'SESSION_REVOKED');
  });

  await t.test('POST /api/v1/auth/logout should revoke session, revoke tokens, and clear cookie', async () => {
    // 1. Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: testEmail, password: testPassword });

    const accessToken = loginRes.body.data.accessToken;
    const rawCookie = loginRes.headers['set-cookie'].find((c) => c.startsWith('refresh_token='));
    const rawToken = rawCookie.split(';')[0].split('=')[1];

    // Verify token works
    const profileResBefore = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.strictEqual(profileResBefore.status, 200);

    // 2. Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .set('Cookie', [`refresh_token=${rawToken}`]);

    assert.strictEqual(logoutRes.status, 204);

    // Verify clear cookie header
    const clearCookieHeaders = logoutRes.headers['set-cookie'];
    assert.ok(clearCookieHeaders);
    const clearedCookie = clearCookieHeaders.find((c) => c.startsWith('refresh_token='));
    assert.ok(clearedCookie);
    assert.ok(clearedCookie.includes('refresh_token=;') || clearedCookie.includes('Max-Age=0') || clearedCookie.includes('Expires=Thu, 01 Jan 1970'));

    // 3. Old access token MUST be rejected now
    const profileResAfter = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.strictEqual(profileResAfter.status, 401);
    assert.strictEqual(profileResAfter.body.error?.code, 'SESSION_REVOKED');

    // 4. Repeated logout without cookie is idempotent (returns 204)
    const idempotentLogoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1');
    assert.strictEqual(idempotentLogoutRes.status, 204);
  });

  await t.test('POST /api/v1/auth/logout-all should revoke all sessions across all devices and increment tokenVersion', async () => {
    // 1. Create two independent sessions for user (e.g. Laptop and Mobile)
    const session1 = await AuthSession.create({
      userId,
      userAgent: 'Device-1-Laptop',
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    const session2 = await AuthSession.create({
      userId,
      userAgent: 'Device-2-Mobile',
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });

    const userInDb = await User.findById(userId);
    const token1 = jwtService.signAccessToken(userInDb, session1).accessToken;
    const token2 = jwtService.signAccessToken(userInDb, session2).accessToken;

    // Both tokens work
    const check1 = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token1}`);
    assert.strictEqual(check1.status, 200);
    const check2 = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token2}`);
    assert.strictEqual(check2.status, 200);

    // 2. Call /api/v1/auth/logout-all using Token 1
    const logoutAllRes = await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token1}`);

    assert.strictEqual(logoutAllRes.status, 204);

    // 3. Both tokens MUST now be rejected with 401 SESSION_REVOKED
    const test1 = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token1}`);
    assert.strictEqual(test1.status, 401);
    assert.strictEqual(test1.body.error?.code, 'SESSION_REVOKED');

    const test2 = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${token2}`);
    assert.strictEqual(test2.status, 401);
    assert.strictEqual(test2.body.error?.code, 'SESSION_REVOKED');

    // 4. Verify DB state: tokenVersion incremented, both sessions revoked
    const updatedUser = await User.findById(userId);
    assert.strictEqual(updatedUser.tokenVersion, 1);

    const s1 = await AuthSession.findById(session1._id);
    const s2 = await AuthSession.findById(session2._id);
    assert.ok(s1.revokedAt !== null);
    assert.ok(s2.revokedAt !== null);
  });

  await t.test('Absolute session expiry: refresh near 7 days cannot extend session or JWT beyond session expiry', async () => {
    // 1. Create a session near absolute expiration (only 120s remaining)
    const nearExpiryDate = new Date(Date.now() + 120 * 1000); // 2 minutes from now
    const session = await AuthSession.create({
      userId,
      absoluteExpiresAt: nearExpiryDate,
    });

    const rawToken = refreshTokenRepository.generateRawToken();
    const tokenHash = refreshTokenRepository.hashToken(rawToken);
    await RefreshToken.create({
      sessionId: session._id,
      userId,
      tokenHash,
      expiresAt: nearExpiryDate,
    });

    // 2. Call refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .set('Cookie', [`refresh_token=${rawToken}`]);

    assert.strictEqual(refreshRes.status, 200);
    // JWT expiresInSeconds must NOT be 600s; it must be capped at <= 120s!
    assert.ok(
      refreshRes.body.data.expiresInSeconds <= 120,
      `expiresInSeconds (${refreshRes.body.data.expiresInSeconds}) must be <= 120s`
    );

    // Refresh token in DB must also have expiresAt capped exactly at session.absoluteExpiresAt
    const newRawCookie = refreshRes.headers['set-cookie']
      .find((c) => c.startsWith('refresh_token='))
      .split(';')[0]
      .split('=')[1];
    const newTokenDoc = await RefreshToken.findOne({
      tokenHash: refreshTokenRepository.hashToken(newRawCookie),
    });
    assert.strictEqual(newTokenDoc.expiresAt.getTime(), nearExpiryDate.getTime());
  });

  await t.test('Auth Request Guard: rejects untrusted Origin and missing X-CSRF-Guard on /refresh', async () => {
    // 1. Missing X-CSRF-Guard
    const resNoGuard = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000');
    assert.strictEqual(resNoGuard.status, 403);
    assert.strictEqual(resNoGuard.body.error?.code, 'CSRF_GUARD_TRIGGERED');

    // 2. Untrusted Origin
    const resBadOrigin = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://attacker-site.com')
      .set('X-CSRF-Guard', '1');
    assert.strictEqual(resBadOrigin.status, 403);
    assert.strictEqual(resBadOrigin.body.error?.code, 'CSRF_GUARD_TRIGGERED');
  });
});
