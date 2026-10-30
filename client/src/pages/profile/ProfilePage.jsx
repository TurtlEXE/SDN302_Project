import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { authService } from '../../services/auth.service.js';
import {
  User,
  Shield,
  KeyRound,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export function ProfilePage() {
  const { user, role, updateProfile, logoutAll } = useAuth();

  // Profile update state
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Change password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  // Logout all state
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const [logoutAllConfirm, setLogoutAllConfirm] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    if (!fullName.trim()) {
      setProfileError('Họ và tên không được để trống.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
      });
      setProfileSuccess('Cập nhật thông tin cá nhân thành công.');
    } catch (err) {
      setProfileError(err.message || 'Không thể cập nhật thông tin.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu mới và mật khẩu xác nhận không khớp.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword({ oldPassword, newPassword });
      setPasswordSuccess('Đổi mật khẩu thành công.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogoutAll = async () => {
    setIsLoggingOutAll(true);
    try {
      await logoutAll();
      window.location.href = '/login';
    } catch (err) {
      alert(err.message || 'Lỗi khi đăng xuất tất cả phiên.');
      setIsLoggingOutAll(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hồ sơ cá nhân</h1>
        <p className="text-xs text-slate-500 mt-1">
          Quản lý thông tin tài khoản, mật khẩu và phiên đăng nhập bảo mật
        </p>
      </div>

      {/* Account Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl shadow-inner">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{user?.fullName}</h2>
              <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-600" />
              <span>Vai trò: {role}</span>
            </span>
          </div>
        </div>

        {/* Profile Update Form */}
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
            <User className="w-4 h-4 text-brand-600" />
            <span>Thông tin liên hệ</span>
          </h3>

          {profileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Họ và tên *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Số điện thoại
              </label>
              <div className="relative">
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0912345678"
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition pl-10"
                />
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60"
            >
              {isUpdatingProfile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>Lưu thay đổi</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center space-x-2">
          <KeyRound className="w-4 h-4 text-brand-600" />
          <span>Đổi mật khẩu tài khoản</span>
        </h3>

        {passwordSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition max-w-md"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu mới (Tối thiểu 8 ký tự)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Xác nhận mật khẩu mới
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 transition"
              />
            </div>
          </div>

          <div className="flex justify-start pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition disabled:opacity-60"
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Đổi mật khẩu</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security & Multi-Session Revocation Card */}
      <div className="bg-white rounded-2xl border border-red-100 shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-semibold text-red-900 flex items-center space-x-2">
          <Shield className="w-4 h-4 text-red-600" />
          <span>Bảo mật & Quản lý phiên</span>
        </h3>

        <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
          Nền tảng áp dụng kiến trúc bảo mật không lưu token trong trình duyệt (JWT RAM). Trong trường hợp
          bạn nghi ngờ tài khoản bị lộ hoặc quên đăng xuất trên thiết bị lạ, bạn có thể thực hiện thu hồi
          ngay lập tức toàn bộ phiên đăng nhập trên tất cả thiết bị.
        </p>

        {logoutAllConfirm ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-red-900">
              Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị?
            </p>
            <p className="text-[11px] text-red-700">
              Mọi phiên làm việc trên các trình duyệt và thiết bị khác sẽ bị chấm dứt ngay lập tức.
            </p>
            <div className="flex items-center space-x-3 pt-1">
              <button
                type="button"
                onClick={handleLogoutAll}
                disabled={isLoggingOutAll}
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition disabled:opacity-60 flex items-center space-x-1.5"
              >
                {isLoggingOutAll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Đồng ý đăng xuất tất cả</span>
              </button>
              <button
                type="button"
                onClick={() => setLogoutAllConfirm(false)}
                className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition"
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setLogoutAllConfirm(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất khỏi tất cả thiết bị</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

