import React, { useEffect, useState, useCallback } from 'react';
import {
  Layers,
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  X,
  ChevronLeft,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { adminService } from '../../services/admin.service.js';

export function AdminSportsPage() {
  const [sports, setSports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', description: '' });
  const [submittingAdd, setSubmittingAdd] = useState(false);

  const [editTargetSport, setEditTargetSport] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', isActive: true });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [deleteTargetSport, setDeleteTargetSport] = useState(null);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const fetchSports = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const params = { page, limit: pagination.limit };
        if (keyword.trim()) params.keyword = keyword.trim();
        if (statusFilter === 'ACTIVE') params.isActive = 'true';
        if (statusFilter === 'INACTIVE') params.isActive = 'false';

        const res = await adminService.listSports(params);
        if (res?.data) {
          setSports(res.data.items || []);
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Không thể tải danh mục môn thể thao.');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, keyword, statusFilter]
  );

  useEffect(() => {
    fetchSports(1);
  }, [fetchSports]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchSports(1);
  };

  // Tạo môn thể thao mới
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) {
      alert('Tên môn thể thao không được để trống.');
      return;
    }
    try {
      setSubmittingAdd(true);
      setError(null);
      const res = await adminService.createSport({
        name: addForm.name.trim(),
        description: addForm.description.trim(),
      });
      setSuccessMsg(res?.message || 'Thêm môn thể thao mới thành công.');
      setShowAddModal(false);
      setAddForm({ name: '', description: '' });
      fetchSports(1);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi thêm môn thể thao.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Cập nhật môn thể thao
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      alert('Tên môn thể thao không được để trống.');
      return;
    }
    try {
      setSubmittingEdit(true);
      setError(null);
      const sportId = editTargetSport.id || editTargetSport._id;
      const res = await adminService.updateSport(sportId, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        isActive: editForm.isActive,
      });
      setSuccessMsg(res?.message || 'Cập nhật môn thể thao thành công.');
      setEditTargetSport(null);
      fetchSports(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cập nhật môn thể thao.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Xóa môn thể thao
  const handleConfirmDelete = async () => {
    try {
      setSubmittingDelete(true);
      const sportId = deleteTargetSport.id || deleteTargetSport._id;
      const res = await adminService.deleteSport(sportId);
      setSuccessMsg(res?.message || 'Đã xóa môn thể thao thành công.');
      setDeleteTargetSport(null);
      fetchSports(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể xóa môn thể thao (có thể đang có sân sử dụng).');
    } finally {
      setSubmittingDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="admin-sports-page">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Danh mục Môn Thể thao
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản trị danh mục môn thể thao hệ thống, cấu hình tên chuẩn hóa và trạng thái mở nhận đặt sân (ADM-03).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition shadow-sm w-fit"
          data-testid="btn-open-add-sport-modal"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm môn thể thao mới</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên môn thể thao..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
          >
            Tìm
          </button>
        </form>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Tạm dừng</option>
          </select>

          <button
            type="button"
            onClick={() => fetchSports(pagination.page)}
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
            title="Tải lại"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Sports Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Tên môn thể thao</th>
                <th className="py-3 px-4">Tên chuẩn hóa</th>
                <th className="py-3 px-4">Mô tả</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && sports.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Đang tải danh mục môn thể thao...
                  </td>
                </tr>
              ) : sports.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    Chưa có môn thể thao nào phù hợp tiêu chí tìm kiếm.
                  </td>
                </tr>
              ) : (
                sports.map((s) => {
                  const sid = s.id || s._id;
                  return (
                    <tr key={sid} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{s.normalizedName}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{s.description || '—'}</td>
                      <td className="py-3.5 px-4">
                        {s.isActive ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Hoạt động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            <XCircle className="w-3 h-3" />
                            <span>Tạm dừng</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTargetSport(s);
                              setEditForm({
                                name: s.name,
                                description: s.description || '',
                                isActive: !!s.isActive,
                              });
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Chỉnh sửa môn thể thao"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTargetSport(s)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                            title="Xóa môn thể thao (chỉ khi chưa có sân)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> (Tổng{' '}
              {pagination.total} môn)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => fetchSports(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fetchSports(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Thêm môn thể thao mới (ADM-03) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-brand-600">
                <Plus className="w-5 h-5" />
                <h2 className="text-base font-bold text-slate-900">Thêm Môn Thể thao mới</h2>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start space-x-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                Tên môn thể thao sẽ tự động được chuẩn hóa viết hoa (ví dụ: <code>CẦU LÔNG</code>, <code>PICKLEBALL</code>
                ) để chống trùng lặp theo quy tắc ADM-03.
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên môn thể thao <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Cầu lông, Bóng đá mini, Tennis, Pickleball..."
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả ngắn</label>
                <textarea
                  rows="3"
                  placeholder="Thông tin quy chuẩn hoặc ghi chú môn thể thao..."
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={submittingAdd}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
                >
                  {submittingAdd ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{submittingAdd ? 'Đang thêm...' : 'Tạo môn thể thao'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Chỉnh sửa môn thể thao */}
      {editTargetSport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-800">
                <Edit2 className="w-4 h-4 text-brand-600" />
                <h2 className="text-base font-bold">Chỉnh sửa Môn Thể thao</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditTargetSport(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 my-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tên môn thể thao <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Mô tả</label>
                <textarea
                  rows="3"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              {/* Toggle isActive */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Trạng thái nhận đặt sân</span>
                  <span className="text-[11px] text-slate-500">
                    Chỉ tắt khi không còn sân nào đang mở nhận đặt với môn này.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                  className={`p-1 rounded-lg transition ${
                    editForm.isActive ? 'text-emerald-600 hover:text-emerald-700' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {editForm.isActive ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditTargetSport(null)}
                  disabled={submittingEdit}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
                >
                  {submittingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{submittingEdit ? 'Đang lưu...' : 'Lưu cập nhật'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Xóa môn thể thao */}
      {deleteTargetSport && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center space-x-2 text-rose-600 border-b border-slate-100 pb-3">
              <Trash2 className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">Xác nhận Xóa Môn Thể thao</h2>
            </div>

            <div className="my-3 text-xs text-slate-600 space-y-2">
              <p>
                Bạn có chắc chắn muốn xóa môn <strong>{deleteTargetSport.name}</strong>?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
                <strong>Ràng buộc hệ thống:</strong> Nếu môn thể thao này đã từng được cấu hình cho bất kỳ sân nào hoặc có
                lịch sử đơn đặt sân, server sẽ từ chối xóa để đảm bảo toàn vẹn dữ liệu.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteTargetSport(null)}
                disabled={submittingDelete}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submittingDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
              >
                {submittingDelete ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{submittingDelete ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSportsPage;

