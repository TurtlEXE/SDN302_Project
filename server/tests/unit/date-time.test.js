import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidTimeString,
  isValidDateString,
  parseTimeToMinutes,
  minutesToTime,
  validateOperatingHours,
  hasAtLeastOneFullSlot,
  calculateAvailableSlots,
  getCurrentDateVN,
  getCurrentTimeVN,
} from '../../src/utils/date-time.js';

describe('Date & Time Utility (Unit)', () => {
  it('should validate time strings correctly', () => {
    assert.strictEqual(isValidTimeString('06:00'), true);
    assert.strictEqual(isValidTimeString('23:59'), true);
    assert.strictEqual(isValidTimeString('00:00'), true);
    assert.strictEqual(isValidTimeString('24:00'), false);
    assert.strictEqual(isValidTimeString('6:00'), false);
    assert.strictEqual(isValidTimeString('invalid'), false);
    assert.strictEqual(isValidTimeString(null), false);
  });

  it('should validate date strings correctly', () => {
    assert.strictEqual(isValidDateString('2026-10-29'), true);
    assert.strictEqual(isValidDateString('2026-1-1'), false);
    assert.strictEqual(isValidDateString('invalid'), false);
  });

  it('should convert HH:mm to minutes and back', () => {
    assert.strictEqual(parseTimeToMinutes('00:00'), 0);
    assert.strictEqual(parseTimeToMinutes('06:00'), 360);
    assert.strictEqual(parseTimeToMinutes('12:30'), 750);
    assert.strictEqual(parseTimeToMinutes('23:59'), 1439);

    assert.strictEqual(minutesToTime(0), '00:00');
    assert.strictEqual(minutesToTime(360), '06:00');
    assert.strictEqual(minutesToTime(750), '12:30');
    assert.strictEqual(minutesToTime(1439), '23:59');

    assert.throws(() => parseTimeToMinutes('invalid'), /Invalid time format/);
    assert.throws(() => minutesToTime(-5), /Minutes must be a number between 0 and 1440/);
    assert.throws(() => minutesToTime(1500), /Minutes must be a number between 0 and 1440/);
  });

  it('should validate operating hours and detect invalid open/close intervals', () => {
    const valid = validateOperatingHours('06:00', '22:00');
    assert.strictEqual(valid.openMinutes, 360);
    assert.strictEqual(valid.closeMinutes, 1320);
    assert.strictEqual(valid.totalMinutes, 960);

    assert.throws(
      () => validateOperatingHours('22:00', '06:00'),
      /Giờ mở cửa \(openTime\) phải trước giờ đóng cửa \(closeTime\)/
    );
    assert.throws(
      () => validateOperatingHours('08:00', '08:00'),
      /Giờ mở cửa \(openTime\) phải trước giờ đóng cửa \(closeTime\)/
    );
  });

  it('should verify hasAtLeastOneFullSlot correctly', () => {
    assert.strictEqual(hasAtLeastOneFullSlot('06:00', '06:30', 30), true);
    assert.strictEqual(hasAtLeastOneFullSlot('06:00', '06:20', 30), false);
    assert.strictEqual(hasAtLeastOneFullSlot('06:00', '07:30', 90), true);
    assert.strictEqual(hasAtLeastOneFullSlot('06:00', '07:29', 90), false);
  });

  it('should calculate available slots and remainder according to Criterion 30 (06:00 - 23:00, step 90 min)', () => {
    // From Criterion 30: open 06:00, close 23:00, step 90 minutes
    // Total duration: 17 hours = 1020 minutes
    // 1020 / 90 = 11 full slots (990 minutes), remainder = 30 minutes (22:30 - 23:00 does not form a slot)
    const result = calculateAvailableSlots('06:00', '23:00', 90);
    assert.strictEqual(result.slotCount, 11);
    assert.strictEqual(result.remainderMinutes, 30);
    assert.strictEqual(result.slots[0].startTime, '06:00');
    assert.strictEqual(result.slots[0].endTime, '07:30');
    assert.strictEqual(result.slots[result.slots.length - 1].startTime, '21:00');
    assert.strictEqual(result.slots[result.slots.length - 1].endTime, '22:30');
  });

  it('should return valid Vietnam timezone date and time strings', () => {
    const dateVN = getCurrentDateVN();
    const timeVN = getCurrentTimeVN();
    assert.strictEqual(isValidDateString(dateVN), true);
    assert.strictEqual(isValidTimeString(timeVN), true);
  });
});

