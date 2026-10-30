import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSlot,
  normalizeAndDeduplicateSlots,
  mergeContiguousSlots,
  isOverlapping,
  hasAnyOverlap,
  generateDaySlots,
} from '../../src/services/booking/slot-merger.js';

describe('Slot Merger Unit Tests (P08 - Pure Logic)', () => {
  describe('validateSlot', () => {
    it('accepts valid slot matching 30m, 60m, 90m step on grid', () => {
      // 30m step
      const r30 = validateSlot({ startTime: '06:00', endTime: '06:30' }, '06:00', '22:00', 30);
      assert.deepEqual(r30, { startMinutes: 360, endMinutes: 390 });

      // 60m step
      const r60 = validateSlot({ startTime: '07:00', endTime: '08:00' }, '06:00', '22:00', 60);
      assert.deepEqual(r60, { startMinutes: 420, endMinutes: 480 });

      // 90m step
      const r90 = validateSlot({ startTime: '07:30', endTime: '09:00' }, '06:00', '22:00', 90);
      assert.deepEqual(r90, { startMinutes: 450, endMinutes: 540 });
    });

    it('rejects slot whose duration does not match slotStepMinutes', () => {
      assert.throws(
        () => validateSlot({ startTime: '06:00', endTime: '07:00' }, '06:00', '22:00', 30),
        { name: 'AppError', message: /không khớp với bước giờ/ }
      );
    });

    it('rejects off-grid slot for 90m step starting at 06:00 (Criterion 29)', () => {
      // 06:30-08:00 has 90m duration, but (390 - 360) % 90 = 30 != 0
      assert.throws(
        () => validateSlot({ startTime: '06:30', endTime: '08:00' }, '06:00', '22:00', 90),
        { name: 'AppError', message: /sai mốc bước giờ/ }
      );
    });

    it('rejects slot outside facility operating hours', () => {
      // Before openTime
      assert.throws(
        () => validateSlot({ startTime: '05:30', endTime: '06:00' }, '06:00', '22:00', 30),
        { name: 'AppError', message: /nằm ngoài khung giờ mở cửa/ }
      );

      // After closeTime
      assert.throws(
        () => validateSlot({ startTime: '22:00', endTime: '22:30' }, '06:00', '22:00', 30),
        { name: 'AppError', message: /nằm ngoài khung giờ mở cửa/ }
      );
    });

    it('rejects malformed slot times or startTime >= endTime', () => {
      assert.throws(
        () => validateSlot({ startTime: '07:00', endTime: '06:00' }, '06:00', '22:00', 60),
        { name: 'AppError', message: /phải trước giờ kết thúc/ }
      );

      assert.throws(
        () => validateSlot({ startTime: 'invalid', endTime: '06:30' }, '06:00', '22:00', 30),
        { name: 'AppError', message: /Định dạng giờ không hợp lệ/ }
      );
    });
  });

  describe('normalizeAndDeduplicateSlots', () => {
    it('deduplicates identical slots sent multiple times (Criterion 28)', () => {
      const input = [
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:30', endTime: '07:00' },
      ];
      const result = normalizeAndDeduplicateSlots(input);
      assert.equal(result.length, 2);
      assert.equal(result[0].startTime, '06:00');
      assert.equal(result[1].startTime, '06:30');
    });

    it('sorts slots ascending by startTime when received in reverse order (Criterion 28)', () => {
      const input = [
        { startTime: '08:00', endTime: '08:30' },
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:30', endTime: '07:00' },
      ];
      const result = normalizeAndDeduplicateSlots(input);
      assert.equal(result[0].startTime, '06:00');
      assert.equal(result[1].startTime, '06:30');
      assert.equal(result[2].startTime, '08:00');
    });

    it('rejects partially overlapping input slots (Criterion 28)', () => {
      const input = [
        { startTime: '06:00', endTime: '07:00' },
        { startTime: '06:30', endTime: '07:30' },
      ];
      assert.throws(() => normalizeAndDeduplicateSlots(input), {
        name: 'AppError',
        message: /bị chồng lấn không hợp lệ/,
      });
    });

    it('rejects empty slot list', () => {
      assert.throws(() => normalizeAndDeduplicateSlots([]), {
        name: 'AppError',
        message: /không được để trống/,
      });
    });
  });

  describe('mergeContiguousSlots', () => {
    it('merges contiguous 30m slots into single continuous Booking (Criteria 6, 8.3.1)', () => {
      const slots = [
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:30', endTime: '07:00' },
      ];
      const intervals = mergeContiguousSlots(slots, '06:00', '22:00', 30);
      assert.equal(intervals.length, 1);
      assert.equal(intervals[0].startTime, '06:00');
      assert.equal(intervals[0].endTime, '07:00');
      assert.equal(intervals[0].durationMinutes, 60);
    });

    it('merges all slots from 08:00 to 12:00 into single 240m Booking (Criteria 26, 8.3.1)', () => {
      const slots = [
        { startTime: '08:00', endTime: '08:30' },
        { startTime: '08:30', endTime: '09:00' },
        { startTime: '09:00', endTime: '09:30' },
        { startTime: '09:30', endTime: '10:00' },
        { startTime: '10:00', endTime: '10:30' },
        { startTime: '10:30', endTime: '11:00' },
        { startTime: '11:00', endTime: '11:30' },
        { startTime: '11:30', endTime: '12:00' },
      ];
      const intervals = mergeContiguousSlots(slots, '06:00', '22:00', 30);
      assert.equal(intervals.length, 1);
      assert.equal(intervals[0].startTime, '08:00');
      assert.equal(intervals[0].endTime, '12:00');
      assert.equal(intervals[0].durationMinutes, 240);
    });

    it('keeps disjoint slots as separate intervals without auto-filling gap (Criterion 27)', () => {
      // 06:00-06:30, 06:30-07:00 and 08:00-08:30
      const slots = [
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:30', endTime: '07:00' },
        { startTime: '08:00', endTime: '08:30' },
      ];
      const intervals = mergeContiguousSlots(slots, '06:00', '22:00', 30);
      assert.equal(intervals.length, 2);

      assert.equal(intervals[0].startTime, '06:00');
      assert.equal(intervals[0].endTime, '07:00');
      assert.equal(intervals[0].durationMinutes, 60);

      assert.equal(intervals[1].startTime, '08:00');
      assert.equal(intervals[1].endTime, '08:30');
      assert.equal(intervals[1].durationMinutes, 30);
    });

    it('merges 90m step slots: 06:00-07:30 + 07:30-09:00 into 180m Booking (Criterion 29)', () => {
      const slots = [
        { startTime: '06:00', endTime: '07:30' },
        { startTime: '07:30', endTime: '09:00' },
      ];
      const intervals = mergeContiguousSlots(slots, '06:00', '22:00', 90);
      assert.equal(intervals.length, 1);
      assert.equal(intervals[0].startTime, '06:00');
      assert.equal(intervals[0].endTime, '09:00');
      assert.equal(intervals[0].durationMinutes, 180);
    });

    it('handles inverted order and deduplication seamlessly during merge (Criterion 28)', () => {
      const slots = [
        { startTime: '06:30', endTime: '07:00' },
        { startTime: '06:00', endTime: '06:30' },
        { startTime: '06:00', endTime: '06:30' }, // duplicate
      ];
      const intervals = mergeContiguousSlots(slots, '06:00', '22:00', 30);
      assert.equal(intervals.length, 1);
      assert.equal(intervals[0].startTime, '06:00');
      assert.equal(intervals[0].endTime, '07:00');
      assert.equal(intervals[0].durationMinutes, 60);
    });
  });

  describe('isOverlapping & hasAnyOverlap (Criterion 31)', () => {
    const existing = { startTime: '08:00', endTime: '12:00' };

    it('detects conflict for interval inside existing [08:00, 12:00)', () => {
      assert.equal(isOverlapping({ startTime: '09:00', endTime: '10:00' }, existing), true);
    });

    it('detects conflict for encompassing interval [07:00, 13:00)', () => {
      assert.equal(isOverlapping({ startTime: '07:00', endTime: '13:00' }, existing), true);
    });

    it('detects conflict for partial left overlap [07:30, 08:30)', () => {
      assert.equal(isOverlapping({ startTime: '07:30', endTime: '08:30' }, existing), true);
    });

    it('detects conflict for partial right overlap [11:30, 12:30)', () => {
      assert.equal(isOverlapping({ startTime: '11:30', endTime: '12:30' }, existing), true);
    });

    it('allows edge-touching left [07:00, 08:00) with NO overlap (Criterion 31)', () => {
      assert.equal(isOverlapping({ startTime: '07:00', endTime: '08:00' }, existing), false);
    });

    it('allows edge-touching right [12:00, 13:00) with NO overlap (Criterion 31)', () => {
      assert.equal(isOverlapping({ startTime: '12:00', endTime: '13:00' }, existing), false);
    });

    it('allows completely disjoint intervals', () => {
      assert.equal(isOverlapping({ startTime: '06:00', endTime: '07:00' }, existing), false);
      assert.equal(isOverlapping({ startTime: '13:00', endTime: '14:00' }, existing), false);
    });

    it('hasAnyOverlap checks across a collection of intervals', () => {
      const schedule = [
        { startTime: '06:00', endTime: '07:00' },
        { startTime: '08:00', endTime: '12:00' },
      ];
      assert.equal(hasAnyOverlap({ startTime: '07:00', endTime: '08:00' }, schedule), false);
      assert.equal(hasAnyOverlap({ startTime: '06:30', endTime: '07:30' }, schedule), true);
      assert.equal(hasAnyOverlap({ startTime: '11:00', endTime: '13:00' }, schedule), true);
    });
  });

  describe('generateDaySlots (Criterion 30)', () => {
    it('truncates remainder at end of day that does not fit a full step (Criterion 30)', () => {
      // Open 06:00, Close 23:00, Step 90 min:
      // Slots: 06:00-07:30, 07:30-09:00, 09:00-10:30, 10:30-12:00,
      //        12:00-13:30, 13:30-15:00, 15:00-16:30, 16:30-18:00,
      //        18:00-19:30, 19:30-21:00, 21:00-22:30.
      // Total 11 slots. 22:30-23:00 (30m) is omitted.
      const slots = generateDaySlots('06:00', '23:00', 90);
      assert.equal(slots.length, 11);
      assert.equal(slots[0].startTime, '06:00');
      assert.equal(slots[0].endTime, '07:30');
      assert.equal(slots[10].startTime, '21:00');
      assert.equal(slots[10].endTime, '22:30');
    });

    it('generates exact full slots when hours divide evenly', () => {
      // Open 06:00, Close 08:00, Step 30 min -> 4 slots
      const slots = generateDaySlots('06:00', '08:00', 30);
      assert.equal(slots.length, 4);
      assert.equal(slots[0].startTime, '06:00');
      assert.equal(slots[3].endTime, '08:00');
    });
  });
});

