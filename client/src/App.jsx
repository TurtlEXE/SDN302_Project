import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from './layouts/PublicLayout.jsx';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';
import { ProtectedRoute, RoleRoute, PublicOnlyRoute } from './components/auth/RouteGuards.jsx';

// Pages
import { HomePage } from './pages/home/HomePage.jsx';
import { LoginPage } from './pages/auth/LoginPage.jsx';
import { RegisterPage } from './pages/auth/RegisterPage.jsx';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage.jsx';
import { ActivateOwnerPage } from './pages/auth/ActivateOwnerPage.jsx';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage.jsx';
import { ProfilePage } from './pages/profile/ProfilePage.jsx';
import { FacilitiesPage } from './pages/facility/FacilitiesPage.jsx';
import { FacilityDetailPage } from './pages/facility/FacilityDetailPage.jsx';
import { CheckoutPage } from './pages/checkout/CheckoutPage.jsx';
import { PaymentResultPage } from './pages/payment/PaymentResultPage.jsx';
import { GuestPayPage } from './pages/payment/GuestPayPage.jsx';
import { MyBookingsPage } from './pages/booking/MyBookingsPage.jsx';
import { BookingDetailPage } from './pages/booking/BookingDetailPage.jsx';
import { ForbiddenPage } from './pages/error/ForbiddenPage.jsx';
import { NotFoundPage } from './pages/error/NotFoundPage.jsx';
import { DashboardPlaceholderPage } from './pages/dashboard/DashboardPlaceholderPage.jsx';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage.jsx';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.jsx';
import { AdminSportsPage } from './pages/admin/AdminSportsPage.jsx';
import { AdminRefundsPage } from './pages/admin/AdminRefundsPage.jsx';
import { AdminEmailOutboxPage } from './pages/admin/AdminEmailOutboxPage.jsx';
import { OwnerDashboardPage } from './pages/owner/OwnerDashboardPage.jsx';
import { OwnerFacilitiesPage } from './pages/owner/OwnerFacilitiesPage.jsx';
import { OwnerCourtBlocksPage } from './pages/owner/OwnerCourtBlocksPage.jsx';
import { OwnerBookingsPage } from './pages/owner/OwnerBookingsPage.jsx';
import { OwnerOnBehalfPage } from './pages/owner/OwnerOnBehalfPage.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public / Customer Routes */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/facilities" element={<FacilitiesPage />} />
        <Route path="/facilities/:id" element={<FacilityDetailPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/result" element={<PaymentResultPage />} />
        <Route path="/guest-pay/:paymentOrderId" element={<GuestPayPage />} />

        {/* Auth routes for unauthenticated users */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/activate-owner" element={<ActivateOwnerPage />} />

        {/* Authenticated Customer routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-bookings" element={<MyBookingsPage />} />
          <Route path="/my-bookings/:id" element={<BookingDetailPage />} />
        </Route>
      </Route>

      {/* Admin Dashboard Routes (P19) */}
      <Route
        path="/admin"
        element={
          <RoleRoute allowedRoles={['ADMIN']}>
            <DashboardLayout />
          </RoleRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboardPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="sports" element={<AdminSportsPage />} />
        <Route path="refunds" element={<AdminRefundsPage />} />
        <Route path="email-outbox" element={<AdminEmailOutboxPage />} />
      </Route>

      {/* Owner Dashboard Routes */}
      <Route
        path="/owner"
        element={
          <RoleRoute allowedRoles={['OWNER']}>
            <DashboardLayout />
          </RoleRoute>
        }
      >
        <Route path="dashboard" element={<OwnerDashboardPage />} />
        <Route path="facilities" element={<OwnerFacilitiesPage />} />
        <Route path="court-blocks" element={<OwnerCourtBlocksPage />} />
        <Route path="bookings" element={<OwnerBookingsPage />} />
        <Route path="on-behalf" element={<OwnerOnBehalfPage />} />
      </Route>

      {/* Error & Fallback Routes */}
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

