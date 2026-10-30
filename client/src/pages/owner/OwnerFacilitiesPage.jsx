import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Plus,
  Edit2,
  Image,
  Upload,
  Trash2,
  Star,
  Activity,
  Layers,
  Clock,
  MapPin,
  Phone,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Eye,
  Check,
  ArrowRight,
} from 'lucide-react';
import { ownerService } from '../../services/owner.service.js';
import { sportService } from '../../services/sport.service.js';
import { formatVND } from '../../utils/slot-helper.js';

/**
 * Calculates slot breakdown and remainder time for a given operating interval and step (Criterion 30, OWN-05)
 */
function calculateSlotPreview(openTime, closeTime, stepMinutes) {
  if (!openTime || !closeTime || !stepMinutes) {
    return { slots: [], remainder: null, totalOperatingMinutes: 0 };
  }
  const [oH, oM] = openTime.split(':').map(Number);
  const [cH, cM] = closeTime.split(':').map(Number);
  const startMin = oH * 60 + oM;
  const endMin = cH * 60 + cM;
  if (endMin <= startMin) {
    return { slots: [], remainder: null, totalOperatingMinutes: 0 };
  }

  const totalMin = endMin - startMin;
  const step = Number(stepMinutes);
  const numSlots = Math.floor(totalMin / step);
  const remainderMin = totalMin % step;

  const slots = [];
  for (let i = 0; i < numSlots; i++) {
    const sM = startMin + i * step;
    const eM = sM + step;
    const sStr = `${String(Math.floor(sM / 60)).padStart(2, '0')}:${String(sM % 60).padStart(2, '0')}`;
    const eStr = `${String(Math.floor(eM / 60)).padStart(2, '0')}:${String(eM % 60).padStart(2, '0')}`;
    slots.push({ startTime: sStr, endTime: eStr });
  }

  let remainder = null;
  if (remainderMin > 0) {
    const lastSlotEnd = startMin + numSlots * step;
    const rStart = `${String(Math.floor(lastSlotEnd / 60)).padStart(2, '0')}:${String(lastSlotEnd % 60).padStart(2, '0')}`;
    remainder = {
      startTime: rStart,
      endTime: closeTime,
      durationMinutes: remainderMin,
    };
  }

  return { slots, remainder, totalOperatingMinutes: totalMin };
}

export function OwnerFacilitiesPage() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Selected Facility for Detailed Management (Images, Sports, Courts)
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [activeTab, setActiveTab] = useState('INFO'); // 'INFO' | 'IMAGES' | 'SPORTS' | 'COURTS'

  // Available sports for dropdown
  const [availableSports, setAvailableSports] = useState([]);

  // Modals & sub-resource states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    address: '',
    province: 'Hà Nội',
    openTime: '06:00',
    closeTime: '22:00',
    phoneNumber: '',
    description: '',
  });

  const [sportsList, setSportsList] = useState([]);
  const [courtsList, setCourtsList] = useState([]);

  // ==========================================
  // DEFECT 1: Facility Edit & Status Management State
  // ==========================================
  const [isEditingFacility, setIsEditingFacility] = useState(false);
  const [editFacilityForm, setEditFacilityForm] = useState({
    name: '',
    address: '',
    province: 'Hà Nội',
    openTime: '06:00',
    closeTime: '22:00',
    phoneNumber: '',
    description: '',
  });
  const [facilitySaving, setFacilitySaving] = useState(false);
  const [facilityConflictWarning, setFacilityConflictWarning] = useState(null);

  // ==========================================
  // DEFECT 2: Court Edit Modal State
  // ==========================================
  const [editingCourt, setEditingCourt] = useState(null);
  const [editCourtForm, setEditCourtForm] = useState({
    name: '',
    pricePerHourVnd: 150000,
    description: '',
    isActive: true,
  });
  const [courtSaving, setCourtSaving] = useState(false);
  const [courtError, setCourtError] = useState(null);

  // ==========================================
  // DEFECT 3: Change FacilitySport Step State & Conflict Warning
  // ==========================================
  const [changingSportStep, setChangingSportStep] = useState(null); // FacilitySport object being edited
  const [targetStep, setTargetStep] = useState(60);
  const [stepSaving, setStepSaving] = useState(false);
  const [stepConflictWarning, setStepConflictWarning] = useState(null);

  // New Sport Form state
  const [newSportId, setNewSportId] = useState('');
  const [newSlotStep, setNewSlotStep] = useState(60);

  // New Court Form state
  const [newCourtName, setNewCourtName] = useState('');
  const [newCourtSportId, setNewCourtSportId] = useState('');
  const [newCourtPrice, setNewCourtPrice] = useState(150000);

  // 1. Load facilities
  const fetchFacilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await ownerService.listFacilities();
      const facs = Array.isArray(res?.data)
        ? res.data
        : res?.data?.facilities || (Array.isArray(res) ? res : []);
      setFacilities(facs);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể tải danh sách cơ sở.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
    sportService.getPublicSports().then((res) => {
      if (res?.data) setAvailableSports(res.data);
    });
  }, [fetchFacilities]);

  // Load detailed sub-resources when a facility is selected
  const loadFacilityDetails = async (fac) => {
    setSelectedFacility(fac);
    setIsEditingFacility(false);
    setFacilityConflictWarning(null);
    const defDay = { isOpen: true, openTime: fac.openTime || '06:00', closeTime: fac.closeTime || '22:00' };
    const defaultWeekly = {
      monday: defDay,
      tuesday: defDay,
      wednesday: defDay,
      thursday: defDay,
      friday: defDay,
      saturday: defDay,
      sunday: defDay,
    };
    setEditFacilityForm({
      name: fac.name || '',
      address: fac.address || '',
      province: fac.province || 'Hà Nội',
      openTime: fac.openTime || '06:00',
      closeTime: fac.closeTime || '22:00',
      phoneNumber: fac.phoneNumber || '',
      description: fac.description || '',
      weeklySchedule: fac.weeklySchedule || defaultWeekly,
    });

    try {
      const [sportsRes, courtsRes] = await Promise.all([
        ownerService.listFacilitySports(fac.id || fac._id),
        ownerService.listCourts(fac.id || fac._id),
      ]);
      setSportsList(sportsRes?.data || []);
      setCourtsList(courtsRes?.data || []);
    } catch {
      // ignore sub-resource fetch error
    }
  };

  // Create new facility
  const handleCreateFacility = async (e) => {
    e.preventDefault();
    try {
      await ownerService.createFacility(createForm);
      setShowCreateModal(false);
      setSuccessMsg('Tạo cơ sở thể thao mới thành công.');
      setCreateForm({
        name: '',
        address: '',
        province: 'Hà Nội',
        openTime: '06:00',
        closeTime: '22:00',
        phoneNumber: '',
        description: '',
      });
      fetchFacilities();
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tạo cơ sở.');
    }
  };

  // ==========================================
  // DEFECT 1 HANDLERS: Update Facility & Status
  // ==========================================
  const handleSaveFacilityInfo = async (e) => {
    e.preventDefault();
    if (!selectedFacility) return;

    try {
      setFacilitySaving(true);
      setError(null);
      setFacilityConflictWarning(null);

      const res = await ownerService.updateFacility(
        selectedFacility.id || selectedFacility._id,
        editFacilityForm
      );
      const updated = res.data || res;
      setSelectedFacility(updated);
      setIsEditingFacility(false);
      setSuccessMsg('Cập nhật thông tin cơ sở thành công.');
      await fetchFacilities();
    } catch (err) {
      const errCode = err.response?.data?.errorCode || err.errorCode;
      const errMsg = err.response?.data?.message || err.message;
      if (errCode === 'FACILITY_HAS_ACTIVE_BOOKINGS') {
        setFacilityConflictWarning(
          'Không thể thay đổi giờ hoạt động: Cơ sở đang có đơn đặt hoặc lịch khóa nằm ngoài khung giờ mới (Tiêu chí 15). Vui lòng xử lý các lịch này trước.'
        );
      } else {
        setError(errMsg || 'Không thể cập nhật thông tin cơ sở.');
      }
    } finally {
      setFacilitySaving(false);
    }
  };

  const handleUpdateFacilityStatus = async (newStatus) => {
    if (!selectedFacility) return;

    try {
      setError(null);
      setFacilityConflictWarning(null);

      const res = await ownerService.updateFacility(
        selectedFacility.id || selectedFacility._id,
        { status: newStatus }
      );
      const updated = res.data || res;
      setSelectedFacility(updated);
      setSuccessMsg(
        newStatus === 'PUBLISHED'
          ? 'Đã công khai cơ sở thành công.'
          : newStatus === 'PAUSED'
          ? 'Đã tạm dừng nhận đặt cho cơ sở này.'
          : 'Đã cập nhật trạng thái cơ sở.'
      );
      await fetchFacilities();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Không thể đổi trạng thái cơ sở.');
    }
  };

  // ==========================================
  // IMAGE MANAGEMENT
  // ==========================================
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedFacility) return;
    try {
      await ownerService.uploadFacilityImage(selectedFacility.id || selectedFacility._id, file);
      const updated = await ownerService.getFacilityById(selectedFacility.id || selectedFacility._id);
      if (updated?.data) {
        setSelectedFacility(updated.data);
        fetchFacilities();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Tải ảnh thất bại.');
    }
  };

  const handleSetCover = async (imageId) => {
    if (!selectedFacility) return;
    try {
      await ownerService.setCoverImage(selectedFacility.id || selectedFacility._id, imageId);
      const updated = await ownerService.getFacilityById(selectedFacility.id || selectedFacility._id);
      if (updated?.data) setSelectedFacility(updated.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể đặt làm ảnh đại diện.');
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!selectedFacility) return;
    try {
      await ownerService.deleteFacilityImage(selectedFacility.id || selectedFacility._id, imageId);
      const updated = await ownerService.getFacilityById(selectedFacility.id || selectedFacility._id);
      if (updated?.data) setSelectedFacility(updated.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa ảnh.');
    }
  };

  // ==========================================
  // DEFECT 3 HANDLERS: Add Sport & Update Step with Preview
  // ==========================================
  const handleAddSport = async (e) => {
    e.preventDefault();
    if (!selectedFacility || !newSportId) return;
    try {
      await ownerService.addFacilitySport(selectedFacility.id || selectedFacility._id, {
        sportId: newSportId,
        slotStepMinutes: Number(newSlotStep),
      });
      const sportsRes = await ownerService.listFacilitySports(selectedFacility.id || selectedFacility._id);
      setSportsList(sportsRes?.data || []);
      setNewSportId('');
      setSuccessMsg('Đã thêm môn thể thao vào cơ sở.');
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể thêm môn thể thao.');
    }
  };

  const openChangeStepModal = (fs) => {
    setChangingSportStep(fs);
    setTargetStep(fs.slotStepMinutes || 60);
    setStepConflictWarning(null);
  };

  const closeChangeStepModal = () => {
    setChangingSportStep(null);
    setStepConflictWarning(null);
  };

  const handleConfirmChangeStep = async (e) => {
    e.preventDefault();
    if (!selectedFacility || !changingSportStep) return;

    try {
      setStepSaving(true);
      setStepConflictWarning(null);
      setError(null);

      await ownerService.updateFacilitySportStep(
        selectedFacility.id || selectedFacility._id,
        changingSportStep.id || changingSportStep._id,
        { slotStepMinutes: Number(targetStep) }
      );

      const sportsRes = await ownerService.listFacilitySports(selectedFacility.id || selectedFacility._id);
      setSportsList(sportsRes?.data || []);
      setSuccessMsg(`Đã đổi bước giờ thành ${targetStep} phút/slot thành công.`);
      closeChangeStepModal();
    } catch (err) {
      const errCode = err.response?.data?.errorCode || err.errorCode;
      const errMsg = err.response?.data?.message || err.message;
      if (errCode === 'FACILITY_HAS_ACTIVE_BOOKINGS') {
        setStepConflictWarning(
          'Không thể thay đổi bước giờ: Nhóm môn thể thao này đang có đơn đặt chỗ (chờ thanh toán / đã xác nhận) hoặc lịch khóa bảo trì chưa kết thúc (Tiêu chí 15).'
        );
      } else {
        alert(errMsg || 'Không thể thay đổi bước giờ.');
      }
    } finally {
      setStepSaving(false);
    }
  };

  // Live preview for adding sport
  const addSportPreview = useMemo(() => {
    if (!selectedFacility) return { slots: [], remainder: null };
    return calculateSlotPreview(selectedFacility.openTime, selectedFacility.closeTime, newSlotStep);
  }, [selectedFacility, newSlotStep]);

  // Live preview for changing sport step modal
  const changeStepPreview = useMemo(() => {
    if (!selectedFacility) return { slots: [], remainder: null };
    return calculateSlotPreview(selectedFacility.openTime, selectedFacility.closeTime, targetStep);
  }, [selectedFacility, targetStep]);

  // ==========================================
  // DEFECT 2 HANDLERS: Court Creation, Edit & Toggle Active
  // ==========================================
  const handleAddCourt = async (e) => {
    e.preventDefault();
    if (!selectedFacility || !newCourtName || !newCourtSportId) return;

    const fs = sportsList.find(
      (s) =>
        (s.sportId?.id || s.sportId?._id || s.sportId) === newCourtSportId ||
        s.id === newCourtSportId ||
        s._id === newCourtSportId
    );

    try {
      await ownerService.createCourt({
        facilityId: selectedFacility.id || selectedFacility._id,
        facilitySportId: fs?.id || fs?._id,
        sportId: newCourtSportId,
        name: newCourtName.trim(),
        pricePerHourVnd: Number(newCourtPrice),
      });
      const courtsRes = await ownerService.listCourts(selectedFacility.id || selectedFacility._id);
      setCourtsList(courtsRes?.data || []);
      setNewCourtName('');
      setSuccessMsg('Đã tạo sân con mới thành công.');
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể tạo sân con.');
    }
  };

  const openEditCourtModal = (court) => {
    setEditingCourt(court);
    const defaultRules = [
      { dayType: 'WEEKDAY', startTime: selectedFacility?.openTime || '06:00', endTime: selectedFacility?.closeTime || '22:00', pricePerHourVnd: court.pricePerHourVnd || 150000 },
      { dayType: 'WEEKEND', startTime: selectedFacility?.openTime || '06:00', endTime: selectedFacility?.closeTime || '22:00', pricePerHourVnd: court.pricePerHourVnd || 150000 },
    ];
    setEditCourtForm({
      name: court.name || '',
      pricePerHourVnd: court.pricePerHourVnd || 150000,
      description: court.description || '',
      isActive: court.isActive !== false,
      pricingRules: Array.isArray(court.pricingRules) && court.pricingRules.length > 0
        ? court.pricingRules.map((r) => ({ ...r }))
        : defaultRules,
    });
    setCourtError(null);
  };

  const closeEditCourtModal = () => {
    setEditingCourt(null);
    setCourtError(null);
  };

  const handleAddPricingRule = () => {
    const rules = editCourtForm.pricingRules || [];
    const newRule = {
      dayType: 'WEEKDAY',
      startTime: selectedFacility?.openTime || '06:00',
      endTime: selectedFacility?.closeTime || '22:00',
      pricePerHourVnd: Number(editCourtForm.pricePerHourVnd) || 150000,
    };
    setEditCourtForm({
      ...editCourtForm,
      pricingRules: [...rules, newRule],
    });
  };

  const handleUpdatePricingRule = (index, field, value) => {
    const rules = [...(editCourtForm.pricingRules || [])];
    rules[index] = { ...rules[index], [field]: value };
    const validPrices = rules.map((r) => Number(r.pricePerHourVnd)).filter((p) => p > 0);
    const minP = validPrices.length > 0 ? Math.min(...validPrices) : editCourtForm.pricePerHourVnd;
    setEditCourtForm({
      ...editCourtForm,
      pricingRules: rules,
      pricePerHourVnd: minP > 0 ? minP : editCourtForm.pricePerHourVnd,
    });
  };

  const handleRemovePricingRule = (index) => {
    const rules = (editCourtForm.pricingRules || []).filter((_, idx) => idx !== index);
    const validPrices = rules.map((r) => Number(r.pricePerHourVnd)).filter((p) => p > 0);
    const minP = validPrices.length > 0 ? Math.min(...validPrices) : editCourtForm.pricePerHourVnd;
    setEditCourtForm({
      ...editCourtForm,
      pricingRules: rules,
      pricePerHourVnd: minP > 0 ? minP : editCourtForm.pricePerHourVnd,
    });
  };

  const handleSaveCourt = async (e) => {
    e.preventDefault();
    if (!editingCourt || !selectedFacility) return;

    try {
      setCourtSaving(true);
      setCourtError(null);

      await ownerService.updateCourt(editingCourt.id || editingCourt._id, {
        name: editCourtForm.name.trim(),
        pricePerHourVnd: Number(editCourtForm.pricePerHourVnd),
        pricingRules: editCourtForm.pricingRules,
        description: editCourtForm.description.trim(),
        isActive: editCourtForm.isActive,
      });

      const courtsRes = await ownerService.listCourts(selectedFacility.id || selectedFacility._id);
      setCourtsList(courtsRes?.data || []);
      setSuccessMsg(`Đã cập nhật sân ${editCourtForm.name} thành công.`);
      closeEditCourtModal();
    } catch (err) {
      setCourtError(err.response?.data?.message || err.message || 'Không thể cập nhật sân con.');
    } finally {
      setCourtSaving(false);
    }
  };

  const handleToggleCourtActive = async (court) => {
    if (!selectedFacility) return;
    try {
      await ownerService.updateCourt(court.id || court._id, {
        isActive: !court.isActive,
      });
      const courtsRes = await ownerService.listCourts(selectedFacility.id || selectedFacility._id);
      setCourtsList(courtsRes?.data || []);
      setSuccessMsg(`Đã ${!court.isActive ? 'mở lại' : 'tạm dừng nhận đặt'} sân ${court.name}.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể thay đổi trạng thái sân.');
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" data-testid="owner-facilities-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Quản lý Cơ sở & Sân đấu
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Thiết lập thông tin địa điểm, bước giờ (30/60/90m), hình ảnh và danh sách sân thi đấu.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/25 transition active:scale-[0.98] self-start sm:self-auto"
          data-testid="btn-create-facility"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm cơ sở mới</span>
        </button>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="font-bold text-sm">
            ×
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="font-bold text-sm">
            ×
          </button>
        </div>
      )}

      {/* Facilities Cards Grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-xs">Đang tải danh sách cơ sở...</div>
      ) : facilities.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Chưa có cơ sở thể thao nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Bắt đầu tạo cơ sở đầu tiên để thiết lập cấu hình môn, bước giờ và nhận khách đặt sân.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((fac) => {
            const isSelected = (selectedFacility?.id || selectedFacility?._id) === (fac.id || fac._id);
            const cover = fac.images?.find((img) => img.isCover)?.url || fac.images?.[0]?.url;

            return (
              <div
                key={fac.id || fac._id}
                className={`bg-white rounded-2xl border transition overflow-hidden shadow-xs flex flex-col justify-between ${
                  isSelected ? 'border-brand-500 ring-2 ring-brand-300' : 'border-slate-200 hover:border-slate-300'
                }`}
                data-testid={`owner-facility-card-${fac.id || fac._id}`}
              >
                <div className="relative h-40 bg-slate-100 overflow-hidden">
                  {cover ? (
                    <img src={cover} alt={fac.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Building2 className="w-12 h-12 stroke-[1.5]" />
                    </div>
                  )}

                  <span
                    className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      fac.status === 'PUBLISHED'
                        ? 'bg-emerald-500 text-white'
                        : fac.status === 'PAUSED'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-500 text-white'
                    }`}
                  >
                    {fac.status === 'PUBLISHED'
                      ? 'Công khai'
                      : fac.status === 'PAUSED'
                      ? 'Tạm dừng'
                      : 'Bản nháp'}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1">{fac.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{fac.address}, {fac.province}</span>
                    </p>
                    <p className="text-xs text-slate-500 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{fac.openTime} - {fac.closeTime}</span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadFacilityDetails(fac)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 font-semibold text-xs border border-slate-200 hover:border-brand-200 transition"
                    data-testid={`btn-manage-${fac.id || fac._id}`}
                  >
                    Quản lý chi tiết & Sân đấu
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Facility Detail Manager Section */}
      {selectedFacility && (
        <div
          className="bg-white rounded-3xl border border-brand-200 shadow-md p-6 sm:p-8 space-y-6"
          data-testid="facility-detail-manager"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs font-semibold text-brand-600 uppercase tracking-widest">
                Đang quản lý:
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {selectedFacility.name}
              </h2>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSelectedFacility(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                title="Đóng quản lý"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sub-tabs Navigation */}
          <div className="flex space-x-2 border-b border-slate-100 pb-2 overflow-x-auto">
            {[
              { key: 'INFO', label: 'Thông tin chung', icon: Building2 },
              { key: 'IMAGES', label: `Hình ảnh (${selectedFacility.images?.length || 0})`, icon: Image },
              { key: 'SPORTS', label: `Môn & Bước giờ (${sportsList.length})`, icon: Activity },
              { key: 'COURTS', label: `Sân thi đấu (${courtsList.length})`, icon: Layers },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                data-testid={`subtab-${t.key.toLowerCase()}`}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  activeTab === t.key
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* ======================================================== */}
          {/* TAB 1: INFO (CRUD MỀM CƠ SỞ & CHUYỂN ĐỔI TRẠNG THÁI) */}
          {/* ======================================================== */}
          {activeTab === 'INFO' && (
            <div className="space-y-6">
              {/* Conflict warning if changing hours overlaps with active bookings (Tiêu chí 15) */}
              {facilityConflictWarning && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Lịch cản trở thay đổi giờ hoạt động</span>
                  </div>
                  <p>{facilityConflictWarning}</p>
                  <div className="flex space-x-3 pt-1">
                    <Link
                      to="/owner/bookings"
                      className="inline-flex items-center space-x-1 font-semibold text-brand-700 hover:underline"
                    >
                      <span>Xem đơn đặt sân</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      to="/owner/court-blocks"
                      className="inline-flex items-center space-x-1 font-semibold text-brand-700 hover:underline"
                    >
                      <span>Xem lịch khóa sân</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              )}

              {/* Status and Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-slate-600">Trạng thái hiện tại:</span>
                  <span
                    className={`px-3 py-1 rounded-full font-bold uppercase text-[11px] ${
                      selectedFacility.status === 'PUBLISHED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedFacility.status === 'PAUSED'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {selectedFacility.status === 'PUBLISHED'
                      ? 'Đang công khai nhận khách'
                      : selectedFacility.status === 'PAUSED'
                      ? 'Đang tạm dừng nhận khách'
                      : 'Bản nháp (Chưa công khai)'}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Status Toggle Buttons */}
                  {selectedFacility.status === 'PUBLISHED' ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateFacilityStatus('PAUSED')}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl font-semibold transition"
                      data-testid="btn-pause-facility"
                    >
                      Tạm dừng nhận khách
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUpdateFacilityStatus('PUBLISHED')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition shadow-xs"
                      data-testid="btn-publish-facility"
                      title="Yêu cầu có ít nhất 1 sân đang hoạt động"
                    >
                      Công khai cơ sở ngay
                    </button>
                  )}

                  {!isEditingFacility ? (
                    <button
                      type="button"
                      onClick={() => setIsEditingFacility(true)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl font-semibold transition"
                      data-testid="btn-edit-facility"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Chỉnh sửa thông tin</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingFacility(false);
                        setFacilityConflictWarning(null);
                      }}
                      className="px-3 py-1.5 text-slate-500 hover:bg-slate-200 rounded-xl transition"
                    >
                      Hủy chỉnh sửa
                    </button>
                  )}
                </div>
              </div>

              {/* Read-only Info Display */}
              {!isEditingFacility ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Tên cơ sở</span>
                    <p className="font-bold text-slate-800 text-sm">{selectedFacility.name}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Số điện thoại hotline</span>
                    <p className="font-bold text-slate-800">{selectedFacility.phoneNumber || 'Chưa cập nhật'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Địa chỉ & Tỉnh thành</span>
                    <p className="font-bold text-slate-800">{selectedFacility.address}, {selectedFacility.province}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Giờ mở - đóng cửa</span>
                    <p className="font-bold text-blue-700">{selectedFacility.openTime} - {selectedFacility.closeTime}</p>
                  </div>
                  <div className="sm:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <span className="text-slate-400 font-medium">Mô tả cơ sở</span>
                    <p className="text-slate-700 whitespace-pre-line">{selectedFacility.description || '(Chưa có mô tả)'}</p>
                  </div>
                </div>
              ) : (
                /* Edit Facility Form */
                <form onSubmit={handleSaveFacilityInfo} className="space-y-4 text-xs bg-slate-50 p-5 rounded-2xl border border-brand-200">
                  <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center space-x-2">
                    <Edit2 className="w-4 h-4 text-brand-600" />
                    <span>Chỉnh sửa thông tin cơ sở</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Tên cơ sở <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFacilityForm.name}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, name: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-name"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Số điện thoại hotline</label>
                      <input
                        type="tel"
                        value={editFacilityForm.phoneNumber}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, phoneNumber: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-phone"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Địa chỉ chi tiết <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editFacilityForm.address}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, address: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-address"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tỉnh / Thành phố</label>
                      <input
                        type="text"
                        value={editFacilityForm.province}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, province: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-province"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Giờ mở cửa</label>
                      <input
                        type="time"
                        required
                        value={editFacilityForm.openTime}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, openTime: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-opentime"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Giờ đóng cửa</label>
                      <input
                        type="time"
                        required
                        value={editFacilityForm.closeTime}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, closeTime: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-closetime"
                      />
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                      <label className="font-semibold text-slate-800 text-xs block mb-2">
                        Lịch hoạt động theo ngày trong tuần (Thứ Hai – Chủ Nhật)
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {[
                          { key: 'monday', label: 'Thứ Hai' },
                          { key: 'tuesday', label: 'Thứ Ba' },
                          { key: 'wednesday', label: 'Thứ Tư' },
                          { key: 'thursday', label: 'Thứ Năm' },
                          { key: 'friday', label: 'Thứ Sáu' },
                          { key: 'saturday', label: 'Thứ Bảy' },
                          { key: 'sunday', label: 'Chủ Nhật' },
                        ].map((day) => {
                          const sched = editFacilityForm.weeklySchedule?.[day.key] || {
                            isOpen: true,
                            openTime: editFacilityForm.openTime,
                            closeTime: editFacilityForm.closeTime,
                          };
                          return (
                            <div key={day.key} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between space-x-2">
                              <div className="flex items-center space-x-1.5 min-w-[75px]">
                                <input
                                  type="checkbox"
                                  id={`check-${day.key}`}
                                  checked={sched.isOpen !== false}
                                  onChange={(e) => {
                                    const updated = {
                                      ...editFacilityForm.weeklySchedule,
                                      [day.key]: { ...sched, isOpen: e.target.checked },
                                    };
                                    setEditFacilityForm({ ...editFacilityForm, weeklySchedule: updated });
                                  }}
                                  className="rounded text-brand-600 h-3.5 w-3.5"
                                />
                                <label htmlFor={`check-${day.key}`} className="font-semibold text-slate-700 cursor-pointer">
                                  {day.label}
                                </label>
                              </div>
                              {sched.isOpen !== false ? (
                                <div className="flex items-center space-x-1">
                                  <input
                                    type="time"
                                    value={sched.openTime || editFacilityForm.openTime}
                                    onChange={(e) => {
                                      const updated = {
                                        ...editFacilityForm.weeklySchedule,
                                        [day.key]: { ...sched, openTime: e.target.value },
                                      };
                                      setEditFacilityForm({ ...editFacilityForm, weeklySchedule: updated });
                                    }}
                                    className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[11px]"
                                  />
                                  <span>-</span>
                                  <input
                                    type="time"
                                    value={sched.closeTime || editFacilityForm.closeTime}
                                    onChange={(e) => {
                                      const updated = {
                                        ...editFacilityForm.weeklySchedule,
                                        [day.key]: { ...sched, closeTime: e.target.value },
                                      };
                                      setEditFacilityForm({ ...editFacilityForm, weeklySchedule: updated });
                                    }}
                                    className="bg-white border border-slate-200 rounded px-1 py-0.5 text-[11px]"
                                  />
                                </div>
                              ) : (
                                <span className="text-amber-600 font-medium text-[11px] px-2 py-0.5 bg-amber-50 rounded border border-amber-200">
                                  Nghỉ / Đóng cửa
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="font-semibold text-slate-700 block mb-1">Mô tả cơ sở</label>
                      <textarea
                        rows={3}
                        value={editFacilityForm.description}
                        onChange={(e) => setEditFacilityForm({ ...editFacilityForm, description: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-slate-800"
                        data-testid="input-edit-facility-desc"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingFacility(false)}
                      className="px-4 py-2 border border-slate-300 rounded-xl text-slate-600 hover:bg-slate-100"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={facilitySaving}
                      className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold disabled:opacity-50 transition shadow-xs"
                      data-testid="btn-save-facility-info"
                    >
                      {facilitySaving ? 'Đang lưu...' : 'Lưu thông tin cơ sở'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: IMAGES */}
          {/* ======================================================== */}
          {activeTab === 'IMAGES' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Tải lên ảnh cơ sở (tối đa 5MB/ảnh). Đặt một ảnh làm ảnh bìa.
                </span>
                <label className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-semibold cursor-pointer hover:bg-brand-700 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Tải ảnh lên</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(selectedFacility.images || []).map((img) => (
                  <div
                    key={img.id || img._id}
                    className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100"
                  >
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                    {img.isCover && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-white" />
                        <span>Ảnh bìa</span>
                      </span>
                    )}

                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2">
                      {!img.isCover && (
                        <button
                          type="button"
                          onClick={() => handleSetCover(img.id || img._id)}
                          className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white text-[10px] font-semibold"
                          title="Đặt làm ảnh bìa"
                        >
                          Chọn bìa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id || img._id)}
                        className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: SPORTS & STEP PREVIEW (TIÊU CHÍ 15, 30) */}
          {/* ======================================================== */}
          {activeTab === 'SPORTS' && (
            <div className="space-y-6">
              {/* Add sport form */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-brand-600" />
                  <span>Thêm môn thể thao mới vào cơ sở</span>
                </h3>

                <form onSubmit={handleAddSport} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Môn thể thao</label>
                    <select
                      value={newSportId}
                      onChange={(e) => setNewSportId(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                      data-testid="select-add-sport"
                    >
                      <option value="">-- Chọn môn --</option>
                      {availableSports.map((s) => (
                        <option key={s._id || s.id} value={s._id || s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Bước giờ ô lịch</label>
                    <select
                      value={newSlotStep}
                      onChange={(e) => setNewSlotStep(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                      data-testid="select-add-sport-step"
                    >
                      <option value={30}>30 phút / slot</option>
                      <option value={60}>60 phút / slot</option>
                      <option value={90}>90 phút / slot</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={!newSportId}
                    className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold disabled:opacity-50 transition shadow-xs"
                    data-testid="btn-submit-add-sport"
                  >
                    Thêm vào cơ sở
                  </button>
                </form>

                {/* Live Slot Preview for new sport */}
                {selectedFacility && (
                  <div className="mt-3 p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                      <span>
                        Sơ đồ ô giờ dự kiến ({selectedFacility.openTime} - {selectedFacility.closeTime}):{' '}
                        <strong className="text-brand-600">{addSportPreview.slots.length} ô</strong> (bước{' '}
                        {newSlotStep}p)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {addSportPreview.slots.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700"
                        >
                          {s.startTime}-{s.endTime}
                        </span>
                      ))}
                    </div>

                    {/* Remainder time alert (Criterion 30) */}
                    {addSportPreview.remainder && (
                      <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] flex items-start space-x-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Khoảng thời gian dư không nhận đặt:</strong>{' '}
                          {addSportPreview.remainder.startTime} - {addSportPreview.remainder.endTime} (
                          {addSportPreview.remainder.durationMinutes} phút). Phần thời gian dư ở cuối ngày không đủ 1
                          slot trọn vẹn sẽ không được mở nhận đặt (Tiêu chí 30, OWN-05).
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Configured Sports list */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Môn thể thao & Bước giờ đang cấu hình ({sportsList.length})
                </h4>

                {sportsList.map((fs) => (
                  <div
                    key={fs.id || fs._id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shadow-xs"
                    data-testid={`facility-sport-row-${fs.id || fs._id}`}
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {fs.sportName || fs.sportId?.name || 'Môn thể thao'}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        Bước giờ hiện tại:{' '}
                        <span className="font-bold text-brand-600">{fs.slotStepMinutes} phút/ô</span> • Cấu hình v
                        {fs.configVersion || 1}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => openChangeStepModal(fs)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 rounded-xl font-semibold transition"
                        data-testid={`btn-change-step-${fs.id || fs._id}`}
                      >
                        Đổi bước giờ
                      </button>
                      <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200">
                        Đang hoạt động
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: COURTS (CRUD MỀM SÂN CON & TOGGLE ACTIVE) */}
          {/* ======================================================== */}
          {activeTab === 'COURTS' && (
            <div className="space-y-6">
              {/* Add Court Form */}
              <form
                onSubmit={handleAddCourt}
                className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-end gap-3 text-xs"
              >
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Thuộc môn thể thao</label>
                  <select
                    value={newCourtSportId}
                    onChange={(e) => setNewCourtSportId(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                    data-testid="select-court-sport"
                  >
                    <option value="">-- Chọn môn --</option>
                    {sportsList.map((s) => (
                      <option key={s.id || s._id} value={s.sportId?._id || s.sportId?.id || s.sportId}>
                        {s.sportName || s.sportId?.name || 'Môn'} ({s.slotStepMinutes}p)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tên sân thi đấu</label>
                  <input
                    type="text"
                    required
                    value={newCourtName}
                    onChange={(e) => setNewCourtName(e.target.value)}
                    placeholder="VD: Sân 1, Sân VIP..."
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                    data-testid="input-court-name"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Giá theo giờ (VND/h)</label>
                  <input
                    type="number"
                    step="10000"
                    required
                    value={newCourtPrice}
                    onChange={(e) => setNewCourtPrice(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700"
                    data-testid="input-court-price"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!newCourtName || !newCourtSportId}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold disabled:opacity-50 transition shadow-xs"
                  data-testid="btn-submit-add-court"
                >
                  Tạo sân con
                </button>
              </form>

              {/* Courts List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {courtsList.map((c) => (
                  <div
                    key={c.id || c._id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 text-xs space-y-3 shadow-xs flex flex-col justify-between"
                    data-testid={`court-card-${c.id || c._id}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-sm truncate">{c.name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {c.isActive ? 'Đang nhận đặt' : 'Tạm ngừng'}
                        </span>
                      </div>

                      <div className="text-brand-700 font-black text-sm">
                        {formatVND(c.pricePerHourVnd)}
                        <span className="text-slate-400 font-normal text-xs"> /giờ</span>
                      </div>

                      <div className="text-slate-500 text-[11px]">
                        Môn: <strong>{c.sportName || 'Thể thao'}</strong>
                      </div>
                      {c.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2">{c.description}</p>
                      )}
                    </div>

                    {/* Court Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditCourtModal(c)}
                        className="flex-1 py-1.5 px-2 bg-slate-50 hover:bg-brand-50 text-slate-700 hover:text-brand-700 border border-slate-200 rounded-lg font-semibold transition text-center"
                        data-testid={`btn-edit-court-${c.id || c._id}`}
                      >
                        Sửa sân
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleCourtActive(c)}
                        className={`py-1.5 px-2.5 rounded-lg font-semibold transition text-[11px] ${
                          c.isActive
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}
                        data-testid={`btn-toggle-court-${c.id || c._id}`}
                      >
                        {c.isActive ? 'Tạm ngừng' : 'Mở lại'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: CREATE FACILITY */}
      {/* ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Thêm cơ sở thể thao mới</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFacility} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tên cơ sở <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: CLB Thể Thao Sao Vàng"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Địa chỉ chi tiết <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Số nhà, tên đường, phường/xã..."
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Tỉnh / Thành phố</label>
                  <input
                    type="text"
                    value={createForm.province}
                    onChange={(e) => setCreateForm({ ...createForm, province: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="tel"
                    placeholder="0912345678"
                    value={createForm.phoneNumber}
                    onChange={(e) => setCreateForm({ ...createForm, phoneNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Giờ mở cửa</label>
                  <input
                    type="time"
                    required
                    value={createForm.openTime}
                    onChange={(e) => setCreateForm({ ...createForm, openTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Giờ đóng cửa</label>
                  <input
                    type="time"
                    required
                    value={createForm.closeTime}
                    onChange={(e) => setCreateForm({ ...createForm, closeTime: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mô tả ngắn</label>
                <textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition shadow-xs"
                >
                  Tạo cơ sở
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT COURT (CRUD MỀM SÂN CON & OWN-05) */}
      {/* ======================================================== */}
      {editingCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Chỉnh sửa sân thi đấu</h3>
                <p className="text-xs text-slate-500 mt-0.5">Sân: {editingCourt.name}</p>
              </div>
              <button
                type="button"
                onClick={closeEditCourtModal}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {courtError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{courtError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCourt} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Tên sân con <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editCourtForm.name}
                  onChange={(e) => setEditCourtForm({ ...editCourtForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  data-testid="input-edit-court-name"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Đơn giá thuê theo giờ (VND/giờ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="10000"
                  min="10000"
                  required
                  value={editCourtForm.pricePerHourVnd}
                  onChange={(e) => setEditCourtForm({ ...editCourtForm, pricePerHourVnd: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold"
                  data-testid="input-edit-court-price"
                />
              </div>

              {/* OWN-05 Policy Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] space-y-1">
                <div className="flex items-center space-x-1 font-semibold text-blue-950">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Quy tắc bảo lưu giá cũ (OWN-05):</span>
                </div>
                <p>
                  Mức giá mới chỉ áp dụng cho các lượt đặt sân mới sau thời điểm lưu. Các đơn đặt đã được khách tạo
                  hoặc thanh toán trước đó vẫn giữ nguyên đơn giá cũ.
                </p>
              </div>

              {/* B03 Pricing Rules by Time & Day Type */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-brand-600" />
                    <span>Bảng giá theo khung giờ & loại ngày ({editCourtForm.pricingRules?.length || 0})</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPricingRule}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 px-2 py-1 rounded-lg border border-brand-200"
                  >
                    + Thêm khung giá
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {(editCourtForm.pricingRules || []).map((rule, rIdx) => (
                    <div
                      key={rIdx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <select
                          value={rule.dayType}
                          onChange={(e) => handleUpdatePricingRule(rIdx, 'dayType', e.target.value)}
                          className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-medium"
                        >
                          <option value="WEEKDAY">Ngày thường (T2–T6)</option>
                          <option value="WEEKEND">Cuối tuần (T7–CN)</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemovePricingRule(rIdx)}
                          className="text-rose-500 hover:text-rose-700 text-xs font-medium px-1.5 py-0.5 rounded"
                          title="Xóa khung giá"
                        >
                          Xóa
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Từ:</span>
                          <input
                            type="time"
                            value={rule.startTime}
                            onChange={(e) => handleUpdatePricingRule(rIdx, 'startTime', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Đến:</span>
                          <input
                            type="time"
                            value={rule.endTime}
                            onChange={(e) => handleUpdatePricingRule(rIdx, 'endTime', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs"
                            required
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Đơn giá (đ/h):</span>
                          <input
                            type="number"
                            step="10000"
                            min="10000"
                            value={rule.pricePerHourVnd}
                            onChange={(e) => handleUpdatePricingRule(rIdx, 'pricePerHourVnd', Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs font-semibold"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Mô tả sân</label>
                <input
                  type="text"
                  value={editCourtForm.description}
                  onChange={(e) => setEditCourtForm({ ...editCourtForm, description: e.target.value })}
                  placeholder="VD: Mặt sân cỏ nhân tạo đạt chuẩn FIFA..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800"
                  data-testid="input-edit-court-desc"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="court-active-checkbox"
                  checked={editCourtForm.isActive}
                  onChange={(e) => setEditCourtForm({ ...editCourtForm, isActive: e.target.checked })}
                  className="rounded text-brand-600 focus:ring-brand-500 h-4 w-4"
                  data-testid="checkbox-edit-court-active"
                />
                <label htmlFor="court-active-checkbox" className="font-semibold text-slate-700 cursor-pointer">
                  Kích hoạt nhận khách đặt sân
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeEditCourtModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={courtSaving}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition shadow-xs disabled:opacity-50"
                  data-testid="btn-save-court"
                >
                  {courtSaving ? 'Đang lưu...' : 'Lưu thay đổi sân'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: CHANGE STEP WITH PREVIEW & CONFLICT WARNING (TIÊU CHÍ 15, 30) */}
      {/* ======================================================== */}
      {changingSportStep && selectedFacility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Thay đổi bước giờ ô lịch</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Môn: {changingSportStep.sportName || changingSportStep.sportId?.name} (Hiện tại:{' '}
                  {changingSportStep.slotStepMinutes}p)
                </p>
              </div>
              <button
                type="button"
                onClick={closeChangeStepModal}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conflict Error Alert (Tiêu chí 15) */}
            {stepConflictWarning && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Cản trở thay đổi cấu hình (Tiêu chí 15)</span>
                </div>
                <p>{stepConflictWarning}</p>
                <div className="flex space-x-3 pt-1">
                  <Link
                    to="/owner/bookings"
                    className="inline-flex items-center space-x-1 font-semibold text-brand-700 hover:underline"
                  >
                    <span>Kiểm tra đơn đặt sân</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                  <Link
                    to="/owner/court-blocks"
                    className="inline-flex items-center space-x-1 font-semibold text-brand-700 hover:underline"
                  >
                    <span>Kiểm tra lịch khóa sân</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmChangeStep} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Chọn bước giờ mới (30 / 60 / 90 phút)
                </label>
                <select
                  value={targetStep}
                  onChange={(e) => setTargetStep(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-bold"
                  data-testid="select-change-step"
                >
                  <option value={30}>30 phút / ô slot</option>
                  <option value={60}>60 phút / ô slot</option>
                  <option value={90}>90 phút / ô slot</option>
                </select>
              </div>

              {/* Live Preview of New Step Breakdown */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-slate-700 font-medium">
                  <span>
                    Giờ hoạt động cơ sở: <strong>{selectedFacility.openTime} - {selectedFacility.closeTime}</strong>
                  </span>
                  <span className="font-bold text-brand-600">
                    {changeStepPreview.slots.length} ô slot dự kiến
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 bg-white rounded-xl border border-slate-200">
                  {changeStepPreview.slots.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700"
                    >
                      {s.startTime}-{s.endTime}
                    </span>
                  ))}
                </div>

                {/* Remainder Box (Criterion 30, OWN-05) */}
                {changeStepPreview.remainder ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px] space-y-1">
                    <div className="flex items-center space-x-1 font-bold text-amber-900">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Khoảng thời gian dư không nhận đặt (Tiêu chí 30):</span>
                    </div>
                    <p>
                      Từ <strong className="font-mono">{changeStepPreview.remainder.startTime}</strong> đến{' '}
                      <strong className="font-mono">{changeStepPreview.remainder.endTime}</strong> (
                      {changeStepPreview.remainder.durationMinutes} phút). Do thời lượng hoạt động không chia hết cho
                      bước giờ {targetStep} phút, khoảng thời gian này sẽ tự động không nhận đặt chỗ.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] flex items-center space-x-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Giờ hoạt động chia hết trọn vẹn cho bước giờ {targetStep} phút. Không có thời gian dư.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeChangeStepModal}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={stepSaving}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition shadow-xs disabled:opacity-50"
                  data-testid="btn-confirm-change-step"
                >
                  {stepSaving ? 'Đang cập nhật...' : 'Xác nhận đổi bước giờ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OwnerFacilitiesPage;
