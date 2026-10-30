import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CreditCard,
  ShieldCheck,
  Clock,
  Calendar,
  AlertCircle,
  Building2,
  ChevronRight,
  ArrowRight,
  User,
  Phone,
  Layers,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { bookingService } from '../../services/booking.service.js';
import { formatVND } from '../../utils/slot-helper.js';
import { PaymentHoldModal } from '../../components/booking/PaymentHoldModal.jsx';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [draft, setDraft] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Active Hold Modal State
  const [holdData, setHoldData] = useState(null);

  // Stable Idempotency Key (Criterion 34)
  const idempotencyKeyRef = useRef('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('sport_booking_draft');
      if (raw) {
        const parsed = JSON.parse(raw);
        setDraft(parsed);
        if (parsed.idempotencyKey) {
          idempotencyKeyRef.current = parsed.idempotencyKey;
        }
      }
    } catch (e) {
      setDraft(null);
    }

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      try {
        const raw = sessionStorage.getItem('sport_booking_draft');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.idempotencyKey = idempotencyKeyRef.current;
          sessionStorage.setItem('sport_booking_draft', JSON.stringify(parsed));
          setDraft(parsed);
        }
      } catch (e) {}
    }
  }, []);

  // Sync user info into contact inputs
  useEffect(() => {
    if (user) {
      if (!contactName && user.fullName) setContactName(user.fullName);
      if (!contactPhone && user.phoneNumber) setContactPhone(user.phoneNumber);
    }
  }, [user]);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!draft || submitting) return;

    if (!contactName.trim()) {
      setError('Vui lòng nhập họ và tên người liên hệ.');
      return;
    }

    if (!contactPhone.trim()) {
      setError('Vui lòng nhập số điện thoại người liên hệ.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Raw step slots matching slotStepMinutes expected by backend (Issue 2)
      const selectedSlots =
        draft.selectedSlots && draft.selectedSlots.length > 0
          ? draft.selectedSlots.map((s) => ({
              startTime: s.startTime,
              endTime: s.endTime,
            }))
          : (draft.ranges || []).map((r) => ({
              startTime: r.startTime,
              endTime: r.endTime,
            }));

      const payload = {
        courtId: draft.courtId,
        bookingDate: draft.bookingDate,
        configVersion: draft.configVersion,
        selectedSlots,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      };

      const res = await bookingService.createBookingRequest(payload);
      const data = res?.data;

      if (data?.paymentOrder?.paymentUrl) {
        // Clear draft from sessionStorage once created
        sessionStorage.removeItem('sport_booking_draft');

        // Show hold modal with authoritative server countdown and redirect button
        setHoldData({
          bookingRequestId: data.bookingRequestId,
          requestNumber: data.requestNumber,
          totalAmountVnd: data.totalAmountVnd,
          holdExpiresAt: data.holdExpiresAt,
          paymentUrl: data.paymentOrder.paymentUrl,
        });

        // Automatically trigger redirect to VNPay
        window.location.href = data.paymentOrder.paymentUrl;
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Không thể tạo yêu cầu đặt sân. Vui lòng kiểm tra lại khung giờ.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelHold = async () => {
    if (!holdData?.bookingRequestId) return;
    try {
      await bookingService.cancelBookingRequest(holdData.bookingRequestId);
    } catch (err) {
      // ignore
    } finally {
      setHoldData(null);
      navigate('/facilities');
    }
  };

  if (!draft) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <Calendar className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Chưa có thông tin đặt sân</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Bạn chưa chọn khung giờ nào hoặc phiên đặt sân đã kết thúc. Vui lòng chọn sân và khung giờ mong muốn.
        </p>
        <Link
          to="/facilities"
          className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
        >
          Khám phá danh sách sân
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-1.5 text-xs text-slate-500">
        <Link to="/" className="hover:text-slate-800 transition">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link to={`/facilities/${draft.facilityId}`} className="hover:text-slate-800 transition">
          {draft.facilityName || 'Cơ sở'}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-semibold">Xác nhận đặt sân & Thanh toán</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Xác nhận Đặt sân & Thanh toán
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Kiểm tra chi tiết các khung giờ đã chọn, thông tin liên hệ và thanh toán trực tuyến qua VNPay.
        </p>
      </div>

      {/* Authentication Prompt if not logged in */}
      {!isAuthenticated && !authLoading && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-xs text-amber-900">
            <Lock className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Bạn chưa đăng nhập. Vui lòng đăng nhập để lưu trữ đơn đặt sân vào tài khoản của bạn.
            </span>
          </div>
          <Link
            to={`/login?redirect=/checkout`}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shrink-0"
          >
            Đăng nhập ngay
          </Link>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center space-x-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Info */}
        <div className="lg:col-span-7 space-y-6">
          {/* Facility & Court Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-brand-600" />
              <span>Thông tin sân thi đấu</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Cơ sở:</span>
                <span className="font-bold text-slate-800 text-sm">{draft.facilityName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Sân thi đấu:</span>
                <span className="font-bold text-slate-800 text-sm">{draft.courtName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Ngày chơi:</span>
                <span className="font-bold text-slate-800 text-sm">{draft.bookingDate}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 block mb-0.5">Đơn giá giờ:</span>
                <span className="font-bold text-brand-700 text-sm">
                  {formatVND(draft.pricePerHourVnd)}/giờ
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <User className="w-4 h-4 text-brand-600" />
              <span>Thông tin người liên hệ nhận sân</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên người đặt *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white"
                    data-testid="input-contact-name"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số điện thoại nhận tin nhắn / hỗ trợ *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="VD: 0987654321"
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white"
                    data-testid="input-contact-phone"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Terms & Policies */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-3 text-xs text-slate-600">
            <div className="flex items-center space-x-2 text-slate-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>Quy định & Cam kết đặt sân</span>
            </div>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-500">
              <li>
                <strong>Thanh toán 100%:</strong> Toàn bộ tiền sân được thu trước qua cổng VNPay để đảm bảo giữ chỗ độc quyền.
              </li>
              <li>
                <strong>Thời gian giữ chỗ 10 phút:</strong> Sau khi bấm thanh toán, hệ thống sẽ khóa lịch trong 10 phút để bạn hoàn tất giao dịch.
              </li>
              <li>
                <strong>Không giao lịch:</strong> Khung giờ đã xác nhận không thể bị người khác đặt đè nhờ cơ chế khóa đồng thời ACID.
              </li>
            </ul>

            <label className="flex items-start space-x-2 pt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span className="text-slate-700">
                Tôi đã đọc và đồng ý với các điều khoản giữ chỗ và thanh toán của SportBooking.
              </span>
            </label>
          </div>
        </div>

        {/* Right Column: Order Summary & Pay Button */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-brand-200 shadow-md p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-brand-600" />
              <span>Chi tiết đơn đặt ({draft.ranges?.length || 0} Booking)</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              {draft.ranges?.length > 1 ? 'Nhiều dải giờ' : '1 dải liền kề'}
            </span>
          </div>

          {/* List of Bookings to be created */}
          <div className="space-y-2.5">
            {(draft.ranges || []).map((range, idx) => (
              <div
                key={`${range.startTime}-${range.endTime}`}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                data-testid={`checkout-range-${idx}`}
              >
                <div>
                  <div className="font-bold text-slate-800">
                    Booking #{idx + 1}: {range.startTime} - {range.endTime}
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">
                    Thời lượng: {range.durationMinutes} phút
                  </div>
                </div>
                <div className="text-sm font-bold text-brand-700">
                  {formatVND(range.priceVnd)}
                </div>
              </div>
            ))}
          </div>

          {/* Total Sum */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Tổng thời gian chơi:</span>
              <span className="font-bold text-slate-800">{draft.totalDurationMinutes} phút</span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Phương thức thanh toán:</span>
              <span className="font-semibold text-slate-700">Cổng VNPay (ATM / QR / Visa)</span>
            </div>

            <div className="pt-2 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Tổng thanh toán:</span>
              <span className="text-2xl font-black text-brand-600" data-testid="checkout-total-price">
                {formatVND(draft.totalPriceVnd)}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmitOrder}
            disabled={submitting || !agreedTerms}
            className="w-full py-4 px-6 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-base shadow-xl shadow-brand-500/25 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            data-testid="btn-submit-booking"
          >
            {submitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang tạo đơn & Chuyển sang VNPay...</span>
              </>
            ) : (
              <>
                <span>Thanh toán VNPay ngay</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Payment Hold Modal when waiting for VNPay gateway */}
      {holdData && (
        <PaymentHoldModal
          isOpen={Boolean(holdData)}
          holdExpiresAt={holdData.holdExpiresAt}
          paymentUrl={holdData.paymentUrl}
          bookingRequestId={holdData.bookingRequestId}
          requestNumber={holdData.requestNumber}
          totalAmountVnd={holdData.totalAmountVnd}
          onCancel={handleCancelHold}
          onExpire={() => {
            setError('Yêu cầu giữ chỗ đã hết hạn 10 phút. Vui lòng chọn lại khung giờ.');
            setHoldData(null);
          }}
        />
      )}
    </div>
  );
}

export default CheckoutPage;

