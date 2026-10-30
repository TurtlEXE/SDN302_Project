import React, { useEffect, useState, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Building2,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { ownerService } from '../../services/owner.service.js';
import { formatVND } from '../../utils/slot-helper.js';

export function OwnerDashboardPage() {
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load facility list for dropdown
  useEffect(() => {
    async function loadFacilities() {
      try {
        const res = await ownerService.listFacilities();
        if (res?.data) {
          setFacilities(res.data);
        }
      } catch (err) {
        // ignore
      }
    }
    loadFacilities();
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (selectedFacilityId) params.facilityId = selectedFacilityId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await ownerService.getDashboard(params);
      if (res?.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Không thể tải dữ liệu thống kê tổng quan.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedFacilityId, startDate, endDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCompleteQuick = async (bookingId) => {
    try {
      await ownerService.completeBooking(bookingId);
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể đánh dấu hoàn tất.');
    }
  };

  const handleNoShowQuick = async (bookingId) => {
    try {
      await ownerService.markNoShowBooking(bookingId);
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể đánh dấu vắng mặt.');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" data-testid="owner-dashboard-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Tổng quan Vận hành Chủ sân
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Số liệu thống kê doanh thu phân bổ từ cổng VNPay, lịch thi đấu và trạng thái phục vụ.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchDashboard}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <div className="flex items-center space-x-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <select
            value={selectedFacilityId}
            onChange={(e) => setSelectedFacilityId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:ring-2 focus:ring-brand-500"
            data-testid="select-dashboard-facility"
          >
            <option value="">Tất cả cơ sở của tôi</option>
            {facilities.map((f) => (
              <option key={f.id || f._id} value={f.id || f._id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500">Từ ngày:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700"
            data-testid="input-start-date"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500">Đến ngày:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700"
            data-testid="input-end-date"
          />
        </div>

        {(selectedFacilityId || startDate || endDate) && (
          <button
            type="button"
            onClick={() => {
              setSelectedFacilityId('');
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline ml-auto"
          >
            Đặt lại lọc
          </button>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Doanh thu VNPay</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900" data-testid="kpi-total-revenue">
            {formatVND(dashboardData?.totalRevenueVnd || 0)}
          </div>
          <div className="text-[11px] text-slate-400">
            Doanh thu thực tế đã thu 100% qua VNPay
          </div>
        </div>

        {/* Bookings Today */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Số đơn hôm nay</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900" data-testid="kpi-bookings-today">
            {dashboardData?.bookingsToday || 0}
          </div>
          <div className="text-[11px] text-slate-400">Lịch chơi trong ngày hôm nay</div>
        </div>

        {/* Completed Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Đã phục vụ</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900" data-testid="kpi-completed-bookings">
            {dashboardData?.completedBookings || 0}
          </div>
          <div className="text-[11px] text-slate-400">Đơn hoàn tất theo khoảng lọc</div>
        </div>

        {/* Cancelled Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
            <span>Đơn đã hủy</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900" data-testid="kpi-cancelled-bookings">
            {dashboardData?.cancelledBookings || 0}
          </div>
          <div className="text-[11px] text-slate-400">
            {dashboardData?.totalRefundedVnd
              ? `Đã hoàn: ${formatVND(dashboardData.totalRefundedVnd)}`
              : 'Không phát sinh hoàn'}
          </div>
        </div>
      </div>

      {/* Unprocessed Past Bookings Warning */}
      {dashboardData?.unprocessedPastBookings?.length > 0 && (
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 space-y-3">
          <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>
              Có {dashboardData.unprocessedPastBookings.length} đơn đã qua giờ chơi nhưng chưa cập nhật
            </span>
          </div>
          <p className="text-xs text-amber-800">
            Vui lòng xác nhận hoàn tất phục vụ hoặc đánh dấu khách không đến (no-show) để cập nhật dữ liệu vận hành.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {dashboardData.unprocessedPastBookings.slice(0, 4).map((b) => (
              <div
                key={b._id || b.id}
                className="bg-white p-3 rounded-xl border border-amber-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800">
                    {b.bookingCode}: {b.snapshot?.courtName}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {b.bookingDate} • {b.startTime} - {b.endTime}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleCompleteQuick(b._id || b.id)}
                    className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[11px]"
                  >
                    Hoàn tất
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNoShowQuick(b._id || b.id)}
                    className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[11px]"
                  >
                    No-show
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Bookings Today Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Lịch thi đấu hôm nay ({dashboardData?.upcomingBookings?.length || 0})</span>
          </h3>
        </div>

        {dashboardData?.upcomingBookings?.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Hôm nay chưa có lịch thi đấu sắp tới.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            {dashboardData?.upcomingBookings?.map((b) => (
              <div
                key={b._id || b.id}
                className="p-4 flex items-center justify-between gap-4 text-xs hover:bg-slate-50 transition"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                      {b.bookingCode}
                    </span>
                    <span className="font-bold text-slate-900">
                      {b.snapshot?.courtName}
                    </span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-600">{b.snapshot?.facilityName}</span>
                  </div>
                  <div className="text-slate-500">
                    Khung giờ: <strong>{b.startTime} - {b.endTime}</strong> ({b.durationMinutes} phút)
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-bold text-brand-700">{formatVND(b.totalPriceVnd)}</div>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OwnerDashboardPage;

