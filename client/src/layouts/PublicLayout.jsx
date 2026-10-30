import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  Dumbbell,
  Menu,
  X,
  User,
  LogOut,
  Calendar,
  LayoutDashboard,
  ChevronDown,
} from 'lucide-react';

export function PublicLayout() {
  const { user, isAuthenticated, role, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    setProfileDropdownOpen(false);
    await logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (role === 'ADMIN') return '/admin/dashboard';
    if (role === 'OWNER') return '/owner/dashboard';
    return '/profile';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-sm shadow-brand-500/20">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg leading-tight tracking-tight text-slate-900">
                  Sport<span className="text-brand-600">Booking</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  Sân thể thao thông minh
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
              >
                Trang chủ
              </Link>
              <Link
                to="/facilities"
                className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
              >
                Tìm sân thể thao
              </Link>
              {isAuthenticated && role === 'CUSTOMER' && (
                <Link
                  to="/my-bookings"
                  className="text-sm font-medium text-slate-700 hover:text-brand-600 transition-colors"
                >
                  Đơn đặt của tôi
                </Link>
              )}
            </nav>

            {/* Auth Actions */}
            <div className="hidden md:flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center space-x-3 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-sm font-medium transition shadow-sm"
                  >
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                      {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <span className="max-w-[120px] truncate">{user?.fullName}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {user?.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-semibold bg-brand-50 text-brand-700 rounded">
                          {role}
                        </span>
                      </div>

                      {role !== 'CUSTOMER' && (
                        <Link
                          to={getDashboardLink()}
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center space-x-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <LayoutDashboard className="w-4 h-4 text-slate-400" />
                          <span>Bảng quản trị</span>
                        </Link>
                      )}

                      <Link
                        to="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center space-x-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>Hồ sơ cá nhân</span>
                      </Link>

                      {role === 'CUSTOMER' && (
                        <Link
                          to="/my-bookings"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center space-x-2 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span>Đơn đặt của tôi</span>
                        </Link>
                      )}

                      <div className="border-t border-slate-100 my-1"></div>

                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left flex items-center space-x-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-3">
                  <Link
                    to="/login"
                    className="text-sm font-semibold text-slate-700 hover:text-brand-600 px-3.5 py-2 transition"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-4 py-2 rounded-lg shadow-sm shadow-brand-500/20 transition-all active:scale-[0.98]"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Trang chủ
            </Link>
            <Link
              to="/facilities"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Tìm sân thể thao
            </Link>

            {isAuthenticated ? (
              <div className="pt-2 border-t border-slate-100 space-y-1">
                <div className="px-3 py-1 text-xs text-slate-500">
                  Đăng nhập: <strong className="text-slate-900">{user?.fullName}</strong> ({role})
                </div>
                {role !== 'CUSTOMER' && (
                  <Link
                    to={getDashboardLink()}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-3 py-2 rounded-md text-sm font-medium text-brand-600 hover:bg-brand-50"
                  >
                    Bảng quản trị
                  </Link>
                )}
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-3 py-2 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Hồ sơ cá nhân
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Đăng xuất
                </button>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 flex flex-col space-y-2">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-center px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block text-center px-4 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-lg shadow-sm"
                >
                  Đăng ký tài khoản
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-10 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                  <Dumbbell className="w-4 h-4" />
                </div>
                <span className="font-bold text-base text-slate-900">SportBooking</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                Nền tảng kết nối người chơi và hệ thống sân bãi thể thao hiện đại hàng đầu. Đặt sân
                nhanh chóng, thanh toán an toàn và bảo mật tối đa qua VNPay.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Liên kết nhanh
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>
                  <Link to="/" className="hover:text-brand-600">
                    Trang chủ
                  </Link>
                </li>
                <li>
                  <Link to="/facilities" className="hover:text-brand-600">
                    Tìm kiếm sân
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-brand-600">
                    Dành cho Chủ sân
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Hỗ trợ & Bảo mật
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                <li>Bảo mật tài khoản & thông tin cá nhân</li>
                <li>Thanh toán trực tuyến an toàn qua VNPay</li>
                <li>Hỗ trợ khách hàng: 08:00 - 22:00 hàng ngày</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
            <p>© 2026 SportBooking Platform. All rights reserved.</p>
            <p className="mt-2 sm:mt-0">Nền tảng đặt sân thể thao trực tuyến tin cậy</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

