import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';
import {
  isValidDateString,
  getCurrentDateVN,
  getCurrentTimeVN,
  parseTimeToMinutes,
} from '../../utils/date-time.js';

/**
 * Calculates a future date string YYYY-MM-DD by adding days to a base date.
 * Uses UTC noon to safely avoid daylight saving or leap second shifts in Asia/Ho_Chi_Minh.
 *
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} days
 * @returns {string} 'YYYY-MM-DD'
 */
export function addDaysToDateVN(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return getCurrentDateVN(targetDate);
}

/**
 * Validates that booking date is between today and maxDaysAhead (Section 8.3.1, Criterion 11).
 * Rejects dates in the past and dates beyond the 30-day window.
 *
 * @param {string} bookingDateStr - 'YYYY-MM-DD'
 * @param {number} [maxDaysAhead=30]
 * @param {string} [customTodayStr=null] - Optional override for unit testing
 * @returns {boolean}
 */
export function validateBookingDateRange(bookingDateStr, maxDaysAhead = 30, customTodayStr = null) {
  if (!isValidDateString(bookingDateStr)) {
    throw AppError.badRequest(
      `Định dạng ngày không hợp lệ: '${bookingDateStr}'. Định dạng chuẩn là YYYY-MM-DD.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const todayStr = customTodayStr || getCurrentDateVN();
  const maxDateStr = addDaysToDateVN(todayStr, maxDaysAhead);

  if (bookingDateStr < todayStr) {
    throw AppError.badRequest('Ngày đặt sân không thể ở trong quá khứ.', ERROR_CODES.VALIDATION_ERROR);
  }

  if (bookingDateStr > maxDateStr) {
    throw AppError.badRequest(
      `Chỉ được đặt sân trước tối đa ${maxDaysAhead} ngày (từ ${todayStr} đến ${maxDateStr}).`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  return true;
}

/**
 * Validates that the earliest start time is at least minAdvanceMinutes in advance
 * when booking for today (Section 8.3.1, Criterion 11).
 * Maintenance block (CourtBlock) can pass minAdvanceMinutes = 0 since it has no payment.
 *
 * @param {string} bookingDateStr - 'YYYY-MM-DD'
 * @param {string|number} earliestStartTime - 'HH:mm' or minutes from midnight
 * @param {number} [minAdvanceMinutes=15]
 * @param {string} [customTodayStr=null] - Optional override for unit testing
 * @param {string} [customNowTimeStr=null] - Optional override for unit testing
 * @returns {boolean}
 */
export function validateAdvanceNotice(
  bookingDateStr,
  earliestStartTime,
  minAdvanceMinutes = 15,
  customTodayStr = null,
  customNowTimeStr = null
) {
  const todayStr = customTodayStr || getCurrentDateVN();

  if (bookingDateStr === todayStr) {
    const nowTimeStr = customNowTimeStr || getCurrentTimeVN();
    const nowMinutes = parseTimeToMinutes(nowTimeStr);

    const earliestMinutes =
      typeof earliestStartTime === 'number'
        ? earliestStartTime
        : parseTimeToMinutes(earliestStartTime);

    if (earliestMinutes < nowMinutes + minAdvanceMinutes) {
      throw AppError.badRequest(
        `Giờ bắt đầu sớm nhất (${typeof earliestStartTime === 'string' ? earliestStartTime : earliestMinutes}) phải cách thời điểm hiện tại ít nhất ${minAdvanceMinutes} phút.`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  return true;
}

/**
 * Validates configuration version matching (Section 8.3.3, Criterion 33, Criterion 34).
 * Throws 409 CONFIG_VERSION_MISMATCH if client version does not match current DB version.
 *
 * @param {number} providedVersion
 * @param {number} currentVersion
 * @returns {boolean}
 */
export function validateConfigVersion(providedVersion, currentVersion) {
  if (providedVersion !== currentVersion) {
    throw AppError.conflict(
      'Cấu hình giờ hoạt động hoặc bước giờ đã thay đổi. Vui lòng tải lại thông tin sân.',
      ERROR_CODES.CONFIG_VERSION_MISMATCH
    );
  }
  return true;
}

/**
 * Validates court price version matching (Section 8.3.3, Criterion 14, Criterion 33).
 * Throws 409 CONFIG_VERSION_MISMATCH if client price version does not match current DB version.
 *
 * @param {number} providedVersion
 * @param {number} currentVersion
 * @returns {boolean}
 */
export function validatePriceVersion(providedVersion, currentVersion) {
  if (providedVersion !== currentVersion) {
    throw AppError.conflict(
      'Đơn giá thuê sân đã thay đổi. Vui lòng tải lại thông tin sân trước khi tiếp tục.',
      ERROR_CODES.CONFIG_VERSION_MISMATCH
    );
  }
  return true;
}

/**
 * Checks whether current time in Asia/Ho_Chi_Minh is at or past the booking's endTime (Criterion 17, 18).
 *
 * @param {string} bookingDateStr - 'YYYY-MM-DD'
 * @param {string} endTimeStr - 'HH:mm'
 * @param {Date} [customNow=new Date()]
 * @returns {boolean}
 */
export function isPastEndTime(bookingDateStr, endTimeStr, customNow = new Date()) {
  const todayVN = getCurrentDateVN(customNow);
  if (bookingDateStr < todayVN) {
    return true;
  }
  if (bookingDateStr > todayVN) {
    return false;
  }
  const nowMinutes = parseTimeToMinutes(getCurrentTimeVN(customNow));
  const endMinutes = parseTimeToMinutes(endTimeStr);
  return nowMinutes >= endMinutes;
}

/**
 * Validates that current time in Vietnam is at or after endTime (Criterion 17, 18).
 * Throws 400 VALIDATION_ERROR if current time is before endTime.
 *
 * @param {string} bookingDateStr - 'YYYY-MM-DD'
 * @param {string} endTimeStr - 'HH:mm'
 * @param {Date} [customNow=new Date()]
 * @param {string} [actionLabel='hoàn tất buổi chơi']
 * @returns {boolean}
 */
export function validatePastEndTime(bookingDateStr, endTimeStr, customNow = new Date(), actionLabel = 'hoàn tất buổi chơi') {
  if (!isPastEndTime(bookingDateStr, endTimeStr, customNow)) {
    throw AppError.badRequest(
      `Chưa đến giờ kết thúc (${endTimeStr}) của buổi chơi, không thể ${actionLabel}.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  return true;
}


