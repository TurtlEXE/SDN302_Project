import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';
import { parseTimeToMinutes } from '../../utils/date-time.js';

/**
 * Calculates price for a single merged interval (Section 8.4, Criteria 6, 24, 32).
 * Formula: Math.round(pricePerHourVnd * durationMinutes / 60), with 0.5 rounded up.
 *
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @param {number} pricePerHourVnd
 * @returns {number} Integer price in VND
 */
export function calculateIntervalPrice(startMinutes, endMinutes, pricePerHourVnd) {
  if (typeof startMinutes !== 'number' || typeof endMinutes !== 'number') {
    throw AppError.badRequest('Thời gian bắt đầu và kết thúc phải là số phút.', ERROR_CODES.VALIDATION_ERROR);
  }

  const durationMinutes = endMinutes - startMinutes;
  if (durationMinutes <= 0) {
    throw AppError.badRequest('Thời lượng khoảng đặt sân phải lớn hơn 0 phút.', ERROR_CODES.VALIDATION_ERROR);
  }

  if (typeof pricePerHourVnd !== 'number' || pricePerHourVnd < 0 || !Number.isFinite(pricePerHourVnd)) {
    throw AppError.badRequest('Đơn giá theo giờ không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
  }

  // Exact rounding with 0.5 rounded up to nearest integer VND
  const exactAmount = (pricePerHourVnd * durationMinutes) / 60;
  const roundedPrice = Math.round(exactAmount + 1e-9);

  return roundedPrice;
}

/**
 * Calculates total price for a BookingRequest from its merged intervals (Section 8.4, Criterion 32).
 * Each merged interval is priced individually, and total price is the sum of merged interval prices.
 * Total price strictly has NO platform fees, NO commissions, NO voucher discounts (Criterion 24).
 *
 * @param {Array<{ startTime: string, endTime: string, startMinutes?: number, endMinutes?: number, durationMinutes?: number }>} mergedIntervals
 * @param {number} pricePerHourVnd
 * @returns {{
 *   intervals: Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number, durationMinutes: number, priceVnd: number }>,
 *   totalPriceVnd: number,
 *   totalDurationMinutes: number
 * }}
 */
export function calculateBookingRequestTotal(mergedIntervals, pricePerHourVnd) {
  if (!Array.isArray(mergedIntervals) || mergedIntervals.length === 0) {
    throw AppError.badRequest('Danh sách khoảng đặt sân không được để trống.', ERROR_CODES.VALIDATION_ERROR);
  }

  if (typeof pricePerHourVnd !== 'number' || pricePerHourVnd <= 0 || !Number.isFinite(pricePerHourVnd)) {
    throw AppError.badRequest('Đơn giá theo giờ phải là số nguyên dương lớn hơn 0.', ERROR_CODES.VALIDATION_ERROR);
  }

  let totalPriceVnd = 0;
  let totalDurationMinutes = 0;

  const intervals = mergedIntervals.map((interval) => {
    const startMinutes =
      typeof interval.startMinutes === 'number'
        ? interval.startMinutes
        : parseTimeToMinutes(interval.startTime);
    const endMinutes =
      typeof interval.endMinutes === 'number'
        ? interval.endMinutes
        : parseTimeToMinutes(interval.endTime);
    const durationMinutes = endMinutes - startMinutes;

    const priceVnd = calculateIntervalPrice(startMinutes, endMinutes, pricePerHourVnd);

    totalPriceVnd += priceVnd;
    totalDurationMinutes += durationMinutes;

    return {
      startTime: interval.startTime,
      endTime: interval.endTime,
      startMinutes,
      endMinutes,
      durationMinutes,
      priceVnd,
    };
  });

  return {
    intervals,
    totalPriceVnd,
    totalDurationMinutes,
  };
}

