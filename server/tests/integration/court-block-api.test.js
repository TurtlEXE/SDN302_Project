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
import { CourtBlock } from '../../src/models/court-block.model.js';
import { Sport } from '../../src/models/sport.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { PaymentOrder } from '../../src/models/payment-order.model.js';
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { ActionLog } from '../../src/models/action-log.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { addDaysToDateVN } from '../../src/services/booking/booking-policy.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('CourtBlock Management & Schedule Blocking API (Integration - P10)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await CourtBlock.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p10-block-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});
    await disconnectDB();
  });

  let customer = null;
  let owner = null;
  let otherOwner = null;

  let customerToken = null;
  let ownerToken = null;
  let otherOwnerToken = null;

  let facility = null;
  let facilitySport = null;
  let court = null;
  let sport = null;

  t.beforeEach(async () => {
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await CourtBlock.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p10-block-/ } });
    await AuthSession.deleteMany({});
    await ActionLog.deleteMany({});

    const passwordHash = await bcrypt.hash('SecurePassword@123', 10);
    const now = new Date();

    customer = await User.create({
      email: `customer-p10-block-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P10 Block',
      phoneNumber: '0901000020',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const s1 = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, s1).accessToken;

    owner = await User.create({
      email: `owner-p10-block-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân P10 Block',
      phoneNumber: '0901000021',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
      emailVerifiedAt: now,
    });
    const s2 = await AuthSession.create({
      userId: owner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    ownerToken = jwtService.signAccessToken(owner, s2).accessToken;

    otherOwner = await User.create({
      email: `other-owner-p10-block-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Khác P10 Block',
      phoneNumber: '0901000022',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      activatedAt: now,
      emailVerifiedAt: now,
    });
    const s3 = await AuthSession.create({
      userId: otherOwner._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    otherOwnerToken = jwtService.signAccessToken(otherOwner, s3).accessToken;

    sport = await Sport.create({
      name: `Tennis P10 ${Date.now()}`,
      normalizedName: `tennis p10 ${Date.now()}`,
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'CLB Tennis Ngôi Sao P10',
      address: '789 Đường Kim Mã',
      province: 'Hà Nội',
      phoneNumber: '0907777777',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      isLockedByAdmin: false,
    });

    facilitySport = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport._id,
      slotStepMinutes: 60,
      configVersion: 1,
    });

    court = await Court.create({
      facilityId: facility._id,
      facilitySportId: facilitySport._id,
      sportId: sport._id,
      name: 'Sân Tennis 1',
      pricePerHourVnd: 200000,
      isActive: true,
    });
  });

  const getTargetDate = () => addDaysToDateVN(getCurrentDateVN(), 3);

  await t.test('1. Owner creates CourtBlock with contiguous slots merged (OWN-06, Criteria 9, 31)', async () => {
    const bookingDate = getTargetDate();

    // Owner creates block for 08:00–09:00 and 09:00–10:00 (contiguous 60m slots)
    const blockRes = await request(app)
      .post('/api/v1/owner/court-blocks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        selectedSlots: [
          { startTime: '08:00', endTime: '09:00' },
          { startTime: '09:00', endTime: '10:00' },
        ],
        reason: 'Bảo trì bề mặt sân',
      });

    assert.equal(blockRes.status, 201);
    assert.equal(blockRes.body.success, true);
    assert.equal(blockRes.body.data.length, 1);
    assert.equal(blockRes.body.data[0].startTime, '08:00');
    assert.equal(blockRes.body.data[0].endTime, '10:00');
    assert.equal(blockRes.body.data[0].isActive, true);

    // Verify Schedule API shows both slots as BLOCKED
    const schedRes = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${bookingDate}`);
    assert.equal(schedRes.status, 200);

    const slot08 = schedRes.body.data.slots.find((s) => s.startTime === '08:00');
    const slot09 = schedRes.body.data.slots.find((s) => s.startTime === '09:00');
    assert.equal(slot08.status, 'BLOCKED');
    assert.equal(slot09.status, 'BLOCKED');

    // ActionLog recorded
    const log = await ActionLog.findOne({ action: 'CREATE_COURT_BLOCK', targetId: court._id });
    assert.ok(log);
    assert.equal(log.actorRole, 'OWNER');
    assert.equal(log.reason, 'Bảo trì bề mặt sân');
  });

  await t.test('2. Mutual conflict prevention between Booking and CourtBlock (Criterion 9, Criterion 31)', async () => {
    const bookingDate = getTargetDate();

    // 1. Create a block for 10:00–11:00
    await request(app)
      .post('/api/v1/owner/court-blocks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        selectedSlots: [{ startTime: '10:00', endTime: '11:00' }],
        reason: 'Lớp huấn luyện riêng',
      });

    // 2. Customer tries to book 10:00–11:00 -> 409 SCHEDULE_CONFLICT
    const bookRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '10:00', endTime: '11:00' }],
        contactName: 'Khách Hàng P10 Block',
        contactPhone: '0901000020',
        idempotencyKey: 'block-conflict-key-1',
      });

    assert.equal(bookRes.status, 409);
    assert.equal(bookRes.body.error.code, 'SCHEDULE_CONFLICT');

    // 3. Customer books 14:00–15:00 successfully
    const bookSuccessRes = await request(app)
      .post('/api/v1/booking-requests')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        configVersion: 1,
        selectedSlots: [{ startTime: '14:00', endTime: '15:00' }],
        contactName: 'Khách Hàng P10 Block',
        contactPhone: '0901000020',
        idempotencyKey: 'block-conflict-key-2',
      });
    assert.equal(bookSuccessRes.status, 201);

    // 4. Owner tries to block 14:00–15:00 -> 409 SCHEDULE_CONFLICT
    const blockConflictRes = await request(app)
      .post('/api/v1/owner/court-blocks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        selectedSlots: [{ startTime: '14:00', endTime: '15:00' }],
        reason: 'Muốn khóa khung giờ đã có khách đặt',
      });

    assert.equal(blockConflictRes.status, 409);
    assert.equal(blockConflictRes.body.error.code, 'SCHEDULE_CONFLICT');
  });

  await t.test('3. Owner deletes CourtBlock to reopen schedule (OWN-06)', async () => {
    const bookingDate = getTargetDate();

    // Create block
    const blockRes = await request(app)
      .post('/api/v1/owner/court-blocks')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        selectedSlots: [{ startTime: '16:00', endTime: '17:00' }],
        reason: 'Sửa bóng đèn',
      });
    assert.equal(blockRes.status, 201);
    const blockId = blockRes.body.data[0].id;

    // Delete block
    const delRes = await request(app)
      .delete(`/api/v1/owner/court-blocks/${blockId}`)
      .set('Authorization', `Bearer ${ownerToken}`);

    assert.equal(delRes.status, 204);

    // Verify DB
    const blk = await CourtBlock.findById(blockId);
    assert.equal(blk.isActive, false);

    // Schedule should be AVAILABLE
    const schedRes = await request(app)
      .get(`/api/v1/courts/${court._id}/schedule?date=${bookingDate}`);
    const slot16 = schedRes.body.data.slots.find((s) => s.startTime === '16:00');
    assert.equal(slot16.status, 'AVAILABLE');
  });

  await t.test('4. Cross-owner security: Owner A cannot block or delete Owner B court (Criterion 4)', async () => {
    const bookingDate = getTargetDate();

    // otherOwner attempts to block owner's court
    const blockRes = await request(app)
      .post('/api/v1/owner/court-blocks')
      .set('Authorization', `Bearer ${otherOwnerToken}`)
      .send({
        courtId: court._id.toString(),
        bookingDate,
        selectedSlots: [{ startTime: '18:00', endTime: '19:00' }],
        reason: 'Chủ khác can thiệp',
      });

    assert.equal(blockRes.status, 403);

    // Create valid block by owner
    const validBlock = await CourtBlock.create({
      courtId: court._id,
      bookingDate,
      startTime: '19:00',
      endTime: '20:00',
      startMinutes: 1140,
      endMinutes: 1200,
      reason: 'Bảo trì',
      createdBy: owner._id,
      isActive: true,
    });

    // otherOwner attempts to delete owner's block
    const delRes = await request(app)
      .delete(`/api/v1/owner/court-blocks/${validBlock._id}`)
      .set('Authorization', `Bearer ${otherOwnerToken}`);

    assert.equal(delRes.status, 403);
  });
});
