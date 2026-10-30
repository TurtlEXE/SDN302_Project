import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, ChevronRight } from 'lucide-react';
import { formatVND } from '../../utils/slot-helper.js';

export function BookingCard({ booking }) {
  const {
    id,
    bookingCode,
    facilityName,
    courtName,
    sportName,
    facilityAddress,
    bookingDate,
    startTime,
    endTime,
    durationMinutes,
    totalPriceVnd,
    status,
    paymentStatus,
  } = booking;

  const getStatusBadge = () => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Đã xác nhận
          </span>
        );
      case 'PENDING_PAYMENT':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            Chờ thanh toán
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Đã phục vụ
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            Đã hủy
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            Khách không đến
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            Hết hạn giữ chỗ
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  const getPaymentBadge = () => {
    if (paymentStatus === 'PAID') {
      return (
        <span className="text-[11px] font-semibold text-emerald-600">
          ● Đã thanh toán VNPay
        </span>
      );
    }
    if (paymentStatus === 'REFUNDED') {
      return (
        <span className="text-[11px] font-semibold text-amber-600">
          ● Đã hoàn tiền
        </span>
      );
    }
    return (
      <span className="text-[11px] font-medium text-slate-400">
        ○ Chưa thanh toán
      </span>
    );
  };

  return (
    <div
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between space-y-4"
      data-testid={`booking-card-${id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
              {bookingCode || 'BK-CHỜ'}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              {sportName || 'Thể thao'}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900 mt-1">
            {courtName} — {facilityName}
          </h3>
        </div>

        <div>{getStatusBadge()}</div>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center space-x-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-800">{bookingDate}</span>
          <span>•</span>
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            {startTime} - {endTime} ({durationMinutes} phút)
          </span>
        </div>

        {facilityAddress && (
          <div className="flex items-start space-x-2 text-slate-500">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span className="truncate">{facilityAddress}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div>
          <div className="text-base font-black text-slate-900">
            {formatVND(totalPriceVnd)}
          </div>
          <div>{getPaymentBadge()}</div>
        </div>

        <Link
          to={`/my-bookings/${id}`}
          className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 text-xs font-semibold border border-slate-200 hover:border-brand-200 transition"
        >
          <span>Chi tiết</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

export default BookingCard;

