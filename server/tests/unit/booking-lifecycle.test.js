import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPastEndTime,
  validatePastEndTime,
} from '../../src/services/booking/booking-policy.js';
import { BookingLifecycleService } from '../../src/services/booking/booking-lifecycle.service.js';
import { AppError } from '../../src/errors/app-error.js';

describe('Booking Lifecycle Policy & Unit Rules (P10 - Pure Logic)', () => {
  const service = new BookingLifecycleService();

  describe('isPastEndTime & validatePastEndTime (Criteria 17, 18)', () => {
    it('returns true when booking date is in the past', () => {
      // Vietnam mock now: 2026-11-05 10:00
      const mockNow = new Date('2026-11-05T03:00:00.000Z'); // 10:00 VN (UTC+7)
      const pastDate = '2026-11-04';
      assert.equal(isPastEndTime(pastDate, '18:00', mockNow), true);
      assert.doesNotThrow(() => validatePastEndTime(pastDate, '18:00', mockNow));
    });

    it('returns false when booking date is in the future', () => {
      const mockNow = new Date('2026-11-05T03:00:00.000Z'); // 10:00 VN
      const futureDate = '2026-11-06';
      assert.equal(isPastEndTime(futureDate, '08:00', mockNow), false);
      assert.throws(
        () => validatePastEndTime(futureDate, '08:00', mockNow),
        (err) => err instanceof AppError && err.statusCode === 400
      );
    });

    it('returns true when booking date is today and currentTime >= endTime', () => {
      // 10:30 VN
      const mockNow = new Date('2026-11-05T03:30:00.000Z');
      const todayDate = '2026-11-05';

      // Past endTime (10:00)
      assert.equal(isPastEndTime(todayDate, '10:00', mockNow), true);
      assert.doesNotThrow(() => validatePastEndTime(todayDate, '10:00', mockNow));

      // Exact endTime (10:30)
      assert.equal(isPastEndTime(todayDate, '10:30', mockNow), true);
      assert.doesNotThrow(() => validatePastEndTime(todayDate, '10:30', mockNow));
    });

    it('returns false when booking date is today and currentTime < endTime', () => {
      // 10:30 VN
      const mockNow = new Date('2026-11-05T03:30:00.000Z');
      const todayDate = '2026-11-05';

      // Future endTime (11:00)
      assert.equal(isPastEndTime(todayDate, '11:00', mockNow), false);
      assert.throws(
        () => validatePastEndTime(todayDate, '11:00', mockNow),
        (err) => {
          assert.ok(err instanceof AppError);
          assert.equal(err.statusCode, 400);
          assert.ok(err.message.includes('Chưa đến giờ kết thúc'));
          return true;
        }
      );
    });
  });

  describe('toBookingDTO Transformation', () => {
    it('correctly maps booking entity fields to standard BookingDTO', () => {
      const rawBooking = {
        _id: '6ae328000000000000000001',
        bookingCode: 'BK20261105-ABC1',
        facilityId: '6ae328000000000000000002',
        courtId: '6ae328000000000000000003',
        bookingDate: '2026-11-05',
        startTime: '08:00',
        endTime: '09:00',
        durationMinutes: 60,
        pricePerHourVnd: 100000,
        totalPriceVnd: 100000,
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
        holdExpiresAt: new Date('2026-11-05T03:10:00Z'),
        createdAt: new Date('2026-11-05T03:00:00Z'),
        snapshot: {
          facilityName: 'Sân Cầu Lông ABC',
          courtName: 'Sân 1',
          sportName: 'Cầu lông',
          facilityAddress: '123 Đường XYZ',
        },
        cancellation: null,
        completion: null,
      };

      const dto = service.toBookingDTO(rawBooking, { contactName: 'Nguyễn Văn A' });

      assert.equal(dto.id, '6ae328000000000000000001');
      assert.equal(dto.bookingCode, 'BK20261105-ABC1');
      assert.equal(dto.facilityName, 'Sân Cầu Lông ABC');
      assert.equal(dto.courtName, 'Sân 1');
      assert.equal(dto.sportName, 'Cầu lông');
      assert.equal(dto.totalPriceVnd, 100000);
      assert.equal(dto.status, 'CONFIRMED');
      assert.equal(dto.paymentStatus, 'PAID');
      assert.equal(dto.contactName, 'Nguyễn Văn A');
    });
  });
});

