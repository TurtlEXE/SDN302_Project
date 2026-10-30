import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, RoleRoute, PublicOnlyRoute } from '../RouteGuards.jsx';
import * as AuthContextModule from '../../../contexts/AuthContext.jsx';

describe('RouteGuards Component (P15)', () => {
  it('ProtectedRoute should allow authenticated users to view content', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { fullName: 'Nguyen Van A', role: 'CUSTOMER' },
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content Visible</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content Visible')).toBeInTheDocument();
  });

  it('ProtectedRoute should redirect unauthenticated users to /login', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Login Page Target')).toBeInTheDocument();
  });

  it('RoleRoute should allow matching role and block unauthorized roles to /403', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'CUSTOMER',
      user: { fullName: 'Customer A', role: 'CUSTOMER' },
    });

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <RoleRoute allowedRoles={['ADMIN']}>
                <div>Admin Dashboard Content</div>
              </RoleRoute>
            }
          />
          <Route path="/403" element={<div>403 Forbidden Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Admin Dashboard Content')).not.toBeInTheDocument();
    expect(screen.getByText('403 Forbidden Target')).toBeInTheDocument();
  });

  it('PublicOnlyRoute should redirect logged-in Admin to /admin/dashboard', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      role: 'ADMIN',
      user: { fullName: 'Admin Root', role: 'ADMIN' },
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <div>Login Form</div>
              </PublicOnlyRoute>
            }
          />
          <Route path="/admin/dashboard" element={<div>Admin Home Target</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Login Form')).not.toBeInTheDocument();
    expect(screen.getByText('Admin Home Target')).toBeInTheDocument();
  });
});

