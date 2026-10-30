import React, { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Building2,
} from 'lucide-react';
import { bookingService } from '../../services/booking.service.js';
import { BookingCard } from '../../components/booking/BookingCard.jsx';

export function MyBookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const currentTab = searchParams.get('tab') || 'ALL';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentPage,
        limit: 10,
      };

      if (currentTab === 'UPCOMING') {
        params.status = 'UPCOMING';
      } else if (currentTab === 'HISTORY') {
        params.status = 'HISTORY';
      }

      const res = await bookingService.getMyBookings(params);
      if (res?.data) {
        setBookings(res.data);
      }
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        err.message ||
        'Không thể tải danh sách đơn đặt sân.';
      setError(msg);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [currentTab, currentPage]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleTabChange = (newTab) => {
    const updated = new URLSearchParams();
    if (newTab !== 'ALL') {
      updated.set('tab', newTab);
    }
    updated.set('page', '1');
    setSearchParams(updated);
  };

  const handlePageChange = (newPage) => {
    const updated = new URLSearchParams(searchParams);
    updated.set('page', String(newPage));
    setSearchParams(updated);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Đơn Đặt Sân Của Tôi
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi trạng thái đặt chỗ, lịch thi đấu sắp tới và lịch sử giao dịch thanh toán.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchBookings}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition self-start sm:self-auto disabled:opacity-50"
          title="Làm mới danh sách"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Cập nhật</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2 border-b border-slate-200 pb-px">
        {[
          { key: 'ALL', label: 'Tất cả đơn' },
          { key: 'UPCOMING', label: 'Sắp diễn ra' },
          { key: 'HISTORY', label: 'Lịch sử phục vụ' },
        ].map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              data-testid={`tab-${tab.key.toLowerCase()}`}
              className={`pb-3 px-4 text-xs font-bold transition border-b-2 select-none ${
                isActive
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-pulse space-y-4"
            >
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-5 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-800">Không thể tải danh sách đơn</h3>
          <p className="text-xs text-rose-600 max-w-sm mx-auto">{error}</p>
          <button
            type="button"
            onClick={fetchBookings}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition"
          >
            Thử lại
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Chưa có đơn đặt sân nào</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {currentTab === 'UPCOMING'
                ? 'Bạn không có lịch thi đấu nào sắp tới. Hãy tìm sân và đặt lịch ngay!'
                : 'Bạn chưa tạo đơn đặt sân nào trong hệ thống.'}
            </p>
          </div>
          <Link
            to="/facilities"
            className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
          >
            Khám phá sân thể thao
          </Link>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          data-testid="my-bookings-list"
        >
          {bookings.map((booking) => (
            <BookingCard key={booking.id || booking._id} booking={booking} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-6">
          <button
            type="button"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-medium text-slate-600 px-3">
            Trang <span className="font-bold text-slate-900">{pagination.page}</span> / {pagination.totalPages}
          </span>

          <button
            type="button"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Trang tiếp"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default MyBookingsPage;

