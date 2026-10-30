import React, { useState } from 'react';
import { X, MapPin, Clock, Phone, Building2, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

export function FacilityDetailInfoModal({ facility, isOpen, onClose }) {
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  if (!isOpen || !facility) return null;

  const images = facility.images?.length
    ? facility.images
    : [
        {
          url:
            'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1200&auto=format&fit=crop',
          isCover: true,
        },
      ];

  const handlePrevImage = () => {
    setActiveImageIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setActiveImageIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-info-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="facility-info-modal-title" className="text-base font-bold text-slate-900 truncate max-w-md">
                {facility.name}
              </h3>
              <p className="text-xs text-slate-500">{facility.province} • Hình ảnh & Thông tin chi tiết</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Đóng thông tin cơ sở"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Gallery Carousel */}
          <div className="space-y-3">
            <div className="relative aspect-[16/9] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm group">
              <img
                src={images[activeImageIdx]?.url}
                alt={`${facility.name} - ảnh ${activeImageIdx + 1}`}
                className="w-full h-full object-cover transition duration-300"
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition"
                    aria-label="Ảnh trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition"
                    aria-label="Ảnh kế tiếp"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-slate-900/70 text-white text-[11px] font-medium">
                    {activeImageIdx + 1} / {images.length}
                  </div>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-thin">
                {images.map((img, idx) => (
                  <button
                    key={img.id || idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-20 h-14 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                      activeImageIdx === idx
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

          {/* Details Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-brand-600" /> Địa chỉ
              </span>
              <p className="text-xs font-semibold text-slate-800">{facility.address}, {facility.province}</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-600" /> Giờ hoạt động chuẩn
              </span>
              <p className="text-xs font-semibold text-slate-800">{facility.openTime} - {facility.closeTime}</p>
            </div>

            {facility.phoneNumber && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-brand-600" /> Điện thoại liên hệ
                </span>
                <p className="text-xs font-semibold text-slate-800">{facility.phoneNumber}</p>
              </div>
            )}

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-brand-600" /> Môn thể thao & Quy mô
              </span>
              <p className="text-xs font-semibold text-slate-800">
                {facility.facilitySports?.length || 0} bộ môn • {facility.courts?.length || 0} sân con
              </p>
            </div>
          </div>

          {/* Description */}
          {facility.description && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Giới thiệu cơ sở</h4>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-white p-4 rounded-xl border border-slate-100">
                {facility.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default FacilityDetailInfoModal;

