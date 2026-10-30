import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  CalendarCheck2,
  ShieldCheck,
  CreditCard,
  Clock,
  ArrowRight,
  Flame,
  Award,
} from 'lucide-react';

export function HomePage() {
  const { isAuthenticated, user, role } = useAuth();

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/50 via-white to-slate-50 pt-16 pb-20 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-100 text-brand-800 text-xs font-semibold">
            <Flame className="w-3.5 h-3.5 text-brand-600" />
            <span>Nền tảng đặt sân thể thao trực tuyến #1</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-4xl mx-auto leading-tight">
            Đặt sân thể thao <span className="text-brand-600">nhanh chóng</span>, thanh toán{' '}
            <span className="text-brand-600">an toàn</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Hệ thống quản lý lịch sân thông minh theo thời gian thực. Loại bỏ 100% tình trạng trùng
            lịch, bảo vệ quyền lợi người chơi với cổng thanh toán VNPay.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/facilities"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/25 transition-all active:scale-[0.98] w-full sm:w-auto"
            >
              <span>Tìm kiếm & Đặt sân ngay</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            {!isAuthenticated ? (
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-sm shadow-sm transition w-full sm:w-auto"
              >
                Đăng ký tài khoản miễn phí
              </Link>
            ) : (
              <Link
                to={role === 'CUSTOMER' ? '/my-bookings' : role === 'ADMIN' ? '/admin/dashboard' : '/owner/dashboard'}
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-sm shadow-sm transition w-full sm:w-auto"
              >
                {role === 'CUSTOMER' ? 'Xem đơn đặt của tôi' : 'Vào Bảng quản trị'}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-slate-900">Tính năng vượt trội</h2>
          <p className="text-xs text-slate-500 mt-1">Được thiết kế phục vụ tối đa người chơi và chủ sân</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <CalendarCheck2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Khóa lịch Atomic độc quyền</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thuật toán kiểm soát khoảng thời gian liên tục và giao dịch MongoDB ACID giúp triệt tiêu
              hoàn toàn nguy cơ hai người đặt cùng một khung giờ.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">VNPay Thanh toán 100%</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Thanh toán an toàn qua VNPAY-QR, thẻ ATM hoặc thẻ quốc tế. Xác thực chữ ký số HMAC SHA-512
              đảm bảo minh bạch tài chính.
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Bảo mật chuẩn JWT RAM</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Access Token được cô lập hoàn toàn trong RAM, bảo vệ người dùng trước các cuộc tấn công
              XSS và rò rỉ bộ nhớ trình duyệt.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

