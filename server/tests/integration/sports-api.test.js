import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { Sport } from '../../src/models/sport.model.js';
import { Court } from '../../src/models/court.model.js';
import { FacilitySport } from '../../src/models/facility-sport.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Sports Catalog API & Soft/Hard Delete Guard (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Sport.deleteMany({ name: { $regex: /P06Test-/ } });
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p06-sport-/ } });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let adminToken = null;
  let customerToken = null;

  t.beforeEach(async () => {
    await Sport.deleteMany({ name: { $regex: /P06Test-/ } });
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p06-sport-/ } });
    await AuthSession.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    // 1. Admin
    const adminUser = await User.create({
      email: `admin-p06-sport-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Viên',
      phoneNumber: '0901234567',
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

    // 2. Customer
    const customerUser = await User.create({
      email: `customer-p06-sport-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng',
      phoneNumber: '0907654321',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const customerSession = await AuthSession.create({
      userId: customerUser._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customerUser, customerSession).accessToken;
  });

  await t.test('POST /api/v1/admin/sports should create new sport and reject duplicates', async () => {
    // 1. Create badminton sport
    const resCreate = await request(app)
      .post('/api/v1/admin/sports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: '  P06Test-Cầu Lông  ',
        description: 'Môn cầu lông sân trong nhà tiêu chuẩn',
      });

    assert.equal(resCreate.status, 201);
    assert.equal(resCreate.body.success, true);
    assert.equal(resCreate.body.data.name, 'P06Test-Cầu Lông');
    assert.equal(resCreate.body.data.normalizedName, 'P06TEST-CẦU LÔNG');
    assert.equal(resCreate.body.data.isActive, true);

    // 2. Reject duplicate name (case-insensitive & whitespace trimmed)
    const resDuplicate = await request(app)
      .post('/api/v1/admin/sports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'p06test-cầu lông',
        description: 'Mô tả trùng',
      });

    assert.equal(resDuplicate.status, 409);
    assert.equal(resDuplicate.body.error.code, 'SPORT_ALREADY_EXISTS');

    // 3. Reject empty name
    const resEmpty = await request(app)
      .post('/api/v1/admin/sports')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '   ' });

    assert.equal(resEmpty.status, 400);
  });

  await t.test('GET /api/v1/sports should return only active sports for public catalog', async () => {
    // Seed 1 active sport and 1 inactive sport
    await Sport.create([
      {
        name: 'P06Test-Bóng Đá',
        normalizedName: 'P06TEST-BÓNG ĐÁ',
        description: 'Sân cỏ nhân tạo 7 người',
        isActive: true,
      },
      {
        name: 'P06Test-Bóng Bàn (Tạm dừng)',
        normalizedName: 'P06TEST-BÓNG BÀN (TẠM DỪNG)',
        description: 'Đang bảo dưỡng',
        isActive: false,
      },
    ]);

    // Public call - does not require authentication
    const resPublic = await request(app).get('/api/v1/sports');
    assert.equal(resPublic.status, 200);
    assert.equal(resPublic.body.success, true);
    assert.ok(Array.isArray(resPublic.body.data));

    // Only active sports returned
    const p06Sports = resPublic.body.data.filter((s) => s.name.startsWith('P06Test-'));
    assert.equal(p06Sports.length, 1);
    assert.equal(p06Sports[0].name, 'P06Test-Bóng Đá');
    assert.equal(p06Sports[0].isActive, true);
  });

  await t.test('GET /api/v1/admin/sports should return all sports with pagination and search', async () => {
    await Sport.create([
      { name: 'P06Test-Pickleball', normalizedName: 'P06TEST-PICKLEBALL', isActive: true },
      { name: 'P06Test-Bóng Rổ', normalizedName: 'P06TEST-BÓNG RỔ', isActive: false },
    ]);

    const resAdmin = await request(app)
      .get('/api/v1/admin/sports?search=P06Test')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resAdmin.status, 200);
    assert.equal(resAdmin.body.success, true);
    assert.equal(resAdmin.body.data.items.length, 2);
    assert.equal(resAdmin.body.data.pagination.total, 2);
  });

  await t.test('PATCH /api/v1/admin/sports/:id should update details and prevent deactivation if active courts exist', async () => {
    const sport = await Sport.create({
      name: 'P06Test-Tennis',
      normalizedName: 'P06TEST-TENNIS',
      description: 'Sân đất nện',
      isActive: true,
    });

    // 1. Update name and description
    const resUpdate = await request(app)
      .patch(`/api/v1/admin/sports/${sport._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'P06Test-Quần Vợt (Tennis)',
        description: 'Sân cứng tiêu chuẩn quốc tế',
      });

    assert.equal(resUpdate.status, 200);
    assert.equal(resUpdate.body.data.name, 'P06Test-Quần Vợt (Tennis)');
    assert.equal(resUpdate.body.data.description, 'Sân cứng tiêu chuẩn quốc tế');

    // 2. Attach an active court to this sport
    const dummyFacilityId = new mongoose.Types.ObjectId();
    const dummyFacilitySportId = new mongoose.Types.ObjectId();
    await Court.create({
      facilityId: dummyFacilityId,
      facilitySportId: dummyFacilitySportId,
      sportId: sport._id,
      name: 'Sân Tennis Số 1',
      pricePerHourVnd: 200000,
      priceVersion: 1,
      isActive: true,
    });

    // 3. Attempt to deactivate sport when active courts exist -> MUST FAIL (ADM-03)
    const resDeactivateFail = await request(app)
      .patch(`/api/v1/admin/sports/${sport._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.equal(resDeactivateFail.status, 400);
    assert.equal(resDeactivateFail.body.error.code, 'SPORT_IN_USE');

    // 4. Deactivate the court first, then deactivating sport should succeed
    await Court.updateMany({ sportId: sport._id }, { isActive: false });
    const resDeactivateSuccess = await request(app)
      .patch(`/api/v1/admin/sports/${sport._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });

    assert.equal(resDeactivateSuccess.status, 200);
    assert.equal(resDeactivateSuccess.body.data.isActive, false);
  });

  await t.test('DELETE /api/v1/admin/sports/:id should prevent hard delete if sport is in use', async () => {
    const sport = await Sport.create({
      name: 'P06Test-Bơi Lội',
      normalizedName: 'P06TEST-BƠI LỘI',
      isActive: true,
    });

    // 1. Link sport to FacilitySport
    const dummyFacilityId = new mongoose.Types.ObjectId();
    await FacilitySport.create({
      facilityId: dummyFacilityId,
      sportId: sport._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });

    // 2. Attempt to delete sport in use -> MUST FAIL (ADM-03)
    const resDeleteFail = await request(app)
      .delete(`/api/v1/admin/sports/${sport._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resDeleteFail.status, 400);
    assert.equal(resDeleteFail.body.error.code, 'SPORT_IN_USE');

    // 3. Remove FacilitySport link, then deletion should succeed
    await FacilitySport.deleteMany({ sportId: sport._id });
    const resDeleteSuccess = await request(app)
      .delete(`/api/v1/admin/sports/${sport._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(resDeleteSuccess.status, 200);
    assert.equal(resDeleteSuccess.body.success, true);
  });

  await t.test('Customer should be rejected from calling Admin Sports endpoints (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/v1/admin/sports')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Hacked Sport' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });
});
