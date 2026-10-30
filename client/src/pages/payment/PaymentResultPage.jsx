import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Home,
  CalendarCheck,
  Receipt,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { paymentService } from '../../services/payment.service.js';
import { bookingService } from '../../services/booking.service.js';
import { formatVND } from '../../utils/slot-helper.js';

export function PaymentResultPage() {
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [verificationResult, setVerificationResult] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  const pollTimerRef = useRef(null);

  // Authoritative server verification on mount
  useEffect(() => {
    let isMounted = true;

    async function verifyPayment() {
      try {
        setLoading(true);
        // Step 1: Call backend processVNPayReturn with raw searchParams
        const res = await paymentService.processVNPayReturn(searchParams);
        if (isMounted) {
          const data = res?.data || {};
          setVerificationResult(data);

          // If still PENDING / PROCESSING, start bounded polling
          if (data.status === 'PENDING' || data.status === 'PROCESSING') {
            startPolling(data.bookingRequestId);
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        if (isMounted) {
          const errData = err.response?.data?.data || {};
          const msg =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Không thể xác thực giao dịch từ máy chủ.';

          setVerificationResult({
            status: errData.status || 'FAILED',
            message: msg,
            bookingRequestId: errData.bookingRequestId,
          });
          setLoading(false);
        }
      }
    }

    verifyPayment();

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [searchParams]);

  // Bounded Polling logic with Visibility Change Pause (Criterion 48, Development Plan P17)
  const startPolling = (bookingRequestId) => {
    if (!bookingRequestId) {
      setLoading(false);
      return;
    }

    let attempts = 0;
    const maxAttempts = 12; // 12 * 2.5s = 30s max polling

    pollTimerRef.current = setInterval(async () => {
      // Pause polling if user switched tab
      if (document.visibilityState === 'hidden') {
        return;
      }

      attempts += 1;
      setPollCount(attempts);

      try {
        const orderRes = await paymentService.getPaymentOrderByBookingRequestId(bookingRequestId);
        const order = orderRes?.data;

        if (order?.status === 'PAID') {
          clearInterval(pollTimerRef.current);
          setVerificationResult((prev) => ({
            ...prev,
            status: 'CONFIRMED',
            amountVnd: order.amountVnd || prev?.amountVnd,
            message: 'Thanh toán đã được xác nhận thành công!',
          }));
          setLoading(false);
        } else if (order?.status === 'FAILED' || order?.status === 'EXPIRED') {
          clearInterval(pollTimerRef.current);
          setVerificationResult((prev) => ({
            ...prev,
            status: order.status,
            message: 'Giao dịch đã kết thúc hoặc hết thời hạn thanh toán.',
          }));
          setLoading(false);
        } else if (attempts >= maxAttempts) {
          // Polling timed out: switch to review state
          clearInterval(pollTimerRef.current);
          setVerificationResult((prev) => ({
            ...prev,
            status: 'REVIEW',
            message:
              'Giao dịch đang chờ xác nhận từ cổng VNPay. Vui lòng kiểm tra lại trong lịch sử đơn đặt hoặc liên hệ quản trị viên.',
          }));
          setLoading(false);
        }
      } catch (e) {
        if (attempts >= maxAttempts) {
          clearInterval(pollTimerRef.current);
          setLoading(false);
        }
      }
    }, 2500);
  };

  const status = verificationResult?.status;
  const isSuccess = status === 'CONFIRMED' || status === 'PAID';
  const isReview = status === 'REVIEW' || status === 'NEEDS_ASSISTANCE';
  const isFailed = status === 'FAILED' || status === 'EXPIRED' || (!isSuccess && !isReview && !loading);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8 animate-fadeIn">
      {/* Loading & Polling State */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto">
            <RefreshCw className="w-8 h-8 animate-spin" />
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Đang xác minh giao dịch với VNPay...
          </h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Hệ thống đang đối chiếu chữ ký số và kiểm tra trạng thái thanh toán từ máy chủ. Vui lòng không đóng trình duyệt.
          </p>
          {pollCount > 0 && (
            <span className="text-[11px] font-mono text-slate-400">
              Kiểm tra lần {pollCount}/12...
            </span>
          )}
        </div>
      ) : isSuccess ? (
        /* Confirmed / Success State */
        <div
          className="bg-white rounded-3xl border border-emerald-200 shadow-lg p-8 sm:p-10 text-center space-y-6"
          data-testid="payment-success-card"
        >
          <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 mb-2">
              Thanh toán thành công 100%
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Đặt sân thành công!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Lịch đặt sân của bạn đã được xác nhận chính thức. Email thông báo chi tiết đã được gửi đến hòm thư của bạn.
            </p>
          </div>

          {/* Transaction Metadata */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 text-xs text-left space-y-3 max-w-md mx-auto">
            {verificationResult?.bookingRequestId && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Mã yêu cầu (Request ID):</span>
                <span className="font-mono font-bold text-slate-800 truncate max-w-[200px]">
                  {verificationResult.bookingRequestId}
                </span>
              </div>
            )}
            {verificationResult?.amountVnd ? (
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Số tiền đã thanh toán:</span>
                <span className="font-bold text-brand-700 text-sm">
                  {formatVND(verificationResult.amountVnd)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Phương thức:</span>
              <span className="font-semibold text-slate-700">VNPay Gateway</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Trạng thái bảo lưu:</span>
              <span className="font-semibold text-emerald-700">Đã khóa lịch thi đấu</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/my-bookings"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition flex items-center justify-center space-x-2"
              data-testid="btn-view-my-bookings"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Xem đơn đặt của tôi</span>
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center space-x-2"
            >
              <Home className="w-4 h-4" />
              <span>Về trang chủ</span>
            </Link>
          </div>
        </div>
      ) : isReview ? (
        /* Review / Needs Assistance State */
        <div
          className="bg-white rounded-3xl border border-amber-200 shadow-lg p-8 sm:p-10 text-center space-y-6"
          data-testid="payment-review-card"
        >
          <div className="w-20 h-20 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
            <AlertTriangle className="w-10 h-10" />
          </div>

          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 mb-2">
              Đang đối soát thủ công
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Giao dịch cần hỗ trợ xác minh
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              {verificationResult?.message ||
                'Máy chủ đã ghi nhận phản hồi từ cổng VNPay và đang kiểm tra đối soát. Vui lòng giữ lại mã tham chiếu để được hỗ trợ nhanh nhất.'}
            </p>
          </div>

          {verificationResult?.bookingRequestId && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs font-mono text-amber-900 max-w-sm mx-auto">
              Mã giao dịch: <strong>{verificationResult.bookingRequestId}</strong>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/my-bookings"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition"
            >
              Kiểm tra đơn của tôi
            </Link>
            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      ) : (
        /* Failed / Expired State */
        <div
          className="bg-white rounded-3xl border border-rose-200 shadow-lg p-8 sm:p-10 text-center space-y-6"
          data-testid="payment-failed-card"
        >
          <div className="w-20 h-20 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <XCircle className="w-10 h-10" />
          </div>

          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 mb-2">
              Thanh toán không thành công
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Giao dịch chưa hoàn tất
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
              {verificationResult?.message ||
                'Giao dịch bị từ chối bởi ngân hàng, bị hủy bởi người dùng hoặc đã hết thời gian bảo lưu 10 phút.'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 max-w-md mx-auto">
            Khung giờ bạn chọn đã được hệ thống giải phóng để người khác có thể đặt. Bạn có thể quay lại và chọn khung giờ mới.
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/facilities"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-md shadow-brand-500/25 transition flex items-center justify-center space-x-2"
              data-testid="btn-rebook"
            >
              <span>Tìm & Đặt lại sân</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentResultPage;

