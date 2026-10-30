import React, { useEffect, useState, useMemo } from 'react';
import { Calendar, RefreshCw, AlertCircle, Clock, Info } from 'lucide-react';
import { courtService } from '../../services/court.service.js';
import { getValidDateList } from '../../utils/slot-helper.js';
import { TimeSlotCell } from './TimeSlotCell.jsx';
import { SelectedRangesSummary } from './SelectedRangesSummary.jsx';

export function CourtSchedule({ court, facility, initialDate, onProceedCheckout }) {
  const dates = useMemo(() => getValidDateList(30), []);
  const defaultDate = initialDate || dates[0]?.dateStr || '';

  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);

  const courtId = court?._id || court?.id;

  const fetchSchedule = async (courtIdToFetch, dateToFetch) => {
    if (!courtIdToFetch || !dateToFetch) return;
    try {
      setLoading(true);
      setError(null);
      const res = await courtService.getCourtSchedule(courtIdToFetch, dateToFetch);
      if (res?.data) {
        setScheduleData(res.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể tải lịch sân.';
      setError(msg);
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when court or date changes
  useEffect(() => {
    if (courtId && selectedDate) {
      setSelectedSlots([]); // Clear selections on court or date change
      fetchSchedule(courtId, selectedDate);
    }
  }, [courtId, selectedDate]);

  // Handle slot toggle
  const handleToggleSlot = (slot) => {
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s.startTime === slot.startTime);
      if (exists) {
        return prev.filter((s) => s.startTime !== slot.startTime);
      } else {
        return [...prev, slot];
      }
    });
  };

  const handleClearSelection = () => {
    setSelectedSlots([]);
  };

  return (
    <div className="space-y-6" data-testid="court-schedule-container">
      {/* 30-Day Date Picker Tabs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Chọn ngày chơi (trong vòng 30 ngày)</span>
          </label>
          <button
            type="button"
            onClick={() => fetchSchedule(courtId, selectedDate)}
            disabled={loading}
            className="text-xs text-slate-500 hover:text-brand-600 flex items-center space-x-1 transition disabled:opacity-50"
            title="Làm mới trạng thái lịch"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Cập nhật</span>
          </button>
        </div>

        {/* Scrollable date strip */}
        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
          {dates.map((d) => {
            const isSelected = d.dateStr === selectedDate;
            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setSelectedDate(d.dateStr)}
                data-testid={`date-tab-${d.dateStr}`}
                className={`flex-shrink-0 flex flex-col items-center justify-center py-2 px-3 rounded-xl border text-xs min-w-[70px] transition select-none ${
                  isSelected
                    ? 'bg-brand-600 border-brand-600 text-white font-bold shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <span className={`text-[10px] uppercase ${isSelected ? 'text-brand-100' : 'text-slate-400'}`}>
                  {d.dayName}
                </span>
                <span className="text-sm font-semibold mt-0.5">{d.displayDate}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
        <div className="flex items-center space-x-1.5">
          <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 inline-block" />
          <span>Trống (Có thể đặt)</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3.5 h-3.5 rounded bg-brand-600 border border-brand-600 inline-block" />
          <span className="font-semibold text-brand-700">Đang chọn</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300 inline-block" />
          <span className="text-amber-800">Đang giữ chỗ</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 inline-block" />
          <span className="text-slate-400 line-through">Đã đặt</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3.5 h-3.5 rounded bg-rose-100 border border-rose-300 inline-block" />
          <span className="text-rose-700">Khóa bảo trì</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-3.5 h-3.5 rounded bg-slate-200/50 border border-slate-200 inline-block" />
          <span className="text-slate-400">Đã qua giờ</span>
        </div>
      </div>

      {/* Main Grid State (Loading, Error, Slots) */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
          <span className="text-xs">Đang tải khung giờ sân...</span>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : scheduleData?.slots?.length ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Giờ mở cửa: {scheduleData.openTime} - {scheduleData.closeTime} (Bước nhảy:{' '}
                {scheduleData.slotStepMinutes} phút)
              </span>
            </span>
            <span>
              {scheduleData.slots.filter((s) => s.status === 'AVAILABLE').length}/
              {scheduleData.slots.length} ô giờ còn trống
            </span>
          </div>

          {/* Slot Grid */}
          <div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5"
            data-testid="time-slot-grid"
          >
            {scheduleData.slots.map((slot) => {
              const isSelected = selectedSlots.some(
                (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
              );
              return (
                <TimeSlotCell
                  key={`${slot.startTime}-${slot.endTime}`}
                  slot={slot}
                  isSelected={isSelected}
                  onToggle={handleToggleSlot}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
          Không có dữ liệu khung giờ cho ngày này.
        </div>
      )}

      {/* Selected Ranges Summary Panel */}
      <SelectedRangesSummary
        selectedSlots={selectedSlots}
        court={court}
        facility={facility}
        bookingDate={selectedDate}
        configVersion={scheduleData?.configVersion}
        slotStepMinutes={scheduleData?.slotStepMinutes}
        onClearSelection={handleClearSelection}
        onProceedCheckout={onProceedCheckout}
      />
    </div>
  );
}

export default CourtSchedule;

