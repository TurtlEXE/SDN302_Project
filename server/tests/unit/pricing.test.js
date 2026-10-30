import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateIntervalPrice,
  calculateBookingRequestTotal,
  validatePricingRules,
  sliceIntervalPricing,
} from '../../src/services/booking/pricing.js';

describe('Pricing Unit Tests (P08 - Pure Logic & B03 Multi-Tier)', () => {
  describe('B03 Multi-Tier Pricing & Pricing Rules', () => {
    const sampleRules = [
      { dayType: 'WEEKDAY', startTime: '17:00', endTime: '18:00', pricePerHourVnd: 100000 },
      { dayType: 'WEEKDAY', startTime: '18:00', endTime: '20:00', pricePerHourVnd: 150000 },
      { dayType: 'WEEKEND', startTime: '17:00', endTime: '20:00', pricePerHourVnd: 200000 },
    ];

    it('required example: weekday 17:30-18:30 across 100k and 150k tiers produces exactly 125,000 VND', () => {
      const mergedIntervals = [{ startTime: '17:30', endTime: '18:30' }];
      const result = calculateBookingRequestTotal(mergedIntervals, sampleRules, 'WEEKDAY');

      assert.equal(result.totalPriceVnd, 125000);
      assert.equal(result.totalDurationMinutes, 60);
      const snapshot = result.intervals[0].pricingSnapshot;
      assert.equal(snapshot.length, 2);
      assert.deepEqual(snapshot[0], {
        startTime: '17:30',
        endTime: '18:00',
        startMinutes: 1050,
        endMinutes: 1080,
        durationMinutes: 30,
        pricePerHourVnd: 100000,
        segmentAmountVnd: 50000,
      });
      assert.deepEqual(snapshot[1], {
        startTime: '18:00',
        endTime: '18:30',
        startMinutes: 1080,
        endMinutes: 1110,
        durationMinutes: 30,
        pricePerHourVnd: 150000,
        segmentAmountVnd: 75000,
      });
    });

    it('weekend for same interval (17:30-18:30) applies weekend pricing rule (200k/h -> 200,000 VND)', () => {
      const mergedIntervals = [{ startTime: '17:30', endTime: '18:30' }];
      const result = calculateBookingRequestTotal(mergedIntervals, sampleRules, 'WEEKEND');

      assert.equal(result.totalPriceVnd, 200000);
      assert.equal(result.totalDurationMinutes, 60);
      assert.equal(result.intervals[0].pricingSnapshot.length, 1);
      assert.equal(result.intervals[0].pricingSnapshot[0].segmentAmountVnd, 200000);
    });

    it('rejects booking when any part of interval is missing pricing coverage (Criteria 2 B03)', () => {
      // 16:30-17:30 has no rule for 16:30-17:00
      const mergedIntervals = [{ startTime: '16:30', endTime: '17:30' }];
      assert.throws(
        () => calculateBookingRequestTotal(mergedIntervals, sampleRules, 'WEEKDAY'),
        (err) => {
          assert.equal(err.name, 'AppError');
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /chưa có bảng giá áp dụng/);
          return true;
        }
      );
    });

    it('validates pricing rules and rejects overlapping rules in the same dayType', () => {
      const overlappingRules = [
        { dayType: 'WEEKDAY', startTime: '17:00', endTime: '18:30', pricePerHourVnd: 100000 },
        { dayType: 'WEEKDAY', startTime: '18:00', endTime: '19:00', pricePerHourVnd: 120000 },
      ];
      assert.throws(
        () => validatePricingRules(overlappingRules),
        (err) => {
          assert.equal(err.name, 'AppError');
          assert.match(err.message, /bị chồng lấn/);
          return true;
        }
      );
    });
  });
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

