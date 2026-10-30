import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export function ForbiddenPage() {
  const { role } = useAuth();

  const homeLink = role === 'ADMIN' ? '/admin/dashboard' : role === 'OWNER' ? '/owner/dashboard' : '/';

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center py-16 px-4 sm:px-6">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 text-amber-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">403</h1>
        <h2 className="text-base font-bold text-slate-800">Truy cập bị từ chối</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Tài khoản của bạn không có đủ thẩm quyền để truy cập vào phân vùng tài nguyên này.
        </p>
        <div className="pt-2 flex items-center justify-center space-x-3">
          <Link
            to={homeLink}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Home className="w-4 h-4" />
            <span>Về trang chủ của bạn</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Đăng nhập tài khoản khác</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

