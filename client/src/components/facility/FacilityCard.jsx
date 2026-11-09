import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, ArrowRight, Dumbbell } from 'lucide-react';
import { formatVND } from '../../utils/slot-helper.js';

export function FacilityCard({ facility }) {
  const facilityId = facility.id || facility._id;
  const {
    name,
    address,
    province,
    openTime,
    closeTime,
    images = [],
  } = facility;
  const minPrice = facility.minPricePerHour || facility.minPrice;

  const [imgError, setImgError] = useState(false);

  const coverImage =
    facility.coverImageUrl ||
    facility.coverImage ||
    (Array.isArray(images) && images.length > 0
      ? images.find((img) => img?.isCover)?.url ||
        images[0]?.url ||
        (typeof images[0] === 'string' ? images[0] : null)
      : null) ||
    null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col group">
      {/* Cover Image / Thumbnail */}
      <div className="relative h-48 bg-slate-100 overflow-hidden flex items-center justify-center">
        {coverImage && !imgError ? (
          <img
            src={coverImage}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-100">
            <Dumbbell className="w-12 h-12 stroke-[1.5]" />
            <span className="text-xs font-medium mt-1 text-slate-400">SportBooking</span>
          </div>
        )}

        {/* Province Badge */}
        <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-semibold tracking-wide">
          {province}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
            {name}
          </h3>

          <p className="text-xs text-slate-500 flex items-start space-x-1.5 leading-relaxed line-clamp-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{address}</span>
          </p>

          <p className="text-xs text-slate-500 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>
              Giờ mở cửa: <strong className="text-slate-700">{openTime} - {closeTime}</strong>
            </span>
          </p>
        </div>

        {/* Price & Action Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
              Giá chỉ từ
            </span>
            <span className="text-sm font-bold text-brand-600">
              {minPrice ? `${formatVND(minPrice)}/giờ` : 'Liên hệ'}
            </span>
          </div>

          <Link
            to={`/facilities/${facilityId}`}
            className="inline-flex items-center space-x-1 px-3.5 py-2 rounded-lg bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white text-xs font-semibold transition-all group/btn"
          >
            <span>Xem lịch & Đặt sân</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
