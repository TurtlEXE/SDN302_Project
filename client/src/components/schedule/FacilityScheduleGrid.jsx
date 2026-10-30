import React from 'react';
import { Check, Clock, Lock, AlertCircle, Ban } from 'lucide-react';
import { formatVND } from '../../utils/slot-helper.js';

export function FacilityScheduleGrid({
  sport,
  selectedCourtId,
  selectedSlots = [],
  onSlotClick,
}) {
  if (!sport || !sport.courts || sport.courts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-slate-400 text-xs">
        Chưa có sân nào được kích hoạt cho môn {sport?.sportName || 'này'}.
      </div>
    );
  }

  // All courts in this sport have the same time slot boundaries
  const timeSlotsHeader = sport.courts[0]?.slots || [];

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      data-testid={`sport-schedule-section-${sport.facilitySportId || sport.sportId}`}
    >
      {/* Sport Section Header */}
      <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <span className="w-2.5 h-6 rounded-full bg-brand-600 inline-block" />
          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
            {sport.sportName}
          </h3>
          <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            {sport.courts.length} sân
          </span>
        </div>

        <div className="text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200 flex items-center space-x-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Mỗi lượt {sport.slotStepMinutes} phút</span>
        </div>
      </div>

      {/* Horizontal Scrollable Timeline Container */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 max-w-full">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                {/* Sticky top-left corner */}
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-slate-100 px-4 py-3 min-w-[130px] sm:min-w-[160px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]"
                >
                  Sân con
                </th>
                {/* Time ruler headers */}
                {timeSlotsHeader.map((slot, idx) => (
                  <th
                    key={slot.startTime}
                    scope="col"
                    className="px-2 py-3 text-center min-w-[70px] sm:min-w-[80px] font-bold text-slate-700 border-r border-slate-100 whitespace-nowrap"
                  >
                    <span className="block text-[11px]">{slot.startTime}</span>
                    <span className="block text-[9px] font-normal text-slate-400">
                      {slot.endTime}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {sport.courts.map((court) => {
                const isCourtActiveForSelection = selectedCourtId === court.courtId;

                return (
                  <tr key={court.courtId} className="hover:bg-slate-50/50 transition">
                    {/* Sticky Court Name Column */}
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-white px-4 py-3 min-w-[130px] sm:min-w-[160px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] align-middle"
                    >
                      <div className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                        {court.courtName}
                      </div>
                      <div className="text-[10px] text-brand-700 font-medium mt-0.5">
                        Từ {formatVND(court.pricePerHourVnd)}/h
                      </div>
                    </th>

                    {/* Court Slots in Timeline */}
                    {court.slots.map((slot) => {
                      const isSelected =
                        isCourtActiveForSelection &&
                        selectedSlots.some(
                          (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
                        );

                      const isAvailable = slot.status === 'AVAILABLE';
                      const isNoPrice = slot.status === 'NO_PRICE';
                      const isHold = slot.status === 'HOLD';
                      const isBooked = slot.status === 'BOOKED';
                      const isBlocked = slot.status === 'BLOCKED';
                      const isPast = slot.status === 'PAST';

                      const isClickable = isAvailable || isSelected;

                      // Style calculation
                      let cellClass =
                        'min-w-[70px] sm:min-w-[80px] h-12 p-1 text-center align-middle border-r border-slate-100 transition relative select-none';
                      let btnClass =
                        'w-full h-full rounded-lg flex flex-col items-center justify-center text-[11px] font-semibold transition border focus:outline-none focus:ring-2 focus:ring-brand-500';

                      if (isSelected) {
                        btnClass +=
                          ' bg-brand-600 text-white border-brand-600 shadow-sm active:scale-95';
                      } else if (isAvailable) {
                        btnClass +=
                          ' bg-white text-slate-800 border-slate-200 hover:border-brand-400 hover:bg-brand-50/50 active:scale-95 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.03)]';
                      } else if (isHold) {
                        btnClass +=
                          ' bg-amber-50 text-amber-800 border-amber-200 cursor-not-allowed opacity-90';
                      } else if (isBooked) {
                        btnClass +=
                          ' bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through opacity-75';
                      } else if (isBlocked) {
                        btnClass +=
                          ' bg-rose-50 text-rose-700 border-rose-200 cursor-not-allowed opacity-80';
                      } else if (isPast) {
                        btnClass +=
                          ' bg-slate-100/70 text-slate-400 border-slate-200 cursor-not-allowed opacity-60';
                      } else if (isNoPrice) {
                        btnClass +=
                          ' bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed border-dashed opacity-60';
                      }

                      const ariaLabel = `Sân ${court.courtName}, từ ${slot.startTime} đến ${
                        slot.endTime
                      }, ${
                        slot.priceVnd ? `Giá ${formatVND(slot.priceVnd)}` : ''
                      }, Trạng thái: ${
                        isSelected
                          ? 'Đang chọn'
                          : isAvailable
                          ? 'Còn trống'
                          : isHold
                          ? 'Đang giữ chỗ'
                          : isBooked
                          ? 'Đã đặt'
                          : isBlocked
                          ? 'Bảo trì'
                          : isPast
                          ? 'Đã qua giờ'
                          : 'Chưa có giá'
                      }`;

                      return (
                        <td key={slot.startTime} className={cellClass}>
                          <button
                            type="button"
                            disabled={!isClickable}
                            onClick={() => onSlotClick(court, slot, sport)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                if (isClickable) onSlotClick(court, slot, sport);
                              }
                            }}
                            className={btnClass}
                            aria-label={ariaLabel}
                            title={ariaLabel}
                            data-testid={`slot-${court.courtId}-${slot.startTime}`}
                          >
                            {isSelected ? (
                              <div className="flex items-center space-x-0.5">
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span className="font-extrabold text-[10px]">Đã chọn</span>
                              </div>
                            ) : isAvailable ? (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-slate-900 leading-tight">
                                  {slot.priceVnd
                                    ? slot.priceVnd >= 1000
                                      ? `${Math.round(slot.priceVnd / 1000)}k`
                                      : `${slot.priceVnd}đ`
                                    : 'Trống'}
                                </span>
                                <span className="text-[9px] text-slate-400 font-normal">
                                  /{sport.slotStepMinutes}p
                                </span>
                              </div>
                            ) : isHold ? (
                              <div className="flex flex-col items-center">
                                <Clock className="w-3 h-3 text-amber-600 mb-0.5" />
                                <span className="text-[9px] font-medium leading-none">Giữ chỗ</span>
                              </div>
                            ) : isBooked ? (
                              <span className="text-[9px] font-medium">Đã đặt</span>
                            ) : isBlocked ? (
                              <div className="flex flex-col items-center">
                                <Lock className="w-3 h-3 text-rose-500 mb-0.5" />
                                <span className="text-[9px] font-medium leading-none">Bảo trì</span>
                              </div>
                            ) : isPast ? (
                              <span className="text-[9px] font-medium">Đã qua</span>
                            ) : (
                              <div className="flex flex-col items-center" title="Sân chưa được thiết lập bảng giá cho giờ này">
                                <Ban className="w-3 h-3 text-slate-400 mb-0.5" />
                                <span className="text-[8px] font-medium leading-none">Chưa giá</span>
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default FacilityScheduleGrid;

