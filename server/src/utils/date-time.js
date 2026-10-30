/**
 * Date and Time Utilities for Sport Booking Platform
 * Business timezone: Asia/Ho_Chi_Minh
 */

const TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a string matches HH:mm format (00:00 - 23:59)
 * @param {string} timeStr
 * @returns {boolean}
 */
export function isValidTimeString(timeStr) {
  if (typeof timeStr !== 'string') return false;
  return TIME_REGEX.test(timeStr);
}

/**
 * Validates whether a string matches YYYY-MM-DD format
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string') return false;
  return DATE_REGEX.test(dateStr);
}

/**
 * Converts HH:mm string to minutes from midnight
 * @param {string} timeStr
 * @returns {number}
 */
export function parseTimeToMinutes(timeStr) {
  if (!isValidTimeString(timeStr)) {
    throw new Error(`Invalid time format '${timeStr}'. Expected HH:mm (00:00 - 23:59).`);
  }
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts minutes from midnight to HH:mm string
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes) {
  if (typeof minutes !== 'number' || minutes < 0 || minutes > 1440) {
    throw new Error(`Minutes must be a number between 0 and 1440. Received: ${minutes}`);
  }
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Validates operating hours: openTime and closeTime must be valid HH:mm and openTime < closeTime
 * @param {string} openTime
 * @param {string} closeTime
 * @returns {{ openMinutes: number, closeMinutes: number, totalMinutes: number }}
 */
export function validateOperatingHours(openTime, closeTime) {
  const openMinutes = parseTimeToMinutes(openTime);
  const closeMinutes = parseTimeToMinutes(closeTime);

  if (openMinutes >= closeMinutes) {
    throw new Error('Giờ mở cửa (openTime) phải trước giờ đóng cửa (closeTime).');
  }

  return {
    openMinutes,
    closeMinutes,
    totalMinutes: closeMinutes - openMinutes,
  };
}

/**
 * Checks if operating hours accommodate at least one full slot for a given slotStepMinutes
 * @param {string} openTime
 * @param {string} closeTime
 * @param {number} slotStepMinutes
 * @returns {boolean}
 */
export function hasAtLeastOneFullSlot(openTime, closeTime, slotStepMinutes) {
  const { totalMinutes } = validateOperatingHours(openTime, closeTime);
  return totalMinutes >= slotStepMinutes;
}

/**
 * Calculates slot breakdown from openTime with slotStepMinutes up to closeTime
 * Truncates remainder at end of day that does not fit a full slot (Criteria 30)
 * @param {string} openTime
 * @param {string} closeTime
 * @param {number} slotStepMinutes
 * @returns {{ slots: Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number }>, slotCount: number, remainderMinutes: number }}
 */
export function calculateAvailableSlots(openTime, closeTime, slotStepMinutes) {
  const { openMinutes, closeMinutes, totalMinutes } = validateOperatingHours(openTime, closeTime);

  const slots = [];
  let currentStart = openMinutes;

  while (currentStart + slotStepMinutes <= closeMinutes) {
    const currentEnd = currentStart + slotStepMinutes;
    slots.push({
      startTime: minutesToTime(currentStart),
      endTime: minutesToTime(currentEnd),
      startMinutes: currentStart,
      endMinutes: currentEnd,
    });
    currentStart = currentEnd;
  }

  const remainderMinutes = closeMinutes - currentStart;

  return {
    slots,
    slotCount: slots.length,
    remainderMinutes,
  };
}

/**
 * Gets current date string in Asia/Ho_Chi_Minh timezone (YYYY-MM-DD)
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getCurrentDateVN(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Gets current time string in Asia/Ho_Chi_Minh timezone (HH:mm)
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getCurrentTimeVN(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

