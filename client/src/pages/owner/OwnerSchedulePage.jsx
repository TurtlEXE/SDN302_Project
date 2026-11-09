import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  User,
  Phone,
  Mail,
  DollarSign,
  Eye,
  CheckCircle2,
  XCircle,
  Info,
  CalendarDays,
  UserPlus,
  ShieldAlert,
  ArrowRight,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { ownerService } from '../../services/owner.service.js';
import { facilityService } from '../../services/facility.service.js';
import {
  getTodayVN,
  getMaxBookingDateVN,
  getValidDateList,
  formatVND,
  mergeContiguousSlots,
  timeToMinutes,
  minutesToTime,
} from '../../utils/slot-helper.js';
import { DatePickerModal } from '../../components/schedule/DatePickerModal.jsx';

export function OwnerSchedulePage() {
  const navigate = useNavigate();

  // 1. Facility & Date state
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const todayVN = useMemo(() => getTodayVN(), []);
  const maxDateVN = useMemo(() => getMaxBookingDateVN(todayVN, 30), [todayVN]);
  const [selectedDate, setSelectedDate] = useState(todayVN);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // 2. Schedule Data & Filter state
  const [scheduleData, setScheduleData] = useState(null);
  const [selectedSportFilter, setSelectedSportFilter] = useState('ALL');
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState(null);

  // 3. Slot Selection for On-Behalf / Quick Block
  // selectedSlots: array of { courtId, courtName, startTime, endTime, priceVnd }
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedCourt, setSelectedCourt] = useState(null);

  // 4. Modals state
  const [activeBookingDetail, setActiveBookingDetail] = useState(null);
  const [activeBlockDetail, setActiveBlockDetail] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [actionError, setActionError] = useState(null);

  // On-Behalf Modal state
  const [isOnBehalfModalOpen, setIsOnBehalfModalOpen] = useState(false);
  const [onBehalfName, setOnBehalfName] = useState('');
  const [onBehalfPhone, setOnBehalfPhone] = useState('');
  const [onBehalfNote, setOnBehalfNote] = useState('');
  const [onBehalfSubmitting, setOnBehalfSubmitting] = useState(false);

  // Quick Block Modal state
  const [isQuickBlockModalOpen, setIsQuickBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('Bảo trì định kỳ');
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  // 1. Load Owner Facilities
  useEffect(() => {
    async function loadFacilities() {
      try {
        const res = await ownerService.listFacilities();
        const facs = res?.data?.facilities || res?.data || [];
        setFacilities(facs);
        if (facs.length > 0) {
          const firstId = facs[0].id || facs[0]._id;
          setSelectedFacilityId(firstId);
        }
      } catch (err) {
        setScheduleError(err.message || 'Không thể tải danh sách cơ sở thể thao.');
      }
    }
    loadFacilities();
  }, []);

  // 2. Fetch Consolidated Schedule for selected facility & date
  const fetchSchedule = useCallback(
    async (dateToFetch) => {
      if (!selectedFacilityId) return;
      const targetDate = dateToFetch || selectedDate;
      try {
        setLoadingSchedule(true);
        setScheduleError(null);
        setSelectedSlots([]);
        setSelectedCourt(null);

        const res = await facilityService.getFacilitySchedule(selectedFacilityId, targetDate);
        if (res?.data) {
          setScheduleData(res.data);
        } else {
          setScheduleData(res);
        }
      } catch (err) {
        const msg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Không thể tải lịch sân thời gian thực.';
        setScheduleError(msg);
        setScheduleData(null);
      } finally {
        setLoadingSchedule(false);
      }
    },
    [selectedFacilityId, selectedDate]
  );

  useEffect(() => {
    if (selectedFacilityId) {
      fetchSchedule(selectedDate);
    }
  }, [selectedFacilityId, selectedDate, fetchSchedule]);

  // Current selected facility object
  const currentFacility = useMemo(() => {
    return facilities.find((f) => (f.id || f._id) === selectedFacilityId) || null;
  }, [facilities, selectedFacilityId]);

  // Date Navigation Handlers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    const newDateStr = d.toISOString().split('T')[0];
    if (newDateStr >= todayVN) {
      setSelectedDate(newDateStr);
    }
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const newDateStr = d.toISOString().split('T')[0];
    if (newDateStr <= maxDateVN) {
      setSelectedDate(newDateStr);
    }
  };

  const handleSelectToday = () => {
    setSelectedDate(todayVN);
  };

  const handleSelectTomorrow = () => {
    const d = new Date(todayVN);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Filtered sports in schedule
  const visibleSports = useMemo(() => {
    if (!scheduleData?.sports) return [];
    if (selectedSportFilter === 'ALL') return scheduleData.sports;
    return scheduleData.sports.filter(
      (s) => s.sportId === selectedSportFilter || s.facilitySportId === selectedSportFilter
    );
  }, [scheduleData, selectedSportFilter]);

  // Slot Selection Handler
  const handleSlotClick = (court, slot) => {
    if (slot.status === 'BOOKED' || slot.status === 'HOLD') {
      if (slot.booking) {
        setActiveBookingDetail({
          ...slot.booking,
          courtName: court.courtName,
          courtId: court.courtId,
          bookingDate: selectedDate,
        });
        setActionSuccess(null);
        setActionError(null);
      }
      return;
    }

    if (slot.status === 'BLOCKED') {
      if (slot.block) {
        setActiveBlockDetail({
          ...slot.block,
          courtName: court.courtName,
          courtId: court.courtId,
          bookingDate: selectedDate,
        });
      }
      return;
    }

    if (slot.status === 'PAST' || slot.status === 'NO_PRICE') {
      return;
    }

    // Available slot toggle
    if (selectedCourt && selectedCourt.courtId !== court.courtId) {
      // Switching to a different court resets previous selection
      setSelectedCourt(court);
      setSelectedSlots([
        {
          courtId: court.courtId,
          courtName: court.courtName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          priceVnd: slot.priceVnd || 0,
        },
      ]);
      return;
    }

    setSelectedCourt(court);
    setSelectedSlots((prev) => {
      const exists = prev.some((s) => s.startTime === slot.startTime);
      if (exists) {
        const next = prev.filter((s) => s.startTime !== slot.startTime);
        if (next.length === 0) setSelectedCourt(null);
        return next;
      } else {
        return [
          ...prev,
          {
            courtId: court.courtId,
            courtName: court.courtName,
            startTime: slot.startTime,
            endTime: slot.endTime,
            priceVnd: slot.priceVnd || 0,
          },
        ];
      }
    });
  };

  // Merge contiguous intervals for display
  const mergedIntervals = useMemo(() => {
    return mergeContiguousSlots(selectedSlots);
  }, [selectedSlots]);

  const totalSelectedPrice = useMemo(() => {
    return selectedSlots.reduce((sum, s) => sum + (s.priceVnd || 0), 0);
  }, [selectedSlots]);

  // Complete Booking Action
  const handleCompleteBooking = async (bookingId) => {
    try {
      setActionLoading(true);
      setActionError(null);
      await ownerService.completeBooking(bookingId);
      setActionSuccess('Đã đánh dấu hoàn tất lượt đặt sân thành công.');
      setActiveBookingDetail(null);
      await fetchSchedule(selectedDate);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Không thể hoàn tất đơn đặt.');
    } finally {
      setActionLoading(false);
    }
  };

  // No-Show Booking Action
  const handleNoShowBooking = async (bookingId) => {
    try {
      setActionLoading(true);
      setActionError(null);
      await ownerService.markNoShowBooking(bookingId);
      setActionSuccess('Đã ghi nhận khách vắng mặt (No-Show).');
      setActiveBookingDetail(null);
      await fetchSchedule(selectedDate);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Không thể đánh dấu vắng mặt.');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Quick On-Behalf Booking
  const handleCreateOnBehalf = async (e) => {
    e.preventDefault();
    if (!onBehalfName.trim() || !onBehalfPhone.trim()) {
      setActionError('Họ tên và số điện thoại khách hàng là bắt buộc.');
      return;
    }
    if (!selectedCourt || selectedSlots.length === 0) return;

    try {
      setOnBehalfSubmitting(true);
      setActionError(null);

      // Resolve versions from scheduleData
      const sportObj = scheduleData?.sports?.find((s) =>
        s.courts?.some((c) => c.courtId === selectedCourt.courtId)
      );

      const payload = {
        courtId: selectedCourt.courtId,
        bookingDate: selectedDate,
        configVersion: sportObj?.configVersion || 1,
        operatingHoursVersion: scheduleData?.operatingHoursVersion || 1,
        priceVersion: selectedCourt.priceVersion || 1,
        selectedSlots: selectedSlots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
        })),
        customerName: onBehalfName.trim(),
        customerPhone: onBehalfPhone.trim(),
        idempotencyKey: `idemp_sched_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      await ownerService.createOnBehalfBooking(payload);
      setIsOnBehalfModalOpen(false);
      setOnBehalfName('');
      setOnBehalfPhone('');
      setOnBehalfNote('');
      setSelectedSlots([]);
      setSelectedCourt(null);
      setActionSuccess('Đã tạo đơn đặt sân hộ thành công! Đơn ở trạng thái Chờ thanh toán 100% VNPay.');
      await fetchSchedule(selectedDate);
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          err.message ||
          'Không thể tạo đơn đặt sân hộ. Vui lòng kiểm tra xung đột khung giờ.'
      );
    } finally {
      setOnBehalfSubmitting(false);
    }
  };

  // Submit Quick Block for Maintenance
  const handleCreateQuickBlock = async (e) => {
    e.preventDefault();
    if (!selectedCourt || selectedSlots.length === 0) return;

    try {
      setBlockSubmitting(true);
      setActionError(null);

      const payload = {
        courtId: selectedCourt.courtId,
        bookingDate: selectedDate,
        reason: blockReason.trim() || 'Bảo trì sân',
        slots: selectedSlots.map((s) => ({
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      };

      await ownerService.createCourtBlock(payload);
      setIsQuickBlockModalOpen(false);
      setBlockReason('Bảo trì định kỳ');
      setSelectedSlots([]);
      setSelectedCourt(null);
      setActionSuccess('Đã khóa lịch sân thành công.');
      await fetchSchedule(selectedDate);
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          err.message ||
          'Không thể khóa lịch sân. Vui lòng kiểm tra khung giờ đã có khách đặt.'
      );
    } finally {
      setBlockSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-fadeIn" data-testid="owner-schedule-page">
      {/* Alert Banners */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Page Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-6 rounded-full bg-brand-600 inline-block" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Lịch Sân Trực Quan (Full-Court Matrix)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-brand-50 text-brand-700 border border-brand-200">
              Live Tracker
            </span>
          </div>
          <p className="text-xs text-slate-500 pl-5">
            Theo dõi trạng thái lịch tất cả các sân theo thời gian thực, xem thông tin khách đặt và thao tác trực tiếp trên lưới lịch.
          </p>
        </div>

        {/* Quick Route Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/owner/on-behalf"
            className="px-3.5 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Đặt sân hộ chi tiết</span>
          </Link>
          <Link
            to="/owner/court-blocks"
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Khóa lịch bảo trì</span>
          </Link>
          <Link
            to="/owner/bookings"
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Dạng danh sách</span>
          </Link>
        </div>
      </div>

      {/* Toolbar: Facility Selector + Date Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Facility Picker */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Chọn cơ sở thể thao
              </label>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="font-bold text-sm text-slate-800 bg-transparent border-none p-0 focus:ring-0 cursor-pointer"
                data-testid="select-owner-schedule-facility"
              >
                {facilities.map((f) => (
                  <option key={f.id || f._id} value={f.id || f._id}>
                    {f.name} ({f.province}) {f.status === 'DRAFT' ? '[Bản nháp]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Navigator */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={selectedDate <= todayVN}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition text-slate-600"
              title="Ngày trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Date Display Pill (Click opens DatePickerModal) */}
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 transition"
              data-testid="btn-open-owner-datepicker"
            >
              <Calendar className="w-3.5 h-3.5 text-brand-600" />
              <span>{selectedDate}</span>
              <span className="text-[10px] text-slate-400 font-normal">
                ({scheduleData?.dayType === 'WEEKEND' ? 'Cuối tuần' : 'Ngày thường'})
              </span>
            </button>

            <button
              type="button"
              onClick={handleNextDay}
              disabled={selectedDate >= maxDateVN}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition text-slate-600"
              title="Ngày tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Quick date shortcuts */}
            <div className="hidden sm:flex items-center space-x-1 pl-2 border-l border-slate-200">
              <button
                type="button"
                onClick={handleSelectToday}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedDate === todayVN
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={handleSelectTomorrow}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Ngày mai
              </button>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchSchedule(selectedDate)}
              disabled={loadingSchedule}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition ml-2"
              title="Cập nhật lại lịch thời gian thực"
            >
              <RefreshCw className={`w-4 h-4 ${loadingSchedule ? 'animate-spin text-brand-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Sport Filter Tabs */}
        {scheduleData?.sports && scheduleData.sports.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center space-x-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedSportFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedSportFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Tất cả bộ môn ({scheduleData.sports.length})
            </button>
            {scheduleData.sports.map((sp) => (
              <button
                key={sp.facilitySportId || sp.sportId}
                type="button"
                onClick={() => setSelectedSportFilter(sp.sportId || sp.facilitySportId)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center space-x-1.5 ${
                  selectedSportFilter === (sp.sportId || sp.facilitySportId)
                    ? 'bg-brand-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{sp.sportName}</span>
                <span className="text-[10px] opacity-80">({sp.courts?.length || 0} sân)</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visual Status Legend */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs select-none">
        <div className="flex flex-wrap items-center gap-4 text-slate-600">
          <div className="flex items-center space-x-1.5 font-medium">
            <span className="w-3.5 h-3.5 rounded-md bg-white border border-emerald-400 shadow-2xs inline-block" />
            <span>Trống (Có thể đặt)</span>
          </div>
          <div className="flex items-center space-x-1.5 font-bold text-brand-700">
            <span className="w-3.5 h-3.5 rounded-md bg-brand-600 border border-brand-700 shadow-2xs inline-block" />
            <span>Đang chọn</span>
          </div>
          <div className="flex items-center space-x-1.5 font-bold text-slate-900">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-900 border border-slate-950 shadow-2xs inline-block" />
            <span>Đã đặt (Click xem chi tiết)</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-amber-800">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-400 border border-amber-500 shadow-2xs inline-block" />
            <span>Giữ chỗ (Chờ thanh toán)</span>
          </div>
          <div className="flex items-center space-x-1.5 font-semibold text-rose-700">
            <span className="w-3.5 h-3.5 rounded-md bg-rose-100 border border-rose-300 shadow-2xs inline-block" />
            <span>Khóa bảo trì</span>
          </div>
          <div className="flex items-center space-x-1.5 font-medium text-slate-400">
            <span className="w-3.5 h-3.5 rounded-md bg-slate-100 border border-slate-200 inline-block" />
            <span>Đã qua</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 italic">
          * Nhấp vào ô trống để chọn slot đặt hộ hoặc khóa bảo trì
        </div>
      </div>

      {/* Main Schedule Matrix Area */}
      {loadingSchedule ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center space-y-3 shadow-sm">
          <RefreshCw className="w-8 h-8 text-brand-600 animate-spin" />
          <p className="text-sm font-bold text-slate-700">Đang tải trạng thái lịch sân trực quan...</p>
        </div>
      ) : scheduleError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-12 text-center space-y-4 shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-900">Không thể tải lịch sân</h3>
            <p className="text-xs text-rose-600 mt-1">{scheduleError}</p>
          </div>
          <button
            type="button"
            onClick={() => fetchSchedule(selectedDate)}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition"
          >
            Thử lại
          </button>
        </div>
      ) : scheduleData && scheduleData.isOpen === false ? (
        <div className="bg-white rounded-2xl border border-amber-200 p-12 text-center space-y-3 shadow-sm">
          <Clock className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Cơ sở có lịch nghỉ vào ngày này</h3>
          <p className="text-xs text-slate-500">
            {scheduleData.message || 'Cơ sở thể thao không mở cửa đón khách vào ngày đã chọn.'}
          </p>
        </div>
      ) : visibleSports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs shadow-sm">
          Không có sân nào phù hợp với bộ lọc.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleSports.map((sport) => {
            const timeSlotsHeader = sport.courts?.[0]?.slots || [];

            return (
              <div
                key={sport.facilitySportId || sport.sportId}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Sport Sub-header */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-4 rounded-full bg-brand-600 inline-block" />
                    <h2 className="text-sm font-extrabold text-slate-900">{sport.sportName}</h2>
                    <span className="text-xs text-slate-500 font-medium bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {sport.courts?.length || 0} sân con
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Bước giờ: <strong>{sport.slotStepMinutes} phút</strong> / lượt
                  </div>
                </div>

                {/* Horizontal Scrollable Table Matrix */}
                <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 max-w-full">
                  <table className="min-w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        {/* Sticky Left Corner */}
                        <th
                          scope="col"
                          className="sticky left-0 z-20 bg-slate-100 px-4 py-3 min-w-[140px] sm:min-w-[170px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]"
                        >
                          Sân thể thao
                        </th>
                        {/* Time Ruler */}
                        {timeSlotsHeader.map((slot) => (
                          <th
                            key={slot.startTime}
                            scope="col"
                            className="px-2 py-2 text-center min-w-[80px] sm:min-w-[90px] border-r border-slate-100 font-bold text-slate-700 whitespace-nowrap"
                          >
                            <span className="block text-[11px] font-mono">{slot.startTime}</span>
                            <span className="block text-[9px] font-normal text-slate-400 font-mono">
                              {slot.endTime}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sport.courts?.map((court) => {
                        return (
                          <tr key={court.courtId} className="hover:bg-slate-50/40 transition">
                            {/* Sticky Court Name */}
                            <th
                              scope="row"
                              className="sticky left-0 z-10 bg-white px-4 py-3 min-w-[140px] sm:min-w-[170px] border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] align-middle"
                            >
                              <div className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">
                                {court.courtName}
                              </div>
                              <div className="text-[10px] text-brand-700 font-medium mt-0.5">
                                Giá chuẩn: {formatVND(court.pricePerHourVnd)}/h
                              </div>
                            </th>

                            {/* Slot Cells */}
                            {court.slots?.map((slot) => {
                              const isSelected =
                                selectedCourt?.courtId === court.courtId &&
                                selectedSlots.some((s) => s.startTime === slot.startTime);

                              const isBooked = slot.status === 'BOOKED';
                              const isHold = slot.status === 'HOLD';
                              const isBlocked = slot.status === 'BLOCKED';
                              const isPast = slot.status === 'PAST';
                              const isAvailable = slot.status === 'AVAILABLE';

                              let cellBgClass = 'bg-white hover:bg-emerald-50 border-slate-100 text-slate-700 cursor-pointer';
                              if (isSelected) {
                                cellBgClass = 'bg-brand-600 text-white font-bold cursor-pointer shadow-inner';
                              } else if (isBooked) {
                                cellBgClass = 'bg-slate-900 text-white cursor-pointer hover:bg-slate-800 border-slate-800';
                              } else if (isHold) {
                                cellBgClass = 'bg-amber-400 text-amber-950 font-bold cursor-pointer hover:bg-amber-500 border-amber-500';
                              } else if (isBlocked) {
                                cellBgClass = 'bg-rose-50 text-rose-800 border-rose-200 cursor-pointer hover:bg-rose-100';
                              } else if (isPast) {
                                cellBgClass = 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-100';
                              }

                              return (
                                <td
                                  key={slot.startTime}
                                  onClick={() => handleSlotClick(court, slot)}
                                  className={`p-1.5 text-center border-r transition select-none ${cellBgClass}`}
                                  title={
                                    isBooked && slot.booking
                                      ? `Khách: ${slot.booking.customerName} (${slot.booking.customerPhone}) - Click xem chi tiết`
                                      : isBlocked && slot.block
                                      ? `Lịch khóa: ${slot.block.reason}`
                                      : isAvailable
                                      ? `Trống: ${formatVND(slot.priceVnd || 0)} - Click chọn`
                                      : ''
                                  }
                                >
                                  {isSelected ? (
                                    <div className="flex items-center justify-center space-x-1 py-1">
                                      <Check className="w-3.5 h-3.5 text-white" />
                                      <span className="text-[10px] uppercase font-bold">Chọn</span>
                                    </div>
                                  ) : isBooked ? (
                                    <div className="py-0.5 px-1 truncate text-left">
                                      <div className="text-[10px] font-bold text-white truncate leading-tight">
                                        {slot.booking?.customerName || 'Đã đặt'}
                                      </div>
                                      <div className="text-[9px] text-slate-300 font-mono truncate leading-tight">
                                        {slot.booking?.customerPhone || '••••'}
                                      </div>
                                    </div>
                                  ) : isHold ? (
                                    <div className="py-0.5 px-1 text-center truncate">
                                      <div className="text-[10px] font-bold text-amber-950 uppercase tracking-tighter">
                                        Giữ chỗ
                                      </div>
                                      <div className="text-[8px] text-amber-900 font-mono truncate">
                                        {slot.booking?.customerName || 'Chờ VNPay'}
                                      </div>
                                    </div>
                                  ) : isBlocked ? (
                                    <div className="py-1 flex items-center justify-center space-x-1 text-rose-700">
                                      <Lock className="w-3 h-3 shrink-0" />
                                      <span className="text-[9px] font-bold truncate">
                                        {slot.block?.reason || 'Khóa'}
                                      </span>
                                    </div>
                                  ) : isPast ? (
                                    <span className="text-[9px] text-slate-400">Qua</span>
                                  ) : (
                                    <div className="py-1">
                                      <span className="text-[10px] font-semibold text-emerald-700 block">
                                        {slot.priceVnd ? formatVND(slot.priceVnd) : 'Trống'}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Selection Bar */}
      {selectedSlots.length > 0 && selectedCourt && (
        <div className="fixed bottom-4 inset-x-4 md:inset-x-8 max-w-5xl mx-auto z-40 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 sm:p-5 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in slide-in-from-bottom-6">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-ping inline-block" />
              <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                Đang chọn: {selectedCourt.courtName} ({selectedSlots.length} slot)
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-300">{selectedDate}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {mergedIntervals.map((range, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-brand-200 text-xs font-mono font-bold"
                >
                  {range.startTime} – {range.endTime}
                </span>
              ))}
              <span className="text-xs text-slate-400 ml-2">
                Tổng cộng: <strong className="text-white text-sm">{formatVND(totalSelectedPrice)}</strong>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsOnBehalfModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-brand-500/20 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đặt sân hộ tại quầy</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQuickBlockModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center space-x-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>Khóa bảo trì</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedSlots([]);
                setSelectedCourt(null);
              }}
              className="p-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Bỏ chọn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Booking Detail Modal (When clicking a booked/hold slot) */}
      {activeBookingDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <CalendarDays className="w-5 h-5 text-brand-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Chi tiết đơn đặt sân</h3>
              </div>
              <button
                onClick={() => setActiveBookingDetail(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Code & Status */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Mã đơn đặt</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {activeBookingDetail.bookingCode || activeBookingDetail.id}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      activeBookingDetail.status === 'CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeBookingDetail.status === 'PENDING_PAYMENT'
                        ? 'bg-amber-100 text-amber-800'
                        : activeBookingDetail.status === 'COMPLETED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {activeBookingDetail.status === 'CONFIRMED'
                      ? 'ĐÃ XÁC NHẬN'
                      : activeBookingDetail.status === 'PENDING_PAYMENT'
                      ? 'CHỜ THANH TOÁN'
                      : activeBookingDetail.status === 'COMPLETED'
                      ? 'ĐÃ HOÀN TẤT'
                      : activeBookingDetail.status}
                  </span>
                </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Thông tin khách hàng
                </span>
                <div className="p-3.5 rounded-xl border border-slate-100 space-y-2 bg-white">
                  <div className="flex items-center space-x-2 text-slate-800">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-bold">{activeBookingDetail.customerName || 'N/A'}</span>
                  </div>
                  {activeBookingDetail.customerPhone && (
                    <div className="flex items-center space-x-2 text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <a
                        href={`tel:${activeBookingDetail.customerPhone}`}
                        className="font-mono text-brand-600 hover:underline"
                      >
                        {activeBookingDetail.customerPhone}
                      </a>
                    </div>
                  )}
                  {activeBookingDetail.customerEmail && (
                    <div className="flex items-center space-x-2 text-slate-500">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span>{activeBookingDetail.customerEmail}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Court & Time Information */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">Sân con</span>
                  <span className="font-bold text-slate-800 text-xs">
                    {activeBookingDetail.courtName}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-semibold block">Khung giờ</span>
                  <span className="font-bold font-mono text-slate-800 text-xs">
                    {activeBookingDetail.startTime} – {activeBookingDetail.endTime}
                  </span>
                </div>
              </div>

              {/* Total Price */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-brand-50/60 border border-brand-100">
                <span className="font-bold text-slate-700">Tổng tiền đơn:</span>
                <span className="font-extrabold text-sm text-brand-700">
                  {formatVND(activeBookingDetail.totalPriceVnd || 0)}
                </span>
              </div>

              {/* Actions */}
              <div className="pt-2 flex flex-col gap-2">
                {activeBookingDetail.status === 'CONFIRMED' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleCompleteBooking(activeBookingDetail.id)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center justify-center space-x-1"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Check-in / Hoàn tất</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleNoShowBooking(activeBookingDetail.id)}
                      className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center justify-center space-x-1"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Khách vắng mặt</span>
                    </button>
                  </div>
                )}

                <Link
                  to={`/owner/bookings`}
                  className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-center transition block"
                >
                  Xem trong danh sách đơn đặt
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Block Detail Modal */}
      {activeBlockDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2 text-rose-600">
                <Lock className="w-4 h-4" />
                <h3 className="font-extrabold text-slate-900 text-sm">Lịch khóa bảo trì</h3>
              </div>
              <button
                onClick={() => setActiveBlockDetail(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-900 space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-500 block">Lý do khóa:</span>
                <p className="font-semibold text-sm">{activeBlockDetail.reason || 'Bảo trì sân'}</p>
              </div>

              <div className="space-y-1 text-slate-600">
                <p>
                  Sân: <strong>{activeBlockDetail.courtName}</strong>
                </p>
                <p>
                  Ngày: <strong>{activeBlockDetail.bookingDate}</strong>
                </p>
                <p>
                  Khung giờ:{' '}
                  <strong className="font-mono">
                    {activeBlockDetail.startTime} – {activeBlockDetail.endTime}
                  </strong>
                </p>
              </div>

              <div className="pt-2">
                <Link
                  to="/owner/court-blocks"
                  className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-center transition block"
                >
                  Mở trang Quản lý khóa lịch sân
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Quick On-Behalf Booking Modal */}
      {isOnBehalfModalOpen && selectedCourt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-brand-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Đặt sân hộ cho khách vãng lai</h3>
              </div>
              <button
                onClick={() => setIsOnBehalfModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOnBehalf} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <p className="text-slate-700">
                  Sân: <strong>{selectedCourt.courtName}</strong> ({selectedDate})
                </p>
                <p className="text-slate-700 font-mono">
                  Khung giờ:{' '}
                  <strong>
                    {mergedIntervals.map((m) => `${m.startTime}–${m.endTime}`).join(', ')}
                  </strong>
                </p>
                <p className="text-brand-700 font-bold">
                  Tổng tiền dự kiến: {formatVND(totalSelectedPrice)}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Họ tên khách hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={onBehalfName}
                  onChange={(e) => setOnBehalfName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  data-testid="input-quick-onbehalf-name"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ví dụ: 0901234567"
                  value={onBehalfPhone}
                  onChange={(e) => setOnBehalfPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none font-mono"
                  data-testid="input-quick-onbehalf-phone"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 leading-relaxed">
                ⚠️ <strong>Quy định VNPay 100%:</strong> Sau khi tạo đơn đặt hộ, hệ thống sẽ giữ chỗ 15 phút và cung cấp link thanh toán VNPay gửi cho khách hoặc thu tiền trực tiếp.
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOnBehalfModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={onBehalfSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition flex items-center space-x-1.5 shadow-md shadow-brand-500/20"
                  data-testid="btn-submit-quick-onbehalf"
                >
                  {onBehalfSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang tạo đơn...</span>
                    </>
                  ) : (
                    <span>Xác nhận đặt hộ</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Quick Block Modal */}
      {isQuickBlockModalOpen && selectedCourt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2 text-rose-600">
                <Lock className="w-5 h-5" />
                <h3 className="font-extrabold text-slate-900 text-sm">Khóa lịch bảo trì khung giờ</h3>
              </div>
              <button
                onClick={() => setIsQuickBlockModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuickBlock} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <p className="text-slate-700">
                  Sân: <strong>{selectedCourt.courtName}</strong> ({selectedDate})
                </p>
                <p className="text-slate-700 font-mono">
                  Khung giờ:{' '}
                  <strong>
                    {mergedIntervals.map((m) => `${m.startTime}–${m.endTime}`).join(', ')}
                  </strong>
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Lý do tạm khóa nhận khách <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bảo dưỡng mặt sân định kỳ"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsQuickBlockModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={blockSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center space-x-1.5 shadow-md shadow-rose-600/20"
                >
                  {blockSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang khóa...</span>
                    </>
                  ) : (
                    <span>Xác nhận khóa</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DatePicker Modal */}
      <DatePickerModal
        isOpen={isDatePickerOpen}
        selectedDate={selectedDate}
        onSelectDate={(newDate) => setSelectedDate(newDate)}
        onClose={() => setIsDatePickerOpen(false)}
      />
    </div>
  );
}

export default OwnerSchedulePage;

