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
 * Calculates authoritative price estimate for merged ranges (Criterion 33)
 * Formula: price = Math.round((durationMinutes / 60) * pricePerHourVnd)
 * 
 * @param {Array<{ startTime: string, endTime: string, durationMinutes: number }>} mergedRanges
 * @param {number} pricePerHourVnd
 * @returns {{ ranges: Array<any>, totalDurationMinutes: number, totalPriceVnd: number }}
 */
export function calculateEstimatedPrice(mergedRanges = [], pricePerHourVnd = 0) {
  let totalDurationMinutes = 0;
  let totalPriceVnd = 0;

  const ranges = mergedRanges.map((range) => {
    const duration = range.durationMinutes;
    const rangePrice = Math.round((duration / 60) * pricePerHourVnd);

    totalDurationMinutes += duration;
    totalPriceVnd += rangePrice;

    return {
      ...range,
      priceVnd: rangePrice,
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
 * Generates valid booking date options up to 30 days ahead (Criterion 27)
 * @param {number} [maxDays=30]
 * @returns {Array<{ dateStr: string, dayName: string, displayDate: string, isToday: boolean }>}
 */
export function getValidDateList(maxDays = 30) {
  const dates = [];
  const now = new Date();

  const daysOfWeek = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  for (let i = 0; i <= maxDays; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const isToday = i === 0;
    const dayName = isToday ? 'Hôm nay' : daysOfWeek[d.getDay()];
    const displayDate = `${day}/${month}`;

    dates.push({
      dateStr,
      dayName,
      displayDate,
      isToday,
    });
  }

  return dates;
}

