import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Phone,
  ChevronRight,
  AlertCircle,
  Building2,
  Calendar,
  Sparkles,
  RefreshCw,
  DollarSign,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { facilityService } from '../../services/facility.service.js';
import { formatVND, getValidDateList, getDayType } from '../../utils/slot-helper.js';
import { FacilityScheduleGrid } from '../../components/schedule/FacilityScheduleGrid.jsx';
import { FacilityPricingModal } from '../../components/schedule/FacilityPricingModal.jsx';
import { FacilityDetailInfoModal } from '../../components/schedule/FacilityDetailInfoModal.jsx';
import { DatePickerModal } from '../../components/schedule/DatePickerModal.jsx';
import { SelectedRangesSummary } from '../../components/schedule/SelectedRangesSummary.jsx';

export function FacilityDetailPage() {
  const { id } = useParams();

  // Facility basic info
  const [facility, setFacility] = useState(null);
  const [loadingFacility, setLoadingFacility] = useState(true);
  const [facilityError, setFacilityError] = useState(null);

  // 30-Day date list
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDate = searchParams.get('date');
  const validDates = useMemo(() => getValidDateList(30), []);
  const initialDate = urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : (validDates[0]?.dateStr || '');

  // Current selected business date
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // Consolidated Schedule Data for the selected date
  const [scheduleData, setScheduleData] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');

  // Sport Filter: 'ALL' or sportId
  const [selectedSportFilter, setSelectedSportFilter] = useState('ALL');

  // Slot Selection state: only 1 court on 1 date
  const [selectedCourt, setSelectedCourt] = useState(null); // { courtId, courtName, facilitySportId, sportName, slotStepMinutes, configVersion, priceVersion, pricingRules }
  const [selectedSlots, setSelectedSlots] = useState([]); // [{ startTime, endTime, priceVnd }]

  // Modals state
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);

  // Confirmation Modals
  const [switchCourtModal, setSwitchCourtModal] = useState({
    isOpen: false,
    pendingCourt: null,
    pendingSlot: null,
    pendingSport: null,
  });

  const [dateChangeModal, setDateChangeModal] = useState({
    isOpen: false,
    targetDate: null,
  });

  // Track active request ID to ignore stale responses when changing dates quickly
  const activeRequestIdRef = useRef(0);

  // Load facility basic details once
  useEffect(() => {
    let isMounted = true;
    async function loadFacilityDetails() {
      try {
        setLoadingFacility(true);
        setFacilityError(null);
        const res = await facilityService.getPublicFacilityById(id);
        if (isMounted && res?.data) {
          setFacility(res.data);
        }
      } catch (err) {
        if (isMounted) {
          const msg =
            err.response?.data?.message || err.message || 'Không thể tải chi tiết cơ sở thể thao.';
          setFacilityError(msg);
        }
      } finally {
        if (isMounted) setLoadingFacility(false);
      }
    }

    loadFacilityDetails();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Load consolidated schedule whenever facility ID or selectedDate changes
  const fetchSchedule = async (dateToFetch) => {
    if (!id || !dateToFetch) return;
    const reqId = ++activeRequestIdRef.current;

    try {
      setLoadingSchedule(true);
      setScheduleError(null);
      const res = await facilityService.getFacilitySchedule(id, dateToFetch);

      // Check if this response is still for the latest request
      if (reqId === activeRequestIdRef.current && res?.data) {
        setScheduleData(res.data);
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        setLastUpdatedTime(`${hrs}:${mins}`);

        // Re-validate existing selection against newly loaded slots
        if (selectedCourt && selectedSlots.length > 0) {
          const targetSport = res.data.sports?.find(
            (s) => s.facilitySportId === selectedCourt.facilitySportId
          );
          const targetCourt = targetSport?.courts?.find(
            (c) => c.courtId === selectedCourt.courtId
          );

          if (targetCourt) {
            // Keep only slots that are still AVAILABLE
            const validSlots = selectedSlots.filter((selected) =>
              targetCourt.slots?.some(
                (s) => s.startTime === selected.startTime && s.status === 'AVAILABLE'
              )
            );
            if (validSlots.length !== selectedSlots.length) {
              setSelectedSlots(validSlots);
              if (validSlots.length === 0) {
                setSelectedCourt(null);
              }
            }
          } else {
            setSelectedCourt(null);
            setSelectedSlots([]);
          }
        }
      }
    } catch (err) {
      if (reqId === activeRequestIdRef.current) {
        const msg =
          err.response?.data?.message || err.message || 'Không thể tải lịch đặt sân.';
        setScheduleError(msg);
        setScheduleData(null);
      }
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setLoadingSchedule(false);
      }
    }
  };

  useEffect(() => {
    fetchSchedule(selectedDate);
  }, [id, selectedDate]);

  // Handle Date Selection (with confirmation if slots are currently selected)
  const handleRequestDateChange = (targetDate) => {
    if (targetDate === selectedDate) return;

    if (selectedSlots.length > 0) {
      setDateChangeModal({
        isOpen: true,
        targetDate,
      });
    } else {
      setSelectedDate(targetDate);
      setSearchParams({ date: targetDate }, { replace: true });
    }
  };

  const handleConfirmDateChange = () => {
    if (dateChangeModal.targetDate) {
      setSelectedSlots([]);
      setSelectedCourt(null);
      setSelectedDate(dateChangeModal.targetDate);
      setSearchParams({ date: dateChangeModal.targetDate }, { replace: true });
    }
    setDateChangeModal({ isOpen: false, targetDate: null });
  };

  const handleCancelDateChange = () => {
    setDateChangeModal({ isOpen: false, targetDate: null });
  };

  // Handle Slot Click (toggle on same court or confirm switch if on different court)
  const handleSlotClick = (court, slot, sport) => {
    const isSameCourt = selectedCourt && selectedCourt.courtId === court.courtId;

    if (!selectedCourt || selectedSlots.length === 0) {
      // Start selection on this court
      setSelectedCourt({
        courtId: court.courtId,
        courtName: court.courtName,
        facilitySportId: sport.facilitySportId,
        sportId: sport.sportId,
        sportName: sport.sportName,
        slotStepMinutes: sport.slotStepMinutes,
        configVersion: sport.configVersion,
        priceVersion: court.priceVersion,
        pricingRules: court.pricingRules,
        pricePerHourVnd: court.pricePerHourVnd,
      });
      setSelectedSlots([slot]);
      return;
    }

    if (isSameCourt) {
      // Toggle slot on same court
      setSelectedSlots((prev) => {
        const exists = prev.some(
          (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
        );
        if (exists) {
          const next = prev.filter(
            (s) => !(s.startTime === slot.startTime && s.endTime === slot.endTime)
          );
          if (next.length === 0) {
            setSelectedCourt(null);
          }
          return next;
        } else {
          return [...prev, slot];
        }
      });
    } else {
      // Clicked slot on a DIFFERENT court while already having selected slots
      setSwitchCourtModal({
        isOpen: true,
        pendingCourt: court,
        pendingSlot: slot,
        pendingSport: sport,
      });
    }
  };

  const handleConfirmSwitchCourt = () => {
    const { pendingCourt, pendingSlot, pendingSport } = switchCourtModal;
    if (pendingCourt && pendingSlot && pendingSport) {
      setSelectedCourt({
        courtId: pendingCourt.courtId,
        courtName: pendingCourt.courtName,
        facilitySportId: pendingSport.facilitySportId,
        sportId: pendingSport.sportId,
        sportName: pendingSport.sportName,
        slotStepMinutes: pendingSport.slotStepMinutes,
        configVersion: pendingSport.configVersion,
        priceVersion: pendingCourt.priceVersion,
        pricingRules: pendingCourt.pricingRules,
        pricePerHourVnd: pendingCourt.pricePerHourVnd,
      });
      setSelectedSlots([pendingSlot]);
    }
    setSwitchCourtModal({
      isOpen: false,
      pendingCourt: null,
      pendingSlot: null,
      pendingSport: null,
    });
  };

  const handleCancelSwitchCourt = () => {
    setSwitchCourtModal({
      isOpen: false,
      pendingCourt: null,
      pendingSlot: null,
      pendingSport: null,
    });
  };

  const handleClearSelection = () => {
    setSelectedSlots([]);
    setSelectedCourt(null);
  };

  // Filter sports based on selected filter
  const displayedSports = useMemo(() => {
    if (!scheduleData?.sports) return [];
    if (selectedSportFilter === 'ALL') return scheduleData.sports;
    return scheduleData.sports.filter(
      (s) => s.sportId === selectedSportFilter || s.facilitySportId === selectedSportFilter
    );
  }, [scheduleData, selectedSportFilter]);

  // First 7 days for the quick horizontal strip
  const quick7Days = useMemo(() => validDates.slice(0, 7), [validDates]);

  if (loadingFacility) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium text-slate-500">Đang tải thông tin cơ sở thể thao...</span>
      </div>
    );
  }

  if (facilityError || !facility) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Không tìm thấy cơ sở thể thao</h2>
        <p className="text-sm text-slate-500">{facilityError || 'Cơ sở không tồn tại hoặc đã tạm đóng.'}</p>
        <Link
          to="/facilities"
          className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
        >
          Quay lại danh sách cơ sở
        </Link>
      </div>
    );
  }

  const coverImage = facility.images?.find((img) => img.isCover)?.url || facility.images?.[0]?.url || 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6 pb-28">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-slate-800 transition">
          Trang chủ
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link to="/facilities" className="hover:text-slate-800 transition">
          Cơ sở thể thao
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-slate-800 font-semibold truncate max-w-xs">{facility.name}</span>
      </nav>

      {/* Compact Facility Header Card (Desktop & Mobile) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center space-x-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 relative group">
            <img
              src={coverImage}
              alt={facility.name}
              className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
                {facility.province}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500 font-medium">
                {facility.courts?.length || 0} sân con
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              {facility.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span className="truncate max-w-xs sm:max-w-sm">{facility.address}</span>
              </span>

              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span>
                  {scheduleData?.isOpen === false ? (
                    <strong className="text-rose-600 font-semibold">Nghỉ hôm nay</strong>
                  ) : (
                    <span>
                      Giờ mở cửa:{' '}
                      <strong className="text-slate-800 font-semibold">
                        {scheduleData?.openTime || facility.openTime} - {scheduleData?.closeTime || facility.closeTime}
                      </strong>
                    </span>
                  )}
                </span>
              </span>

              {facility.phoneNumber && (
                <span className="flex items-center space-x-1">
                  <Phone className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span>{facility.phoneNumber}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons & Price Badge */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 gap-2 shrink-0">
          <div className="text-left sm:text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Giá dịch vụ từ
            </span>
            <div className="text-lg font-black text-brand-700">
              {formatVND(facility.minPricePerHour || facility.minPrice || 100000)}
              <span className="text-xs font-normal text-slate-500"> /giờ</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsInfoModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center space-x-1.5"
            aria-label="Xem ảnh và thông tin chi tiết cơ sở"
          >
            <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
            <span>Xem ảnh & chi tiết</span>
          </button>
        </div>
      </div>

      {/* Single Consolidated Date Picker & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        {/* Date Picker Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-brand-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Chọn ngày đặt sân
            </h2>
            <span className="text-xs text-slate-400">
              ({scheduleData?.dayType === 'WEEKEND' ? 'Cuối tuần' : 'Ngày thường'})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {lastUpdatedTime && (
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Cập nhật lúc {lastUpdatedTime}
              </span>
            )}
            <button
              type="button"
              onClick={() => fetchSchedule(selectedDate)}
              disabled={loadingSchedule}
              className="text-xs text-slate-500 hover:text-brand-600 flex items-center space-x-1 p-1.5 rounded-lg border border-slate-200 hover:border-brand-300 transition disabled:opacity-50"
              title="Tải lại lịch sân"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSchedule ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>
        </div>

        {/* 7-Day Quick Strip & Date Picker Modal Button */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
          {quick7Days.map((item) => {
            const isSelected = item.dateStr === selectedDate;
            return (
              <button
                key={item.dateStr}
                type="button"
                onClick={() => handleRequestDateChange(item.dateStr)}
                data-testid={`quick-date-${item.dateStr}`}
                className={`flex-shrink-0 flex flex-col items-center justify-center py-2 px-3.5 rounded-xl border text-xs min-w-[76px] transition select-none ${
                  isSelected
                    ? 'bg-brand-600 border-brand-600 text-white font-bold shadow-md shadow-brand-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider ${
                    isSelected ? 'text-brand-100' : item.isWeekend ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {item.dayName}
                </span>
                <span className="text-xs font-extrabold mt-0.5">{item.displayDate}</span>
                {item.isToday && (
                  <span
                    className={`text-[9px] mt-0.5 px-1 rounded ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-brand-50 text-brand-700 font-semibold'
                    }`}
                  >
                    Hôm nay
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setIsDatePickerModalOpen(true)}
            className="flex-shrink-0 py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50/50 text-slate-600 hover:text-brand-700 text-xs font-semibold flex items-center space-x-1.5 transition shrink-0"
          >
            <Calendar className="w-4 h-4 text-brand-600" />
            <span>Chọn ngày khác...</span>
          </button>
        </div>

        {/* Optional Sport Filter Pills */}
        {scheduleData?.sports && scheduleData.sports.length > 1 && (
          <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-thin">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Lọc môn:
            </span>
            <button
              type="button"
              onClick={() => setSelectedSportFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${
                selectedSportFilter === 'ALL'
                  ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Tất cả bộ môn ({scheduleData.sports.length})
            </button>
            {scheduleData.sports.map((sport) => {
              const isSelected =
                selectedSportFilter === sport.sportId ||
                selectedSportFilter === sport.facilitySportId;
              return (
                <button
                  key={sport.facilitySportId}
                  type="button"
                  onClick={() => setSelectedSportFilter(sport.sportId || sport.facilitySportId)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {sport.sportName} ({sport.courts?.length || 0})
                </button>
              );
            })}
          </div>
        )}

        {/* Shared Status Legend Once for All Courts */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-white border border-slate-300 inline-block shadow-sm" />
              <span>Còn trống</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-brand-600 border border-brand-600 inline-block text-white flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </span>
              <span className="font-bold text-brand-700">Đang chọn</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-200 inline-block" />
              <span className="text-amber-800">Đang giữ chỗ</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 inline-block line-through text-slate-400" />
              <span className="text-slate-400">Đã đặt</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-rose-50 border border-rose-200 inline-block" />
              <span className="text-rose-700">Khóa bảo trì</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100/70 border border-slate-200 inline-block" />
              <span className="text-slate-400">Đã qua giờ</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-dashed border-slate-300 inline-block" />
              <span className="text-slate-400">Chưa có giá</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPricingModalOpen(true)}
            className="text-xs font-bold text-brand-700 hover:text-brand-800 hover:underline flex items-center space-x-1"
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Xem bảng giá chi tiết</span>
          </button>
        </div>
      </div>

      {/* Main Schedule Display Area */}
      <main className="space-y-6">
        {loadingSchedule ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
            <span className="text-xs font-medium">Đang tải toàn bộ lịch sân theo ngày...</span>
          </div>
        ) : scheduleError ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{scheduleError}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchSchedule(selectedDate)}
              className="px-3 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 font-bold hover:bg-rose-100 transition"
            >
              Thử lại
            </button>
          </div>
        ) : scheduleData && scheduleData.isOpen === false ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
            <h3 className="text-sm font-bold text-amber-900">Cơ sở không mở cửa vào ngày này</h3>
            <p className="text-xs text-amber-800 max-w-md mx-auto">
              Cơ sở thể thao có lịch nghỉ vào ngày {selectedDate} ({scheduleData.dayOfWeek === 'sunday' ? 'Chủ nhật' : `Thứ ${scheduleData.dayOfWeek}`}). 
              Vui lòng chọn ngày khác ở thanh chọn ngày phía trên.
            </p>
          </div>
        ) : displayedSports.length > 0 ? (
          <div className="space-y-6">
            {displayedSports.map((sport) => (
              <FacilityScheduleGrid
                key={sport.facilitySportId || sport.sportId}
                sport={sport}
                selectedCourtId={selectedCourt?.courtId}
                selectedSlots={selectedSlots}
                onSlotClick={handleSlotClick}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
            Chưa có môn thể thao hoặc sân con nào phù hợp với bộ lọc.
          </div>
        )}

        {/* Selected Ranges Summary (Desktop & Mobile) */}
        {selectedCourt && selectedSlots.length > 0 && (
          <div className="pt-4">
            <SelectedRangesSummary
              selectedSlots={selectedSlots}
              court={selectedCourt}
              facility={facility}
              bookingDate={selectedDate}
              configVersion={selectedCourt.configVersion}
              operatingHoursVersion={scheduleData?.operatingHoursVersion || facility.operatingHoursVersion}
              priceVersion={selectedCourt.priceVersion}
              pricingRules={selectedCourt.pricingRules}
              dayType={scheduleData?.dayType}
              slotStepMinutes={selectedCourt.slotStepMinutes}
              sportName={selectedCourt.sportName}
              onClearSelection={handleClearSelection}
            />
          </div>
        )}
      </main>

      {/* Confirmation Dialog: Switch Court */}
      {switchCourtModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Xác nhận chuyển sân</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Chuyển sang <strong>{switchCourtModal.pendingCourt?.courtName}</strong> sẽ bỏ các khung giờ bạn đã chọn ở{' '}
                  <strong>{selectedCourt?.courtName}</strong>. Bạn có muốn tiếp tục không?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelSwitchCourt}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchCourt}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm"
              >
                Xác nhận đổi sân
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Change Date with Active Selection */}
      {dateChangeModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Thay đổi ngày đặt sân</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Đổi sang ngày <strong>{dateChangeModal.targetDate}</strong> sẽ làm mới các ô giờ bạn đã chọn ở ngày hiện tại. 
                  Bạn có muốn tiếp tục?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleCancelDateChange}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDateChange}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition shadow-sm"
              >
                Đổi ngày
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Facility Pricing Modal */}
      <FacilityPricingModal
        facility={facility}
        sports={scheduleData?.sports || []}
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />

      {/* Facility Info & Gallery Modal */}
      <FacilityDetailInfoModal
        facility={facility}
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />

      {/* 30-Day Datepicker Modal */}
      <DatePickerModal
        isOpen={isDatePickerModalOpen}
        selectedDate={selectedDate}
        onSelectDate={handleRequestDateChange}
        onClose={() => setIsDatePickerModalOpen(false)}
      />
    </div>
  );
}

export default FacilityDetailPage;
