import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  Receipt,
  CreditCard,
  AlertCircle,
  ExternalLink,
  Trash2,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { bookingService } from '../../services/booking.service.js';
import { paymentService } from '../../services/payment.service.js';
import { formatVND } from '../../utils/slot-helper.js';
import { PaymentHoldModal } from '../../components/booking/PaymentHoldModal.jsx';

export function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [paymentUrl, setPaymentUrl] = useState(null);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadBooking() {
      try {
        setLoading(true);
        setError(null);
        const res = await bookingService.getBookingById(id);
        if (isMounted && res?.data) {
          setBooking(res.data);
        }
      } catch (err) {
        if (isMounted) {
          const msg =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Không thể tải chi tiết đơn đặt sân.';
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBooking();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleContinuePayment = async () => {
    if (!booking?.paymentOrder?.id) return;
    try {
      setIsProcessing(true);
      const res = await paymentService.createPaymentUrl(booking.paymentOrder.id);
      if (res?.data?.paymentUrl) {
        setPaymentUrl(res.data.paymentUrl);
        setShowHoldModal(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tạo lại liên kết thanh toán.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking?.bookingRequestId) return;
    if (!window.confirm('Bạn có chắc chắn muốn hủy yêu cầu đặt sân này và giải phóng khung giờ?')) {
      return;
    }

    try {
      setIsProcessing(true);
      await bookingService.cancelBookingRequest(booking.bookingRequestId, 'Khách hàng tự hủy.');
      // Reload booking detail
      const res = await bookingService.getBookingById(id);
      if (res?.data) {
        setBooking(res.data);
      }
      setShowHoldModal(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể hủy đơn đặt sân.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Đang tải thông tin đơn đặt sân...</span>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Không tìm thấy đơn đặt sân</h2>
        <p className="text-xs text-slate-500">{error || 'Đơn không tồn tại hoặc bạn không có quyền xem.'}</p>
        <Link
          to="/my-bookings"
          className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
        >
          Quay lại danh sách đơn
        </Link>
      </div>
    );
  }

  const isPending = booking.status === 'PENDING_PAYMENT';
  const isConfirmed = booking.status === 'CONFIRMED';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-fadeIn">
      {/* Back to list */}
      <div>
        <Link
          to="/my-bookings"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại Đơn đặt của tôi</span>
        </Link>
      </div>

      {/* Main Detail Card */}
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
        data-testid="booking-detail-card"
      >
        {/* Card Header */}
        <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-lg border border-brand-200">
                {booking.bookingCode}
              </span>
              <span className="text-xs text-slate-400">
                Ngày tạo: {booking.createdAt ? new Date(booking.createdAt).toLocaleString('vi-VN') : 'N/A'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
              {booking.courtName} — {booking.facilityName}
            </h1>
            <p className="text-xs text-slate-500 flex items-center space-x-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{booking.facilityAddress}</span>
            </p>
          </div>

          <div className="flex flex-col items-start sm:items-end space-y-1">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                isConfirmed
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isPending
                  ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Trạng thái: {booking.status}
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              Thanh toán: {booking.paymentStatus}
            </span>
          </div>
        </div>

        {/* Schedule & Timing Info */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Ngày thi đấu</span>
              </span>
              <div className="text-base font-bold text-slate-900">{booking.bookingDate}</div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Khung giờ</span>
              </span>
              <div className="text-base font-bold text-slate-900">
                {booking.startTime} - {booking.endTime}
              </div>
              <span className="text-xs text-slate-500">({booking.durationMinutes} phút)</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider flex items-center space-x-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span>Tiền sân</span>
              </span>
              <div className="text-base font-black text-brand-700">
                {formatVND(booking.totalPriceVnd)}
              </div>
              <span className="text-xs text-slate-400">
                {formatVND(booking.pricePerHourVnd)}/h
              </span>
            </div>
          </div>

          {/* Payment & Transaction Info */}
          {booking.paymentOrder && (
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Receipt className="w-4 h-4 text-brand-600" />
                <span>Chi tiết thanh toán VNPay</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 pt-1">
                <div>
                  Mã tham chiếu VNPay: <strong className="text-slate-800">{booking.paymentOrder.vnpayTxnRef}</strong>
                </div>
                <div>
                  Số tiền dự kiến: <strong className="text-brand-700">{formatVND(booking.paymentOrder.expectedAmountVnd)}</strong>
                </div>
                {booking.holdExpiresAt && (
                  <div>
                    Hạn giữ chỗ: <span className="font-mono text-slate-800">{new Date(booking.holdExpiresAt).toLocaleTimeString('vi-VN')}</span>
                  </div>
                )}
                <div>
                  Trạng thái lệnh: <strong className="text-slate-800">{booking.paymentOrder.status}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Pending Actions */}
          {isPending && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-4">
              <div className="flex items-start space-x-3 text-xs text-amber-900">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm">Đơn đặt đang trong thời gian giữ chỗ 10 phút</h4>
                  <p className="text-amber-700 mt-0.5">
                    Khung giờ đang được bảo lưu. Vui lòng hoàn tất thanh toán VNPay để hệ thống xác nhận chính thức.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleContinuePayment}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md transition flex items-center space-x-1.5 disabled:opacity-50"
                  data-testid="btn-continue-vnpay"
                >
                  <span>Mở liên kết thanh toán VNPay</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleCancelBooking}
                  disabled={isProcessing}
                  className="px-4 py-2.5 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs transition flex items-center space-x-1.5 disabled:opacity-50"
                  data-testid="btn-cancel-booking"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hủy giữ chỗ</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal for payment hold continuation */}
      {showHoldModal && paymentUrl && (
        <PaymentHoldModal
          isOpen={showHoldModal}
          holdExpiresAt={booking.holdExpiresAt}
          paymentUrl={paymentUrl}
          bookingRequestId={booking.bookingRequestId}
          requestNumber={booking.bookingCode}
          totalAmountVnd={booking.totalPriceVnd}
          onCancel={handleCancelBooking}
          onExpire={() => setShowHoldModal(false)}
        />
      )}
    </div>
  );
}

export default BookingDetailPage;

