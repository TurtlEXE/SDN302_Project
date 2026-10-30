import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ownerService } from '../../services/owner.service.js';
import { courtService } from '../../services/court.service.js';
import {
  getTodayVN,
  getMaxBookingDateVN,
  calculateEstimatedPrice,
  mergeContiguousSlots,
  getDayType,
} from '../../utils/slot-helper.js';

export function OwnerOnBehalfPage() {
  // Facility & Court Selection
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [courts, setCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');

  // Business Date selection in Asia/Ho_Chi_Minh (Issue 4)
  const todayStr = getTodayVN();
  const maxDateStr = getMaxBookingDateVN(todayStr, 30);
  const [bookingDate, setBookingDate] = useState(todayStr);

  // Customer Contact Information
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Schedule & Slot selection
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Stable Idempotency Key for retries (Issue 4)
  const idempotencyKeyRef = useRef('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Result state (when successfully created)
  const [resultData, setResultData] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // 1. Load facilities on mount
  useEffect(() => {
    async function loadFacilities() {
      try {
        setLoading(true);
        const res = await ownerService.listFacilities();
        const facs = res.data?.facilities || res.data || [];
        setFacilities(facs);
        if (facs.length > 0) {
          setSelectedFacilityId(facs[0].id || facs[0]._id);
        }
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách cơ sở thể thao.');
      } finally {
        setLoading(false);
      }
    }
    loadFacilities();
  }, []);

  // 2. Load courts when selected facility changes
  useEffect(() => {
    async function loadCourts() {
      if (!selectedFacilityId) {
        setCourts([]);
        setSelectedCourtId('');
        return;
      }
      try {
        const res = await ownerService.listCourts(selectedFacilityId);
        const courtList = res.data?.courts || res.data || [];
        // Only active courts
        const activeCourts = courtList.filter((c) => c.isActive !== false);
        setCourts(activeCourts);
        if (activeCourts.length > 0) {
          setSelectedCourtId(activeCourts[0].id || activeCourts[0]._id);
        } else {
          setSelectedCourtId('');
        }
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách sân.');
      }
    }
    loadCourts();
  }, [selectedFacilityId]);

  // 3. Load schedule when court/date changes (with OWNER role for 0-min advance notice)
  const loadSchedule = useCallback(async () => {
    if (!selectedCourtId || !bookingDate) {
      setScheduleData(null);
      setSelectedSlots([]);
      return;
    }

    try {
      setScheduleLoading(true);
      setError(null);
      const res = await courtService.getCourtSchedule(selectedCourtId, bookingDate, 'OWNER');
      setScheduleData(res.data || res);
      setSelectedSlots([]);
      idempotencyKeyRef.current = ''; // Reset idempotency key when court or date changes
    } catch (err) {
      setError(err.message || 'Không thể tải lịch sân cho ngày đã chọn.');
      setScheduleData(null);
    } finally {
      setScheduleLoading(false);
    }
  }, [selectedCourtId, bookingDate]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Toggle slot selection
  const toggleSlotSelection = (slot) => {
    idempotencyKeyRef.current = ''; // Reset idempotency key when slot selection changes
    const isSelected = selectedSlots.some(
      (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
    );

    if (isSelected) {
      setSelectedSlots(
        selectedSlots.filter(
          (s) => !(s.startTime === slot.startTime && s.endTime === slot.endTime)
        )
      );
    } else {
      setSelectedSlots([
        ...selectedSlots,
        { startTime: slot.startTime, endTime: slot.endTime },
      ]);
    }
  };

  // Submit on-behalf booking
  const handleCreateOnBehalf = async (e) => {
    e.preventDefault();

    if (!selectedCourtId) {
      setError('Vui lòng chọn sân thể thao.');
      return;
    }
    if (!customerName.trim()) {
      setError('Vui lòng nhập họ và tên khách hàng.');
      return;
    }
    if (!customerPhone.trim()) {
      setError('Vui lòng nhập số điện thoại liên hệ của khách hàng.');
      return;
    }
    if (selectedSlots.length === 0) {
      setError('Vui lòng chọn ít nhất một khung giờ.');
      return;
    }
    if (!scheduleData?.configVersion) {
      setError('Không xác định được phiên bản cấu hình sân. Vui lòng tải lại thông tin sân.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Stable idempotencyKey: create if empty, reuse across retries (Issue 4)
      if (!idempotencyKeyRef.current) {
        idempotencyKeyRef.current = `idemp_obh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      const payload = {
        courtId: selectedCourtId,
        bookingDate,
        configVersion: scheduleData.configVersion,
        operatingHoursVersion: scheduleData.operatingHoursVersion,
        priceVersion: scheduleData.priceVersion,
        selectedSlots,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        idempotencyKey: idempotencyKeyRef.current,
      };

      const res = await ownerService.createOnBehalfBooking(payload);
      setResultData(res.data);
      // Reset form and idempotency key on success
      idempotencyKeyRef.current = '';
      setCustomerName('');
      setCustomerPhone('');
      setSelectedSlots([]);
      // Reload schedule
      await loadSchedule();
    } catch (err) {
      setError(
        err.message ||
          'Không thể tạo đơn đặt hộ. Vui lòng kiểm tra xung đột khung giờ hoặc phiên bản cấu hình.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val || 0);
  };

  // Copy guest link to clipboard
  const handleCopyGuestLink = () => {
    if (!resultData?.guestAccessLink) return;
    const fullLink = `${window.location.origin}${resultData.guestAccessLink}`;
    navigator.clipboard.writeText(fullLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const currentCourt = courts.find((c) => (c.id || c._id) === selectedCourtId);

  // Calculate estimated price
  const estimatedPrice =
    currentCourt && selectedSlots.length > 0
      ? calculateEstimatedPrice(
          mergeContiguousSlots(selectedSlots),
          {
            pricingRules: scheduleData?.pricingRules || currentCourt?.pricingRules || [],
            pricePerHourVnd: currentCourt.pricePerHourVnd || 0,
          },
          scheduleData?.dayType || (bookingDate ? getDayType(bookingDate) : 'WEEKDAY')
        ).totalPriceVnd
      : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Đặt sân hộ khách vãng lai (Tại quầy / Qua điện thoại)
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Hỗ trợ khách hàng đặt sân trực tiếp tại quầy hoặc gọi điện. Hệ thống giữ chỗ 10 phút và tạo liên kết thanh toán 100% qua VNPay (OWN-08, Tiêu chí 46, 52).
        </p>
      </div>

      {/* Strict Policy Notice */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-amber-500"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Bắt buộc thanh toán qua VNPay:</span> Hệ thống không hỗ trợ thu tiền mặt offline hoặc tự xác nhận đã thanh toán. Khi tạo đơn đặt hộ, hệ thống sinh mã QR VNPay và liên kết thanh toán có thời hạn 10 phút. Nếu khách không thanh toán trong 10 phút, khung giờ sẽ tự động giải phóng.
            </p>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Success Result Modal / Card */}
      {resultData && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6 mb-8 shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-200 text-green-900 mb-2">
                Tạo đơn đặt hộ thành công - Đang giữ chỗ 10 phút
              </span>
              <h2 className="text-xl font-bold text-gray-900">
                Đơn đặt: #{resultData.requestNumber}
              </h2>
              <p className="text-xs text-gray-600 mt-1">
                Thời hạn thanh toán: <span className="font-semibold text-red-600">{new Date(resultData.holdExpiresAt).toLocaleTimeString('vi-VN')}</span> (10 phút giữ chỗ)
              </p>
            </div>
            <button
              onClick={() => setResultData(null)}
              className="text-gray-400 hover:text-gray-600 font-bold text-lg"
            >
              ×
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Summary */}
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Thông tin thanh toán
              </h3>
              <p className="text-xs text-gray-600">
                Tổng tiền cần thanh toán: <span className="text-base font-bold text-red-600">{formatCurrency(resultData.totalAmountVnd)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Mã giao dịch VNPay: <span className="font-mono">{resultData.paymentOrder?.vnpayTxnRef}</span>
              </p>

              {/* VNPay Link Button */}
              {resultData.paymentOrder?.paymentUrl && (
                <div className="mt-3">
                  <a
                    href={resultData.paymentOrder.paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition"
                  >
                    Mở cổng thanh toán VNPay ngay (Tại quầy)
                  </a>
                </div>
              )}
            </div>

            {/* Guest Access Link */}
            <div className="bg-white p-4 rounded border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Liên kết gửi khách hàng (Tự thanh toán trên điện thoại)
              </h3>
              <p className="text-xs text-gray-600 mb-2">
                Gửi đường link bảo mật này qua Zalo / SMS để khách hàng mở và quét VNPay QR trên điện thoại:
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}${resultData.guestAccessLink}`}
                  className="w-full text-xs bg-gray-50 border border-gray-300 rounded px-2 py-1.5 font-mono text-gray-700 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyGuestLink}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded whitespace-nowrap"
                >
                  {copiedLink ? 'Đã chép!' : 'Sao chép link'}
                </button>
              </div>
              <p className="text-[11px] text-amber-600 mt-2">
                Link đi kèm mã bí mật (accessCode). Không chia sẻ công khai ra ngoài.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout: Form and Schedule Picker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form Info (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-lg shadow p-6 border border-gray-100 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              1. Thông tin đơn đặt hộ
            </h2>

            <div className="space-y-4">
              {/* Facility */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Cơ sở thể thao <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  disabled={loading}
                >
                  {facilities.map((fac) => (
                    <option key={fac.id || fac._id} value={fac.id || fac._id}>
                      {fac.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Court */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Sân thể thao <span className="text-red-500">*</span>
                </label>
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedCourtId}
                  onChange={(e) => setSelectedCourtId(e.target.value)}
                  disabled={courts.length === 0}
                >
                  {courts.length === 0 ? (
                    <option value="">(Không có sân khả dụng)</option>
                  ) : (
                    courts.map((court) => (
                      <option key={court.id || court._id} value={court.id || court._id}>
                        {court.name} - {formatCurrency(court.pricePerHourVnd)}/giờ
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ngày chơi <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={bookingDate}
                  min={todayStr}
                  max={maxDateStr}
                  onChange={(e) => setBookingDate(e.target.value)}
                />
              </div>

              {/* Customer Contact */}
              <div className="pt-2 border-t border-gray-100">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Họ và tên khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Số điện thoại khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  placeholder="VD: 0912345678"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Pricing & Submit */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4 text-sm">
              <span className="text-gray-600">Đã chọn:</span>
              <span className="font-semibold text-gray-900">
                {selectedSlots.length} khung giờ
              </span>
            </div>
            <div className="flex justify-between items-center mb-6 text-base font-bold">
              <span className="text-gray-800">Tạm tính:</span>
              <span className="text-red-600">{formatCurrency(estimatedPrice)}</span>
            </div>

            <button
              type="button"
              onClick={handleCreateOnBehalf}
              disabled={
                submitting ||
                selectedSlots.length === 0 ||
                !customerName.trim() ||
                !customerPhone.trim() ||
                !selectedCourtId
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded text-sm disabled:opacity-50 transition shadow"
            >
              {submitting
                ? 'Đang tạo đơn & giữ chỗ...'
                : 'Tạo đơn đặt hộ & Giữ chỗ 10 phút'}
            </button>
          </div>
        </div>

        {/* Right Column: Visual Slot Selection (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                2. Chọn khung giờ đặt sân
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {currentCourt?.name || 'Sân'} | Bước nhảy:{' '}
                {scheduleData?.slotStepMinutes || 60} phút | Phiên bản:{' '}
                v{scheduleData?.configVersion || 1}
              </p>
            </div>
            <button
              type="button"
              onClick={loadSchedule}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Tải lại lịch
            </button>
          </div>

          {scheduleLoading ? (
            <div className="text-center py-20 text-gray-400">
              Đang tải lịch sân...
            </div>
          ) : !scheduleData?.slots || scheduleData.slots.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded text-gray-400">
              Không có khung giờ nào cho sân và ngày này.
            </div>
          ) : (
            <div>
              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-600 mb-4 bg-gray-50 p-2.5 rounded border border-gray-100">
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-white border border-gray-300"></span>
                  <span>Trống (Khả dụng)</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-600"></span>
                  <span>Đang chọn</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-gray-200 border border-gray-300"></span>
                  <span>Đã có khách / Đang giữ</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300"></span>
                  <span>Đang khóa bảo trì</span>
                </div>
              </div>

              {/* Slot grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 max-h-96 overflow-y-auto p-2 border border-gray-200 rounded">
                {scheduleData.slots.map((slot, index) => {
                  const isSelected = selectedSlots.some(
                    (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
                  );
                  const isBooked =
                    slot.status === 'BOOKED' || slot.status === 'HOLD';
                  const isBlocked = slot.status === 'BLOCKED';

                  let btnStyle =
                    'text-xs py-2 px-2 rounded font-medium border text-center transition flex flex-col items-center justify-center ';
                  if (isSelected) {
                    btnStyle += 'bg-blue-600 text-white border-blue-600 shadow-sm';
                  } else if (isBlocked) {
                    btnStyle +=
                      'bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed';
                  } else if (isBooked) {
                    btnStyle +=
                      'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed';
                  } else {
                    btnStyle +=
                      'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600 hover:shadow-xs';
                  }

                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={isBooked || isBlocked}
                      onClick={() => toggleSlotSelection(slot)}
                      className={btnStyle}
                      title={
                        isBooked
                          ? 'Đã có khách đặt chỗ'
                          : isBlocked
                          ? 'Đang khóa bảo trì'
                          : 'Nhấp để chọn'
                      }
                    >
                      <div className="font-semibold">{slot.startTime}</div>
                      <div className="text-[10px] opacity-75">{slot.endTime}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 text-xs text-gray-500">
                Gợi ý: Chọn các khung giờ liền kề. Hệ thống sẽ tự động gộp các khoảng thời gian liên tục thành một đơn đặt (Tiêu chí 6, 26).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OwnerOnBehalfPage;

