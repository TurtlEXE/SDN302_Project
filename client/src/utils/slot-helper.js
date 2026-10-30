/**
 * Slot and Time Interval Calculation Utilities (P16)
 * Follows core business rules in docs/architecture.md Mục 8 & docs/features.md Criteria 28-33.
 */

/**
 * Convert HH:mm to minutes from midnight
 * @param {string} timeStr - 'HH:mm'
 * @returns {number}
 */
export function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map((v) => parseInt(v, 10));
  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to HH:mm
 * @param {number} minutes
 * @returns {string}
 */
export function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Merges contiguous selected slots into continuous intervals (PUB-05, Criterion 32)
 * Disjoint intervals remain separate ranges.
 * 
 * @param {Array<{ startTime: string, endTime: string }>} slots
 * @returns {Array<{ startTime: string, endTime: string, durationMinutes: number, slotCount: number }>}
 */
export function mergeContiguousSlots(slots = []) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  // Map with numeric minutes and sort ascending by startMinutes
  const normalized = slots
    .map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
      startMinutes: timeToMinutes(s.startTime),
      endMinutes: timeToMinutes(s.endTime),
    }))
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const ranges = [];
  let currentRange = null;

  for (const slot of normalized) {
    if (!currentRange) {
      currentRange = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        slotCount: 1,
      };
      continue;
    }

    // If adjacent (contiguous), merge by expanding endTime
    if (slot.startMinutes === currentRange.endMinutes) {
      currentRange.endTime = slot.endTime;
      currentRange.endMinutes = slot.endMinutes;
      currentRange.slotCount += 1;
    } else {
      // Disjoint gap found: commit previous range and start new range
      ranges.push({
        startTime: currentRange.startTime,
        endTime: currentRange.endTime,
        durationMinutes: currentRange.endMinutes - currentRange.startMinutes,
        slotCount: currentRange.slotCount,
      });

      currentRange = {
        startTime: slot.startTime,
        endTime: slot.endTime,
        startMinutes: slot.startMinutes,
        endMinutes: slot.endMinutes,
        slotCount: 1,
      };
    }
  }

  if (currentRange) {
    ranges.push({
      startTime: currentRange.startTime,
      endTime: currentRange.endTime,
      durationMinutes: currentRange.endMinutes - currentRange.startMinutes,
      slotCount: currentRange.slotCount,
    });
  }

  return ranges;
}

/**
 * Calculates authoritative price estimate for merged ranges (Criterion 33 & B03 multi-tier)
 * Formula: price = Math.round((durationMinutes / 60) * pricePerHourVnd)
 * 
 * @param {Array<{ startTime: string, endTime: string, durationMinutes: number }>} mergedRanges
 * @param {number | Array<object> | { pricingRules?: Array<object>, pricePerHourVnd?: number }} pricingInput
 * @param {'WEEKDAY' | 'WEEKEND'} [dayType='WEEKDAY']
 * @returns {{ ranges: Array<any>, totalDurationMinutes: number, totalPriceVnd: number }}
 */
export function calculateEstimatedPrice(mergedRanges = [], pricingInput = 0, dayType = 'WEEKDAY') {
  let totalDurationMinutes = 0;
  let totalPriceVnd = 0;

  let pricingRules = [];
  let fallbackPrice = 0;

  if (typeof pricingInput === 'number') {
    fallbackPrice = pricingInput;
  } else if (Array.isArray(pricingInput)) {
    pricingRules = pricingInput;
  } else if (pricingInput && typeof pricingInput === 'object') {
    pricingRules = pricingInput.pricingRules || [];
    fallbackPrice = pricingInput.pricePerHourVnd || 0;
  }

  const ranges = mergedRanges.map((range) => {
    const startMin = timeToMinutes(range.startTime);
    const endMin = timeToMinutes(range.endTime);
    const duration = range.durationMinutes || (endMin - startMin);

    let rangePrice = 0;
    let segments = [];

    if (pricingRules.length > 0) {
      const matchingRules = pricingRules
        .filter((r) => r.dayType === dayType)
        .map((r) => ({
          ...r,
          startMinutes: timeToMinutes(r.startTime),
          endMinutes: timeToMinutes(r.endTime),
          pricePerHourVnd: Number(r.pricePerHourVnd),
        }))
        .sort((a, b) => a.startMinutes - b.startMinutes);

      let cur = startMin;
      for (const rule of matchingRules) {
        if (rule.endMinutes <= cur) continue;
        if (rule.startMinutes > cur) {
          // Gap: use fallback if available
          const gapDur = Math.min(rule.startMinutes, endMin) - cur;
          if (gapDur > 0 && fallbackPrice > 0) {
            rangePrice += Math.round((gapDur / 60) * fallbackPrice);
          }
          cur = Math.min(rule.startMinutes, endMin);
        }

        const sStart = cur;
        const sEnd = Math.min(rule.endMinutes, endMin);
        const sDur = sEnd - sStart;

        if (sDur > 0) {
          const segAmount = Math.round((sDur / 60) * rule.pricePerHourVnd);
          segments.push({
            startTime: minutesToTime(sStart),
            endTime: minutesToTime(sEnd),
            startMinutes: sStart,
            endMinutes: sEnd,
            durationMinutes: sDur,
            pricePerHourVnd: rule.pricePerHourVnd,
            segmentAmountVnd: segAmount,
          });
          rangePrice += segAmount;
          cur = sEnd;
        }

        if (cur >= endMin) break;
      }

      if (cur < endMin && fallbackPrice > 0) {
        const remDur = endMin - cur;
        rangePrice += Math.round((remDur / 60) * fallbackPrice);
      }
    } else {
      rangePrice = Math.round((duration / 60) * fallbackPrice);
    }

    totalDurationMinutes += duration;
    totalPriceVnd += rangePrice;

    return {
      ...range,
      priceVnd: rangePrice,
      pricingSnapshot: segments,
    };
  });

  return {
    ranges,
    totalDurationMinutes,
    totalPriceVnd,
  };
}

/**
 * Format currency in VND
 * @param {number} amount
 * @returns {string}
 */
export function formatVND(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Returns the current date in Asia/Ho_Chi_Minh timezone as YYYY-MM-DD (Issue 4)
 * @param {Date} [date=new Date()]
 * @returns {string} YYYY-MM-DD
 */
export function getTodayVN(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Adds a number of days to a YYYY-MM-DD date string in Asia/Ho_Chi_Minh timezone (Issue 4)
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {number} days
 * @returns {string} YYYY-MM-DD
 */
export function addDaysVN(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return getTodayVN(targetDate);
}

/**
 * Returns the maximum booking date allowed (today + maxDays ahead in Asia/Ho_Chi_Minh) (Issue 4)
 * @param {string} [todayStr]
 * @param {number} [maxDays=30]
 * @returns {string} YYYY-MM-DD
 */
export function getMaxBookingDateVN(todayStr = getTodayVN(), maxDays = 30) {
  return addDaysVN(todayStr, maxDays);
}

/**
 * Generates valid booking date options up to 30 days ahead in Asia/Ho_Chi_Minh timezone (Criterion 27, Issue 4)
 * @param {number} [maxDays=30]
 * @param {Date} [baseDate=new Date()]
 * @returns {Array<{ dateStr: string, dayName: string, displayDate: string, isToday: boolean }>}
 */
export function getValidDateList(maxDays = 30, baseDate = new Date()) {
  const dates = [];
  const todayStr = getTodayVN(baseDate);
  const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  for (let i = 0; i <= maxDays; i++) {
    const dateStr = addDaysVN(todayStr, i);
    const [year, month, day] = dateStr.split('-').map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dayOfWeekIndex = utcDate.getUTCDay();

    const isToday = i === 0;
    const dayName = isToday ? 'Hôm nay' : daysOfWeek[dayOfWeekIndex];
    const displayDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

    dates.push({
      dateStr,
      dayName,
      displayDate,
      isToday,
    });
  }

  return dates;
}

export const DAY_OF_WEEK_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function getDayOfWeekKey(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 'monday';
  const [year, month, day] = dateStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return DAY_OF_WEEK_KEYS[utcDate.getUTCDay()];
}

export function getDayType(dateStr) {
  const key = getDayOfWeekKey(dateStr);
  return key === 'saturday' || key === 'sunday' ? 'WEEKEND' : 'WEEKDAY';
}


