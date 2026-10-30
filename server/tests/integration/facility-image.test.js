import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { Facility } from '../../src/models/facility.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { jwtService } from '../../src/services/jwt.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_FACILITIES_DIR = path.resolve(__dirname, '../../uploads/facilities');

test('Facility Image Management & Upload Limits (Integration)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Facility.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-image-/ } });
    await AuthSession.deleteMany({});
    // Clean up uploaded test files
    if (fs.existsSync(UPLOADS_FACILITIES_DIR)) {
      const files = fs.readdirSync(UPLOADS_FACILITIES_DIR);
      for (const file of files) {
        if (file.includes('test-fac-')) {
          try {
            fs.unlinkSync(path.join(UPLOADS_FACILITIES_DIR, file));
          } catch {
            // ignore
          }
        }
      }
    }
    await disconnectDB();
  });

  let owner1 = null;
  let owner1Token = null;
  let owner2Token = null;
  let facility = null;

  t.beforeEach(async () => {
    await Facility.deleteMany({});
    await User.deleteMany({ email: { $regex: /p07-image-/ } });
    await AuthSession.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    owner1 = await User.create({
      email: `owner1-p07-image-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Quản Lý Ảnh 1',
      phoneNumber: '0933000001',
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

    const owner2 = await User.create({
      email: `owner2-p07-image-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Quản Lý Ảnh 2',
      phoneNumber: '0933000002',
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

    facility = await Facility.create({
      ownerId: owner1._id,
      name: 'test-fac-San-Bong-Da',
      address: '200 Điện Biên Phủ',
      province: 'Bình Thạnh',
      phoneNumber: '0933111222',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'DRAFT',
      images: [],
    });
  });

  await t.test('POST /api/v1/owner/facilities/:id/images should upload image and auto-assign cover to first image', async () => {
    const dummyJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

    const res = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', dummyJpgBuffer, 'cover-photo.jpg');

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.strictEqual(res.body.data.isCover, true);
    assert.ok(res.body.data.url.startsWith('/uploads/facilities/'));

    // Check DB
    const checkFac = await Facility.findById(facility._id);
    assert.strictEqual(checkFac.images.length, 1);
    assert.strictEqual(checkFac.images[0].isCover, true);
  });

  await t.test('Upload validation: rejects unsupported formats and files > 5MB', async () => {
    // 1. Text file rejected
    const txtBuffer = Buffer.from('this is not an image');
    const txtRes = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', txtBuffer, 'document.txt');

    assert.strictEqual(txtRes.status, 400);
    assert.strictEqual(txtRes.body.error.code, 'INVALID_FILE_TYPE');

    // 2. Large file > 5MB rejected
    const largeBuffer = Buffer.alloc(5 * 1024 * 1024 + 1024); // 5MB + 1KB
    const largeRes = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', largeBuffer, 'huge.jpg');

    assert.strictEqual(largeRes.status, 400);
    assert.strictEqual(largeRes.body.error.code, 'FILE_TOO_LARGE');
  });

  await t.test('Set cover image & Delete image: cover transfers when cover image is deleted', async () => {
    const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    // Upload image 1 (will be auto cover)
    const img1Res = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', dummyJpg, 'img1.jpg');

    const img1Id = img1Res.body.data.id;

    // Upload image 2 (not cover)
    const img2Res = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', dummyJpg, 'img2.jpg');

    const img2Id = img2Res.body.data.id;
    assert.strictEqual(img2Res.body.data.isCover, false);

    // Explicitly set image 2 as cover
    const setCoverRes = await request(app)
      .patch(`/api/v1/owner/facilities/${facility._id}/images/${img2Id}/set-cover`)
      .set('Authorization', `Bearer ${owner1Token}`);

    assert.strictEqual(setCoverRes.status, 200);

    const facAfterCover = await Facility.findById(facility._id);
    const img1 = facAfterCover.images.find((i) => i.id === img1Id);
    const img2 = facAfterCover.images.find((i) => i.id === img2Id);
    assert.strictEqual(img1.isCover, false);
    assert.strictEqual(img2.isCover, true);

    // Delete image 2 (which is current cover)
    const delRes = await request(app)
      .delete(`/api/v1/owner/facilities/${facility._id}/images/${img2Id}`)
      .set('Authorization', `Bearer ${owner1Token}`);

    assert.strictEqual(delRes.status, 204);

    // Verify image 1 has now automatically become cover
    const facAfterDel = await Facility.findById(facility._id);
    assert.strictEqual(facAfterDel.images.length, 1);
    assert.strictEqual(facAfterDel.images[0].id, img1Id);
    assert.strictEqual(facAfterDel.images[0].isCover, true);
  });

  await t.test('Image Limit (OWN-03): Maximum 10 images per facility, 11th image rejected', async () => {
    // Populate facility with 10 dummy images in DB
    const dummyImages = [];
    for (let i = 1; i <= 10; i++) {
      dummyImages.push({
        id: `img-id-${i}`,
        url: `/uploads/facilities/test-fac-${i}.jpg`,
        isCover: i === 1,
        order: i - 1,
      });
    }

    facility.images = dummyImages;
    await facility.save();

    // Attempt 11th image upload
    const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner1Token}`)
      .attach('file', dummyJpg, 'img11.jpg');

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error.code, 'IMAGE_LIMIT_EXCEEDED');
  });

  await t.test('Cross-Owner Image Isolation (Criteria 4): Owner 2 cannot upload or delete images of Owner 1', async () => {
    const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    // Owner 2 tries to upload image to Owner 1 facility
    const uploadRes = await request(app)
      .post(`/api/v1/owner/facilities/${facility._id}/images`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .attach('file', dummyJpg, 'hacked.jpg');

    assert.strictEqual(uploadRes.status, 403);
    assert.strictEqual(uploadRes.body.error.code, 'FORBIDDEN');

    // Owner 2 tries to delete image
    const delRes = await request(app)
      .delete(`/api/v1/owner/facilities/${facility._id}/images/fake-image-id`)
      .set('Authorization', `Bearer ${owner2Token}`);

    assert.strictEqual(delRes.status, 403);
    assert.strictEqual(delRes.body.error.code, 'FORBIDDEN');
  });
});

