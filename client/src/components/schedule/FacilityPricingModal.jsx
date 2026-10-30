import React from 'react';
import { X, Calendar, DollarSign, Clock, AlertCircle } from 'lucide-react';
import { formatVND } from '../../utils/slot-helper.js';

export function FacilityPricingModal({ facility, sports = [], isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 id="pricing-modal-title" className="text-base font-bold text-slate-900">
                Bảng giá dịch vụ thuê sân
              </h3>
              <p className="text-xs text-slate-500">
                {facility?.name || 'Cơ sở thể thao'} • Giá niêm yết theo khung giờ & loại ngày
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Đóng bảng giá"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 leading-relaxed">
            <strong>Lưu ý:</strong> Giá áp dụng theo múi giờ Việt Nam (Asia/Ho_Chi_Minh). 
            Ngày thường: Thứ Hai - Thứ Sáu; Cuối tuần: Thứ Bảy - Chủ Nhật. 
            Giá một lượt được tính tỷ lệ theo bước giờ thực tế của môn thể thao.
          </div>

          {sports && sports.length > 0 ? (
            sports.map((sport) => (
              <div key={sport.facilitySportId || sport.sportId} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center space-x-1.5">
                    <span>{sport.sportName}</span>
                    <span className="text-[11px] font-normal normal-case text-slate-500">
                      (Mỗi lượt {sport.slotStepMinutes} phút)
                    </span>
                  </h4>
                  <span className="text-xs text-slate-500">{sport.courts?.length || 0} sân</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(sport.courts || []).map((court) => {
                    const rules = court.pricingRules || [];
                    const weekdayRules = rules.filter((r) => r.dayType === 'WEEKDAY');
                    const weekendRules = rules.filter((r) => r.dayType === 'WEEKEND');

                    return (
                      <div
                        key={court.courtId || court.id}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">{court.courtName}</span>
                          <span className="text-xs text-brand-700 font-semibold bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            Từ {formatVND(court.pricePerHourVnd)}/h
                          </span>
                        </div>

                        {/* Weekday Rules */}
                        <div className="space-y-1.5">
                          <span className="font-semibold text-slate-600 block text-[11px] uppercase tracking-wide">
                            Ngày thường (T2 - T6):
                          </span>
                          {weekdayRules.length > 0 ? (
                            <div className="space-y-1">
                              {weekdayRules.map((rule, idx) => {
                                const slotPrice = Math.round(
                                  ((sport.slotStepMinutes || 30) / 60) * rule.pricePerHourVnd
                                );
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between py-1 px-2 rounded bg-white border border-slate-100 text-[11px]"
                                  >
                                    <span className="font-medium text-slate-700">
                                      {rule.startTime} - {rule.endTime}
                                    </span>
                                    <div className="text-right">
                                      <span className="font-bold text-slate-900">
                                        {formatVND(slotPrice)}
                                      </span>
                                      <span className="text-slate-400 text-[10px]">
                                        {' '}({formatVND(rule.pricePerHourVnd)}/h)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Chưa cấu hình</span>
                          )}
                        </div>

                        {/* Weekend Rules */}
                        <div className="space-y-1.5">
                          <span className="font-semibold text-slate-600 block text-[11px] uppercase tracking-wide">
                            Cuối tuần (T7 - CN):
                          </span>
                          {weekendRules.length > 0 ? (
                            <div className="space-y-1">
                              {weekendRules.map((rule, idx) => {
                                const slotPrice = Math.round(
                                  ((sport.slotStepMinutes || 30) / 60) * rule.pricePerHourVnd
                                );
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between py-1 px-2 rounded bg-white border border-slate-100 text-[11px]"
                                  >
                                    <span className="font-medium text-slate-700">
                                      {rule.startTime} - {rule.endTime}
                                    </span>
                                    <div className="text-right">
                                      <span className="font-bold text-slate-900">
                                        {formatVND(slotPrice)}
                                      </span>
                                      <span className="text-slate-400 text-[10px]">
                                        {' '}({formatVND(rule.pricePerHourVnd)}/h)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Chưa cấu hình</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-slate-400">
              Chưa có dữ liệu bảng giá cho cơ sở này.
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

export default FacilityPricingModal;

