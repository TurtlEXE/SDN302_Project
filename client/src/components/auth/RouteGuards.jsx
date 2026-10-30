import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { Loader2 } from 'lucide-react';

export function LoadingScreen({ message = 'Đang tải dữ liệu...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600">
      <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

/**
 * Requires authentication. If unauthenticated, redirects to /login saving attempted path.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Đang kiểm tra trạng thái đăng nhập..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}

/**
 * Requires specific user role. If mismatch, redirects to /403.
 */
export function RoleRoute({ allowedRoles = [], children }) {
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Đang kiểm tra quyền truy cập..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return children ? children : <Outlet />;
}

/**
 * For unauthenticated pages (Login, Register).
 * If already logged in, redirects to their corresponding role home.
 */
export function PublicOnlyRoute({ children }) {
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    // Check if there was an intended redirect destination
    const fromPath = location.state?.from?.pathname;
    if (fromPath && fromPath !== '/login' && fromPath !== '/register') {
      return <Navigate to={fromPath} replace />;
    }

    if (role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (role === 'OWNER') {
      return <Navigate to="/owner/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children ? children : <Outlet />;
}

