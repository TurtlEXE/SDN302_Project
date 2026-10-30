import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
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
import { CourtDaySchedule } from '../../src/models/court-day-schedule.model.js';
import { EmailOutbox } from '../../src/models/email-outbox.model.js';
import { bookingLifecycleService } from '../../src/services/booking/booking-lifecycle.service.js';
import { bookingCleanupService } from '../../src/services/booking/booking-cleanup.service.js';
import { paymentService } from '../../src/services/payment/payment.service.js';
import { getCurrentDateVN } from '../../src/utils/date-time.js';

test('Booking Lifecycle Email Outbox Events (Integration - P13)', async (t) => {
  t.before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  t.after(async () => {
    await EmailOutbox.deleteMany({ recipientEmail: { $regex: /p13-life-/ } });
    await Booking.deleteMany({});
    await BookingRequest.deleteMany({});
    await PaymentOrder.deleteMany({});
    await CourtDaySchedule.deleteMany({});
    await Court.deleteMany({});
    await FacilitySport.deleteMany({});
    await Facility.deleteMany({});
    await Sport.deleteMany({});
    await User.deleteMany({ email: { $regex: /p13-life-/ } });
    await AuthSession.deleteMany({});
    await disconnectDB();
  });

  let customer = null;
  let owner = null;
  let facility = null;
  let court = null;
  let sport = null;
  const todayStr = getCurrentDateVN();

  await t.test('0. Setup users, facility, court', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const now = new Date();

    customer = await User.create({
      email: `customer-p13-life-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Khách Hàng Vòng Đời',
      phoneNumber: '0903111222',
      role: 'CUSTOMER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
    });

    owner = await User.create({
      email: `owner-p13-life-${Date.now()}@sportbooking.local`,
      passwordHash,
      fullName: 'Chủ Sân Vòng Đời',
      phoneNumber: '0902111222',
      role: 'OWNER',
      isLocked: false,
      tokenVersion: 0,
      emailVerifiedAt: now,
      activatedAt: now,
    });

    sport = await Sport.create({
      name: `Cầu Lông P13 Life ${Date.now()}`,
      normalizedName: `CAU LONG P13 LIFE ${Date.now()}`,
      isActive: true,
    });

    facility = await Facility.create({
      ownerId: owner._id,
      name: 'Cơ Sở Vòng Đời P13',
      address: '789 Đường Life, Hà Nội',
      province: 'Hà Nội',
      phoneNumber: '0902111222',
      openTime: '06:00',
      closeTime: '23:00',
      status: 'PUBLISHED',
      images: [{ id: 'img-life', url: 'https://example.com/life.jpg', isCover: true }],
    });

    const fs = await FacilitySport.create({
      facilityId: facility._id,
      sportId: sport._id,
      slotStepMinutes: 30,
      configVersion: 1,
    });

    court = await Court.create({
      facilityId: facility._id,
      facilitySportId: fs._id,
      sportId: sport._id,
      name: 'Sân Life 1',
      pricePerHourVnd: 100000,
      isActive: true,
    });
  });

  await t.test('1. BOOKING_CONFIRMED: enqueues emails for customer AND owner when customer books online (Criterion 39)', async () => {
    const br = await BookingRequest.create({
      requestNumber: `REQ-CONF-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      source: 'CUSTOMER_ONLINE',
      courtId: court._id,
      facilityId: facility._id,
      bookingDate: todayStr,
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-CONF-${Date.now()}`,
      payloadFingerprint: `FP-CONF-${Date.now()}`,
      holdExpiresAt: new Date(Date.now() + 600000),
    });

    const po = await PaymentOrder.create({
      bookingRequestId: br._id,
      vnpayTxnRef: `TXN-CONF-${Date.now()}`,
      expectedAmountVnd: 100000,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 600000),
    });

    await Booking.create({
      bookingRequestId: br._id,
      bookingCode: `BK-CONF-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility._id,
      courtId: court._id,
      bookingDate: todayStr,
      startTime: '10:00',
      endTime: '11:00',
      startMinutes: 600,
      endMinutes: 660,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      holdExpiresAt: br.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    // Mock VNPay successful callback queryParams
    const queryParams = {
      vnp_TxnRef: po.vnpayTxnRef,
      vnp_Amount: '10000000',
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_TransactionNo: `VNPAY-${Date.now()}`,
      vnp_PayDate: '20261030100000',
    };

    // Override vnpayClient verifySignature for test
    paymentService.vnpayClient.verifySignature = () => true;

    await paymentService.processVNPayCallback(queryParams, true);

    // Customer email should exist
    const custEmail = await EmailOutbox.findOne({
      eventKey: `BOOKING_CONFIRMED_${br._id}`,
      recipientEmail: customer.email,
    });
    assert.ok(custEmail);
    assert.equal(custEmail.eventType, 'BOOKING_CONFIRMED');

    // Owner email should exist
    const ownerEmail = await EmailOutbox.findOne({
      eventKey: `BOOKING_CONFIRMED_OWNER_${br._id}`,
      recipientEmail: owner.email,
    });
    assert.ok(ownerEmail);
    assert.equal(ownerEmail.eventType, 'BOOKING_CONFIRMED');
  });

  await t.test('2. BOOKING_CANCELLED: enqueues cancellation email for pending booking request', async () => {
    const br = await BookingRequest.create({
      requestNumber: `REQ-CANCEL-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      source: 'CUSTOMER_ONLINE',
      courtId: court._id,
      facilityId: facility._id,
      bookingDate: todayStr,
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-CANCEL-${Date.now()}`,
      payloadFingerprint: `FP-CANCEL-${Date.now()}`,
      holdExpiresAt: new Date(Date.now() + 600000),
    });

    const po = await PaymentOrder.create({
      bookingRequestId: br._id,
      vnpayTxnRef: `TXN-CANCEL-${Date.now()}`,
      expectedAmountVnd: 100000,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 600000),
    });

    await Booking.create({
      bookingRequestId: br._id,
      bookingCode: `BK-CANCEL-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility._id,
      courtId: court._id,
      bookingDate: todayStr,
      startTime: '14:00',
      endTime: '15:00',
      startMinutes: 840,
      endMinutes: 900,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      holdExpiresAt: br.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    await bookingLifecycleService.cancelBookingRequest(customer, br._id.toString(), 'Khách đổi kế hoạch');

    const cancelEmail = await EmailOutbox.findOne({
      eventKey: `CANCEL_BR_CUSTOMER_${br._id}`,
      recipientEmail: customer.email,
    });
    assert.ok(cancelEmail);
    assert.equal(cancelEmail.eventType, 'BOOKING_CANCELLED');
  });

  await t.test('3. HOLD_EXPIRED: enqueues expiration email when hold expires during cleanup', async () => {
    const expiredPastDate = new Date(Date.now() - 30000); // 30s ago
    const br = await BookingRequest.create({
      requestNumber: `REQ-EXP-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      source: 'CUSTOMER_ONLINE',
      courtId: court._id,
      facilityId: facility._id,
      bookingDate: todayStr,
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-EXP-${Date.now()}`,
      payloadFingerprint: `FP-EXP-${Date.now()}`,
      holdExpiresAt: expiredPastDate,
    });

    await PaymentOrder.create({
      bookingRequestId: br._id,
      vnpayTxnRef: `TXN-EXP-${Date.now()}`,
      expectedAmountVnd: 100000,
      status: 'PENDING',
      expiresAt: expiredPastDate,
    });

    await Booking.create({
      bookingRequestId: br._id,
      bookingCode: `BK-EXP-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility._id,
      courtId: court._id,
      bookingDate: todayStr,
      startTime: '11:00',
      endTime: '12:00',
      startMinutes: 660,
      endMinutes: 720,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'UNPAID',
      holdExpiresAt: expiredPastDate,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    await bookingCleanupService.cleanupExpiredHolds(new Date());

    const expiredEmail = await EmailOutbox.findOne({
      eventKey: `HOLD_EXPIRED_${br._id}`,
      recipientEmail: customer.email,
    });
    assert.ok(expiredEmail);
    assert.equal(expiredEmail.eventType, 'HOLD_EXPIRED');
  });

  await t.test('4. BOOKING_COMPLETED: enqueues completion email when owner confirms completion', async () => {
    // Booking in past date
    const br = await BookingRequest.create({
      requestNumber: `REQ-COMP-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      source: 'CUSTOMER_ONLINE',
      courtId: court._id,
      facilityId: facility._id,
      bookingDate: '2026-10-20',
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-COMP-${Date.now()}`,
      payloadFingerprint: `FP-COMP-${Date.now()}`,
      holdExpiresAt: new Date(),
    });

    const bk = await Booking.create({
      bookingRequestId: br._id,
      bookingCode: `BK-COMP-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility._id,
      courtId: court._id,
      bookingDate: '2026-10-20',
      startTime: '08:00',
      endTime: '09:00',
      startMinutes: 480,
      endMinutes: 540,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: br.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    await bookingLifecycleService.completeBooking(owner, bk._id.toString(), 'Phục vụ chu đáo');

    const compEmail = await EmailOutbox.findOne({
      eventKey: `BOOKING_COMPLETED_${bk._id}`,
      recipientEmail: customer.email,
    });
    assert.ok(compEmail);
    assert.equal(compEmail.eventType, 'BOOKING_COMPLETED');
  });

  await t.test('5. BOOKING_NO_SHOW: enqueues no-show email when owner marks no-show', async () => {
    // Booking in past date
    const br = await BookingRequest.create({
      requestNumber: `REQ-NOSHOW-${Date.now()}`,
      customerId: customer._id,
      createdBy: customer._id,
      source: 'CUSTOMER_ONLINE',
      courtId: court._id,
      facilityId: facility._id,
      bookingDate: '2026-10-20',
      totalAmountVnd: 100000,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      idempotencyKey: `IDEMP-NOSHOW-${Date.now()}`,
      payloadFingerprint: `FP-NOSHOW-${Date.now()}`,
      holdExpiresAt: new Date(),
    });

    const bk = await Booking.create({
      bookingRequestId: br._id,
      bookingCode: `BK-NOSHOW-${Date.now()}`,
      customerId: customer._id,
      facilityId: facility._id,
      courtId: court._id,
      bookingDate: '2026-10-20',
      startTime: '09:00',
      endTime: '10:00',
      startMinutes: 540,
      endMinutes: 600,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      allocatedAmountVnd: 100000,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      holdExpiresAt: br.holdExpiresAt,
      contactName: customer.fullName,
      contactPhone: customer.phoneNumber,
      snapshot: {
        facilityName: facility.name,
        facilityAddress: facility.address,
        courtName: court.name,
        sportName: 'Cầu lông',
        slotStepMinutes: 30,
      },
    });

    await bookingLifecycleService.markNoShowBooking(owner, bk._id.toString(), 'Khách không đến');

    const noShowEmail = await EmailOutbox.findOne({
      eventKey: `BOOKING_NO_SHOW_${bk._id}`,
      recipientEmail: customer.email,
    });
    assert.ok(noShowEmail);
    assert.equal(noShowEmail.eventType, 'BOOKING_NO_SHOW');
  });
});
