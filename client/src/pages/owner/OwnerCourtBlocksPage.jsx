import React, { useState, useEffect, useCallback } from 'react';
import { ownerService } from '../../services/owner.service.js';
import { courtService } from '../../services/court.service.js';

export function OwnerCourtBlocksPage() {
  // Facility & Court selection
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [courts, setCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState('');

  // Date selection (default today)
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Status filter for list
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE

  // Court schedule & slot selection for locking
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [reason, setReason] = useState('');

  // Blocks list
  const [blocks, setBlocks] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // 1. Load facilities on mount
  useEffect(() => {
    async function loadFacilities() {
      try {
        setLoading(true);
        const res = await ownerService.listFacilities();
        const facs = res.data?.facilities || res.data || [];
        setFacilities(facs);
        if (facs.length > 0) {
          setSelectedFacilityId(facs[0]._id);
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
        if (courtList.length > 0) {
          setSelectedCourtId(courtList[0]._id);
        } else {
          setSelectedCourtId('');
        }
      } catch (err) {
        setError(err.message || 'Không thể tải danh sách sân.');
      }
    }
    loadCourts();
  }, [selectedFacilityId]);

  // 3. Load court schedule and blocks when court/date changes
  const loadScheduleAndBlocks = useCallback(async () => {
    if (!selectedCourtId || !selectedDate) {
      setScheduleData(null);
      setBlocks([]);
      return;
    }

    try {
      setError(null);
      // Fetch schedule for visual slot picker
      try {
        const schedRes = await courtService.getCourtSchedule(selectedCourtId, selectedDate);
        setScheduleData(schedRes.data || schedRes);
      } catch {
        setScheduleData(null);
      }

      // Fetch blocks
      const params = { courtId: selectedCourtId };
      if (statusFilter === 'ACTIVE') params.isActive = true;
      if (statusFilter === 'INACTIVE') params.isActive = false;

      const blocksRes = await ownerService.listCourtBlocks(params);
      const items = blocksRes.data || [];
      setBlocks(items);
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin lịch khóa sân.');
    }
  }, [selectedCourtId, selectedDate, statusFilter]);

  useEffect(() => {
    loadScheduleAndBlocks();
    setSelectedSlots([]);
  }, [loadScheduleAndBlocks]);

  // Handle slot toggle for locking
  const toggleSlotSelection = (slot) => {
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

  // Select all available slots
  const selectAllAvailableSlots = () => {
    if (!scheduleData?.slots) return;
    const avail = scheduleData.slots.filter((s) => s.status === 'AVAILABLE');
    setSelectedSlots(
      avail.map((s) => ({ startTime: s.startTime, endTime: s.endTime }))
    );
  };

  const clearSlotSelection = () => {
    setSelectedSlots([]);
  };

  // Submit create court block
  const handleCreateCourtBlock = async (e) => {
    e.preventDefault();
    if (selectedSlots.length === 0) {
      setError('Vui lòng chọn ít nhất một khung giờ để khóa.');
      return;
    }
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do khóa sân (bảo trì, sự cố đột xuất,...).');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      await ownerService.createCourtBlock({
        courtId: selectedCourtId,
        bookingDate: selectedDate,
        selectedSlots,
        reason: reason.trim(),
      });

      setSuccessMsg('Đã tạo lịch khóa sân thành công.');
      setReason('');
      setSelectedSlots([]);
      await loadScheduleAndBlocks();
    } catch (err) {
      setError(
        err.message ||
          'Không thể khóa sân. Lưu ý: Không thể khóa nếu đã có đơn đặt sân đang hoạt động.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Delete / Reopen court block
  const handleDeleteCourtBlock = async (blockId) => {
    if (!window.confirm('Bạn có chắc chắn muốn mở lại khung giờ sân này?')) {
      return;
    }

    try {
      setError(null);
      setSuccessMsg(null);
      await ownerService.deleteCourtBlock(blockId);
      setSuccessMsg('Đã mở lại sân thành công.');
      await loadScheduleAndBlocks();
    } catch (err) {
      setError(err.message || 'Không thể mở lại sân.');
    }
  };

  const currentCourt = courts.find((c) => c._id === selectedCourtId);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Title & Breadcrumb */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Quản lý khóa lịch sân (Bảo trì & Sự cố)
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Khóa các khung giờ bảo trì hoặc khắc phục sự cố đột xuất để tạm dừng nhận đặt sân mới (OWN-06, Tiêu chí 9, 31).
        </p>
      </div>

      {/* Policy Notice */}
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
              <span className="font-semibold">Quy tắc bảo vệ lịch:</span> Hệ thống sẽ tự động chặn và báo lỗi nếu khung giờ dự kiến khóa đã có khách hàng đặt chỗ đang hoạt động (CONFIRMED / PENDING_PAYMENT). Vui lòng kiểm tra kỹ trước khi khóa.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
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

      {/* Filter and Selection Controls */}
      <div className="bg-white rounded-lg shadow p-6 mb-8 border border-gray-100">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Bộ lọc & Chọn sân cần thao tác
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Facility */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Cơ sở thể thao
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
              disabled={loading}
            >
              {facilities.length === 0 ? (
                <option value="">Không có cơ sở nào</option>
              ) : (
                facilities.map((fac) => (
                  <option key={fac._id} value={fac._id}>
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
              disabled={courts.length === 0}
            >
              {courts.length === 0 ? (
                <option value="">(Cơ sở chưa có sân)</option>
              ) : (
                courts.map((court) => (
                  <option key={court._id} value={court._id}>
                    {court.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Ngày khóa sân
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedDate}
              min={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          {/* Status Filter for Table */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Trạng thái lịch khóa
            </label>
            <select
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Tất cả lịch khóa</option>
              <option value="ACTIVE">Đang khóa (Hiệu lực)</option>
              <option value="INACTIVE">Đã mở lại (Hết hiệu lực)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Form to create court block (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-lg shadow p-6 border border-gray-100 flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            Tạo lịch khóa mới
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Chọn sân, ngày và các khung giờ bạn muốn tạm dừng nhận khách để thực hiện bảo dưỡng hoặc sửa chữa.
          </p>

          {!selectedCourtId ? (
            <div className="text-center py-12 text-gray-400">
              Vui lòng chọn cơ sở và sân thể thao để tiếp tục.
            </div>
          ) : (
            <form onSubmit={handleCreateCourtBlock} className="space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-gray-700">
                    Chọn khung giờ cần khóa ({currentCourt?.name || 'Sân'})
                  </span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={selectAllAvailableSlots}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      Chọn tất cả slot trống
                    </button>
                    {selectedSlots.length > 0 && (
                      <button
                        type="button"
                        onClick={clearSlotSelection}
                        className="text-xs text-gray-500 hover:text-gray-700 underline"
                      >
                        Bỏ chọn
                      </button>
                    )}
                  </div>
                </div>

                {/* Slots Grid */}
                {scheduleData?.slots && scheduleData.slots.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded bg-gray-50">
                    {scheduleData.slots.map((slot, index) => {
                      const isSelected = selectedSlots.some(
                        (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
                      );
                      const isBooked = slot.status === 'BOOKED' || slot.status === 'HOLD';
                      const isBlocked = slot.status === 'BLOCKED';

                      let btnClass = 'text-xs py-1.5 px-2 rounded font-medium border text-center transition ';
                      if (isSelected) {
                        btnClass += 'bg-red-600 text-white border-red-600 shadow-sm';
                      } else if (isBlocked) {
                        btnClass += 'bg-amber-100 text-amber-800 border-amber-300 cursor-not-allowed';
                      } else if (isBooked) {
                        btnClass += 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed';
                      } else {
                        btnClass += 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:text-blue-600';
                      }

                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={isBooked || isBlocked}
                          onClick={() => toggleSlotSelection(slot)}
                          className={btnClass}
                          title={
                            isBooked
                              ? 'Đã có khách đặt chỗ'
                              : isBlocked
                              ? 'Đã bị khóa lịch trước đó'
                              : 'Nhấp để chọn khóa'
                          }
                        >
                          <div>{slot.startTime}</div>
                          <div className="text-[10px] opacity-75">{slot.endTime}</div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 border border-dashed rounded bg-gray-50 text-xs text-gray-500">
                    {scheduleData === null
                      ? 'Đang tải thông tin khung giờ...'
                      : 'Không có khung giờ nào khả dụng cho ngày này.'}
                  </div>
                )}

                {/* Selection summary */}
                <div className="mt-2 text-xs text-gray-600">
                  Đã chọn: <span className="font-semibold text-red-600">{selectedSlots.length}</span> khung giờ
                </div>

                {/* Reason input */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Lý do khóa sân <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Bảo trì cỏ nhân tạo định kỳ, sửa trụ đèn số 2,..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={submitting || selectedSlots.length === 0 || !reason.trim()}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-4 rounded text-sm disabled:opacity-50 transition shadow"
                >
                  {submitting ? 'Đang thực hiện...' : 'Xác nhận khóa lịch sân'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Right Column: Court Blocks List (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-lg shadow p-6 border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-900">
              Danh sách lịch khóa ({blocks.length})
            </h2>
            <button
              onClick={loadScheduleAndBlocks}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Tải lại
            </button>
          </div>

          {blocks.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg text-gray-500">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <p className="text-sm font-medium">Chưa có lịch khóa nào cho sân này</p>
              <p className="text-xs text-gray-400 mt-1">
                Các khung giờ bảo trì hoặc sự cố sẽ được hiển thị tại đây khi bạn tạo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 text-gray-700 text-xs uppercase font-semibold border-b">
                  <tr>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Khung giờ</th>
                    <th className="px-4 py-3">Lý do</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {blocks.map((block) => (
                    <tr key={block._id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {block.bookingDate}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-blue-700">
                        {block.startTime} - {block.endTime}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={block.reason}>
                        {block.reason}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {block.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                            Đang khóa
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                            Đã mở lại
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {block.isActive ? (
                          <button
                            onClick={() => handleDeleteCourtBlock(block._id)}
                            className="text-xs text-blue-600 hover:text-blue-900 font-medium px-2 py-1 rounded border border-blue-200 hover:bg-blue-50 transition"
                          >
                            Mở lại sân
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Không khả dụng</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OwnerCourtBlocksPage;

