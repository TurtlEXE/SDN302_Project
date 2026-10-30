import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBookingDateRange,
  validateAdvanceNotice,
  validateConfigVersion,
  validatePriceVersion,
  addDaysToDateVN,
} from '../../src/services/booking/booking-policy.js';

describe('Booking Policy Unit Tests (P08 - Pure Logic)', () => {
  const mockToday = '2026-10-29';

  describe('validateBookingDateRange (Criterion 11)', () => {
    it('allows booking for today', () => {
      assert.equal(validateBookingDateRange('2026-10-29', 30, mockToday), true);
    });

    it('allows booking for exactly 30 days ahead', () => {
      // 2026-10-29 + 30 days = 2026-11-28
      const maxDate = addDaysToDateVN(mockToday, 30);
      assert.equal(maxDate, '2026-11-28');
      assert.equal(validateBookingDateRange('2026-11-28', 30, mockToday), true);
    });

    it('rejects booking in the past (Criterion 11)', () => {
      assert.throws(
        () => validateBookingDateRange('2026-10-28', 30, mockToday),
        { name: 'AppError', message: /không thể ở trong quá khứ/ }
      );
    });

    it('rejects booking beyond 30 days (Criterion 11)', () => {
      assert.throws(
        () => validateBookingDateRange('2026-11-29', 30, mockToday),
        { name: 'AppError', message: /Chỉ được đặt sân trước tối đa 30 ngày/ }
      );
    });

    it('rejects invalid date string format', () => {
      assert.throws(
        () => validateBookingDateRange('29-10-2026', 30, mockToday),
        { name: 'AppError', message: /Định dạng ngày không hợp lệ/ }
      );
      assert.throws(
        () => validateBookingDateRange('not-a-date', 30, mockToday),
        { name: 'AppError', message: /Định dạng ngày không hợp lệ/ }
      );
    });
  });

  describe('validateAdvanceNotice (Criterion 11)', () => {
    const mockNow = '10:00'; // 600 minutes

    it('allows booking for today when earliest start time is >= 15 min ahead', () => {
      // Exactly 15 minutes ahead (10:15)
      assert.equal(validateAdvanceNotice('2026-10-29', '10:15', 15, mockToday, mockNow), true);
      // 30 minutes ahead (10:30)
      assert.equal(validateAdvanceNotice('2026-10-29', '10:30', 15, mockToday, mockNow), true);
      // 60 minutes ahead (11:00)
      assert.equal(validateAdvanceNotice('2026-10-29', '11:00', 15, mockToday, mockNow), true);
    });

    it('rejects booking for today when earliest start time is under 15 min ahead (Criterion 11)', () => {
      // 14 minutes ahead (10:14)
      assert.throws(
        () => validateAdvanceNotice('2026-10-29', '10:14', 15, mockToday, mockNow),
        { name: 'AppError', message: /phải cách thời điểm hiện tại ít nhất 15 phút/ }
      );

      // Start time in the past earlier today (09:30)
      assert.throws(
        () => validateAdvanceNotice('2026-10-29', '09:30', 15, mockToday, mockNow),
        { name: 'AppError', message: /phải cách thời điểm hiện tại ít nhất 15 phút/ }
      );
    });

    it('bypasses 15-minute check for future booking dates', () => {
      // For tomorrow (2026-10-30), 06:00 is fine even though mockNow is 10:00
      assert.equal(validateAdvanceNotice('2026-10-30', '06:00', 15, mockToday, mockNow), true);
    });

    it('supports minAdvanceMinutes = 0 for maintenance blocks (Section 8.3.1)', () => {
      // Maintenance block starting right at 10:00 is allowed
      assert.equal(validateAdvanceNotice('2026-10-29', '10:00', 0, mockToday, mockNow), true);
    });
  });

  describe('validateConfigVersion & validatePriceVersion (Criteria 33, 34)', () => {
    it('passes when configVersion matches current DB version', () => {
      assert.equal(validateConfigVersion(1, 1), true);
      assert.equal(validateConfigVersion(3, 3), true);
    });

    it('throws 409 CONFIG_VERSION_MISMATCH when configVersion mismatches (Criteria 33, 34)', () => {
      assert.throws(
        () => validateConfigVersion(1, 2),
        (err) => {
          assert.equal(err.name, 'AppError');
          assert.equal(err.statusCode, 409);
          assert.equal(err.errorCode, 'CONFIG_VERSION_MISMATCH');
          return true;
        }
      );
    });

    it('passes when priceVersion matches current DB version', () => {
      assert.equal(validatePriceVersion(2, 2), true);
    });

    it('throws 409 CONFIG_VERSION_MISMATCH when priceVersion mismatches (Criteria 14, 33)', () => {
      assert.throws(
        () => validatePriceVersion(1, 2),
        (err) => {
          assert.equal(err.name, 'AppError');
          assert.equal(err.statusCode, 409);
          assert.equal(err.errorCode, 'CONFIG_VERSION_MISMATCH');
          return true;
        }
      );
    });
  });
});

