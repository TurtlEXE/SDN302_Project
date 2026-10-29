import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../../src/config/database.js';
import { env } from '../../src/config/env.js';
import { withTransaction } from '../../src/database/transaction.js';
import { User, Facility, BookingRequest, Booking, PaymentOrder } from '../../src/models/index.js';

describe('Multi-Document ACID Transactions (Integration)', () => {
  before(async () => {
    await connectDB(env.MONGODB_TEST_URI);
  });

  after(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({ email: { $regex: /rollback|commit|nested/ } }),
      Facility.deleteMany({ name: { $regex: /Rollback|Test Facility/ } }),
      BookingRequest.deleteMany({ requestNumber: { $regex: /BR-(ROLLBACK|COMMIT)/ } }),
      Booking.deleteMany({ bookingCode: { $regex: /BK-COMMIT/ } }),
      PaymentOrder.deleteMany({ vnpayTxnRef: { $regex: /PO-COMMIT/ } }),
    ]);
  });

  it('should rollback all documents across multiple collections when an error is thrown inside transaction', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const facilityId = new mongoose.Types.ObjectId();
    const courtId = new mongoose.Types.ObjectId();
    const bookingRequestId = new mongoose.Types.ObjectId();

    await assert.rejects(
      async () => {
        await withTransaction(async (session) => {
          // 1. Create User
          await User.create(
            [
              {
                _id: ownerId,
                email: 'rollback.owner@test.local',
                fullName: 'Rollback Test Owner',
                phoneNumber: '0909999999',
                role: 'OWNER',
              },
            ],
            { session }
          );

          // 2. Create Facility
          await Facility.create(
            [
              {
                _id: facilityId,
                ownerId,
                name: 'Rollback Facility',
                address: '123 Test',
                province: 'Hà Nội',
                phoneNumber: '0909999999',
              },
            ],
            { session }
          );

          // 3. Create BookingRequest
          await BookingRequest.create(
            [
              {
                _id: bookingRequestId,
                requestNumber: 'BR-ROLLBACK-001',
                createdBy: ownerId,
                source: 'CUSTOMER_ONLINE',
                courtId,
                facilityId,
                bookingDate: '2026-11-10',
                totalAmountVnd: 300000,
                holdExpiresAt: new Date(Date.now() + 600000),
                contactName: 'Test Rollback',
                contactPhone: '0909999999',
                idempotencyKey: 'idemp-rollback-001',
                payloadFingerprint: 'fp-rollback-001',
              },
            ],
            { session }
          );

          // 4. Intentionally throw an error to trigger rollback
          throw new Error('INTENTIONAL_ERROR_TRIGGERING_ROLLBACK');
        });
      },
      /INTENTIONAL_ERROR_TRIGGERING_ROLLBACK/
    );

    // Verify database state: NO documents should persist
    const foundUser = await User.findById(ownerId);
    const foundFacility = await Facility.findById(facilityId);
    const foundRequest = await BookingRequest.findById(bookingRequestId);

    assert.equal(foundUser, null, 'User document must have been rolled back');
    assert.equal(foundFacility, null, 'Facility document must have been rolled back');
    assert.equal(foundRequest, null, 'BookingRequest document must have been rolled back');
  });

  it('should successfully commit multiple documents when no error occurs in transaction', async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const facilityId = new mongoose.Types.ObjectId();
    const courtId = new mongoose.Types.ObjectId();
    const bookingRequestId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    const paymentOrderId = new mongoose.Types.ObjectId();

    const result = await withTransaction(async (session) => {
      const [user] = await User.create(
        [
          {
            _id: ownerId,
            email: 'commit.owner@test.local',
            fullName: 'Commit Test Owner',
            phoneNumber: '0908888888',
            role: 'OWNER',
          },
        ],
        { session }
      );

      const [req] = await BookingRequest.create(
        [
          {
            _id: bookingRequestId,
            requestNumber: 'BR-COMMIT-001',
            createdBy: ownerId,
            source: 'CUSTOMER_ONLINE',
            courtId,
            facilityId,
            bookingDate: '2026-11-10',
            totalAmountVnd: 150000,
            holdExpiresAt: new Date(Date.now() + 600000),
            contactName: 'Commit User',
            contactPhone: '0908888888',
            idempotencyKey: 'idemp-commit-001',
            payloadFingerprint: 'fp-commit-001',
          },
        ],
        { session }
      );

      const [booking] = await Booking.create(
        [
          {
            _id: bookingId,
            bookingCode: 'BK-COMMIT-001',
            bookingRequestId: req._id,
            courtId,
            facilityId,
            bookingDate: '2026-11-10',
            startTime: '08:00',
            endTime: '09:00',
            startMinutes: 480,
            endMinutes: 540,
            durationMinutes: 60,
            pricePerHourVnd: 150000,
            totalPriceVnd: 150000,
            holdExpiresAt: req.holdExpiresAt,
            snapshot: {
              facilityName: 'Test Facility',
              facilityAddress: 'Address',
              courtName: 'Court 1',
              sportName: 'Cầu lông',
              slotStepMinutes: 60,
            },
          },
        ],
        { session }
      );

      const [po] = await PaymentOrder.create(
        [
          {
            _id: paymentOrderId,
            bookingRequestId: req._id,
            vnpayTxnRef: 'PO-COMMIT-001',
            expectedAmountVnd: 150000,
            expiresAt: req.holdExpiresAt,
          },
        ],
        { session }
      );

      return { user, req, booking, po };
    });

    assert.ok(result);

    // Verify all documents exist
    const foundUser = await User.findById(ownerId);
    const foundReq = await BookingRequest.findById(bookingRequestId);
    const foundBooking = await Booking.findById(bookingId);
    const foundPo = await PaymentOrder.findById(paymentOrderId);

    assert.ok(foundUser, 'User must be committed');
    assert.ok(foundReq, 'BookingRequest must be committed');
    assert.ok(foundBooking, 'Booking must be committed');
    assert.ok(foundPo, 'PaymentOrder must be committed');
  });

  it('should reuse existing session without error when nested withTransaction is called', async () => {
    const userId = new mongoose.Types.ObjectId();

    await withTransaction(async (outerSession) => {
      // Inner call with existingSession
      await withTransaction(async (innerSession) => {
        assert.equal(innerSession, outerSession, 'Inner session should be identical to outer session');
        await User.create(
          [
            {
              _id: userId,
              email: `nested.session.${Date.now()}@test.local`,
              fullName: 'Nested Session User',
              phoneNumber: '0907777777',
              role: 'CUSTOMER',
            },
          ],
          { session: innerSession }
        );
      }, outerSession);
    });

    const user = await User.findById(userId);
    assert.ok(user, 'User created via nested session must be committed');
  });
});
