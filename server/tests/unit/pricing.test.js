import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIntervalPrice,
  calculateBookingRequestTotal,
} from '../../src/services/booking/pricing.js';

describe('Pricing Unit Tests (P08 - Pure Logic)', () => {
  describe('calculateIntervalPrice', () => {
    it('calculates exact price for 120,000 VND/h at 30, 60, 90, 240 min (Criterion 6, Section 8.4)', () => {
      // 30 min = 60,000 VND
      const p30 = calculateIntervalPrice(360, 390, 120000);
      assert.equal(p30, 60000);

      // 60 min = 120,000 VND
      const p60 = calculateIntervalPrice(360, 420, 120000);
      assert.equal(p60, 120000);

      // 90 min = 180,000 VND
      const p90 = calculateIntervalPrice(360, 450, 120000);
      assert.equal(p90, 180000);

      // 240 min (08:00 to 12:00) = 480,000 VND
      const p240 = calculateIntervalPrice(480, 720, 120000);
      assert.equal(p240, 480000);
    });

    it('rounds 0.5 up to nearest integer VND for odd hourly rates (Criterion 32)', () => {
      // Rate 100,001 VND/h, 30 min: 100001 * 30 / 60 = 50000.5 -> 50,001 VND
      const p30 = calculateIntervalPrice(0, 30, 100001);
      assert.equal(p30, 50001);

      // Rate 100,001 VND/h, 60 min: 100001 * 60 / 60 = 100001 VND
      const p60 = calculateIntervalPrice(0, 60, 100001);
      assert.equal(p60, 100001);
    });

    it('rejects duration <= 0 or invalid rates', () => {
      assert.throws(() => calculateIntervalPrice(360, 360, 120000), {
        name: 'AppError',
        message: /phải lớn hơn 0 phút/,
      });

      assert.throws(() => calculateIntervalPrice(400, 360, 120000), {
        name: 'AppError',
        message: /phải lớn hơn 0 phút/,
      });

      assert.throws(() => calculateIntervalPrice(0, 60, -100), {
        name: 'AppError',
        message: /không hợp lệ/,
      });
    });
  });

  describe('calculateBookingRequestTotal (Criterion 32)', () => {
    it('contiguous 60m booking at 100,001 VND/h is 100,001 VND (not 100,002 VND)', () => {
      // After merging two 30-min contiguous slots into one 60-min interval:
      const mergedIntervals = [
        { startTime: '06:00', endTime: '07:00', startMinutes: 360, endMinutes: 420, durationMinutes: 60 },
      ];
      const result = calculateBookingRequestTotal(mergedIntervals, 100001);

      assert.equal(result.intervals.length, 1);
      assert.equal(result.intervals[0].priceVnd, 100001);
      assert.equal(result.totalPriceVnd, 100001);
      assert.equal(result.totalDurationMinutes, 60);
    });

    it('disjoint two 30m bookings at 100,001 VND/h are 50,001 each, total 100,002 VND (Criterion 32)', () => {
      // Two separate intervals: 06:00-06:30 and 08:00-08:30
      const disjointIntervals = [
        { startTime: '06:00', endTime: '06:30', startMinutes: 360, endMinutes: 390, durationMinutes: 30 },
        { startTime: '08:00', endTime: '08:30', startMinutes: 480, endMinutes: 510, durationMinutes: 30 },
      ];
      const result = calculateBookingRequestTotal(disjointIntervals, 100001);

      assert.equal(result.intervals.length, 2);
      assert.equal(result.intervals[0].priceVnd, 50001);
      assert.equal(result.intervals[1].priceVnd, 50001);
      assert.equal(result.totalPriceVnd, 100002);
      assert.equal(result.totalDurationMinutes, 60);
    });

    it('disjoint 60m + 30m bookings at 120,000 VND/h totals 180,000 VND (Section 8.4, Criterion 27)', () => {
      // 06:00-07:00 (120k) and 08:00-08:30 (60k) -> 180k
      const intervals = [
        { startTime: '06:00', endTime: '07:00', startMinutes: 360, endMinutes: 420, durationMinutes: 60 },
        { startTime: '08:00', endTime: '08:30', startMinutes: 480, endMinutes: 510, durationMinutes: 30 },
      ];
      const result = calculateBookingRequestTotal(intervals, 120000);

      assert.equal(result.intervals[0].priceVnd, 120000);
      assert.equal(result.intervals[1].priceVnd, 60000);
      assert.equal(result.totalPriceVnd, 180000);
      assert.equal(result.totalDurationMinutes, 90);
    });

    it('rejects empty intervals or non-positive pricePerHourVnd', () => {
      assert.throws(() => calculateBookingRequestTotal([], 120000), {
        name: 'AppError',
        message: /không được để trống/,
      });

      assert.throws(
        () =>
          calculateBookingRequestTotal(
            [{ startTime: '06:00', endTime: '06:30', startMinutes: 360, endMinutes: 390 }],
            0
          ),
        {
          name: 'AppError',
          message: /phải là số nguyên dương lớn hơn 0/,
        }
      );
    });
  });
});

