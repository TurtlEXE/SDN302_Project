import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { RefreshToken } from '../../src/models/refresh-token.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { jwtService } from '../../src/services/jwt.service.js';
import { seedCrossRoleData } from '../../scripts/seed-cross-role-data.js';

test('Cross-Role Access Control & Multi-Actor Isolation (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'admin@sportbooking.local',
          'owner1@sportbooking.local',
          'owner2@sportbooking.local',
          'customer1@sportbooking.local',
          'customer2@sportbooking.local',
        ],
      },
    });
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});
    await ActionLog.deleteMany({});
    await EmailOutbox.deleteMany({});
    await disconnectDB();
  });

  let seeded = null;
  let adminToken = null;
  let owner1Token = null;
  let owner2Token = null;
  let cust1Token = null;
  let cust2Token = null;
  let owner1Session = null;

  t.beforeEach(async () => {
    await User.deleteMany({
      email: {
        $in: [
          'admin@sportbooking.local',
          'owner1@sportbooking.local',
          'owner2@sportbooking.local',
          'customer1@sportbooking.local',
          'customer2@sportbooking.local',
        ],
      },
    });
    await AuthSession.deleteMany({});
    await RefreshToken.deleteMany({});
    await ActionLog.deleteMany({});
    await EmailOutbox.deleteMany({});

    // Seed dataset: 1 Admin, 2 Owners, 2 Customers
    seeded = await seedCrossRoleData(env.MONGODB_TEST_URI);

    // Create session and access token for each actor
    const createActorToken = async (user) => {
      const session = await AuthSession.create({
        userId: user._id,
        absoluteExpiresAt: new Date(Date.now() + 86400000),
      });
      const token = jwtService.signAccessToken(user, session).accessToken;
      return { session, token };
    };

    const adminAuth = await createActorToken(seeded.admin);
    adminToken = adminAuth.token;

    const o1Auth = await createActorToken(seeded.owners[0]);
    owner1Token = o1Auth.token;
    owner1Session = o1Auth.session;

    const o2Auth = await createActorToken(seeded.owners[1]);
    owner2Token = o2Auth.token;

    const c1Auth = await createActorToken(seeded.customers[0]);
    cust1Token = c1Auth.token;

    const c2Auth = await createActorToken(seeded.customers[1]);
    cust2Token = c2Auth.token;
  });

  await t.test('Seeded dataset should contain exactly 1 Admin, at least 2 Owners, and at least 2 Customers', () => {
    assert.equal(seeded.admin.role, 'ADMIN');
    assert.equal(seeded.owners.length, 2);
    assert.equal(seeded.owners[0].role, 'OWNER');
    assert.equal(seeded.owners[1].role, 'OWNER');
    assert.equal(seeded.customers.length, 2);
    assert.equal(seeded.customers[0].role, 'CUSTOMER');
    assert.equal(seeded.customers[1].role, 'CUSTOMER');
  });

  await t.test('Customers and Owners must NOT be able to call Admin APIs (403 Forbidden)', async () => {
    // Customer 1 calls GET /api/v1/admin/users
    const resCustUsers = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${cust1Token}`);
    assert.equal(resCustUsers.status, 403);
    assert.equal(resCustUsers.body.error.code, 'FORBIDDEN');

    // Customer 2 calls POST /api/v1/admin/sports
    const resCustSports = await request(app)
      .post('/api/v1/admin/sports')
      .set('Authorization', `Bearer ${cust2Token}`)
      .send({ name: 'Hacked Sport' });
    assert.equal(resCustSports.status, 403);
    assert.equal(resCustSports.body.error.code, 'FORBIDDEN');

    // Owner 1 calls GET /api/v1/admin/users
    const resOwnerUsers = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${owner1Token}`);
    assert.equal(resOwnerUsers.status, 403);
    assert.equal(resOwnerUsers.body.error.code, 'FORBIDDEN');

    // Owner 2 calls PATCH /api/v1/admin/users/:id/lock
    const resOwnerLock = await request(app)
      .patch(`/api/v1/admin/users/${seeded.customers[0]._id}/lock`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .send({ reason: 'Malicious lock' });
    assert.equal(resOwnerLock.status, 403);
    assert.equal(resOwnerLock.body.error.code, 'FORBIDDEN');
  });

  await t.test('Profile isolation: Customer 1 only accesses Customer 1 profile, not Customer 2', async () => {
    const res1 = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${cust1Token}`);

    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.email, 'customer1@sportbooking.local');

    const res2 = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${cust2Token}`);

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.email, 'customer2@sportbooking.local');
  });

  await t.test('Locking Owner 1 revokes Owner 1 session while Owner 2 and Customers operate normally', async () => {
    // 1. Admin locks Owner 1
    const resLock = await request(app)
      .patch(`/api/v1/admin/users/${seeded.owners[0]._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Tạm đình chỉ kiểm tra vi phạm vận hành' });

    assert.equal(resLock.status, 200);

    // 2. Owner 1 calling /api/v1/users/me with old token is rejected (401 SESSION_REVOKED)
    const resOwner1Old = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${owner1Token}`);
    assert.equal(resOwner1Old.status, 401);

    // 3. Owner 1 cannot log in anew (403 ACCOUNT_LOCKED)
    const resOwner1Login = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: 'owner1@sportbooking.local',
        password: 'Password123!',
      });
    assert.equal(resOwner1Login.status, 403);
    assert.equal(resOwner1Login.body.error.code, 'ACCOUNT_LOCKED');

    // 4. Owner 2 operates normally
    const resOwner2 = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${owner2Token}`);
    assert.equal(resOwner2.status, 200);
    assert.equal(resOwner2.body.data.email, 'owner2@sportbooking.local');

    // 5. Customer 1 operates normally
    const resCust1 = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${cust1Token}`);
    assert.equal(resCust1.status, 200);
  });

  await t.test('Unlocking Owner 1 does NOT revive prior session; Owner 1 must login again', async () => {
    // Admin locks Owner 1
    await request(app)
      .patch(`/api/v1/admin/users/${seeded.owners[0]._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Locking for unlock test' });

    // Admin unlocks Owner 1
    const resUnlock = await request(app)
      .patch(`/api/v1/admin/users/${seeded.owners[0]._id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Đã hoàn tất kiểm tra' });

    assert.equal(resUnlock.status, 200);

    // CRITICAL: Owner 1's prior token is STILL rejected!
    const resPriorToken = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${owner1Token}`);
    assert.equal(resPriorToken.status, 401);

    // Owner 1 CAN now successfully log in anew
    const resNewLogin = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Guard', '1')
      .send({
        email: 'owner1@sportbooking.local',
        password: 'Password123!',
      });

    assert.equal(resNewLogin.status, 200);
    assert.ok(resNewLogin.body.data.accessToken);

    // New access token works
    const resNewMe = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${resNewLogin.body.data.accessToken}`);
    assert.equal(resNewMe.status, 200);
    assert.equal(resNewMe.body.data.email, 'owner1@sportbooking.local');
  });
});
