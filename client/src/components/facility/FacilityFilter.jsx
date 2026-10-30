import React, { useEffect, useState } from 'react';
import { Search, MapPin, Activity, DollarSign, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { sportService } from '../../services/sport.service.js';

const POPULAR_PROVINCES = [
  'Hà Nội',
  'Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bình Dương',
  'Đồng Nai',
  'Khánh Hòa',
  'Bà Rịa - Vũng Tàu',
  'Quảng Ninh',
  'Thừa Thiên Huế',
  'Lâm Đồng',
  'Bắc Ninh',
  'Nghệ An',
  'Thanh Hóa',
];

export function FacilityFilter({ initialFilters = {}, onFilterChange, onReset }) {
  const [keyword, setKeyword] = useState(initialFilters.keyword || '');
  const [province, setProvince] = useState(initialFilters.province || '');
  const [sportId, setSportId] = useState(initialFilters.sportId || '');
  const [minPrice, setMinPrice] = useState(initialFilters.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(initialFilters.maxPrice || '');
  const [sort, setSort] = useState(initialFilters.sort || '');

  const [sports, setSports] = useState([]);
  const [loadingSports, setLoadingSports] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync state if initialFilters prop changes (e.g. from browser back/forward URL change)
  useEffect(() => {
    setKeyword(initialFilters.keyword || '');
    setProvince(initialFilters.province || '');
    setSportId(initialFilters.sportId || '');
    setMinPrice(initialFilters.minPrice || '');
    setMaxPrice(initialFilters.maxPrice || '');
    setSort(initialFilters.sort || '');
  }, [
    initialFilters.keyword,
    initialFilters.province,
    initialFilters.sportId,
    initialFilters.minPrice,
    initialFilters.maxPrice,
    initialFilters.sort,
  ]);

  // Load sports list for dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadSports() {
      try {
        setLoadingSports(true);
        const res = await sportService.getPublicSports();
        if (isMounted && res?.data) {
          setSports(res.data);
        }
      } catch (err) {
        // Silently tolerate sport list load error
      } finally {
        if (isMounted) setLoadingSports(false);
      }
    }
    loadSports();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    onFilterChange?.({
      keyword: keyword.trim(),
      province,
      sportId,
      minPrice: minPrice ? Number(minPrice) : '',
      maxPrice: maxPrice ? Number(maxPrice) : '',
      sort,
    });
  };

  const handleReset = () => {
    setKeyword('');
    setProvince('');
    setSportId('');
    setMinPrice('');
    setMaxPrice('');
    setSort('');
    onReset?.();
  };

  const hasActiveFilters = Boolean(
    keyword || province || sportId || minPrice || maxPrice || sort
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Main Search Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="md:col-span-5 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo tên sân, cơ sở thể thao..."
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition"
              data-testid="input-keyword"
            />
          </div>

          {/* Province Dropdown */}
          <div className="md:col-span-3 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <MapPin className="w-4 h-4" />
            </div>
            <select
              value={province}
              onChange={(e) => {
                setProvince(e.target.value);
              }}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition appearance-none cursor-pointer"
              data-testid="select-province"
            >
              <option value="">Tất cả tỉnh / thành</option>
              {POPULAR_PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Sport Select */}
          <div className="md:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Activity className="w-4 h-4" />
            </div>
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition appearance-none cursor-pointer"
              disabled={loadingSports}
              data-testid="select-sport"
            >
              <option value="">Tất cả môn</option>
              {sports.map((s) => (
                <option key={s._id || s.id} value={s._id || s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-xl shadow-sm transition active:scale-[0.98] flex items-center justify-center space-x-1"
              data-testid="btn-search-submit"
            >
              <Search className="w-4 h-4" />
              <span>Tìm kiếm</span>
            </button>

            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2.5 rounded-xl border transition ${
                isExpanded || minPrice || maxPrice || sort
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
              title="Bộ lọc nâng cao"
              data-testid="btn-toggle-advanced"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Advanced Filters */}
        {isExpanded && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fadeIn">
            {/* Min Price */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Giá từ (VNĐ/giờ)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="VD: 50000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  data-testid="input-min-price"
                />
              </div>
            </div>

            {/* Max Price */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Đến mức giá (VNĐ/giờ)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="VD: 300000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  data-testid="input-max-price"
                />
              </div>
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Sắp xếp theo
              </label>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 focus:bg-white"
                data-testid="select-sort"
              >
                <option value="">Mặc định</option>
                <option value="minPrice:asc">Giá: Thấp đến cao</option>
                <option value="minPrice:desc">Giá: Cao đến thấp</option>
                <option value="createdAt:desc">Mới nhất</option>
              </select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2 px-3 border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium text-xs rounded-lg transition flex items-center justify-center space-x-1.5"
                  data-testid="btn-reset-filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa bộ lọc</span>
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default FacilityFilter;

