import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { syncAllIndexes } from '../../scripts/sync-indexes.js';
import {
  User,
  Sport,
  FacilitySport,
  Court,
  CourtDaySchedule,
  BookingRequest,
  Booking,
  PaymentOrder,
  PaymentTransaction,
} from '../../src/models/index.js';

const FS_TEST_FACILITY_ID = new mongoose.Types.ObjectId('65a000000000000000000001');
const FS_TEST_SPORT_ID = new mongoose.Types.ObjectId('65a000000000000000000002');
const COURT_DAY_DATE = '2026-11-15';

describe('Unique Indexes, Constraints & Atomic Coordination (Integration)', () => {
  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
    // Ensure all indexes exist in test DB
    await syncAllIndexes(env.MONGODB_TEST_URI);
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({ email: 'duplicate@test.local' }),
      Sport.deleteMany({ normalizedName: 'BONG BAN' }),
      FacilitySport.deleteMany({ facilityId: FS_TEST_FACILITY_ID }),
      Court.deleteMany({ name: 'Sân 1' }),
      CourtDaySchedule.deleteMany({ bookingDate: COURT_DAY_DATE }),
      BookingRequest.deleteMany({ requestNumber: { $regex: /^BR-IDEMP/ } }),
      Booking.deleteMany({ bookingCode: 'BK-UNIQUE-001' }),
      PaymentOrder.deleteMany({ vnpayTxnRef: { $regex: /^PO-INDEX/ } }),
      PaymentTransaction.deleteMany({ vnpayTxnRef: { $regex: /^REF-00/ } }),
    ]);
  });

  it('should reject duplicate User email (unique constraint code 11000)', async () => {
    await User.create({
      email: 'duplicate@test.local',
      fullName: 'User 1',
      phoneNumber: '0901111111',
      role: 'CUSTOMER',
    });

    await assert.rejects(
      async () => {
        await User.create({
          email: 'duplicate@test.local', // same email
          fullName: 'User 2',
          phoneNumber: '0902222222',
          role: 'CUSTOMER',
        });
      },
      (err) => {
        assert.equal(err.code, 11000, 'MongoDB duplicate key error code must be 11000');
        return true;
      }
    );
  });

  it('should reject duplicate Sport normalizedName (case-insensitive uniqueness)', async () => {
    await Sport.create({
      name: 'Bóng bàn',
      normalizedName: 'BONG BAN',
    });

    await assert.rejects(
      async () => {
        await Sport.create({
          name: 'Bóng Bàn Phong Trào',
          normalizedName: 'BONG BAN',
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });

  it('should reject duplicate FacilitySport for the same facilityId and sportId', async () => {
    const facilityId = FS_TEST_FACILITY_ID;
    const sportId = FS_TEST_SPORT_ID;

    await FacilitySport.create({
      facilityId,
      sportId,
      slotStepMinutes: 60,
    });

    await assert.rejects(
      async () => {
        await FacilitySport.create({
          facilityId,
          sportId,
          slotStepMinutes: 30, // Duplicate facility + sport combination
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });

  it('should reject duplicate Court name within the same facilitySportId', async () => {
    const facilitySportId = new mongoose.Types.ObjectId();
    const facilityId = new mongoose.Types.ObjectId();
    const sportId = new mongoose.Types.ObjectId();

    await Court.create({
      facilitySportId,
      facilityId,
      sportId,
      name: 'Sân 1',
      pricePerHourVnd: 100000,
    });

    await assert.rejects(
      async () => {
        await Court.create({
          facilitySportId,
          facilityId,
          sportId,
          name: 'Sân 1', // Duplicate name in same facilitySport
          pricePerHourVnd: 120000,
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });

  it('should enforce unique CourtDaySchedule per courtId + bookingDate and support atomic version increment', async () => {
    const courtId = new mongoose.Types.ObjectId();
    const bookingDate = COURT_DAY_DATE;

    // Atomic coordination pattern: findOneAndUpdate with upsert: true and $inc: { scheduleVersion: 1 }
    const schedule1 = await CourtDaySchedule.findOneAndUpdate(
      { courtId, bookingDate },
      { $inc: { scheduleVersion: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    assert.ok(schedule1);
    assert.equal(schedule1.courtId.toString(), courtId.toString());
    assert.equal(schedule1.bookingDate, bookingDate);
    assert.equal(schedule1.scheduleVersion, 1);

    // Second atomic update incrementing version
    const schedule2 = await CourtDaySchedule.findOneAndUpdate(
      { courtId, bookingDate },
      { $inc: { scheduleVersion: 1 }, $set: { updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    assert.equal(schedule2._id.toString(), schedule1._id.toString());
    assert.equal(schedule2.scheduleVersion, 2, 'scheduleVersion must be atomically incremented');

    // Attempting direct duplicate create must fail with 11000
    await assert.rejects(
      async () => {
        await CourtDaySchedule.create({
          courtId,
          bookingDate,
          scheduleVersion: 1,
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });

  it('should enforce uniqueness for Booking bookingCode and BookingRequest idempotencyKey per creator', async () => {
    const userId = new mongoose.Types.ObjectId();
    const courtId = new mongoose.Types.ObjectId();
    const facilityId = new mongoose.Types.ObjectId();

    await BookingRequest.create({
      requestNumber: 'BR-IDEMP-001',
      createdBy: userId,
      source: 'CUSTOMER_ONLINE',
      courtId,
      facilityId,
      bookingDate: '2026-11-20',
      totalAmountVnd: 100000,
      holdExpiresAt: new Date(Date.now() + 600000),
      contactName: 'Customer',
      contactPhone: '0901111111',
      idempotencyKey: 'idemp-key-xyz',
      payloadFingerprint: 'fp-1',
    });

    // Duplicate idempotencyKey for same user must fail
    await assert.rejects(
      async () => {
        await BookingRequest.create({
          requestNumber: 'BR-IDEMP-002',
          createdBy: userId,
          source: 'CUSTOMER_ONLINE',
          courtId,
          facilityId,
          bookingDate: '2026-11-20',
          totalAmountVnd: 100000,
          holdExpiresAt: new Date(Date.now() + 600000),
          contactName: 'Customer',
          contactPhone: '0901111111',
          idempotencyKey: 'idemp-key-xyz', // duplicate for same user
          payloadFingerprint: 'fp-2',
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );

    // Duplicate bookingCode on Booking must fail
    const reqId = new mongoose.Types.ObjectId();
    await Booking.create({
      bookingCode: 'BK-UNIQUE-001',
      bookingRequestId: reqId,
      courtId,
      facilityId,
      bookingDate: '2026-11-20',
      startTime: '07:00',
      endTime: '08:00',
      startMinutes: 420,
      endMinutes: 480,
      durationMinutes: 60,
      pricePerHourVnd: 100000,
      totalPriceVnd: 100000,
      holdExpiresAt: new Date(Date.now() + 600000),
      snapshot: {
        facilityName: 'Fac',
        facilityAddress: 'Addr',
        courtName: 'Crt',
        sportName: 'Sp',
        slotStepMinutes: 60,
      },
    });

    await assert.rejects(
      async () => {
        await Booking.create({
          bookingCode: 'BK-UNIQUE-001', // duplicate code
          bookingRequestId: reqId,
          courtId,
          facilityId,
          bookingDate: '2026-11-20',
          startTime: '08:00',
          endTime: '09:00',
          startMinutes: 480,
          endMinutes: 540,
          durationMinutes: 60,
          pricePerHourVnd: 100000,
          totalPriceVnd: 100000,
          holdExpiresAt: new Date(Date.now() + 600000),
          snapshot: {
            facilityName: 'Fac',
            facilityAddress: 'Addr',
            courtName: 'Crt',
            sportName: 'Sp',
            slotStepMinutes: 60,
          },
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });

  it('should support partial unique index on PaymentTransaction (allows multiple null vnpayTransactionNo, blocks duplicate strings)', async () => {
    // 1. Multiple null/undefined vnpayTransactionNo are allowed (e.g. invalid/failed callback before VNPay txn assigned)
    const txn1 = await PaymentTransaction.create({
      vnpayTransactionNo: null,
      vnpayTxnRef: 'REF-001',
      amountVnd: 100000,
      responseCode: '99',
      transactionStatus: '02',
      isAccepted: false,
      rawCallbackData: { error: 'cancelled' },
    });

    const txn2 = await PaymentTransaction.create({
      vnpayTransactionNo: null,
      vnpayTxnRef: 'REF-002',
      amountVnd: 200000,
      responseCode: '99',
      transactionStatus: '02',
      isAccepted: false,
      rawCallbackData: { error: 'cancelled' },
    });

    assert.ok(txn1._id);
    assert.ok(txn2._id);

    // 2. Real string vnpayTransactionNo must be unique
    await PaymentTransaction.create({
      vnpayTransactionNo: '14567890',
      vnpayTxnRef: 'REF-003',
      amountVnd: 150000,
      responseCode: '00',
      transactionStatus: '00',
      isAccepted: true,
      rawCallbackData: { success: true },
    });

    await assert.rejects(
      async () => {
        await PaymentTransaction.create({
          vnpayTransactionNo: '14567890', // duplicate bank transaction ID
          vnpayTxnRef: 'REF-004',
          amountVnd: 150000,
          responseCode: '00',
          transactionStatus: '00',
          isAccepted: true,
          rawCallbackData: { success: true },
        });
      },
      (err) => {
        assert.equal(err.code, 11000);
        return true;
      }
    );
  });
});
