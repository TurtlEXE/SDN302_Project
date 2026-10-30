import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { apiClient, ApiError } from '../api-client.js';
import { tokenMemory } from '../token-memory.js';

describe('ApiClient & Single-Flight Refresh Mutex (P15)', () => {
  beforeEach(() => {
    tokenMemory.clearToken();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should attach Bearer token and X-CSRF-Guard on mutation requests', async () => {
    tokenMemory.setToken('jwt_ram_token_abc');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { status: 'ok' } }),
    });
    global.fetch = mockFetch;

    await apiClient.post('/auth/change-password', { newPassword: 'abc' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, config] = mockFetch.mock.calls[0];

    expect(url).toBe('/api/v1/auth/change-password');
    expect(config.credentials).toBe('include');
    expect(config.headers['Authorization']).toBe('Bearer jwt_ram_token_abc');
    expect(config.headers['X-CSRF-Guard']).toBe('1');
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('should NOT attach X-CSRF-Guard on safe GET requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
    });
    global.fetch = mockFetch;

    await apiClient.get('/facilities');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, config] = mockFetch.mock.calls[0];
    expect(config.headers['X-CSRF-Guard']).toBeUndefined();
    expect(config.credentials).toBe('include');
  });

  it('should perform single-flight refresh when receiving 401 and replay queued requests', async () => {
    tokenMemory.setToken('expired_token_1');

    let refreshCallCount = 0;

    const mockFetch = vi.fn().mockImplementation((url, config) => {
      // Refresh endpoint call
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { accessToken: 'new_fresh_token_999' },
          }),
        });
      }

      // Initial call with expired token returns 401
      if (config.headers['Authorization'] === 'Bearer expired_token_1') {
        return Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          json: async () => ({
            success: false,
            error: { code: 'TOKEN_EXPIRED', message: 'Token expired' },
          }),
        });
      }

      // Replayed call with new token returns 200
      if (config.headers['Authorization'] === 'Bearer new_fresh_token_999') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { resource: url },
          }),
        });
      }

      return Promise.reject(new Error('Unexpected call'));
    });

    global.fetch = mockFetch;

    // Fire 3 simultaneous API calls that get 401
    const [res1, res2, res3] = await Promise.all([
      apiClient.get('/users/me'),
      apiClient.get('/facilities'),
      apiClient.get('/sports'),
    ]);

    // Exactly 1 refresh call was made
    expect(refreshCallCount).toBe(1);

    // All 3 requests replayed successfully with the new token
    expect(res1.data.resource).toBe('/api/v1/users/me');
    expect(res2.data.resource).toBe('/api/v1/facilities');
    expect(res3.data.resource).toBe('/api/v1/sports');

    // Token memory now has the refreshed token
    expect(tokenMemory.getToken()).toBe('new_fresh_token_999');
  });

  it('should NOT attempt to refresh token on 403 Forbidden errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Không có quyền' },
      }),
    });
    global.fetch = mockFetch;

    await expect(apiClient.get('/admin/dashboard')).rejects.toThrow(ApiError);
    // Only 1 request made, NO refresh call attempted
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).not.toContain('/auth/refresh');
  });
});

