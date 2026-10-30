import React from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { LayoutDashboard, CheckCircle2, Shield, Store } from 'lucide-react';

export function DashboardPlaceholderPage({ title, description }) {
  const { user, role } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
            <LayoutDashboard className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs text-slate-600">
          <div className="flex items-center space-x-2 font-semibold text-slate-800">
            {role === 'ADMIN' ? (
              <Shield className="w-4 h-4 text-amber-500" />
            ) : (
              <Store className="w-4 h-4 text-brand-600" />
            )}
            <span>Phiên làm việc xác thực: {user?.fullName} ({user?.email})</span>
          </div>
          <p>
            Phân quyền: <span className="font-semibold text-slate-900">{role}</span>. Nền tảng xác thực
            JWT trong RAM và kiểm soát phân quyền RouteGuard đã hoạt động ổn định.
          </p>
        </div>
      </div>
    </div>
  );
}

