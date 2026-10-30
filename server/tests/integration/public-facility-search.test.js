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

test('Public Facility Listing, Filtering & Privacy (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Facility.deleteMany({});
    await FacilitySport.deleteMany({});
    await Court.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-search-/ } });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let activeOwner = null;
  let lockedOwner = null;
  let unactivatedOwner = null;
  let sportBadminton = null;
  let sportFootball = null;

  let facPublished1 = null;
  let facPublished2 = null;
  let facDraft = null;
  let facPaused = null;
  let facAdminLocked = null;
  let facLockedOwner = null;
  let facNoActiveCourt = null;

  t.beforeEach(async () => {
    await Facility.deleteMany({});
    await FacilitySport.deleteMany({});
    await Court.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-search-/ } });
    await AuthSession.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    // 1. Active Owner
    activeOwner = await User.create({
      email: `active-owner-p07-search-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Hoạt Động',
      phoneNumber: '0944000001',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });

    // 2. Locked Owner
    lockedOwner = await User.create({
      email: `locked-owner-p07-search-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Bị Khóa',
      phoneNumber: '0944000002',
      role: 'OWNER',
      isLocked: true,
      lockReason: 'Vi phạm chính sách',
      tokenVersion: 1,
      emailVerifiedAt: now,
      activatedAt: now,
    });

    // 3. Unactivated Owner
    unactivatedOwner = await User.create({
      email: `unact-owner-p07-search-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Chưa Kích Hoạt',
      phoneNumber: '0944000003',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: null, // Not activated!
    });

    // Sports
    sportBadminton = await Sport.create({
      name: 'Cầu Lông',
      normalizedName: 'CAU LONG',
      description: 'Môn cầu lông',
      isActive: true,
    });

    sportFootball = await Sport.create({
      name: 'Bóng Đá',
      normalizedName: 'BONG DA',
      description: 'Môn bóng đá',
      isActive: true,
    });

    // Facilities
    // 1. Published 1: Hanoi, Badminton + Football, minPrice: 120,000
    facPublished1 = await Facility.create({
      ownerId: activeOwner._id,
      name: 'CLB Cầu Lông Ba Đình',
      description: 'Cơ sở cầu lông và bóng đá hàng đầu',
      address: '10 Kim Mã',
      province: 'Hà Nội',
      phoneNumber: '0944111111',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
      images: [
        { id: 'img-1', url: '/uploads/facilities/badinh-cover.jpg', isCover: true, order: 0 },
      ],
    });

    const fs1Badminton = await FacilitySport.create({
      facilityId: facPublished1._id,
      sportId: sportBadminton._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    await Court.create({
      facilityId: facPublished1._id,
      facilitySportId: fs1Badminton._id,
      sportId: sportBadminton._id,
      name: 'Sân Cầu Lông 1',
      pricePerHourVnd: 120000,
      priceVersion: 1,
      isActive: true,
    });

    await Court.create({
      facilityId: facPublished1._id,
      facilitySportId: fs1Badminton._id,
      sportId: sportBadminton._id,
      name: 'Sân Cầu Lông 2',
      pricePerHourVnd: 150000,
      priceVersion: 1,
      isActive: true,
    });

    // 2. Published 2: TP. Hồ Chí Minh, Football, minPrice: 300,000
    facPublished2 = await Facility.create({
      ownerId: activeOwner._id,
      name: 'Trung Tâm Thể Thao Sài Gòn Star',
      description: 'Sân bóng đá cỏ nhân tạo cao cấp',
      address: '45 Lê Duẩn',
      province: 'TP. Hồ Chí Minh',
      phoneNumber: '0944222222',
      openTime: '06:00',
      closeTime: '23:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
      images: [
        { id: 'img-2', url: '/uploads/facilities/saigon-cover.jpg', isCover: true, order: 0 },
      ],
    });

    const fs2Football = await FacilitySport.create({
      facilityId: facPublished2._id,
      sportId: sportFootball._id,
      slotStepMinutes: 90,
      configVersion: 1,
    });

    await Court.create({
      facilityId: facPublished2._id,
      facilitySportId: fs2Football._id,
      sportId: sportFootball._id,
      name: 'Sân Bóng Đá 11 Người',
      pricePerHourVnd: 300000,
      priceVersion: 1,
      isActive: true,
    });

    // 3. Draft facility -> should be hidden
    facDraft = await Facility.create({
      ownerId: activeOwner._id,
      name: 'Cơ Sở Đang Nháp',
      address: '1 Phố Nháp',
      province: 'Hà Nội',
      phoneNumber: '0944333333',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'DRAFT',
      isLockedByAdmin: false,
    });

    // 4. Paused facility -> should be hidden
    facPaused = await Facility.create({
      ownerId: activeOwner._id,
      name: 'Cơ Sở Tạm Dừng',
      address: '2 Phố Tạm Dừng',
      province: 'Hà Nội',
      phoneNumber: '0944444444',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PAUSED',
      isLockedByAdmin: false,
    });

    // 5. Admin locked facility -> should be hidden
    facAdminLocked = await Facility.create({
      ownerId: activeOwner._id,
      name: 'Cơ Sở Bị Admin Khóa',
      address: '3 Phố Khóa',
      province: 'Hà Nội',
      phoneNumber: '0944555555',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: true,
      lockReason: 'Khóa vi phạm',
    });

    // 6. Locked owner facility -> should be hidden
    facLockedOwner = await Facility.create({
      ownerId: lockedOwner._id,
      name: 'Cơ Sở Của Owner Bị Khóa',
      address: '4 Phố Owner Khóa',
      province: 'Hà Nội',
      phoneNumber: '0944666666',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    // 7. Facility without active courts -> should be hidden
    facNoActiveCourt = await Facility.create({
      ownerId: activeOwner._id,
      name: 'Cơ Sở Không Có Sân Hoạt Động',
      address: '5 Phố Không Sân',
      province: 'Hà Nội',
      phoneNumber: '0944777777',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });
  });

  await t.test('PUB-01: Public listing only returns PUBLISHED, unlocked facilities with active owner & active courts', async () => {
    const res = await request(app).get('/api/v1/facilities');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    // Exactly 2 facilities should be visible: facPublished1 and facPublished2
    assert.strictEqual(res.body.data.length, 2);
    const ids = res.body.data.map((f) => f.id);
    assert.ok(ids.includes(facPublished1._id.toString()));
    assert.ok(ids.includes(facPublished2._id.toString()));

    // Excluded check
    assert.ok(!ids.includes(facDraft._id.toString()));
    assert.ok(!ids.includes(facPaused._id.toString()));
    assert.ok(!ids.includes(facAdminLocked._id.toString()));
    assert.ok(!ids.includes(facLockedOwner._id.toString()));
    assert.ok(!ids.includes(facNoActiveCourt._id.toString()));
  });

  await t.test('PUB-02: Search & Filters (Keyword, Sport, Province, Price Range)', async () => {
    // 1. Keyword search 'Ba Đình' -> matches facPublished1
    const resKeyword = await request(app).get('/api/v1/facilities?keyword=Ba%20Đình');
    assert.strictEqual(resKeyword.status, 200);
    assert.strictEqual(resKeyword.body.data.length, 1);
    assert.strictEqual(resKeyword.body.data[0].id, facPublished1._id.toString());

    // 2. Keyword search by address 'Lê Duẩn' -> matches facPublished2
    const resAddress = await request(app).get('/api/v1/facilities?keyword=Lê%20Duẩn');
    assert.strictEqual(resAddress.status, 200);
    assert.strictEqual(resAddress.body.data.length, 1);
    assert.strictEqual(resAddress.body.data[0].id, facPublished2._id.toString());

    // 3. Filter by sport 'Badminton' -> matches facPublished1
    const resSport = await request(app).get(`/api/v1/facilities?sportId=${sportBadminton._id}`);
    assert.strictEqual(resSport.status, 200);
    assert.strictEqual(resSport.body.data.length, 1);
    assert.strictEqual(resSport.body.data[0].id, facPublished1._id.toString());

    // 4. Filter by province 'TP. Hồ Chí Minh' -> matches facPublished2
    const resProvince = await request(app).get('/api/v1/facilities?province=TP.%20H%E1%BB%93%20Ch%C3%AD%20Minh');
    assert.strictEqual(resProvince.status, 200);
    assert.strictEqual(resProvince.body.data.length, 1);
    assert.strictEqual(resProvince.body.data[0].id, facPublished2._id.toString());

    // 5. Filter by price range: minPrice=200000 -> only facPublished2 (300,000 >= 200,000)
    const resPrice = await request(app).get('/api/v1/facilities?minPrice=200000');
    assert.strictEqual(resPrice.status, 200);
    assert.strictEqual(resPrice.body.data.length, 1);
    assert.strictEqual(resPrice.body.data[0].id, facPublished2._id.toString());
  });

  await t.test('PUB-02: Sorting by price and name', async () => {
    // price_asc: facPublished1 (120,000) then facPublished2 (300,000)
    const resPriceAsc = await request(app).get('/api/v1/facilities?sort=price_asc');
    assert.strictEqual(resPriceAsc.status, 200);
    assert.strictEqual(resPriceAsc.body.data[0].id, facPublished1._id.toString());
    assert.strictEqual(resPriceAsc.body.data[1].id, facPublished2._id.toString());

    // price_desc: facPublished2 (300,000) then facPublished1 (120,000)
    const resPriceDesc = await request(app).get('/api/v1/facilities?sort=price_desc');
    assert.strictEqual(resPriceDesc.status, 200);
    assert.strictEqual(resPriceDesc.body.data[0].id, facPublished2._id.toString());
    assert.strictEqual(resPriceDesc.body.data[1].id, facPublished1._id.toString());
  });

  await t.test('PUB-03: Public Detail API & Privacy Protection', async () => {
    const res = await request(app).get(`/api/v1/facilities/${facPublished1._id}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, facPublished1._id.toString());
    assert.strictEqual(res.body.data.name, 'CLB Cầu Lông Ba Đình');
    assert.strictEqual(res.body.data.minPricePerHour, 120000);
    assert.strictEqual(res.body.data.coverImageUrl, '/uploads/facilities/badinh-cover.jpg');

    // Sports & Courts included
    assert.strictEqual(res.body.data.facilitySports.length, 1);
    assert.strictEqual(res.body.data.facilitySports[0].sportName, 'Cầu Lông');
    assert.strictEqual(res.body.data.courts.length, 2);

    // CRITICAL: Privacy check - NO passwordHash, tokenVersion, or private auth credentials in payload
    assert.strictEqual(res.body.data.passwordHash, undefined);
    assert.strictEqual(res.body.data.tokenVersion, undefined);
    assert.strictEqual(res.body.data.ownerEmail, undefined);

    // Accessing draft facility publicly returns 404
    const draftRes = await request(app).get(`/api/v1/facilities/${facDraft._id}`);
    assert.strictEqual(draftRes.status, 404);
    assert.strictEqual(draftRes.body.error.code, 'FACILITY_NOT_FOUND');

    // Accessing admin locked facility publicly returns 404
    const lockedRes = await request(app).get(`/api/v1/facilities/${facAdminLocked._id}`);
    assert.strictEqual(lockedRes.status, 404);
    assert.strictEqual(lockedRes.body.error.code, 'FACILITY_NOT_FOUND');
  });
});

