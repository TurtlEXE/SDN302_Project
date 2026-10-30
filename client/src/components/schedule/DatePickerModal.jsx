import React from 'react';
import { X, Calendar, Check } from 'lucide-react';
import { getValidDateList } from '../../utils/slot-helper.js';

export function DatePickerModal({ isOpen, selectedDate, onSelectDate, onClose }) {
  if (!isOpen) return null;

  const validDates = getValidDateList(30);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="datepicker-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 id="datepicker-modal-title" className="text-base font-bold text-slate-900">
                Chọn ngày đặt sân
              </h3>
              <p className="text-xs text-slate-500">Trong vòng 30 ngày tới</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Đóng bảng chọn ngày"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content: 30 days grid */}
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            {validDates.map((item) => {
              const isSelected = item.dateStr === selectedDate;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => {
                    onSelectDate(item.dateStr);
                    onClose();
                  }}
                  data-testid={`datepicker-cell-${item.dateStr}`}
                  className={`p-3 rounded-xl border flex flex-col items-center justify-center transition relative ${
                    isSelected
                      ? 'bg-brand-600 border-brand-600 text-white font-bold shadow-md shadow-brand-500/20'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-brand-400 hover:bg-brand-50/40'
                  }`}
                >
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isSelected
                        ? 'text-brand-100'
                        : item.isWeekend
                        ? 'text-amber-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.dayName}
                  </span>
                  <span className="text-xs font-extrabold mt-0.5">{item.displayDate}</span>
                  {item.isToday && (
                    <span
                      className={`text-[9px] mt-1 px-1 rounded font-semibold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      Hôm nay
                    </span>
                  )}
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default DatePickerModal;

