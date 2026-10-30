import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Phone,
  ChevronRight,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { facilityService } from '../../services/facility.service.js';
import { formatVND } from '../../utils/slot-helper.js';
import { CourtSchedule } from '../../components/schedule/CourtSchedule.jsx';

export function FacilityDetailPage() {
  const { id } = useParams();

  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedSportId, setSelectedSportId] = useState(null);
  const [selectedCourtId, setSelectedCourtId] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function loadFacility() {
      try {
        setLoading(true);
        setError(null);
        const res = await facilityService.getPublicFacilityById(id);
        if (isMounted && res?.data) {
          const fac = res.data;
          setFacility(fac);

          // Select first sport by default if available
          if (fac.facilitySports && fac.facilitySports.length > 0) {
            const firstSport = fac.facilitySports[0];
            setSelectedSportId(firstSport.sportId || firstSport.id);

            // Find courts for this sport
            const firstCourts = (fac.courts || []).filter(
              (c) =>
                c.facilitySportId === firstSport.id ||
                c.sportId === (firstSport.sportId || firstSport.id)
            );
            if (firstCourts.length > 0) {
              setSelectedCourtId(firstCourts[0].id || firstCourts[0]._id);
            }
          } else if (fac.courts && fac.courts.length > 0) {
            setSelectedCourtId(fac.courts[0].id || fac.courts[0]._id);
          }
        }
      } catch (err) {
        if (isMounted) {
          const msg =
            err.response?.data?.message || err.message || 'Không thể tải chi tiết cơ sở.';
          setError(msg);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFacility();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // When selected sport changes, update selected court to first court of that sport
  const handleSelectSport = (sportId) => {
    setSelectedSportId(sportId);
    if (!facility?.courts) return;

    const matchedCourts = facility.courts.filter(
      (c) =>
        c.sportId === sportId ||
        (facility.facilitySports || []).some(
          (fs) => (fs.sportId === sportId || fs.id === sportId) && c.facilitySportId === fs.id
        )
    );

    if (matchedCourts.length > 0) {
      setSelectedCourtId(matchedCourts[0].id || matchedCourts[0]._id);
    } else {
      setSelectedCourtId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Đang tải thông tin cơ sở thể thao...</span>
      </div>
    );
  }

  if (error || !facility) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Không tìm thấy cơ sở thể thao</h2>
        <p className="text-sm text-slate-500">{error || 'Cơ sở không tồn tại hoặc đã tạm đóng.'}</p>
        <Link
          to="/facilities"
          className="inline-flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-semibold hover:bg-brand-700 transition"
        >
          Quay lại danh sách cơ sở
        </Link>
      </div>
    );
  }

  // Filter available courts for the selected sport
  const currentSport = (facility.facilitySports || []).find(
    (fs) => fs.sportId === selectedSportId || fs.id === selectedSportId
  );

  const availableCourts = (facility.courts || []).filter((c) => {
    if (!selectedSportId) return true;
    return (
      c.sportId === selectedSportId ||
      (currentSport && c.facilitySportId === currentSport.id)
    );
  });

  const activeCourt = availableCourts.find(
    (c) => (c.id || c._id) === selectedCourtId
  ) || availableCourts[0];

  const images = facility.images?.length
    ? facility.images
    : [
        {
          url:
            'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
        },
      ];

  const activeImage = images[activeImageIndex] || images[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-1.5 text-xs text-slate-500">
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

      {/* Hero: Facility Presentation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Gallery */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative aspect-[16/10] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            <img
              src={activeImage.url}
              alt={facility.name}
              className="w-full h-full object-cover transition duration-300"
            />
          </div>

          {images.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-1">
              {images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                    activeImageIndex === idx
                      ? 'border-brand-600 ring-2 ring-brand-300'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 mb-2">
                {facility.province}
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">
                {facility.name}
              </h1>
            </div>

            <div className="space-y-2 text-xs sm:text-sm text-slate-600">
              <div className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                <span>{facility.address}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-brand-600 shrink-0" />
                <span>
                  Giờ mở cửa: <strong className="text-slate-800">{facility.openTime} - {facility.closeTime}</strong>
                </span>
              </div>
              {facility.phoneNumber && (
                <div className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-brand-600 shrink-0" />
                  <span>
                    Điện thoại liên hệ: <strong className="text-slate-800">{facility.phoneNumber}</strong>
                  </span>
                </div>
              )}
            </div>

            {facility.description && (
              <div className="pt-3 border-t border-slate-100 text-xs sm:text-sm text-slate-600 leading-relaxed">
                {facility.description}
              </div>
            )}
          </div>

          {/* Pricing Highlight */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Mức giá chỉ từ
              </span>
              <div className="text-xl font-black text-brand-700">
                {formatVND(facility.minPrice || activeCourt?.pricePerHourVnd || 0)}
                <span className="text-xs font-normal text-slate-500"> /giờ</span>
              </div>
            </div>

            <div className="flex items-center space-x-1 text-xs text-brand-700 font-semibold bg-white px-3 py-1.5 rounded-xl border border-brand-200">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>Lịch thời gian thực</span>
            </div>
          </div>
        </div>
      </div>

      {/* Court Schedule Selection Section */}
      <section className="pt-6 border-t border-slate-200 space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-brand-600" />
            <span>Lịch sân & Đặt chỗ</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chọn môn thể thao, sân thi đấu và bấm chọn các ô giờ trống để đặt lịch.
          </p>
        </div>

        {/* Sport Selection Tabs */}
        {facility.facilitySports && facility.facilitySports.length > 0 && (
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              1. Chọn bộ môn thể thao
            </label>
            <div className="flex flex-wrap gap-2">
              {facility.facilitySports.map((fs) => {
                const fsSportId = fs.sportId || fs.id;
                const isSelected = selectedSportId === fsSportId;
                return (
                  <button
                    key={fs.id}
                    type="button"
                    onClick={() => handleSelectSport(fsSportId)}
                    data-testid={`sport-tab-${fsSportId}`}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-brand-300 hover:bg-slate-50'
                    }`}
                  >
                    <span>{fs.sportName || 'Môn thể thao'}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {fs.slotStepMinutes}p/slot
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Court Selection Tabs */}
        {availableCourts.length > 0 ? (
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              2. Chọn sân thi đấu
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCourts.map((court) => {
                const cId = court.id || court._id;
                const isSelected = (activeCourt?.id || activeCourt?._id) === cId;
                return (
                  <button
                    key={cId}
                    type="button"
                    onClick={() => setSelectedCourtId(cId)}
                    data-testid={`court-tab-${cId}`}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold border transition flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{court.name}</span>
                    <span className="text-[10px] opacity-75">
                      ({formatVND(court.pricePerHourVnd)}/h)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            Hiện chưa có sân nào được kích hoạt cho môn thể thao này. Vui lòng chọn môn khác.
          </div>
        )}

        {/* Schedule Grid Component */}
        {activeCourt && (
          <div className="pt-2">
            <CourtSchedule court={activeCourt} facility={facility} />
          </div>
        )}
      </section>
    </div>
  );
}

export default FacilityDetailPage;

