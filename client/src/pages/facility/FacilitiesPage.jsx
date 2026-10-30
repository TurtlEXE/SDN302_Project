import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { facilityService } from '../../services/facility.service.js';
import { FacilityCard } from '../../components/facility/FacilityCard.jsx';
import { FacilityFilter } from '../../components/facility/FacilityFilter.jsx';

export function FacilitiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read current filters from URL
  const currentFilters = {
    keyword: searchParams.get('keyword') || '',
    province: searchParams.get('province') || '',
    sportId: searchParams.get('sportId') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sort: searchParams.get('sort') || '',
    page: parseInt(searchParams.get('page') || '1', 10),
  };

  const [facilities, setFacilities] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFacilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: currentFilters.page,
        limit: 12,
      };

      if (currentFilters.keyword) params.keyword = currentFilters.keyword;
      if (currentFilters.province) params.province = currentFilters.province;
      if (currentFilters.sportId) params.sportId = currentFilters.sportId;
      if (currentFilters.minPrice) params.minPrice = currentFilters.minPrice;
      if (currentFilters.maxPrice) params.maxPrice = currentFilters.maxPrice;
      if (currentFilters.sort) params.sort = currentFilters.sort;

      const res = await facilityService.getPublicFacilities(params);
      if (res?.data) {
        setFacilities(res.data);
      }
      if (res?.pagination) {
        setPagination(res.pagination);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể tải danh sách cơ sở.';
      setError(msg);
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [
    currentFilters.keyword,
    currentFilters.province,
    currentFilters.sportId,
    currentFilters.minPrice,
    currentFilters.maxPrice,
    currentFilters.sort,
    currentFilters.page,
  ]);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleFilterChange = (newFilters) => {
    const updated = new URLSearchParams();
    if (newFilters.keyword) updated.set('keyword', newFilters.keyword);
    if (newFilters.province) updated.set('province', newFilters.province);
    if (newFilters.sportId) updated.set('sportId', newFilters.sportId);
    if (newFilters.minPrice) updated.set('minPrice', newFilters.minPrice);
    if (newFilters.maxPrice) updated.set('maxPrice', newFilters.maxPrice);
    if (newFilters.sort) updated.set('sort', newFilters.sort);
    // Reset to page 1 on filter change
    updated.set('page', '1');
    setSearchParams(updated);
  };

  const handleResetFilters = () => {
    setSearchParams({});
  };

  const handlePageChange = (newPage) => {
    const updated = new URLSearchParams(searchParams);
    updated.set('page', String(newPage));
    setSearchParams(updated);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Khám phá Cơ sở Thể thao
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tìm kiếm sân tập yêu thích, xem trạng thái lịch thời gian thực và đặt sân trực tuyến.
        </p>
      </div>

      {/* Filter Component */}
      <FacilityFilter
        initialFilters={currentFilters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
      />

      {/* Results Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <span
          className="text-xs sm:text-sm font-semibold text-slate-700"
          data-testid="results-count"
        >
          Tìm thấy <span className="text-brand-600 font-bold">{pagination.total}</span> cơ sở phù hợp
        </span>
      </div>

      {/* Results State */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-pulse h-80"
            >
              <div className="h-44 bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="p-8 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-rose-800">Đã xảy ra sự cố</h3>
          <p className="text-xs text-rose-600 max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={fetchFacilities}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
        </div>
      ) : facilities.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy cơ sở phù hợp</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Không có sân nào khớp với các điều kiện lọc hiện tại. Vui lòng thử tìm kiếm với từ khóa hoặc tiêu chí khác.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
          >
            Xóa bộ lọc tìm kiếm
          </button>
        </div>
      ) : (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          data-testid="facilities-grid"
        >
          {facilities.map((fac) => (
            <FacilityCard key={fac.id || fac._id} facility={fac} />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-6">
          <button
            type="button"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Trang trước"
            data-testid="btn-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-medium text-slate-600 px-3">
            Trang <span className="font-bold text-slate-900">{pagination.page}</span> / {pagination.totalPages}
          </span>

          <button
            type="button"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={!pagination.hasNext}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            title="Trang tiếp"
            data-testid="btn-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export default FacilitiesPage;
