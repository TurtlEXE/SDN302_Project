import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  CalendarCheck,
  DollarSign,
  Receipt,
  Mail,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
} from 'lucide-react';
import { adminService } from '../../services/admin.service.js';
import { formatVND } from '../../utils/slot-helper.js';

export function AdminDashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const res = await adminService.getDashboard(params);
      if (res?.data) {
        setDashboardData(res.data);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Không thể tải dữ liệu thống kê quản trị hệ thống.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="space-y-8 animate-fadeIn" data-testid="admin-dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Tổng quan Vận hành Toàn hệ thống
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Báo cáo kiểm toán, đối soát thanh toán và trạng thái hoạt động trên toàn platform (ADM-06).
          </p>
        </div>
        <button
          type="button"
          onClick={fetchDashboard}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          <span>Làm mới số liệu</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-600">
          <Clock className="w-4 h-4 text-slate-400" />
          <span>Bộ lọc thời gian:</span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-500 font-medium">Từ ngày:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs text-slate-500 font-medium">Đến ngày:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleClearFilter}
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline underline-offset-2 ml-auto"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Operational Alert Banners */}
      {dashboardData && (
        <div className="space-y-3">
          {dashboardData.totalPendingRefundVnd > 0 && (
            <div
              className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm"
              data-testid="alert-pending-refunds"
            >
              <div className="flex items-center space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Hồ sơ hoàn tiền cần xử lý:</strong> Đang có{' '}
                  <span className="font-bold text-amber-700">{formatVND(dashboardData.totalPendingRefundVnd)}</span> tiền
                  hoàn đang ở trạng thái chờ đối soát thủ công.
                </span>
              </div>
              <Link
                to="/admin/refunds"
                className="inline-flex items-center space-x-1 font-bold text-amber-800 hover:text-amber-900 shrink-0"
              >
                <span>Xử lý ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {dashboardData.unresolvedExceptionTransactions > 0 && (
            <div
              className="bg-purple-50 border border-purple-200 text-purple-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm"
              data-testid="alert-exceptions"
            >
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0" />
                <span>
                  <strong>Giao dịch ngoại lệ:</strong> Phát hiện{' '}
                  <span className="font-bold text-purple-700">{dashboardData.unresolvedExceptionTransactions}</span> giao dịch
                  đến muộn hoặc sai số tiền chưa được tạo hồ sơ hoàn.
                </span>
              </div>
              <Link
                to="/admin/refunds"
                className="inline-flex items-center space-x-1 font-bold text-purple-800 hover:text-purple-900 shrink-0"
              >
                <span>Đối soát</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {dashboardData.failedEmailsCount > 0 && (
            <div
              className="bg-rose-50 border border-rose-200 text-rose-900 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-xs shadow-sm"
              data-testid="alert-failed-emails"
            >
              <div className="flex items-center space-x-2.5">
                <Mail className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Hộp thư Outbox:</strong> Có{' '}
                  <span className="font-bold text-rose-700">{dashboardData.failedEmailsCount}</span> email gửi thất bại cần
                  kiểm tra và kích hoạt gửi lại.
                </span>
              </div>
              <Link
                to="/admin/email-outbox"
                className="inline-flex items-center space-x-1 font-bold text-rose-800 hover:text-rose-900 shrink-0"
              >
                <span>Kiểm tra outbox</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Loading & Error States */}
      {loading && !dashboardData && (
        <div className="py-20 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-xs text-slate-500 font-medium">Đang tổng hợp số liệu toàn hệ thống...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Main KPI Cards Grid */}
      {dashboardData && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: User Base */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tài khoản Hệ thống</span>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">
                  {dashboardData.totalCustomers + dashboardData.totalOwners}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">tổng cộng</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Khách hàng: <strong className="text-slate-800">{dashboardData.totalCustomers}</strong></span>
                <span>Chủ sân: <strong className="text-slate-800">{dashboardData.totalOwners}</strong></span>
              </div>
            </div>

            {/* KPI 2: Facilities & Courts */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hạ tầng Cơ sở</span>
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">
                  {dashboardData.totalPublishedFacilities}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">cơ sở công khai</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Tổng sân nhận đặt: <strong className="text-slate-800">{dashboardData.totalActiveCourts}</strong></span>
              </div>
            </div>

            {/* KPI 3: Bookings Count */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tổng Đơn trong kỳ</span>
                <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
                  <CalendarCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-slate-900">
                  {dashboardData.totalBookingsMonth}
                </span>
                <span className="text-xs text-slate-400 ml-1.5 font-medium">lượt đặt</span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Hoàn tất: <strong className="text-emerald-600">{dashboardData.bookingsByStatus?.COMPLETED || 0}</strong></span>
                <span>Đã hủy: <strong className="text-rose-600">{dashboardData.bookingsByStatus?.CANCELLED || 0}</strong></span>
              </div>
            </div>

            {/* KPI 4: Net Revenue */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Thu ròng hệ thống</span>
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-xl sm:text-2xl font-black text-slate-900">
                  {formatVND(dashboardData.netCollectedVnd)}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Thu vào: <strong className="text-slate-800">{formatVND(dashboardData.totalCollectedVnd)}</strong></span>
                <span>Đã hoàn: <strong className="text-rose-600">-{formatVND(dashboardData.totalRefundedVnd)}</strong></span>
              </div>
            </div>
          </div>

          {/* Booking Status Distribution Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Phân bổ Trạng thái Đơn đặt sân</h2>
                <p className="text-xs text-slate-500 mt-0.5">Số lượng đơn theo các trạng thái vòng đời trong khoảng thời gian đã chọn</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full">
                Tổng: {dashboardData.totalBookingsMonth} đơn
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Confirmed */}
              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100">
                <div className="flex items-center space-x-1.5 text-blue-700 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Xác nhận</span>
                </div>
                <div className="mt-2 text-xl font-black text-blue-900">
                  {dashboardData.bookingsByStatus?.CONFIRMED || 0}
                </div>
                <p className="text-[10px] text-blue-600 mt-0.5">Đã thanh toán đủ</p>
              </div>

              {/* Completed */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center space-x-1.5 text-emerald-700 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Hoàn tất</span>
                </div>
                <div className="mt-2 text-xl font-black text-emerald-900">
                  {dashboardData.bookingsByStatus?.COMPLETED || 0}
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">Đã phục vụ xong</p>
              </div>

              {/* Pending Payment */}
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100">
                <div className="flex items-center space-x-1.5 text-amber-700 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Chờ trả tiền</span>
                </div>
                <div className="mt-2 text-xl font-black text-amber-900">
                  {dashboardData.bookingsByStatus?.PENDING_PAYMENT || 0}
                </div>
                <p className="text-[10px] text-amber-600 mt-0.5">Giữ chỗ 10 phút</p>
              </div>

              {/* Cancelled */}
              <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-100">
                <div className="flex items-center space-x-1.5 text-rose-700 text-xs font-bold">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Đã hủy</span>
                </div>
                <div className="mt-2 text-xl font-black text-rose-900">
                  {dashboardData.bookingsByStatus?.CANCELLED || 0}
                </div>
                <p className="text-[10px] text-rose-600 mt-0.5">Khách / Admin hủy</p>
              </div>

              {/* Expired */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center space-x-1.5 text-slate-700 text-xs font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Hết hạn</span>
                </div>
                <div className="mt-2 text-xl font-black text-slate-900">
                  {dashboardData.bookingsByStatus?.EXPIRED || 0}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Quá hạn giữ chỗ</p>
              </div>

              {/* No Show */}
              <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100">
                <div className="flex items-center space-x-1.5 text-purple-700 text-xs font-bold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Vắng mặt</span>
                </div>
                <div className="mt-2 text-xl font-black text-purple-900">
                  {dashboardData.bookingsByStatus?.NO_SHOW || 0}
                </div>
                <p className="text-[10px] text-purple-600 mt-0.5">Khách không đến</p>
              </div>
            </div>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/admin/users"
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-500 hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-brand-500 group-hover:text-white transition">
                  <Users className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Quản lý Tài khoản</h3>
              <p className="text-xs text-slate-500 mt-1">Cấp tài khoản Owner, khóa / mở khóa và kích hoạt email mời.</p>
            </Link>

            <Link
              to="/admin/sports"
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-500 hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-brand-500 group-hover:text-white transition">
                  <Layers className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Danh mục Môn Thể thao</h3>
              <p className="text-xs text-slate-500 mt-1">Quản lý môn thể thao hệ thống, chuẩn hóa tên và bật/tắt nhận sân.</p>
            </Link>

            <Link
              to="/admin/refunds"
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-500 hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-brand-500 group-hover:text-white transition">
                  <Receipt className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Hồ sơ Hoàn tiền & Ngoại lệ</h3>
              <p className="text-xs text-slate-500 mt-1">Ghi nhận hoàn tiền ngân hàng và xử lý giao dịch muộn / sai tiền.</p>
            </Link>

            <Link
              to="/admin/email-outbox"
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:border-brand-500 hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl group-hover:bg-brand-500 group-hover:text-white transition">
                  <Mail className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Hộp thư Outbox & Gửi lại</h3>
              <p className="text-xs text-slate-500 mt-1">Giám sát hàng đợi email, phát hiện email lỗi và thử lại an toàn.</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboardPage;

