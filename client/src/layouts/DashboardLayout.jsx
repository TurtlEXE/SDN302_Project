import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  Dumbbell,
  LayoutDashboard,
  Users,
  Building2,
  CalendarCheck,
  CalendarX,
  UserPlus,
  Receipt,
  Mail,
  User,
  LogOut,
  Globe,
  Menu,
  X,
  Shield,
  Store,
} from 'lucide-react';

export function DashboardLayout() {
  const { user, role, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminNav = [
    { name: 'Tổng quan hệ thống', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Quản lý tài khoản', path: '/admin/users', icon: Users },
    { name: 'Danh mục môn thể thao', path: '/admin/sports', icon: Dumbbell },
    { name: 'Hồ sơ hoàn tiền', path: '/admin/refunds', icon: Receipt },
    { name: 'Hộp thư Outbox', path: '/admin/email-outbox', icon: Mail },
  ];

  const ownerNav = [
    { name: 'Tổng quan doanh thu', path: '/owner/dashboard', icon: LayoutDashboard },
    { name: 'Cơ sở & Slot bước giờ', path: '/owner/facilities', icon: Building2 },
    { name: 'Khóa lịch bảo trì', path: '/owner/court-blocks', icon: CalendarX },
    { name: 'Quản lý đơn đặt sân', path: '/owner/bookings', icon: CalendarCheck },
    { name: 'Đặt sân hộ vãng lai', path: '/owner/on-behalf', icon: UserPlus },
  ];

  const navItems = role === 'ADMIN' ? adminNav : ownerNav;

  return (
    <div className="min-h-screen bg-slate-100 flex text-slate-800">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-64 bg-slate-900 text-white z-50 flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo & Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
            <Link to="/" className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center text-white font-bold">
                <Dumbbell className="w-4 h-4" />
              </div>
              <span className="font-bold text-base text-white">
                Sport<span className="text-brand-400">Booking</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Role Badge Info */}
          <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-950/40">
            <div className="flex items-center space-x-2">
              {role === 'ADMIN' ? (
                <Shield className="w-4 h-4 text-amber-400" />
              ) : (
                <Store className="w-4 h-4 text-brand-400" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                {role === 'ADMIN' ? 'Hệ thống Quản trị' : 'Cổng Chủ sân'}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 mt-1 truncate">{user?.fullName}</p>
          </div>

          {/* Nav Items */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-slate-800 space-y-1">
          <Link
            to="/"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>Trang người dùng</span>
          </Link>
          <Link
            to="/profile"
            className="flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          >
            <User className="w-4 h-4" />
            <span>Tài khoản cá nhân</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-slate-700 hidden sm:inline">
              {role === 'ADMIN' ? 'Bảng Điều Khiển Quản Trị Viên' : 'Bảng Vận Hành Cơ Sở Thể Thao'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-900">{user?.fullName}</p>
              <p className="text-[11px] text-slate-500">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
              {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

