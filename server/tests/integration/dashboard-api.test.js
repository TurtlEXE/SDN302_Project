import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { Facility } from '../../src/models/facility.model.js';
import { FacilitySport } from '../../src/models/facility-sport.model.js';
import { Court } from '../../src/models/court.model.js';
import { Sport } from '../../src/models/sport.model.js';
import { User } from '../../src/models/user.model.js';
import { AuthSession } from '../../src/models/auth-session.model.js';
import { BookingRequest } from '../../src/models/booking-request.model.js';
import { Booking } from '../../src/models/booking.model.js';
import { PaymentOrder } from '../../src/models/payment-order.model.js';
import { PaymentTransaction } from '../../src/models/payment-transaction.model.js';
import { RefundCase } from '../../src/models/refund-case.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';
import { jwtService } from '../../src/services/jwt.service.js';

test('Dashboard & Reporting APIs (Integration - P13)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await RefundCase.deleteMany({});
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await PaymentTransaction.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await EmailOutbox.deleteMany({});
    await User.deleteMany({ email: { $regex: /p13-dash-/ } });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let admin = null;
  let adminToken = null;
  let owner1 = null;
  let owner1Token = null;
  let owner2 = null;
  let owner2Token = null;
  let customer = null;
  let customerToken = null;

  let sport = null;
  let facility1 = null;
  let facility2 = null;
  let court1 = null;
  let court2 = null;

  const todayStr = getCurrentDateVN();

  await t.test('0. Setup test users, facilities and seed bookings', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const now = new Date();

    // Admin
    admin = await User.create({
      email: `admin-p13-dash-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Admin P13',
      phoneNumber: '0901111111',
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

    // Owner 1
    owner1 = await User.create({
      email: `owner1-p13-dash-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 1',
      phoneNumber: '0902222221',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const sOwner1 = await AuthSession.create({
      userId: owner1._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    owner1Token = jwtService.signAccessToken(owner1, sOwner1).accessToken;

    // Owner 2
    owner2 = await User.create({
      email: `owner2-p13-dash-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân 2',
      phoneNumber: '0902222222',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });
    const sOwner2 = await AuthSession.create({
      userId: owner2._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    owner2Token = jwtService.signAccessToken(owner2, sOwner2).accessToken;

    // Customer
    customer = await User.create({
      email: `customer-p13-dash-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng P13',
      phoneNumber: '0903333333',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });
    const sCust = await AuthSession.create({
      userId: customer._id,
      absoluteExpiresAt: new Date(Date.now() + 86400000),
    });
    customerToken = jwtService.signAccessToken(customer, sCust).accessToken;

    // Sport
    sport = await Sport.create({
      name: `Cầu Lông P13 ${Date.now()}`,
      normalizedName: `CAU LONG P13 ${Date.now()}`,
      isActive: true,
    });

    // Facilities
    facility1 = await Facility.create({
      ownerId: owner1._id,
      name: 'Cơ Sở 1 P13',
      address: '123 Phố A, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902222221',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      images: [{ id: 'img-1', url: 'https://example.com/1.jpg', isCover: true }],
    });

    facility2 = await Facility.create({
      ownerId: owner2._id,
      name: 'Cơ Sở 2 P13',
      address: '456 Phố B, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902222222',
      openTime: '06:00',
      closeTime: '22:00',
      status: 'PUBLISHED',
      images: [{ id: 'img-2', url: 'https://example.com/2.jpg', isCover: true }],
    });

    const fs1 = await FacilitySport.create({
      facilityId: facility1._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    const fs2 = await FacilitySport.create({
      facilityId: facility2._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court1 = await Court.create({
      facilityId: facility1._id,
      facilitySportId: fs1._id,
      sportId: sport._id,
      name: 'Sân 1',
      pricePerHourVnd: 100000,
      isActive: true,
    });

    court2 = await Court.create({
      facilityId: facility2._id,
      facilitySportId: fs2._id,
      sportId: sport._id,
      name: 'Sân 2',
      pricePerHourVnd: 150000,
      isActive: true,
    });

    // Create bookings for Facility 1 (Owner 1):
    // Booking A: Today, CONFIRMED/PAID, 100.000 VND
    const brA = await BookingRequest.create({
      requestNumber: `REQ-DASH-A-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      courtId: court1._id,
      facilityId: facility1._id,
      bookingDate: todayStr,
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-A-${Date.now()}`,
      payloadFingerprint: `FP-A-${Date.now()}`,
      holdExpiresAt: new Date(Date.now() + 600000),
    });
    const poA = await PaymentOrder.create({
      bookingRequestId: brA._id,
      vnpayTxnRef: `TXN-A-${Date.now()}`,
      expectedAmountVnd: 100000,
      status: 'PAID',
      expiresAt: new Date(Date.now() + 600000),
    });
    await PaymentTransaction.create({
      paymentOrderId: poA._id,
      vnpayTransactionNo: `VNPAY-A-${Date.now()}`,
      vnpayTxnRef: poA.vnpayTxnRef,
      amountVnd: 100000,
      responseCode: '00',
      transactionStatus: '00',
      isAccepted: true,
      rawCallbackData: { vnp_Amount: '10000000' },
    });
    await Booking.create({
      bookingRequestId: brA._id,
      bookingCode: `BK-DASH-A-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility1._id,
      courtId: court1._id,
      bookingDate: todayStr,
      startTime: '18:00',
      endTime: '19:00',
      startMinutes: 1080,
      endMinutes: 1140,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: brA.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      snapshot: {
        facilityName: facility1.name,
        facilityAddress: facility1.address,
        courtName: court1.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    // Booking B: Yesterday, COMPLETED/PAID, 200.000 VND
    const brB = await BookingRequest.create({
      requestNumber: `REQ-DASH-B-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      courtId: court1._id,
      facilityId: facility1._id,
      bookingDate: '2026-10-25',
      totalAmountVnd: 200000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-B-${Date.now()}`,
      payloadFingerprint: `FP-B-${Date.now()}`,
      holdExpiresAt: new Date(Date.now() + 600000),
    });
    const poB = await PaymentOrder.create({
      bookingRequestId: brB._id,
      vnpayTxnRef: `TXN-B-${Date.now()}`,
      expectedAmountVnd: 200000,
      status: 'PAID',
      expiresAt: new Date(Date.now() + 600000),
    });
    await PaymentTransaction.create({
      paymentOrderId: poB._id,
      vnpayTransactionNo: `VNPAY-B-${Date.now()}`,
      vnpayTxnRef: poB.vnpayTxnRef,
      amountVnd: 200000,
      responseCode: '00',
      transactionStatus: '00',
      isAccepted: true,
      rawCallbackData: { vnp_Amount: '20000000' },
    });
    await Booking.create({
      bookingRequestId: brB._id,
      bookingCode: `BK-DASH-B-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility1._id,
      courtId: court1._id,
      bookingDate: '2026-10-25',
      startTime: '08:00',
      endTime: '10:00',
      startMinutes: 480,
      endMinutes: 600,
      durationMinutes: 120,
      pricePerHourVnd: 100000,
      totalPriceVnd: 200000,
      allocatedAmountVnd: 200000,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      holdExpiresAt: brB.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      completion: { completedAt: now, completedBy: owner1._id },
      snapshot: {
        facilityName: facility1.name,
        facilityAddress: facility1.address,
        courtName: court1.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    // Booking C: Yesterday, CANCELLED/REFUNDED, 100.000 VND
    const brC = await BookingRequest.create({
      requestNumber: `REQ-DASH-C-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      courtId: court1._id,
      facilityId: facility1._id,
      bookingDate: '2026-10-25',
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-C-${Date.now()}`,
      payloadFingerprint: `FP-C-${Date.now()}`,
      holdExpiresAt: new Date(Date.now() + 600000),
    });
    const poC = await PaymentOrder.create({
      bookingRequestId: brC._id,
      vnpayTxnRef: `TXN-C-${Date.now()}`,
      expectedAmountVnd: 100000,
      status: 'PAID',
      expiresAt: new Date(Date.now() + 600000),
    });
    const ptC = await PaymentTransaction.create({
      paymentOrderId: poC._id,
      vnpayTransactionNo: `VNPAY-C-${Date.now()}`,
      vnpayTxnRef: poC.vnpayTxnRef,
      amountVnd: 100000,
      responseCode: '00',
      transactionStatus: '00',
      isAccepted: true,
      rawCallbackData: { vnp_Amount: '10000000' },
    });
    const bkC = await Booking.create({
      bookingRequestId: brC._id,
      bookingCode: `BK-DASH-C-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility1._id,
      courtId: court1._id,
      bookingDate: '2026-10-25',
      startTime: '10:00',
      endTime: '11:00',
      startMinutes: 600,
      endMinutes: 660,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      holdExpiresAt: brC.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      cancellation: { cancelledAt: now, cancelledBy: admin._id, reason: 'Test refund' },
      snapshot: {
        facilityName: facility1.name,
        facilityAddress: facility1.address,
        courtName: court1.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });
    await RefundCase.create({
      refundCaseCode: `RF-DASH-${Date.now()}`,
      bookingId: bkC._id,
      paymentTransactionId: ptC._id,
      refundAmountVnd: 100000,
      reason: 'Test refund',
      status: 'REFUNDED',
      proofReference: 'UNC-TEST-REFUND',
      processedBy: admin._id,
      processedAt: now,
    });
  });

  await t.test('1. GET /api/v1/owner/dashboard: enforces authentication & OWNER role', async () => {
    // 401 without auth
    const resNoAuth = await request(app).get('/api/v1/owner/dashboard');
    assert.equal(resNoAuth.status, 401);

    // 403 with CUSTOMER token
    const resCust = await request(app)
      .get('/api/v1/owner/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(resCust.status, 403);
  });

  await t.test('2. GET /api/v1/owner/dashboard: returns accurate metrics and strictly separates money (Criterion 35)', async () => {
    const res = await request(app)
      .get('/api/v1/owner/dashboard')
      .set('Authorization', `Bearer ${owner1Token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    // Bookings today: Booking A is today and CONFIRMED
    assert.equal(data.bookingsToday, 1);
    // Completed bookings: Booking B is COMPLETED
    assert.equal(data.completedBookings, 1);
    // Cancelled bookings: Booking C is CANCELLED
    assert.equal(data.cancelledBookings, 1);

    // Financial calculations:
    // Booking A (100k) + Booking B (200k) + Booking C (100k) = 400.000 total revenue
    assert.equal(data.totalRevenueVnd, 400000);
    // Refunded: Booking C refund = 100.000
    assert.equal(data.totalRefundedVnd, 100000);
    // Net revenue: 400.000 - 100.000 = 300.000
    assert.equal(data.netRevenueVnd, 300000);
    assert.equal(data.pendingRefundVnd, 0);

    // Array checks
    assert.ok(Array.isArray(data.upcomingBookings));
    assert.ok(Array.isArray(data.unprocessedPastBookings));
  });

  await t.test('3. GET /api/v1/owner/dashboard: enforces facility isolation (cannot access other owner facility)', async () => {
    const resForbidden = await request(app)
      .get(`/api/v1/owner/dashboard?facilityId=${facility2._id}`)
      .set('Authorization', `Bearer ${owner1Token}`);

    assert.equal(resForbidden.status, 403);
    assert.equal(resForbidden.body.error.code, 'FORBIDDEN');
  });

  await t.test('4. GET /api/v1/owner/dashboard: supports date range filters', async () => {
    const resRange = await request(app)
      .get('/api/v1/owner/dashboard?startDate=2026-10-24&endDate=2026-10-26')
      .set('Authorization', `Bearer ${owner1Token}`);

    assert.equal(resRange.status, 200);
    const data = resRange.body.data;
    // In this range: only Booking B and Booking C (total 300k, refunded 100k, net 200k)
    assert.equal(data.completedBookings, 1);
    assert.equal(data.cancelledBookings, 1);
    assert.equal(data.totalRevenueVnd, 300000);
    assert.equal(data.totalRefundedVnd, 100000);
    assert.equal(data.netRevenueVnd, 200000);
  });

  await t.test('5. GET /api/v1/admin/dashboard: enforces authentication & ADMIN role', async () => {
    // 401 without auth
    const resNoAuth = await request(app).get('/api/v1/admin/dashboard');
    assert.equal(resNoAuth.status, 401);

    // 403 with OWNER token
    const resOwner = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${owner1Token}`);
    assert.equal(resOwner.status, 403);

    // 403 with CUSTOMER token
    const resCust = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    assert.equal(resCust.status, 403);
  });

  await t.test('6. GET /api/v1/admin/dashboard: returns overall operational stats and status breakdown (ADM-06)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const data = res.body.data;

    assert.ok(data.totalCustomers >= 1);
    assert.ok(data.totalOwners >= 2);
    assert.ok(data.totalPublishedFacilities >= 2);
    assert.ok(data.totalActiveCourts >= 2);

    // Check status map
    assert.ok(data.bookingsByStatus);
    assert.equal(typeof data.bookingsByStatus.CONFIRMED, 'number');
    assert.equal(typeof data.bookingsByStatus.COMPLETED, 'number');
    assert.equal(typeof data.bookingsByStatus.CANCELLED, 'number');

    // Check financial figures
    assert.ok(data.totalCollectedVnd >= 400000);
    assert.ok(data.totalRefundedVnd >= 100000);
    assert.equal(data.netCollectedVnd, data.totalCollectedVnd - data.totalRefundedVnd);
  });
});
