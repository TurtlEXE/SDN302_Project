import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.service.js';
import { tokenMemory } from '../services/token-memory.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Bootstrap silent session on page reload / startup
   */
  useEffect(() => {
    let isMounted = true;

    async function bootstrapAuth() {
      try {
        const { user: refreshedUser } = await authService.refresh();
        if (isMounted && refreshedUser) {
          setUser(refreshedUser);
        }
      } catch {
        // Silent failure: user is unauthenticated or cookie expired
        if (isMounted) {
          setUser(null);
          tokenMemory.clearToken();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrapAuth();

    // Multi-tab sync listener
    const unsubscribe = tokenMemory.onBroadcast((event) => {
      if (event.type === 'LOGOUT' || event.type === 'SESSION_REVOKED') {
        setUser(null);
        tokenMemory.clearToken();
      } else if (event.type === 'LOGIN' && event.payload?.user) {
        setUser(event.payload.user);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setAuthError(null);
    try {
      const { user: loggedInUser } = await authService.login({ email, password });
      setUser(loggedInUser);
      return loggedInUser;
    } catch (err) {
      setAuthError(err.message || 'Đăng nhập không thành công.');
      throw err;
    }
  }, []);

  const register = useCallback(async (payload) => {
    setAuthError(null);
    try {
      const data = await authService.register(payload);
      return data;
    } catch (err) {
      setAuthError(err.message || 'Đăng ký tài khoản không thành công.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setAuthError(null);
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await authService.logoutAll();
    } finally {
      setUser(null);
      setAuthError(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const freshUser = await authService.getMe();
      setUser(freshUser);
      return freshUser;
    } catch (err) {
      if (err.statusCode === 401) {
        setUser(null);
      }
      throw err;
    }
  }, []);

  const updateProfile = useCallback(async ({ fullName, phoneNumber }) => {
    const updated = await authService.updateProfile({ fullName, phoneNumber });
    setUser(updated);
    return updated;
  }, []);

  const clearError = useCallback(() => {
    setAuthError(null);
  }, []);

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    login,
    register,
    logout,
    logoutAll,
    refreshProfile,
    updateProfile,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

