import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { AuthToken } from '../../src/models/auth-token.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { mailClient } from '../../src/integrations/mail.client.js';
import { authTokenService, TOKEN_TYPES } from '../../src/services/auth-token.service.js';
import { clearEmailCooldowns } from '../../src/middlewares/rate-limit.js';
import { ERROR_CODES } from '../../src/errors/error-codes.js';

describe('Auth Tokens & Resend Verification API (Integration)', () => {
  const UNVERIFIED_USER_EMAIL = 'unverified-customer@sportbooking.local';
  const VERIFIED_USER_EMAIL = 'verified-customer@sportbooking.local';
  let unverifiedUserId;
  let verifiedUserId;

  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);

    // Clean up existing test users
    await User.deleteMany({
      email: { $in: [UNVERIFIED_USER_EMAIL, VERIFIED_USER_EMAIL] },
    });

    const unverified = await User.create({
      fullName: 'Unverified Customer',
      email: UNVERIFIED_USER_EMAIL,
      phoneNumber: '0901234561',
      passwordHash: 'dummy_hash_for_test',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerifiedAt: null,
    });
    unverifiedUserId = unverified._id;

    const verified = await User.create({
      fullName: 'Verified Customer',
      email: VERIFIED_USER_EMAIL,
      phoneNumber: '0901234562',
      passwordHash: 'dummy_hash_for_test',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });
    verifiedUserId = verified._id;
  });

  after(async () => {
    await User.deleteMany({
      email: { $in: [UNVERIFIED_USER_EMAIL, VERIFIED_USER_EMAIL] },
    });
    await AuthToken.deleteMany({
      userId: { $in: [unverifiedUserId, verifiedUserId] },
    });
    await EmailOutbox.deleteMany({
      recipientEmail: { $in: [UNVERIFIED_USER_EMAIL, VERIFIED_USER_EMAIL] },
    });
    await disconnectDB();
  });

  beforeEach(async () => {
    clearEmailCooldowns();
    mailClient.clearSentEmails();
    mailClient.setFailureMock(null);
    await User.findByIdAndUpdate(unverifiedUserId, { $set: { emailVerifiedAt: null } });
    await AuthToken.deleteMany({
      userId: { $in: [unverifiedUserId, verifiedUserId] },
    });
    await EmailOutbox.deleteMany({
      recipientEmail: { $in: [UNVERIFIED_USER_EMAIL, VERIFIED_USER_EMAIL] },
    });
  });

  it('POST /api/v1/auth/resend-verification should issue new token, queue outbox email and commit atomically', async () => {
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: UNVERIFIED_USER_EMAIL });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.message.includes('tiếp nhận thành công'));

    // Verify token was stored in DB
    const tokens = await AuthToken.find({ userId: unverifiedUserId, type: TOKEN_TYPES.VERIFY_EMAIL });
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].usedAt, null);

    // Verify outbox was populated
    const outbox = await EmailOutbox.find({ recipientEmail: UNVERIFIED_USER_EMAIL });
    assert.equal(outbox.length, 1);
    assert.equal(outbox[0].status, 'PENDING');
    assert.ok(outbox[0].templateData.verificationUrl.includes('/verify-email?token='));
  });

  it('POST /api/v1/auth/resend-verification should enforce 60-second cooldown rate limit per email', async () => {
    // 1st request -> 200 OK
    const res1 = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: UNVERIFIED_USER_EMAIL });
    assert.equal(res1.status, 200);

    // 2nd request within 60s -> 429 Too Many Requests
    const res2 = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: UNVERIFIED_USER_EMAIL });

    assert.equal(res2.status, 429);
    assert.equal(res2.body.error.code, ERROR_CODES.RATE_LIMIT_EXCEEDED);
    assert.ok(res2.body.error.message.includes('60 giây'));
  });

  it('POST /api/v1/auth/resend-verification should return 200 for already verified account without issuing tokens', async () => {
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: VERIFIED_USER_EMAIL });

    assert.equal(res.status, 200);
    assert.ok(res.body.message.includes('đã được xác thực trước đó'));

    const tokens = await AuthToken.find({ userId: verifiedUserId });
    assert.equal(tokens.length, 0, 'No token should be issued for verified user');
  });

  it('POST /api/v1/auth/resend-verification should return 200 generic message for non-existent email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: 'non-existent-user-xyz@sportbooking.local' });

    assert.equal(res.status, 200);
    assert.ok(res.body.message.includes('liên kết xác thực'));
  });

  it('GET /api/v1/auth/verify-token and GET /verify-email should NEVER consume token, while POST /verify-email consumes atomically', async () => {
    // Generate token
    const { token } = await authTokenService.generateToken({
      userId: unverifiedUserId,
      type: TOKEN_TYPES.VERIFY_EMAIL,
    });

    // 1. GET /api/v1/auth/verify-token
    const getRes1 = await request(app)
      .get(`/api/v1/auth/verify-token?token=${token}&type=VERIFY_EMAIL`);
    assert.equal(getRes1.status, 200);
    assert.equal(getRes1.body.data.valid, true);

    // 2. GET /api/v1/auth/verify-email (simulating user clicking email link directly in browser or prefetcher)
    const getRes2 = await request(app)
      .get(`/api/v1/auth/verify-email?token=${token}`);
    assert.equal(getRes2.status, 200);
    assert.equal(getRes2.body.data.valid, true);

    // Check database: usedAt MUST STILL BE NULL!
    const tokenAfterGets = await AuthToken.findOne({ tokenHash: authTokenService.hashToken(token) });
    assert.equal(tokenAfterGets.usedAt, null, 'GET request must not mark token as used');

    // 3. POST /api/v1/auth/verify-email (actual form submission)
    const postRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ token });

    assert.equal(postRes.status, 200);
    assert.ok(postRes.body.message.includes('thành công'));

    // Check database: token consumed and user emailVerifiedAt updated
    const tokenAfterPost = await AuthToken.findOne({ tokenHash: authTokenService.hashToken(token) });
    assert.ok(tokenAfterPost.usedAt !== null, 'POST request must mark token as used');

    const updatedUser = await User.findById(unverifiedUserId);
    assert.ok(updatedUser.emailVerifiedAt !== null, 'User emailVerifiedAt must be populated');

    // 4. Repeated POST /api/v1/auth/verify-email must be rejected with TOKEN_ALREADY_USED
    const repeatPostRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ token });

    assert.equal(repeatPostRes.status, 400);
    assert.equal(repeatPostRes.body.error.code, ERROR_CODES.TOKEN_ALREADY_USED);
  });

  it('should isolate email delivery failures from data transactions (Transactional Outbox guarantee)', async () => {
    // Simulate SMTP network failure
    mailClient.setFailureMock(new Error('SMTP Transport Offline'));

    // User requests resend verification
    const res = await request(app)
      .post('/api/v1/auth/resend-verification')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({ email: UNVERIFIED_USER_EMAIL });

    // The HTTP response still succeeds!
    assert.equal(res.status, 200);

    // The database transaction succeeded: AuthToken exists and EmailOutbox document exists
    const token = await AuthToken.findOne({ userId: unverifiedUserId, type: TOKEN_TYPES.VERIFY_EMAIL });
    assert.ok(token, 'AuthToken must be safely persisted despite mail failure');

    const outbox = await EmailOutbox.findOne({ recipientEmail: UNVERIFIED_USER_EMAIL });
    assert.ok(outbox, 'Outbox item must be stored and waiting for worker retry');
    assert.equal(outbox.status, 'PENDING');
  });
});
