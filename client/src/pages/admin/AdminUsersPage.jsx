import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  UserPlus,
  Lock,
  Unlock,
  KeyRound,
  Mail,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ShieldAlert,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';
import { adminService } from '../../services/admin.service.js';

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modals state
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({ fullName: '', email: '', phoneNumber: '' });
  const [submittingProvision, setSubmittingProvision] = useState(false);

  const [lockTargetUser, setLockTargetUser] = useState(null);
  const [lockReason, setLockReason] = useState('');
  const [submittingLock, setSubmittingLock] = useState(false);

  const [unlockTargetUser, setUnlockTargetUser] = useState(null);
  const [unlockReason, setUnlockReason] = useState('');
  const [submittingUnlock, setSubmittingUnlock] = useState(false);

  const [editTargetUser, setEditTargetUser] = useState(null);
  const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '' });
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState(null);

  const fetchUsers = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError(null);
        const params = { page, limit: pagination.limit };
        if (roleFilter) params.role = roleFilter;
        if (statusFilter === 'LOCKED') params.isLocked = 'true';
        if (statusFilter === 'ACTIVE') params.isLocked = 'false';
        if (searchKeyword.trim()) params.keyword = searchKeyword.trim();

        const res = await adminService.listUsers(params);
        if (res?.data) {
          setUsers(res.data.items || []);
          if (res.data.pagination) {
            setPagination(res.data.pagination);
          }
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Không thể tải danh sách tài khoản.');
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, roleFilter, statusFilter, searchKeyword]
  );

  useEffect(() => {
    fetchUsers(1);
  }, [fetchUsers]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  // Cấp tài khoản Owner (ADM-01)
  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    if (!provisionForm.fullName.trim() || !provisionForm.email.trim() || !provisionForm.phoneNumber.trim()) {
      alert('Vui lòng điền đầy đủ họ tên, email và số điện thoại.');
      return;
    }
    try {
      setSubmittingProvision(true);
      setError(null);
      const res = await adminService.provisionOwner(provisionForm);
      setSuccessMsg(res?.message || 'Cấp tài khoản Chủ sân thành công. Email kích hoạt 24h đã được xếp hàng gửi.');
      setShowProvisionModal(false);
      setProvisionForm({ fullName: '', email: '', phoneNumber: '' });
      fetchUsers(1);
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi cấp tài khoản chủ sân.');
    } finally {
      setSubmittingProvision(false);
    }
  };

  // Gửi lại thư mời kích hoạt cho Owner chưa active
  const handleResendInvitation = async (user) => {
    if (!confirm(`Xác nhận gửi lại email kích hoạt tài khoản cho Chủ sân "${user.fullName}"? Liên kết cũ sẽ bị vô hiệu.`)) {
      return;
    }
    try {
      setActionLoadingId(user.id || user._id);
      const res = await adminService.resendOwnerInvitation(user.id || user._id);
      setSuccessMsg(res?.message || 'Đã gửi lại email mời kích hoạt thành công.');
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể gửi lại email mời.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Khóa tài khoản
  const handleConfirmLock = async () => {
    if (!lockReason.trim()) {
      alert('Lý do khóa tài khoản là bắt buộc.');
      return;
    }
    try {
      setSubmittingLock(true);
      const userId = lockTargetUser.id || lockTargetUser._id;
      const res = await adminService.lockUser(userId, lockReason.trim());
      setSuccessMsg(res?.message || 'Đã khóa tài khoản thành công.');
      setLockTargetUser(null);
      setLockReason('');
      fetchUsers(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể khóa tài khoản.');
    } finally {
      setSubmittingLock(false);
    }
  };

  // Mở khóa tài khoản
  const handleConfirmUnlock = async () => {
    try {
      setSubmittingUnlock(true);
      const userId = unlockTargetUser.id || unlockTargetUser._id;
      const res = await adminService.unlockUser(userId, unlockReason.trim() || 'Quản trị viên mở khóa tài khoản');
      setSuccessMsg(res?.message || 'Đã mở khóa tài khoản thành công.');
      setUnlockTargetUser(null);
      setUnlockReason('');
      fetchUsers(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể mở khóa tài khoản.');
    } finally {
      setSubmittingUnlock(false);
    }
  };

  // Yêu cầu gửi email đặt lại mật khẩu (AUTH-04)
  const handleTriggerResetPassword = async (user) => {
    if (!confirm(`Gửi liên kết đặt lại mật khẩu (hiệu lực 15 phút) tới email "${user.email}"?`)) {
      return;
    }
    try {
      setActionLoadingId(user.id || user._id);
      const res = await adminService.resetPassword(user.id || user._id);
      setSuccessMsg(res?.message || 'Đã gửi email yêu cầu đặt lại mật khẩu tới người dùng.');
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cập nhật thông tin liên hệ (ADM-02)
  const handleConfirmEdit = async (e) => {
    e.preventDefault();
    if (!editForm.fullName.trim() || !editForm.phoneNumber.trim()) {
      alert('Họ tên và số điện thoại không được để trống.');
      return;
    }
    try {
      setSubmittingEdit(true);
      const userId = editTargetUser.id || editTargetUser._id;
      const res = await adminService.updateUser(userId, editForm);
      setSuccessMsg(res?.message || 'Cập nhật thông tin người dùng thành công.');
      setEditTargetUser(null);
      fetchUsers(pagination.page);
    } catch (err) {
      alert(err.response?.data?.message || 'Không thể cập nhật thông tin.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="admin-users-page">
      {/* Header & Provision Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Quản lý Tài khoản & Phân quyền
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Cấp tài khoản Chủ sân (Owner), kiểm soát trạng thái khóa tài khoản và quản trị danh tính người dùng (ADM-01, ADM-02).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowProvisionModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition shadow-sm w-fit"
          data-testid="btn-open-provision-modal"
        >
          <UserPlus className="w-4 h-4" />
          <span>Cấp tài khoản Chủ sân (Owner)</span>
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
              placeholder="Tìm theo họ tên, email hoặc số điện thoại..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
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

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium">
            <Filter className="w-3.5 h-3.5" />
            <span>Vai trò:</span>
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Tất cả vai trò</option>
            <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
            <option value="OWNER">Chủ sân (OWNER)</option>
            <option value="ADMIN">Quản trị viên (ADMIN)</option>
          </select>

          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium ml-2">
            <span>Trạng thái:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Tất cả</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Bị khóa</option>
          </select>

          <button
            type="button"
            onClick={() => fetchUsers(pagination.page)}
            className="p-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 transition"
            title="Tải lại"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Người dùng</th>
                <th className="py-3 px-4">Email & Xác minh</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4">Vai trò</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-500" />
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    Không tìm thấy người dùng phù hợp với tiêu chí lọc.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const uid = u.id || u._id;
                  const isActionLoading = actionLoadingId === uid;
                  const isOwnerUnactivated = u.role === 'OWNER' && !u.activatedAt;

                  return (
                    <tr key={uid} className="hover:bg-slate-50/70 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center space-x-2">
                          <span>{u.fullName}</span>
                          {u.role === 'ADMIN' && (
                            <span className="p-0.5 bg-purple-100 text-purple-700 rounded text-[10px]" title="Quản trị viên">
                              <ShieldCheck className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Email & Verification */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-700">{u.email}</span>
                          <span className="text-[10px] mt-0.5">
                            {u.emailVerifiedAt ? (
                              <span className="text-emerald-600 font-semibold inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Đã xác minh</span>
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold inline-flex items-center space-x-1">
                                <Clock className="w-3 h-3" />
                                <span>Chưa xác minh email</span>
                              </span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-slate-700">{u.phoneNumber || '—'}</td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        {u.role === 'ADMIN' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                            ADMIN
                          </span>
                        )}
                        {u.role === 'OWNER' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            OWNER
                          </span>
                        )}
                        {u.role === 'CUSTOMER' && (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                            CUSTOMER
                          </span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {u.isLocked ? (
                          <div className="inline-flex flex-col">
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 w-fit">
                              <Lock className="w-3 h-3" />
                              <span>Bị khóa</span>
                            </span>
                            {u.lockReason && (
                              <span className="text-[10px] text-rose-600 italic mt-0.5 max-w-xs truncate" title={u.lockReason}>
                                Lý do: {u.lockReason}
                              </span>
                            )}
                          </div>
                        ) : isOwnerUnactivated ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-fit">
                            <Clock className="w-3 h-3" />
                            <span>Chờ kích hoạt</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 w-fit">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Hoạt động</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center space-x-1.5 justify-end">
                          {/* Sửa thông tin liên hệ */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditTargetUser(u);
                              setEditForm({ fullName: u.fullName || '', phoneNumber: u.phoneNumber || '' });
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            title="Chỉnh sửa họ tên & SĐT"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Resend Invitation (Chỉ dành cho Owner chưa kích hoạt) */}
                          {isOwnerUnactivated && (
                            <button
                              type="button"
                              onClick={() => handleResendInvitation(u)}
                              disabled={isActionLoading}
                              className="px-2 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition inline-flex items-center space-x-1"
                              title="Gửi lại email mời kích hoạt"
                            >
                              <Mail className="w-3 h-3" />
                              <span>Gửi lại mời</span>
                            </button>
                          )}

                          {/* Reset Password Link (Không áp dụng cho tài khoản bị khóa hoặc Owner chưa kích hoạt) */}
                          {!u.isLocked && (!isOwnerUnactivated || u.role !== 'OWNER') && (
                            <button
                              type="button"
                              onClick={() => handleTriggerResetPassword(u)}
                              disabled={isActionLoading}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                              title="Gửi email đặt lại mật khẩu"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Khóa / Mở khóa tài khoản */}
                          {u.role === 'ADMIN' ? (
                            <span className="text-[10px] text-slate-400 italic px-1.5">Không thể khóa Admin</span>
                          ) : u.isLocked ? (
                            <button
                              type="button"
                              onClick={() => {
                                setUnlockTargetUser(u);
                                setUnlockReason('Quản trị viên mở khóa tài khoản');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition inline-flex items-center space-x-1"
                            >
                              <Unlock className="w-3 h-3" />
                              <span>Mở khóa</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setLockTargetUser(u);
                                setLockReason('');
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition inline-flex items-center space-x-1"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Khóa</span>
                            </button>
                          )}
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
              {pagination.total} tài khoản)
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Cấp tài khoản Owner (ADM-01) */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-brand-600">
                <UserPlus className="w-5 h-5" />
                <h2 className="text-base font-bold text-slate-900">Cấp tài khoản Chủ sân (Owner)</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-4 p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Quy tắc cấp tài khoản (ADM-01):</strong> Sau khi thống nhất bên ngoài hệ thống, Admin cấp tài
                khoản tại đây. Hệ thống sẽ tạo tài khoản <code>OWNER</code> chưa kích hoạt và gửi email mời kèm liên kết
                hiệu lực <strong>24 giờ</strong> để Chủ sân tự xác nhận email và tự đặt mật khẩu đầu tiên. Không dùng mật
                khẩu mặc định.
              </div>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên chủ sân <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Chủ Sân"
                  value={provisionForm.fullName}
                  onChange={(e) => setProvisionForm({ ...provisionForm, fullName: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email liên hệ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@domain.com"
                  value={provisionForm.email}
                  onChange={(e) => setProvisionForm({ ...provisionForm, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0912345678"
                  value={provisionForm.phoneNumber}
                  onChange={(e) => setProvisionForm({ ...provisionForm, phoneNumber: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  disabled={submittingProvision}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingProvision}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
                >
                  {submittingProvision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{submittingProvision ? 'Đang cấp tài khoản...' : 'Xác nhận cấp Owner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Khóa tài khoản (bắt buộc nhập lý do - ADM-02) */}
      {lockTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center space-x-2 text-rose-600 border-b border-slate-100 pb-3">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">Xác nhận Khóa tài khoản</h2>
            </div>

            <div className="my-3 text-xs text-slate-600 space-y-2">
              <p>
                Bạn đang chuẩn bị khóa tài khoản của <strong>{lockTargetUser.fullName}</strong> ({lockTargetUser.email}).
              </p>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-1">
                <p className="font-bold">Hệ quả kỹ thuật:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Toàn bộ phiên đăng nhập đang hoạt động sẽ bị thu hồi ngay lập tức.</li>
                  <li>Nếu là Chủ sân, các cơ sở của chủ sân sẽ tạm ngừng nhận đơn đặt mới.</li>
                  <li>Gửi email thông báo tạm khóa tài khoản kèm lý do.</li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Lý do khóa tài khoản <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                required
                placeholder="Nhập lý do chi tiết để lưu audit log và gửi trong email..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setLockTargetUser(null)}
                disabled={submittingLock}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLock}
                disabled={submittingLock || !lockReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
              >
                {submittingLock ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                <span>{submittingLock ? 'Đang khóa...' : 'Xác nhận khóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Mở khóa tài khoản */}
      {unlockTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center space-x-2 text-emerald-600 border-b border-slate-100 pb-3">
              <Unlock className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900">Mở khóa tài khoản</h2>
            </div>

            <div className="my-3 text-xs text-slate-600 space-y-2">
              <p>
                Xác nhận mở khóa tài khoản cho <strong>{unlockTargetUser.fullName}</strong> ({unlockTargetUser.email})?
              </p>
              <p className="text-slate-500 text-[11px]">
                Người dùng sẽ có thể đăng nhập lại bình thường. Các phiên đăng nhập cũ không được tự động phục hồi.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Ghi chú / Lý do mở khóa</label>
              <input
                type="text"
                placeholder="Quản trị viên mở khóa tài khoản..."
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setUnlockTargetUser(null)}
                disabled={submittingUnlock}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlock}
                disabled={submittingUnlock}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition inline-flex items-center space-x-1.5 shadow-sm"
              >
                {submittingUnlock ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                <span>{submittingUnlock ? 'Đang mở khóa...' : 'Xác nhận mở khóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Chỉnh sửa thông tin liên hệ (ADM-02: Không sửa email/vai trò) */}
      {editTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2 text-slate-800">
                <Edit2 className="w-4 h-4 text-brand-600" />
                <h2 className="text-base font-bold">Chỉnh sửa thông tin liên hệ</h2>
              </div>
              <button type="button" onClick={() => setEditTargetUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs">
              <strong>Chính sách ADM-02:</strong> Không cho phép sửa đổi email hoặc vai trò trực tiếp để bảo vệ tính toàn
              vẹn danh tính và xác thực tài khoản.
            </div>

            <form onSubmit={handleConfirmEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email (Cố định)</label>
                <input
                  type="text"
                  disabled
                  value={editTargetUser.email}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số điện thoại <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={editForm.phoneNumber}
                  onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditTargetUser(null)}
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
                  <span>{submittingEdit ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;
