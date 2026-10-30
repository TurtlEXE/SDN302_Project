import {
  parseTimeToMinutes,
  minutesToTime,
  isValidTimeString,
  calculateAvailableSlots,
} from '../../utils/date-time.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';

/**
 * Validates a single slot against operating hours and slotStepMinutes.
 * Throws AppError.badRequest if slot is invalid, off-grid, or out of operating hours.
 *
 * @param {{ startTime: string, endTime: string }} slot
 * @param {string} openTime - e.g. '06:00'
 * @param {string} closeTime - e.g. '22:00'
 * @param {number} slotStepMinutes - 30, 60, or 90
 * @returns {{ startMinutes: number, endMinutes: number }}
 */
export function validateSlot(slot, openTime, closeTime, slotStepMinutes) {
  if (!slot || typeof slot !== 'object') {
    throw AppError.badRequest('Ô giờ phải là một đối tượng hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
  }

  const { startTime, endTime } = slot;
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
    throw AppError.badRequest(
      `Định dạng giờ không hợp lệ: startTime='${startTime}', endTime='${endTime}'. Định dạng chuẩn là HH:mm.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

  if (startMinutes >= endMinutes) {
    throw AppError.badRequest(
      `Giờ bắt đầu (${startTime}) phải trước giờ kết thúc (${endTime}).`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const duration = endMinutes - startMinutes;
  if (duration !== slotStepMinutes) {
    throw AppError.badRequest(
      `Độ dài ô giờ (${duration} phút) không khớp với bước giờ của môn (${slotStepMinutes} phút).`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  if (startMinutes < openMinutes || endMinutes > closeMinutes) {
    throw AppError.badRequest(
      `Ô giờ ${startTime}–${endTime} nằm ngoài khung giờ mở cửa (${openTime}–${closeTime}).`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  if ((startMinutes - openMinutes) % slotStepMinutes !== 0) {
    throw AppError.badRequest(
      `Ô giờ ${startTime}–${endTime} sai mốc bước giờ (mốc gốc mở cửa: ${openTime}, bước: ${slotStepMinutes} phút).`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  return { startMinutes, endMinutes };
}

/**
 * Normalizes input slots: deduplicates identical slots, sorts ascending by startTime,
 * and ensures there are no partial overlaps within the input itself (Criterion 28).
 *
 * @param {Array<{ startTime: string, endTime: string }>} slots
 * @returns {Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number }>}
 */
export function normalizeAndDeduplicateSlots(slots) {
  if (!Array.isArray(slots) || slots.length === 0) {
    throw AppError.badRequest('Danh sách ô giờ không được để trống.', ERROR_CODES.VALIDATION_ERROR);
  }

  // Deduplicate identical slots by key: "startTime-endTime"
  const seenMap = new Map();
  for (const slot of slots) {
    if (!slot || typeof slot !== 'object') {
      throw AppError.badRequest('Ô giờ trong danh sách không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
    }
    const startTime = typeof slot.startTime === 'string' ? slot.startTime.trim() : '';
    const endTime = typeof slot.endTime === 'string' ? slot.endTime.trim() : '';
    if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) {
      throw AppError.badRequest(
        `Định dạng giờ không hợp lệ: startTime='${startTime}', endTime='${endTime}'.`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    const key = `${startTime}-${endTime}`;
    if (!seenMap.has(key)) {
      seenMap.set(key, {
        startTime,
        endTime,
        startMinutes: parseTimeToMinutes(startTime),
        endMinutes: parseTimeToMinutes(endTime),
      });
    }
  }

  const uniqueSlots = Array.from(seenMap.values());

  // Sort ascending by startMinutes
  uniqueSlots.sort((a, b) => a.startMinutes - b.startMinutes);

  // Validate no partial or conflicting overlaps within unique input slots (Criterion 28)
  for (let i = 0; i < uniqueSlots.length - 1; i++) {
    const current = uniqueSlots[i];
    const next = uniqueSlots[i + 1];

    if (current.endMinutes > next.startMinutes) {
      throw AppError.badRequest(
        `Các ô giờ gửi lên bị chồng lấn không hợp lệ: ${current.startTime}–${current.endTime} và ${next.startTime}–${next.endTime}.`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  return uniqueSlots;
}

/**
 * Merges contiguous slots into unified intervals (Section 8.3.1, Criteria 6, 26, 27, 28, 29).
 * - Validates each slot against operating hours and slotStep.
 * - Deduplicates identical slots (order-independent).
 * - Rejects off-grid slots and partially overlapping input slots.
 * - Contiguous slots (current.endTime === next.startTime) merge into one continuous interval.
 * - Disjoint slots remain separate intervals (never auto-fills gaps).
 *
 * @param {Array<{ startTime: string, endTime: string }>} slots
 * @param {string} openTime
 * @param {string} closeTime
 * @param {number} slotStepMinutes
 * @returns {Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number, durationMinutes: number }>}
 */
export function mergeContiguousSlots(slots, openTime, closeTime, slotStepMinutes) {
  // Validate each individual slot against schedule rules first
  for (const slot of slots) {
    validateSlot(slot, openTime, closeTime, slotStepMinutes);
  }

  // Deduplicate, sort and check for internal conflicts
  const sortedSlots = normalizeAndDeduplicateSlots(slots);

  const mergedIntervals = [];
  let currentInterval = null;

  for (const slot of sortedSlots) {
    if (!currentInterval) {
      currentInterval = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        durationMinutes: slot.endMinutes - slot.startMinutes,
      };
      continue;
    }

    // If contiguous (current interval ends exactly when next slot starts)
    if (currentInterval.endMinutes === slot.startMinutes) {
      currentInterval.endTime = slot.endTime;
      currentInterval.endMinutes = slot.endMinutes;
      currentInterval.durationMinutes = currentInterval.endMinutes - currentInterval.startMinutes;
    } else {
      // Disjoint gap: push current interval and start new interval
      mergedIntervals.push(currentInterval);
      currentInterval = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        durationMinutes: slot.endMinutes - slot.startMinutes,
      };
    }
  }

  if (currentInterval) {
    mergedIntervals.push(currentInterval);
  }

  return mergedIntervals;
}

/**
 * Checks whether two time intervals overlap (Section 8.3.2, Criterion 31).
 * Convention: half-open intervals [start, end), where start < end.
 * Overlap condition: startA < endB && endA > startB.
 * Edge-touching (endA === startB or startA === endB) does NOT overlap (returns false).
 *
 * @param {{ startTime?: string, endTime?: string, startMinutes?: number, endMinutes?: number }} intervalA
 * @param {{ startTime?: string, endTime?: string, startMinutes?: number, endMinutes?: number }} intervalB
 * @returns {boolean}
 */
export function isOverlapping(intervalA, intervalB) {
  const startA =
    typeof intervalA.startMinutes === 'number'
      ? intervalA.startMinutes
      : parseTimeToMinutes(intervalA.startTime);
  const endA =
    typeof intervalA.endMinutes === 'number'
      ? intervalA.endMinutes
      : parseTimeToMinutes(intervalA.endTime);

  const startB =
    typeof intervalB.startMinutes === 'number'
      ? intervalB.startMinutes
      : parseTimeToMinutes(intervalB.startTime);
  const endB =
    typeof intervalB.endMinutes === 'number'
      ? intervalB.endMinutes
      : parseTimeToMinutes(intervalB.endTime);

  return startA < endB && endA > startB;
}

/**
 * Checks if targetInterval overlaps with any interval in the provided list.
 *
 * @param {{ startTime?: string, endTime?: string, startMinutes?: number, endMinutes?: number }} targetInterval
 * @param {Array<{ startTime?: string, endTime?: string, startMinutes?: number, endMinutes?: number }>} existingIntervals
 * @returns {boolean}
 */
export function hasAnyOverlap(targetInterval, existingIntervals) {
  if (!Array.isArray(existingIntervals) || existingIntervals.length === 0) {
    return false;
  }
  return existingIntervals.some((existing) => isOverlapping(targetInterval, existing));
}

/**
 * Generates day slot grid from openTime with slotStepMinutes up to closeTime.
 * Truncates remainder not fitting a full step (Criterion 30).
 *
 * @param {string} openTime
 * @param {string} closeTime
 * @param {number} slotStepMinutes
 * @returns {Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number }>}
 */
export function generateDaySlots(openTime, closeTime, slotStepMinutes) {
  const { slots } = calculateAvailableSlots(openTime, closeTime, slotStepMinutes);
  return slots;
}

