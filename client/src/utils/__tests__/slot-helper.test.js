import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  mergeContiguousSlots,
  calculateEstimatedPrice,
  formatVND,
  getValidDateList,
  getTodayVN,
  addDaysVN,
  getMaxBookingDateVN,
} from '../slot-helper.js';

describe('Slot Helper Utilities (P16)', () => {
  describe('timeToMinutes & minutesToTime', () => {
    it('correctly converts HH:mm to minutes from midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('06:30')).toBe(390);
      expect(timeToMinutes('18:45')).toBe(1125);
      expect(timeToMinutes('23:59')).toBe(1439);
      expect(timeToMinutes(null)).toBe(0);
      expect(timeToMinutes('')).toBe(0);
    });

    it('correctly converts minutes from midnight to HH:mm', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(390)).toBe('06:30');
      expect(minutesToTime(1125)).toBe('18:45');
      expect(minutesToTime(1439)).toBe('23:59');
    });
  });

  describe('mergeContiguousSlots (PUB-05, Criterion 32)', () => {
    it('returns empty array when input is empty or invalid', () => {
      expect(mergeContiguousSlots([])).toEqual([]);
      expect(mergeContiguousSlots(null)).toEqual([]);
      expect(mergeContiguousSlots(undefined)).toEqual([]);
    });

    it('returns single range for one slot', () => {
      const slots = [{ startTime: '08:00', endTime: '09:00' }];
      const result = mergeContiguousSlots(slots);
      expect(result).toEqual([
        {
          startTime: '08:00',
          endTime: '09:00',
          durationMinutes: 60,
          slotCount: 1,
        },
      ]);
    });

    it('merges contiguous adjacent slots into one continuous range', () => {
      const slots = [
        { startTime: '17:00', endTime: '17:30' },
        { startTime: '17:30', endTime: '18:00' },
        { startTime: '18:00', endTime: '18:30' },
      ];
      const result = mergeContiguousSlots(slots);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        startTime: '17:00',
        endTime: '18:30',
        durationMinutes: 90,
        slotCount: 3,
      });
    });

    it('preserves separate ranges for disjoint slots with time gap', () => {
      const slots = [
        { startTime: '08:00', endTime: '09:00' },
        { startTime: '17:00', endTime: '18:30' },
      ];
      const result = mergeContiguousSlots(slots);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        startTime: '08:00',
        endTime: '09:00',
        durationMinutes: 60,
        slotCount: 1,
      });
      expect(result[1]).toEqual({
        startTime: '17:00',
        endTime: '18:30',
        durationMinutes: 90,
        slotCount: 1,
      });
    });

    it('correctly sorts unsorted input slots before merging', () => {
      const slots = [
        { startTime: '18:00', endTime: '18:30' },
        { startTime: '08:00', endTime: '08:30' },
        { startTime: '17:30', endTime: '18:00' },
      ];
      const result = mergeContiguousSlots(slots);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        startTime: '08:00',
        endTime: '08:30',
        durationMinutes: 30,
        slotCount: 1,
      });
      expect(result[1]).toEqual({
        startTime: '17:30',
        endTime: '18:30',
        durationMinutes: 60,
        slotCount: 2,
      });
    });
  });

  describe('calculateEstimatedPrice (Criterion 33)', () => {
    it('calculates proportional price for ranges based on pricePerHourVnd', () => {
      const ranges = [
        { startTime: '08:00', endTime: '09:30', durationMinutes: 90 },
        { startTime: '17:00', endTime: '18:00', durationMinutes: 60 },
      ];
      const pricePerHourVnd = 100000;

      const result = calculateEstimatedPrice(ranges, pricePerHourVnd);
      expect(result.totalDurationMinutes).toBe(150);
      // 90 mins @ 100k/hr = 150k
      expect(result.ranges[0].priceVnd).toBe(150000);
      // 60 mins @ 100k/hr = 100k
      expect(result.ranges[1].priceVnd).toBe(100000);
      // Total = 250k
      expect(result.totalPriceVnd).toBe(250000);
    });

    it('handles zero or missing values safely', () => {
      const result = calculateEstimatedPrice([], 100000);
      expect(result.totalDurationMinutes).toBe(0);
      expect(result.totalPriceVnd).toBe(0);
      expect(result.ranges).toEqual([]);
    });
  });

  describe('formatVND', () => {
    it('formats numbers into Vietnamese Dong currency string', () => {
      const formatted = formatVND(150000);
      expect(formatted).toContain('150.000');
      expect(formatted).toContain('₫');
    });

    it('handles zero, null, undefined safely', () => {
      expect(formatVND(0)).toContain('0');
      expect(formatVND(null)).toBe('0 ₫');
      expect(formatVND(undefined)).toBe('0 ₫');
    });
  });

  describe('getValidDateList & Vietnam Timezone Date Helpers (Issue 4, Criterion 27)', () => {
    it('generates 31 days (today + 30 days) of booking date options', () => {
      const dates = getValidDateList(30);
      expect(dates).toHaveLength(31);
      expect(dates[0].isToday).toBe(true);
      expect(dates[0].dayName).toBe('Hôm nay');
      expect(dates[0].dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dates[1].isToday).toBe(false);
    });

    it('correctly resolves Vietnam date at 00:30 VN (17:30 UTC previous day)', () => {
      // 00:30 on 2026-11-01 in Vietnam is 2026-10-31T17:30:00.000Z in UTC
      const dateAt0030VN = new Date('2026-10-31T17:30:00.000Z');
      expect(getTodayVN(dateAt0030VN)).toBe('2026-11-01');

      const dates = getValidDateList(30, dateAt0030VN);
      expect(dates[0].dateStr).toBe('2026-11-01');
      expect(dates[0].dayName).toBe('Hôm nay');
      expect(dates[30].dateStr).toBe('2026-12-01');
    });

    it('correctly resolves Vietnam date at 06:59 VN (23:59 UTC previous day)', () => {
      // 06:59 on 2026-11-01 in Vietnam is 2026-10-31T23:59:00.000Z in UTC
      const dateAt0659VN = new Date('2026-10-31T23:59:00.000Z');
      expect(getTodayVN(dateAt0659VN)).toBe('2026-11-01');

      const dates = getValidDateList(30, dateAt0659VN);
      expect(dates[0].dateStr).toBe('2026-11-01');
    });

    it('correctly handles month-end, leap year, and year-end transitions', () => {
      expect(addDaysVN('2026-12-31', 1)).toBe('2027-01-01');
      expect(addDaysVN('2026-02-28', 1)).toBe('2026-03-01');
      expect(addDaysVN('2026-10-31', 30)).toBe('2026-11-30');
      expect(getMaxBookingDateVN('2026-10-31', 30)).toBe('2026-11-30');
    });
  });
});

