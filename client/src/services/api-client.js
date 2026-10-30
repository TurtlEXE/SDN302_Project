import { tokenMemory } from './token-memory.js';

export class ApiError extends Error {
  constructor(message, statusCode, code, details = []) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Custom fetch client with in-memory token, CSRF protection, and single-flight refresh mutex
 */
class ApiClient {
  constructor(baseUrl = '/api/v1') {
    this.baseUrl = baseUrl;
  }

  /**
   * Helper to format headers
   */
  _buildHeaders(customHeaders = {}, method = 'GET', isFormData = false) {
    const headers = { ...customHeaders };

    // Set JSON content-type if not multipart form-data
    if (!isFormData && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    // Attach in-memory Access Token if available
    const token = tokenMemory.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Attach X-CSRF-Guard on mutations (POST, PUT, PATCH, DELETE)
    const upperMethod = method.toUpperCase();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(upperMethod) && !headers['X-CSRF-Guard']) {
      headers['X-CSRF-Guard'] = '1';
    }

    return headers;
  }

  /**
   * Perform raw fetch with credentials: 'include'
   */
  async request(endpoint, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body,
      isFormData = false,
      _retry = false,
      ...customConfig
    } = options;

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const requestHeaders = this._buildHeaders(headers, method, isFormData);

    const config = {
      method,
      headers: requestHeaders,
      credentials: 'include', // Always send and receive HttpOnly cookies
      ...customConfig,
    };

    if (body !== undefined) {
      config.body = isFormData ? body : typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, config);

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      const data = await response.json().catch(() => ({}));

      // Handle successful responses (2xx)
      if (response.ok) {
        return data;
      }

      // 401 Unauthorized handling & Single-Flight Refresh Mutex
      const isAuthRefreshEndpoint = endpoint.includes('/auth/refresh') || endpoint.includes('/auth/login');
      const isTokenExpired = response.status === 401 && !isAuthRefreshEndpoint;

      if (isTokenExpired && !_retry) {
        if (isRefreshing) {
          // Wait for active refresh to finish then retry
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((newToken) => {
              return this.request(endpoint, {
                ...options,
                _retry: true,
                headers: { ...headers, Authorization: `Bearer ${newToken}` },
              });
            })
            .catch((err) => Promise.reject(err));
        }

        isRefreshing = true;

        try {
          // Call refresh endpoint once
          const refreshRes = await this.post('/auth/refresh', {}, { _retry: true });
          const newAccessToken = refreshRes?.data?.accessToken;

          if (newAccessToken) {
            tokenMemory.setToken(newAccessToken);
            processQueue(null, newAccessToken);

            // Replay original request
            return this.request(endpoint, {
              ...options,
              _retry: true,
              headers: { ...headers, Authorization: `Bearer ${newAccessToken}` },
            });
          } else {
            throw new ApiError('Không thể làm mới phiên đăng nhập.', 401, 'UNAUTHORIZED');
          }
        } catch (refreshErr) {
          tokenMemory.clearToken();
          processQueue(refreshErr, null);
          tokenMemory.broadcast('SESSION_REVOKED');
          throw refreshErr;
        } finally {
          isRefreshing = false;
        }
      }

      // Standard error envelope extraction
      const errorCode = data?.error?.code || 'API_ERROR';
      const errorMessage = data?.error?.message || response.statusText || 'Lỗi hệ thống';
      const errorDetails = data?.error?.details || [];

      throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(
        err.message || 'Lỗi kết nối mạng hoặc máy chủ không phản hồi.',
        0,
        'NETWORK_ERROR'
      );
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'POST', body });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PUT', body });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

