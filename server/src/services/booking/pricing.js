import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../errors/error-codes.js';
import { parseTimeToMinutes, minutesToTime, isValidTimeString } from '../../utils/date-time.js';

/**
 * Validates a list of pricing rules for consistency:
 * - Each rule must have dayType in ['WEEKDAY', 'WEEKEND']
 * - Valid HH:mm startTime and endTime, with startTime < endTime
 * - Positive finite pricePerHourVnd
 * - No overlapping rules within the same dayType
 *
 * @param {Array<{ dayType: string, startTime: string, endTime: string, pricePerHourVnd: number }>} rules
 */
export function validatePricingRules(rules) {
  if (!Array.isArray(rules)) {
    throw AppError.badRequest('Bảng giá phải là danh sách các quy tắc.', ERROR_CODES.VALIDATION_ERROR);
  }

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!['WEEKDAY', 'WEEKEND'].includes(r.dayType)) {
      throw AppError.badRequest(`Loại ngày '${r.dayType}' không hợp lệ (chỉ chấp nhận WEEKDAY hoặc WEEKEND).`, ERROR_CODES.VALIDATION_ERROR);
    }
    if (!isValidTimeString(r.startTime) || !isValidTimeString(r.endTime)) {
      throw AppError.badRequest(`Khung giờ '${r.startTime} - ${r.endTime}' không đúng định dạng HH:mm.`, ERROR_CODES.VALIDATION_ERROR);
    }
    const startMin = parseTimeToMinutes(r.startTime);
    const endMin = parseTimeToMinutes(r.endTime);
    if (startMin >= endMin) {
      throw AppError.badRequest(`Giờ bắt đầu (${r.startTime}) phải trước giờ kết thúc (${r.endTime}).`, ERROR_CODES.VALIDATION_ERROR);
    }
    const price = Number(r.pricePerHourVnd);
    if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(price)) {
      throw AppError.badRequest('Đơn giá theo giờ phải là số nguyên dương lớn hơn 0.', ERROR_CODES.VALIDATION_ERROR);
    }
  }

  // Check overlap within same dayType
  for (let i = 0; i < rules.length; i++) {
    const a = rules[i];
    const aStart = parseTimeToMinutes(a.startTime);
    const aEnd = parseTimeToMinutes(a.endTime);

    for (let j = i + 1; j < rules.length; j++) {
      const b = rules[j];
      if (a.dayType === b.dayType) {
        const bStart = parseTimeToMinutes(b.startTime);
        const bEnd = parseTimeToMinutes(b.endTime);

        // Overlap condition: aStart < bEnd && bStart < aEnd
        if (aStart < bEnd && bStart < aEnd) {
          throw AppError.badRequest(
            `Các quy tắc bảng giá bị chồng lấn trong loại ngày ${a.dayType}: (${a.startTime}–${a.endTime}) và (${b.startTime}–${b.endTime}).`,
            ERROR_CODES.VALIDATION_ERROR
          );
        }
      }
    }
  }
  return true;
}

/**
 * Calculates price for a single uniform interval (Section 8.4, Criteria 6, 24, 32).
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

  const exactAmount = (pricePerHourVnd * durationMinutes) / 60;
  return Math.round(exactAmount + 1e-9);
}

/**
 * Slices an interval across applicable pricing rules for a given dayType.
 * Pro-rates each segment and ensures 100% price coverage.
 * If any part of the interval has no price rule, rejects with 400.
 *
 * @param {number} startMinutes
 * @param {number} endMinutes
 * @param {Array<object>} pricingRules
 * @param {'WEEKDAY' | 'WEEKEND'} dayType
 * @param {number} [fallbackPricePerHourVnd]
 * @returns {{ priceVnd: number, segments: Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number, durationMinutes: number, pricePerHourVnd: number, segmentAmountVnd: number }> }}
 */
export function sliceIntervalPricing(startMinutes, endMinutes, pricingRules = [], dayType = 'WEEKDAY', fallbackPricePerHourVnd = null) {
  if (startMinutes >= endMinutes) {
    throw AppError.badRequest('Khoảng thời gian không hợp lệ.', ERROR_CODES.VALIDATION_ERROR);
  }

  const matchingRules = (Array.isArray(pricingRules) ? pricingRules : [])
    .filter((r) => r.dayType === dayType)
    .map((r) => ({
      ...r,
      startMinutes: parseTimeToMinutes(r.startTime),
      endMinutes: parseTimeToMinutes(r.endTime),
      pricePerHourVnd: Number(r.pricePerHourVnd),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  // If no matching rules but a valid fallback is supplied (for legacy tests)
  if (matchingRules.length === 0) {
    if (typeof fallbackPricePerHourVnd === 'number' && fallbackPricePerHourVnd > 0) {
      const duration = endMinutes - startMinutes;
      const segmentAmount = calculateIntervalPrice(startMinutes, endMinutes, fallbackPricePerHourVnd);
      return {
        priceVnd: segmentAmount,
        segments: [
          {
            startTime: minutesToTime(startMinutes),
            endTime: minutesToTime(endMinutes),
            startMinutes,
            endMinutes,
            durationMinutes: duration,
            pricePerHourVnd: fallbackPricePerHourVnd,
            segmentAmountVnd: segmentAmount,
          },
        ],
      };
    }

    throw AppError.badRequest(
      `Khoảng thời gian ${minutesToTime(startMinutes)}–${minutesToTime(endMinutes)} (${dayType === 'WEEKEND' ? 'Cuối tuần' : 'Ngày thường'}) chưa có bảng giá áp dụng. Vui lòng liên hệ chủ sân để bổ sung bảng giá.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  let current = startMinutes;
  const segments = [];

  for (const rule of matchingRules) {
    if (rule.endMinutes <= current) {
      continue;
    }

    if (rule.startMinutes > current) {
      // Gap detected before this rule!
      const gapEnd = Math.min(rule.startMinutes, endMinutes);
      throw AppError.badRequest(
        `Khoảng thời gian ${minutesToTime(current)}–${minutesToTime(gapEnd)} (${dayType === 'WEEKEND' ? 'Cuối tuần' : 'Ngày thường'}) chưa có bảng giá áp dụng. Vui lòng liên hệ chủ sân để bổ sung bảng giá.`,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const segStart = current;
    const segEnd = Math.min(rule.endMinutes, endMinutes);
    const segDuration = segEnd - segStart;

    if (segDuration > 0) {
      const segmentAmountVnd = calculateIntervalPrice(segStart, segEnd, rule.pricePerHourVnd);
      segments.push({
        startTime: minutesToTime(segStart),
        endTime: minutesToTime(segEnd),
        startMinutes: segStart,
        endMinutes: segEnd,
        durationMinutes: segDuration,
        pricePerHourVnd: rule.pricePerHourVnd,
        segmentAmountVnd,
      });
      current = segEnd;
    }

    if (current >= endMinutes) {
      break;
    }
  }

  if (current < endMinutes) {
    // Gap at the end of the interval
    throw AppError.badRequest(
      `Khoảng thời gian ${minutesToTime(current)}–${minutesToTime(endMinutes)} (${dayType === 'WEEKEND' ? 'Cuối tuần' : 'Ngày thường'}) chưa có bảng giá áp dụng. Vui lòng liên hệ chủ sân để bổ sung bảng giá.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  const priceVnd = segments.reduce((sum, s) => sum + s.segmentAmountVnd, 0);

  return {
    priceVnd,
    segments,
  };
}

/**
 * Calculates total price for a BookingRequest from its merged intervals (B03 Multi-Tier & Section 8.4, Criterion 32).
 * Each merged interval is priced individually based on court pricing rules and dayType.
 * Total price strictly has NO platform fees, NO commissions, NO voucher discounts (Criterion 24).
 *
 * @param {Array<{ startTime: string, endTime: string, startMinutes?: number, endMinutes?: number, durationMinutes?: number }>} mergedIntervals
 * @param {number | Array<object> | { pricingRules?: Array<object>, pricePerHourVnd?: number }} pricingInput
 * @param {'WEEKDAY' | 'WEEKEND'} [dayType='WEEKDAY']
 * @returns {{
 *   intervals: Array<{ startTime: string, endTime: string, startMinutes: number, endMinutes: number, durationMinutes: number, priceVnd: number, pricingSnapshot: Array<object> }>,
 *   totalPriceVnd: number,
 *   totalDurationMinutes: number
 * }}
 */
export function calculateBookingRequestTotal(mergedIntervals, pricingInput, dayType = 'WEEKDAY') {
  if (!Array.isArray(mergedIntervals) || mergedIntervals.length === 0) {
    throw AppError.badRequest('Danh sách khoảng đặt sân không được để trống.', ERROR_CODES.VALIDATION_ERROR);
  }

  let pricingRules = [];
  let fallbackPricePerHourVnd = null;

  if (typeof pricingInput === 'number') {
    if (pricingInput <= 0 || !Number.isFinite(pricingInput)) {
      throw AppError.badRequest('Đơn giá theo giờ phải là số nguyên dương lớn hơn 0.', ERROR_CODES.VALIDATION_ERROR);
    }
    fallbackPricePerHourVnd = pricingInput;
  } else if (Array.isArray(pricingInput)) {
    pricingRules = pricingInput;
  } else if (pricingInput && typeof pricingInput === 'object') {
    pricingRules = pricingInput.pricingRules || [];
    fallbackPricePerHourVnd = pricingInput.pricePerHourVnd || null;
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

    const { priceVnd, segments } = sliceIntervalPricing(
      startMinutes,
      endMinutes,
      pricingRules,
      dayType,
      fallbackPricePerHourVnd
    );

    totalPriceVnd += priceVnd;
    totalDurationMinutes += durationMinutes;

    return {
      startTime: interval.startTime,
      endTime: interval.endTime,
      startMinutes,
      endMinutes,
      durationMinutes,
      priceVnd,
      pricingSnapshot: segments,
    };
  });

  return {
    intervals,
    totalPriceVnd,
    totalDurationMinutes,
  };
}
