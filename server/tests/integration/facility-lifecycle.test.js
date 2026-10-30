import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { Facility } from '../../src/models/facility.model.js';
import { FacilitySport } from '../../src/models/facility-sport.model.js';
import { Court } from '../../src/models/court.model.js';
import { Sport } from '../../src/models/sport.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Facility Lifecycle, Publishing Guards & Admin Lockout (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Facility.deleteMany({});
    await FacilitySport.deleteMany({});
    await Court.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-lifecycle-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let owner1 = null;
  let owner1Token = null;
  let owner2 = null;
  let owner2Token = null;
  let admin = null;
  let adminToken = null;
  let customerToken = null;
  let sport = null;

  t.beforeEach(async () => {
    await Facility.deleteMany({});
    await FacilitySport.deleteMany({});
    await Court.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-lifecycle-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    // 1. Owner 1
    owner1 = await User.create({
      email: `owner1-p07-lifecycle-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 1',
      phoneNumber: '0911000001',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const s1 = await AuthSession.create({
      userId: owner1._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    owner1Token = jwtService.signAccessToken(owner1, s1).accessToken;

    // 2. Owner 2
    owner2 = await User.create({
      email: `owner2-p07-lifecycle-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 2',
      phoneNumber: '0911000002',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const s2 = await AuthSession.create({
      userId: owner2._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    owner2Token = jwtService.signAccessToken(owner2, s2).accessToken;

    // 3. Admin
    admin = await User.create({
      email: `admin-p07-lifecycle-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Quản Trị Viên',
      phoneNumber: '0911000003',
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

    // 4. Customer
    const customer = await User.create({
      email: `customer-p07-lifecycle-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng',
      phoneNumber: '0911000004',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sCustomer = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, sCustomer).accessToken;

    // Sport
    sport = await Sport.create({
      name: 'Cầu Lông',
      normalizedName: 'CAU LONG',
      description: 'Môn cầu lông',
      isActive: true,
    });
  });

  await t.test('POST /api/v1/owner/facilities should create new facility in DRAFT status', async () => {
    const res = await request(app)
      .post('/api/v1/owner/facilities')
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({
        name: 'Sân Thể Thao An Bình',
        description: 'Sân đẹp hiện đại',
        address: '123 Đường Số 1',
        province: 'Hà Nội',
        phoneNumber: '0988776655',
        openTime: '06:00',
        closeTime: '22:00',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, 'Sân Thể Thao An Bình');
    assert.strictEqual(res.body.data.status, 'DRAFT');
    assert.strictEqual(res.body.data.isLockedByAdmin, false);
    assert.strictEqual(res.body.data.operatingHoursVersion, 1);
  });

  await t.test('Cross-Owner Isolation (Criteria 4): Owner A cannot read or modify Owner B facility', async () => {
    const fac = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở Của Owner 1',
      address: '123 Đường 1',
      province: 'Hà Nội',
      phoneNumber: '0988000001',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'DRAFT',
    });

    // Owner 2 attempts to read Owner 1 facility
    const getRes = await request(app)
      .get(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner2Token}`);
    assert.strictEqual(getRes.status, 403);
    assert.strictEqual(getRes.body.error.code, 'FORBIDDEN');

    // Owner 2 attempts to update Owner 1 facility
    const patchRes = await request(app)
      .patch(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .send({ name: 'Hacked Facility Name' });
    assert.strictEqual(patchRes.status, 403);
    assert.strictEqual(patchRes.body.error.code, 'FORBIDDEN');

    // Customer cannot access owner endpoints
    const cusRes = await request(app)
      .get(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    assert.strictEqual(cusRes.status, 403);
  });

  await t.test('Publication Guard (OWN-02): Cannot publish facility without at least one active court', async () => {
    const fac = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở Chưa Có Sân',
      address: '456 Phố Mới',
      province: 'Đà Nẵng',
      phoneNumber: '0988000002',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'DRAFT',
    });

    // Attempt to publish without court
    const res = await request(app)
      .patch(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'PUBLISHED' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'FACILITY_CANNOT_PUBLISH');

    // Create a facility sport and court with isActive = false
    const facSport = await FacilitySport.create({
      facilityId: fac._id,
      sportId: sport._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });

    const inactiveCourt = await Court.create({
      facilityId: fac._id,
      facilitySportId: facSport._id,
      sportId: sport._id,
      name: 'Sân 1',
      pricePerHourVnd: 100000,
      priceVersion: 1,
      isActive: false, // Inactive!
    });

    // Still cannot publish with only inactive courts
    const res2 = await request(app)
      .patch(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'PUBLISHED' });

    assert.strictEqual(res2.status, 400);
    assert.strictEqual(res2.body.error.code, 'FACILITY_CANNOT_PUBLISH');

    // Turn court active
    inactiveCourt.isActive = true;
    await inactiveCourt.save();

    // Now publish succeeds!
    const res3 = await request(app)
      .patch(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'PUBLISHED' });

    assert.strictEqual(res3.status, 200);
    assert.strictEqual(res3.body.data.status, 'PUBLISHED');

    // Owner can pause facility
    const res4 = await request(app)
      .patch(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ status: 'PAUSED' });

    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.body.data.status, 'PAUSED');
  });

  await t.test('Admin Lockout & ActionLog Audit Trail (ADM-04)', async () => {
    const fac = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở Cần Khóa',
      address: '789 Đường Lê Lợi',
      province: 'TP. Hồ Chí Minh',
      phoneNumber: '0988000003',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    // Lock without reason -> 400
    const errRes = await request(app)
      .patch(`/api/v1/admin/facilities/${fac._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.strictEqual(errRes.status, 400);

    // Lock with reason
    const lockRes = await request(app)
      .patch(`/api/v1/admin/facilities/${fac._id}/lock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Vi phạm quy định tiếng ồn và an toàn PCCC' });

    assert.strictEqual(lockRes.status, 200);
    assert.strictEqual(lockRes.body.data.isLockedByAdmin, true);
    assert.strictEqual(lockRes.body.data.lockReason, 'Vi phạm quy định tiếng ồn và an toàn PCCC');

    // Verify ActionLog
    const log = await ActionLog.findOne({ targetId: fac._id, action: 'LOCK_FACILITY' });
    assert.ok(log);
    assert.strictEqual(log.actorRole, 'ADMIN');
    assert.strictEqual(log.reason, 'Vi phạm quy định tiếng ồn và an toàn PCCC');
  });

  await t.test('Admin Unlock does NOT auto-convert PAUSED to PUBLISHED (Criteria 21)', async () => {
    // Facility was left in PAUSED status by owner before/during lockout
    const fac = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở Tạm Dừng Đang Bị Khóa',
      address: '111 Phố Huế',
      province: 'Hà Nội',
      phoneNumber: '0988000004',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PAUSED', // PAUSED by owner
      isLockedByAdmin: true,
      lockReason: 'Kiểm tra giấy phép',
    });

    // Admin unlocks
    const unlockRes = await request(app)
      .patch(`/api/v1/admin/facilities/${fac._id}/unlock`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(unlockRes.status, 200);
    assert.strictEqual(unlockRes.body.data.isLockedByAdmin, false);
    assert.strictEqual(unlockRes.body.data.lockReason, null);
    // CRITICAL: status remains PAUSED! Not auto PUBLISHED!
    assert.strictEqual(unlockRes.body.data.status, 'PAUSED');

    // Verify ActionLog
    const unlockLog = await ActionLog.findOne({ targetId: fac._id, action: 'UNLOCK_FACILITY' });
    assert.ok(unlockLog);
    assert.strictEqual(unlockLog.actorRole, 'ADMIN');
  });

  await t.test('Owner cannot self-unlock an admin-locked facility (Criteria 19)', async () => {
    const fac = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở Bị Khóa',
      address: '222 Phố Huế',
      province: 'Hà Nội',
      phoneNumber: '0988000005',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: true,
      lockReason: 'Admin khóa',
    });

    // Owner tries to set isLockedByAdmin = false or unlock via patch
    const patchRes = await request(app)
      .patch(`/api/v1/owner/facilities/${fac._id}`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .send({ isLockedByAdmin: false, status: 'PUBLISHED' });

    // The facility remains locked by admin in DB
    const checkFac = await Facility.findById(fac._id);
    assert.strictEqual(checkFac.isLockedByAdmin, true);
    assert.strictEqual(checkFac.lockReason, 'Admin khóa');
  });
});
