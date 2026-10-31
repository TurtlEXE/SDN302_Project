import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  AlertCircle,
  ArrowRight,
  Trash2,
  CheckCircle2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import {
  mergeContiguousSlots,
  calculateEstimatedPrice,
  formatVND,
  getDayType,
} from '../../utils/slot-helper.js';

export function SelectedRangesSummary({
  selectedSlots = [],
  court,
  facility,
  bookingDate,
  configVersion,
  operatingHoursVersion,
  priceVersion,
  pricingRules,
  dayType: passedDayType,
  slotStepMinutes,
  sportName,
  onClearSelection,
  onProceedCheckout,
}) {
  const navigate = useNavigate();
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const mergedRanges = mergeContiguousSlots(selectedSlots);
  const resolvedDayType = passedDayType || (bookingDate ? getDayType(bookingDate) : 'WEEKDAY');
  const pricingInput = {
    pricingRules: pricingRules || court?.pricingRules || [],
    pricePerHourVnd: court?.pricePerHourVnd || 0,
  };
  const { ranges: pricedRanges, totalDurationMinutes, totalPriceVnd, hasMissingPrice } =
    calculateEstimatedPrice(mergedRanges, pricingInput, resolvedDayType);

  const isDisjoint = pricedRanges.length > 1;

  const handleProceed = () => {
    if (pricedRanges.length === 0 || hasMissingPrice) return;

    let existingIdempKey = null;
    try {
      const raw = sessionStorage.getItem('sport_booking_draft');
      if (raw) {
        const parsed = JSON.parse(raw);
        existingIdempKey = parsed?.idempotencyKey;
      }
    } catch (e) {
      // ignore storage read errors
    }

    const draftData = {
      facilityId: facility?.id || facility?._id,
      facilityName: facility?.name,
      courtId: court?.id || court?._id || court?.courtId,
      courtName: court?.name || court?.courtName,
      sportId: court?.sportId,
      sportName: sportName || court?.sportName,
      bookingDate,
      pricePerHourVnd: court?.pricePerHourVnd || 0,
      priceVersion: priceVersion || court?.priceVersion || 1,
      pricingRules: pricingRules || court?.pricingRules || [],
      dayType: resolvedDayType,
      configVersion,
      operatingHoursVersion,
      slotStepMinutes: slotStepMinutes || court?.slotStepMinutes || 30,
      // Raw selected slots matching slotStepMinutes for backend payload (Issue 2)
      selectedSlots: selectedSlots.map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      // Merged contiguous intervals for UI display & booking calculation
      ranges: pricedRanges.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
        durationMinutes: r.durationMinutes,
        priceVnd: r.priceVnd,
        pricingSnapshot: r.pricingSnapshot || [],
      })),
      totalDurationMinutes,
      totalPriceVnd,
      idempotencyKey:
        existingIdempKey ||
        `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem('sport_booking_draft', JSON.stringify(draftData));
    } catch (err) {
      // ignore storage write errors
    }

    if (onProceedCheckout) {
      onProceedCheckout(draftData);
    } else {
      navigate('/checkout');
    }
  };

  if (selectedSlots.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-6 text-center text-slate-500">
        <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Chưa có ô giờ nào được chọn</p>
        <p className="text-xs text-slate-500 mt-1">
          Bấm vào các ô giờ trống màu trắng ở bảng lịch phía trên để bắt đầu đặt sân.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop & Tablet Inline Card */}
      <div
        className="bg-white rounded-2xl border border-brand-200 shadow-md p-5 space-y-4"
        data-testid="selected-ranges-summary"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">
                {court?.name || court?.courtName || 'Sân đã chọn'}
                {sportName ? ` (${sportName})` : ''}
              </h4>
              <div className="flex items-center text-xs text-slate-500 space-x-2">
                <span className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {bookingDate}
                </span>
                <span>•</span>
                <span>{resolvedDayType === 'WEEKEND' ? 'Cuối tuần' : 'Ngày thường'}</span>
                <span>•</span>
                <span>Từ {formatVND(court?.pricePerHourVnd || 0)}/giờ</span>
              </div>
            </div>
          </div>

          {onClearSelection && (
            <button
              type="button"
              onClick={onClearSelection}
              className="text-xs text-slate-400 hover:text-rose-600 flex items-center space-x-1 p-1 rounded transition"
              title="Bỏ chọn tất cả"
              data-testid="btn-clear-selection"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bỏ chọn</span>
            </button>
          )}
        </div>

        {/* Disjoint Notice */}
        {isDisjoint && (
          <div className="flex items-start space-x-2 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-semibold">Bạn đang chọn {pricedRanges.length} khoảng giờ không liền nhau:</p>
              <p className="text-amber-700 mt-0.5">
                Hệ thống sẽ tự động gộp các ô liền kề và tạo {pricedRanges.length} lượt chơi trong cùng một đơn hàng.
              </p>
            </div>
          </div>
        )}

        {/* Merged Ranges List */}
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Khoảng giờ đã gộp ({pricedRanges.length}):
          </span>
          <div className="space-y-2">
            {pricedRanges.map((range, idx) => (
              <div
                key={`${range.startTime}-${range.endTime}`}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                data-testid={`merged-range-${idx}`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    {range.startTime} - {range.endTime}
                  </span>
                  <span className="text-slate-500">
                    ({range.durationMinutes} phút)
                  </span>
                  {range.pricingSnapshot && range.pricingSnapshot.length > 1 && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      Đa khung giá ({range.pricingSnapshot.length} đoạn)
                    </span>
                  )}
                </div>
                <span className="font-bold text-brand-700 text-sm">
                  {formatVND(range.priceVnd)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Footer */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">
              Tổng thời gian: <span className="font-semibold text-slate-800">{totalDurationMinutes} phút</span>
            </div>
            <div className="text-lg font-black text-slate-900">
              Tổng tạm tính:{' '}
              <span className="text-brand-600" data-testid="total-price-vnd">
                {hasMissingPrice ? 'Chưa có giá' : formatVND(totalPriceVnd)}
              </span>
            </div>
            {hasMissingPrice && (
              <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                Khung giờ chưa được cấu hình bảng giá. Vui lòng bỏ chọn ô thiếu giá.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={handleProceed}
            disabled={hasMissingPrice}
            className="w-full sm:w-auto px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-500/25 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            data-testid="btn-proceed-checkout"
          >
            <span>Tiến hành đặt sân</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar (< 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-xl p-3 pb-safe">
        {/* Expandable Drawer for Mobile */}
        {isMobileExpanded && (
          <div className="mb-3 max-h-60 overflow-y-auto space-y-2 pb-2 border-b border-slate-100 text-xs">
            <div className="flex items-center justify-between font-semibold text-slate-700">
              <span>Chi tiết khoảng giờ:</span>
              {onClearSelection && (
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="text-rose-600 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Bỏ chọn
                </button>
              )}
            </div>
            {pricedRanges.map((range, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-1.5 px-2 bg-slate-50 rounded-lg"
              >
                <span>
                  {range.startTime} - {range.endTime} ({range.durationMinutes}p)
                </span>
                <span className="font-bold text-brand-700">{formatVND(range.priceVnd)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            data-testid="btn-toggle-mobile-drawer"
            aria-label="Xem chi tiết các ô giờ đã chọn"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            className="text-left flex-1 flex items-center justify-between"
          >
            <div>
              <div className="text-[11px] font-bold text-slate-900 truncate max-w-[170px]">
                {court?.name || court?.courtName}
              </div>
              <div className="text-base font-black text-brand-600">
                {hasMissingPrice ? 'Chưa có giá' : formatVND(totalPriceVnd)}{' '}
                <span className="text-[10px] font-normal text-slate-400">
                  ({totalDurationMinutes}p)
                </span>
              </div>
            </div>
            {isMobileExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-400 mr-2" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400 mr-2" />
            )}
          </button>

          <button
            type="button"
            onClick={handleProceed}
            disabled={hasMissingPrice}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-md transition shrink-0 flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Đặt sân</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

export default SelectedRangesSummary;
