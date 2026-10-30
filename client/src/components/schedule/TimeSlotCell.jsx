import React from 'react';
import { Check } from 'lucide-react';

export function TimeSlotCell({ slot, isSelected = false, onToggle }) {
  const { startTime, endTime, status } = slot;
  const isAvailable = status === 'AVAILABLE';

  const handleClick = () => {
    if (isAvailable && onToggle) {
      onToggle(slot);
    }
  };

  // Status mapping
  const getStatusBadge = () => {
    switch (status) {
      case 'HOLD':
        return (
          <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
            Giữ chỗ
          </span>
        );
      case 'BOOKED':
        return (
          <span className="text-[10px] font-medium text-slate-500 bg-slate-200/80 px-1.5 py-0.5 rounded">
            Đã đặt
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="text-[10px] font-medium text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
            Khóa
          </span>
        );
      case 'PAST':
        return (
          <span className="text-[10px] font-medium text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded">
            Đã qua
          </span>
        );
      default:
        return null;
    }
  };

  const getStyleClasses = () => {
    if (isSelected) {
      return 'bg-brand-600 text-white border-brand-600 ring-2 ring-brand-400/50 shadow-md scale-[1.02] font-semibold';
    }

    switch (status) {
      case 'AVAILABLE':
        return 'bg-white hover:bg-brand-50/60 hover:border-brand-400 text-slate-800 border-slate-200 cursor-pointer shadow-xs active:scale-[0.98] transition-all';
      case 'HOLD':
        return 'bg-amber-50/70 border-amber-200 text-amber-900 cursor-not-allowed opacity-90';
      case 'BOOKED':
        return 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through opacity-80';
      case 'BLOCKED':
        return 'bg-rose-50/70 border-rose-200 text-rose-800 cursor-not-allowed opacity-90';
      case 'PAST':
      default:
        return 'bg-slate-100/70 border-slate-200 text-slate-400 cursor-not-allowed opacity-60';
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isAvailable}
      aria-label={`${startTime} - ${endTime}, trạng thái: ${status}${isSelected ? ', đã chọn' : ''}`}
      data-testid={`slot-${startTime.replace(':', '')}-${endTime.replace(':', '')}`}
      data-status={status}
      data-selected={isSelected ? 'true' : 'false'}
      className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs transition duration-150 select-none min-h-[58px] ${getStyleClasses()}`}
    >
      <div className="flex items-center space-x-1">
        <span className="font-medium tracking-tight">
          {startTime} - {endTime}
        </span>
        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />}
      </div>

      {!isAvailable && (
        <div className="mt-1">
          {getStatusBadge()}
        </div>
      )}
    </button>
  );
}

export default TimeSlotCell;

