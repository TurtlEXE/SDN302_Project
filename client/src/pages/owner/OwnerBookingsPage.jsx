import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { ownerService } from '../../services/owner.service.js';

export function OwnerBookingsPage() {
  // Filters
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [courts, setCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Bookings list & pagination
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal / Action state
  const [activeModal, setActiveModal] = useState(null); // 'COMPLETE' | 'NO_SHOW' | 'CANCEL_HOLD' | null
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

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
        setCourts(courtList);
        setSelectedCourtId(''); // Reset court selection on facility change
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách sân.');
      }
    }
    loadCourts();
  }, [selectedFacilityId]);

  // 3. Load bookings
  const loadBookings = useCallback(
    async (page = 1) => {
      if (!selectedFacilityId) return;

      try {
        setLoading(true);
        setError(null);

        const params = {
          facilityId: selectedFacilityId,
          page,
          limit: 10,
        };
        if (selectedCourtId) params.courtId = selectedCourtId;
        if (selectedDate) params.date = selectedDate;
        if (selectedStatus !== 'ALL') params.status = selectedStatus;

        const res = await ownerService.listBookings(params);
        setBookings(res.data || []);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách đơn đặt sân.');
      } finally {
        setLoading(false);
      }
    },
    [selectedFacilityId, selectedCourtId, selectedDate, selectedStatus]
  );

  useEffect(() => {
    loadBookings(1);
  }, [loadBookings]);

  // Open action modal
  const openActionModal = (type, booking) => {
    setActiveModal(type);
    setSelectedBooking(booking);
    setActionNote('');
  };

  const closeActionModal = () => {
    setActiveModal(null);
    setSelectedBooking(null);
    setActionNote('');
  };

  // Submit action
  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;

    try {
      setActionSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      if (activeModal === 'COMPLETE') {
        await ownerService.completeBooking(selectedBooking.id, actionNote);
        setSuccessMsg(
          `Đã xác nhận hoàn tất phục vụ đơn ${selectedBooking.bookingCode}.`
        );
      } else if (activeModal === 'NO_SHOW') {
        await ownerService.markNoShowBooking(selectedBooking.id, actionNote);
        setSuccessMsg(
          `Đã đánh dấu khách vắng mặt cho đơn ${selectedBooking.bookingCode}.`
        );
      } else if (activeModal === 'CANCEL_HOLD') {
        // Use bookingRequestId or fallback to booking.id
        const reqId = selectedBooking.bookingRequestId || selectedBooking.id;
        await ownerService.cancelBookingRequest(reqId, actionNote);
        setSuccessMsg(
          `Đã hủy giữ chỗ thành công cho đơn ${selectedBooking.bookingCode}.`
        );
      }

      closeActionModal();
      await loadBookings(pagination.page);
    } catch (err) {
      setError(err.message || 'Thao tác không thành công.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(val || 0);
  };

  // Status badge styling
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
            Đã thanh toán (Chờ chơi)
          </span>
        );
      case 'PENDING_PAYMENT':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
            Chờ thanh toán (Giữ chỗ)
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">
            Đã hoàn tất
          </span>
        );
      case 'NO_SHOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
            Khách vắng mặt
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
            Đã hủy
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            Hết hạn giữ chỗ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quản lý đơn đặt sân & Vận hành
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Theo dõi thông tin khách hàng, kiểm tra lịch chơi và thực hiện các tác vụ hoàn tất phục vụ hoặc ghi nhận vắng mặt (OWN-07, OWN-09).
          </p>
        </div>
        <div>
          <Link
            to="/owner/schedule"
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs shadow-sm transition active:scale-95"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Xem Lịch Sân Trực Quan (Matrix Grid)</span>
          </Link>
        </div>
      </div>

      {/* Strict Policy Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Quy chuẩn tài chính 100% VNPay:</span> Toàn bộ doanh thu tiền sân được thu và xác thực 100% qua cổng VNPay. Chủ sân không được tự ý thu tiền mặt ngoài hệ thống hoặc tự ý hoàn tiền. Nếu khách hàng yêu cầu hủy đơn đã thanh toán hoặc hoàn tiền do sự cố bất khả kháng, vui lòng hướng dẫn khách hàng gửi yêu cầu tới Quản trị viên hệ thống (Tiêu chí 35, 53).
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
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
      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6 flex justify-between items-center">
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-green-500 hover:text-green-700 font-bold ml-4"
          >
            ×
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Bộ lọc tìm kiếm đơn đặt
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Facility */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Cơ sở thể thao
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
            >
              {facilities.length === 0 ? (
                <option value="">Không có cơ sở nào</option>
              ) : (
                facilities.map((fac) => (
                  <option key={fac.id || fac._id} value={fac.id || fac._id}>
                    {fac.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Court */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Sân thể thao
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
            >
              <option value="">Tất cả các sân</option>
              {courts.map((court) => (
                <option key={court.id || court._id} value={court.id || court._id}>
                  {court.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ngày đặt sân
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Trạng thái đơn
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="CONFIRMED">Đã thanh toán (Chờ chơi)</option>
              <option value="PENDING_PAYMENT">Chờ thanh toán (Giữ chỗ)</option>
              <option value="COMPLETED">Đã hoàn tất</option>
              <option value="NO_SHOW">Khách vắng mặt</option>
              <option value="CANCELLED">Đã hủy</option>
              <option value="EXPIRED">Hết hạn giữ chỗ</option>
            </select>
          </div>
        </div>

        {/* Clear filter button */}
        {(selectedCourtId || selectedDate || selectedStatus !== 'ALL') && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setSelectedCourtId('');
                setSelectedDate('');
                setSelectedStatus('ALL');
              }}
              className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-900">
            Danh sách đơn đặt ({pagination.total})
          </h2>
          <button
            onClick={() => loadBookings(pagination.page)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Làm mới
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">
            Đang tải dữ liệu đơn đặt sân...
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 border-dashed border-gray-200 text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-300 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-sm font-medium">Không tìm thấy đơn đặt sân nào</p>
            <p className="text-xs text-gray-400 mt-1">
              Thử thay đổi bộ lọc hoặc chọn ngày khác để xem kết quả.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Mã đơn</th>
                  <th className="px-4 py-3">Khách hàng</th>
                  <th className="px-4 py-3">Sân / Môn</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Giá tiền</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Tác vụ vận hành</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bookings.map((booking) => {
                  const isConfirmed = booking.status === 'CONFIRMED';
                  const isPending = booking.status === 'PENDING_PAYMENT';

                  return (
                    <tr
                      key={booking.id || booking._id}
                      className="hover:bg-gray-50 transition"
                    >
                      {/* Booking Code */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-medium text-gray-900">
                        {booking.bookingCode}
                      </td>

                      {/* Customer Contact */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {booking.contactName || '(Không có tên)'}
                        </div>
                        <div className="text-xs text-gray-500 font-mono">
                          {booking.contactPhone || '(Không có số ĐT)'}
                        </div>
                      </td>

                      {/* Court & Sport */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {booking.courtName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.sportName}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-blue-700">
                          {booking.startTime} - {booking.endTime}
                        </div>
                        <div className="text-xs text-gray-500">
                          {booking.bookingDate} ({booking.durationMinutes} phút)
                        </div>
                      </td>

                      {/* Price & Payment */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(booking.totalPriceVnd)}
                        </div>
                        <div className="text-xs">
                          {booking.paymentStatus === 'PAID' ? (
                            <span className="text-green-600 font-medium">
                              ✓ VNPay Đã thu
                            </span>
                          ) : (
                            <span className="text-amber-600 font-medium">
                              Chưa thanh toán
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {renderStatusBadge(booking.status)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                        {isConfirmed && (
                          <>
                            <button
                              onClick={() => openActionModal('COMPLETE', booking)}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white font-medium px-2.5 py-1.5 rounded transition shadow-sm"
                              title="Xác nhận hoàn tất phục vụ (sau khi hết giờ)"
                            >
                              Hoàn tất
                            </button>
                            <button
                              onClick={() => openActionModal('NO_SHOW', booking)}
                              className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium px-2.5 py-1.5 rounded transition shadow-sm"
                              title="Đánh dấu khách không đến (sau khi hết giờ)"
                            >
                              No-show
                            </button>
                          </>
                        )}

                        {isPending && (
                          <button
                            onClick={() => openActionModal('CANCEL_HOLD', booking)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white font-medium px-2.5 py-1.5 rounded transition shadow-sm"
                            title="Hủy đơn giữ chỗ và giải phóng slot ngay"
                          >
                            Hủy giữ chỗ
                          </button>
                        )}

                        {!isConfirmed && !isPending && (
                          <span className="text-xs text-gray-400 italic">
                            Không có tác vụ
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-600">
              Trang <span className="font-semibold">{pagination.page}</span> /{' '}
              <span className="font-semibold">{pagination.totalPages}</span> (Tổng{' '}
              {pagination.total} đơn)
            </span>
            <div className="space-x-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => loadBookings(pagination.page - 1)}
                className="px-3 py-1 text-xs border rounded font-medium disabled:opacity-40 hover:bg-gray-50"
              >
                Trước
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadBookings(pagination.page + 1)}
                className="px-3 py-1 text-xs border rounded font-medium disabled:opacity-40 hover:bg-gray-50"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {activeModal && selectedBooking && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {activeModal === 'COMPLETE' && 'Xác nhận hoàn tất phục vụ'}
              {activeModal === 'NO_SHOW' && 'Đánh dấu khách vắng mặt (No-show)'}
              {activeModal === 'CANCEL_HOLD' && 'Xác nhận hủy giữ chỗ'}
            </h3>

            <p className="text-xs text-gray-600 mb-4">
              Mã đơn: <span className="font-mono font-semibold">{selectedBooking.bookingCode}</span> | Khách: <span className="font-semibold">{selectedBooking.contactName}</span> ({selectedBooking.contactPhone})
            </p>

            {activeModal === 'COMPLETE' && (
              <p className="text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded">
                Lưu ý: Tác vụ hoàn tất chỉ được hệ thống chấp nhận sau khi giờ chơi kết thúc (endTime).
              </p>
            )}

            {activeModal === 'NO_SHOW' && (
              <p className="text-xs text-amber-700 mb-4 bg-amber-50 p-2 rounded">
                Cảnh báo: Đánh dấu khách vắng mặt sau giờ chơi kết thúc. Tiền sân đã thanh toán không tự động hoàn trả.
              </p>
            )}

            {activeModal === 'CANCEL_HOLD' && (
              <p className="text-xs text-red-700 mb-4 bg-red-50 p-2 rounded">
                Cảnh báo: Đơn đang ở trạng thái giữ chỗ. Khi hủy, toàn bộ khung giờ của đơn này sẽ được mở lại cho khách khác đặt ngay lập tức.
              </p>
            )}

            <form onSubmit={handleActionSubmit}>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Ghi chú / Lý do thực hiện
                </label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={
                    activeModal === 'COMPLETE'
                      ? 'Ghi chú phục vụ (không bắt buộc)...'
                      : activeModal === 'NO_SHOW'
                      ? 'Lý do vắng mặt (không bắt buộc)...'
                      : 'Lý do hủy giữ chỗ...'
                  }
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeActionModal}
                  disabled={actionSubmitting}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className={`px-4 py-2 text-sm text-white font-medium rounded transition shadow-sm ${
                    activeModal === 'COMPLETE'
                      ? 'bg-green-600 hover:bg-green-700'
                      : activeModal === 'NO_SHOW'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionSubmitting ? 'Đang xử lý...' : 'Xác nhận thực hiện'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerBookingsPage;

