import React, { useEffect, useState } from 'react';
import { Clock, AlertTriangle, ExternalLink, XCircle } from 'lucide-react';
import { formatVND } from '../../utils/slot-helper.js';

export function PaymentHoldModal({
  isOpen = false,
  holdExpiresAt,
  paymentUrl,
  bookingRequestId,
  requestNumber,
  totalAmountVnd = 0,
  onCancel,
  onExpire,
}) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!holdExpiresAt) return 600;
    const diff = Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!isOpen || !holdExpiresAt) return;

    const interval = setInterval(() => {
      const diff = Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsLeft(0);
        clearInterval(interval);
        if (onExpire) onExpire();
      } else {
        setSecondsLeft(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, holdExpiresAt, onExpire]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isExpired = secondsLeft <= 0;

  const handleProceedPayment = () => {
    if (paymentUrl && !isExpired) {
      window.location.href = paymentUrl;
    }
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    try {
      setIsCancelling(true);
      await onCancel();
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
      data-testid="payment-hold-modal"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 text-center space-y-6">
        {/* Countdown Badge */}
        <div className="flex flex-col items-center space-y-2">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isExpired
                ? 'bg-rose-50 text-rose-600'
                : secondsLeft <= 120
                ? 'bg-amber-50 text-amber-600 animate-pulse'
                : 'bg-brand-50 text-brand-600'
            }`}
          >
            {isExpired ? (
              <XCircle className="w-8 h-8" />
            ) : (
              <Clock className="w-8 h-8 animate-spin-slow" />
            )}
          </div>

          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {isExpired ? 'Hết thời gian giữ chỗ' : 'Đang giữ chỗ cho bạn'}
          </h3>

          <p className="text-xs text-slate-500 max-w-sm">
            {isExpired
              ? 'Yêu cầu giữ chỗ đã hết hiệu lực 10 phút. Các ô giờ đã được tự động mở lại cho người khác.'
              : 'Khung giờ bạn chọn đang được bảo lưu độc quyền trong 10 phút. Vui lòng hoàn tất thanh toán VNPay trước khi hết hạn.'}
          </p>
        </div>

        {/* Big Countdown Timer */}
        {!isExpired ? (
          <div className="py-3 px-6 bg-slate-50 rounded-2xl border border-slate-200 inline-block mx-auto">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-0.5">
              Thời gian còn lại
            </span>
            <span
              className={`text-3xl sm:text-4xl font-mono font-black ${
                secondsLeft <= 120 ? 'text-rose-600 animate-pulse' : 'text-brand-600'
              }`}
              data-testid="countdown-timer"
            >
              {timeFormatted}
            </span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold">
            00:00 — Hết hạn giữ chỗ
          </div>
        )}

        {/* Order Details Preview */}
        <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left space-y-2 border border-slate-100">
          {requestNumber && (
            <div className="flex justify-between">
              <span className="text-slate-500">Mã yêu cầu:</span>
              <span className="font-bold text-slate-800">{requestNumber}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Số tiền cần thanh toán:</span>
            <span className="font-bold text-brand-700 text-sm">
              {formatVND(totalAmountVnd)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Cổng thanh toán:</span>
            <span className="font-semibold text-slate-700">VNPay (100% trả trước)</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          {!isExpired ? (
            <button
              type="button"
              onClick={handleProceedPayment}
              className="w-full py-3.5 px-6 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition flex items-center justify-center space-x-2 active:scale-[0.98]"
              data-testid="btn-modal-vnpay"
            >
              <span>Tiếp tục thanh toán VNPay</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold text-xs transition disabled:opacity-50"
            data-testid="btn-modal-cancel"
          >
            {isCancelling ? 'Đang hủy...' : isExpired ? 'Đóng và đặt lại' : 'Hủy yêu cầu đặt sân'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentHoldModal;

