import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext.jsx';
import { authService } from '../../services/auth.service.js';

function TestConsumer() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>
      {user && <div data-testid="user-name">{user.fullName}</div>}
      <button
        onClick={() => login({ email: 'test@sportbooking.local', password: 'Password123!' })}
      >
        Trigger Login
      </button>
      <button onClick={() => logout()}>Trigger Logout</button>
    </div>
  );
}

describe('AuthContext & AuthProvider (P15)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should bootstrap session on mount and render children when refresh succeeds', async () => {
    vi.spyOn(authService, 'refresh').mockResolvedValue({
      user: { id: 'u1', fullName: 'Nguyen Van A', role: 'CUSTOMER' },
      accessToken: 'token_123',
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    const authStatus = await screen.findByTestId('auth-status');
    expect(authStatus.textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('user-name').textContent).toBe('Nguyen Van A');
  });

  it('should bootstrap gracefully as anonymous when refresh fails (no active session)', async () => {
    vi.spyOn(authService, 'refresh').mockRejectedValue(new Error('No refresh cookie'));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    const authStatus = await screen.findByTestId('auth-status');
    expect(authStatus.textContent).toBe('ANONYMOUS');
    expect(screen.queryByTestId('user-name')).not.toBeInTheDocument();
  });

  it('should handle login and logout transitions properly', async () => {
    vi.spyOn(authService, 'refresh').mockRejectedValue(new Error('No session'));
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: { id: 'u2', fullName: 'Chủ Sân Pro', role: 'OWNER' },
      accessToken: 'owner_token',
    });
    vi.spyOn(authService, 'logout').mockResolvedValue({});

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    );

    await screen.findByTestId('auth-status');

    // Trigger login
    await act(async () => {
      screen.getByText('Trigger Login').click();
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('AUTHENTICATED');
    expect(screen.getByTestId('user-name').textContent).toBe('Chủ Sân Pro');

    // Trigger logout
    await act(async () => {
      screen.getByText('Trigger Logout').click();
    });

    expect(screen.getByTestId('auth-status').textContent).toBe('ANONYMOUS');
  });
});

