import axios from 'axios';
import { config } from '@/config';

const unsafeMethods = new Set(['post', 'put', 'patch', 'delete']);
let csrfToken: string | null = null;
let csrfTokenRequest: Promise<string> | null = null;

const api = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  // 15 second timeout for all requests
  timeout: 15000,
});

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  if (!csrfTokenRequest) {
    csrfTokenRequest = axios
      .get(`${config.apiUrl}/security/csrf-token`, { withCredentials: true })
      .then((response) => {
        const token = response.data?.token ?? response.data?.data?.token;
        if (!token) throw new Error('CSRF token endpoint did not return a token');
        csrfToken = token;
        return token;
      })
      .finally(() => {
        csrfTokenRequest = null;
      });
  }

  return csrfTokenRequest;
}

export async function refreshCsrfToken(): Promise<string> {
  csrfToken = null;
  return getCsrfToken();
}

api.interceptors.request.use(async (request) => {
  const method = request.method?.toLowerCase();
  if (method && unsafeMethods.has(method)) {
    request.headers.set('x-csrf-token', await getCsrfToken());

    // Add idempotency key for mutation requests if not already set
    if (!request.headers['X-Idempotency-Key'] && !request.headers['x-idempotency-key']) {
      const idempotencyKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${(request.data as any)?.menuItemId || ''}`;
      request.headers.set('X-Idempotency-Key', idempotencyKey);
    }
  }
  return request;
});

/**
 * Response interceptor with offline queue support.
 * If a mutation request fails due to network error, it gets queued
 * in IndexedDB for later sync when the connection is restored.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // CSRF token refresh on 403
    if (error.response?.status === 403 && error.response?.data?.message?.includes('CSRF')) {
      csrfToken = null;
      const originalRequest = error.config;
      if (originalRequest && !originalRequest._csrfRetry) {
        originalRequest._csrfRetry = true;
        originalRequest.headers.set('x-csrf-token', await getCsrfToken());
        return api.request(originalRequest);
      }
    }

    // Queue offline mutations for later sync
    if (!error.response && error.code !== 'ERR_CANCELED' && error.config) {
      const method = error.config.method?.toLowerCase();

      // Only queue mutation requests (POST, PUT, PATCH, DELETE)
      if (method && unsafeMethods.has(method)) {
        const idempotencyKey = error.config.headers['X-Idempotency-Key'] ||
          `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
          const { enqueueAction } = await import('@/services/offlineQueue');
          await enqueueAction({
            type: method === 'delete' ? 'delete' : method === 'patch' ? 'update' : 'create',
            endpoint: error.config.url || '',
            method: method.toUpperCase(),
            body: error.config.data ? JSON.parse(error.config.data) : {},
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': idempotencyKey,
            },
            idempotencyKey,
            maxRetries: 3,
          });

          // Don't propagate the error for queued mutations - the UI should still show success
          // Return a special response indicating the action was queued
          return Promise.resolve({
            data: {
              success: true,
              offline: true,
              message: 'Action queued for sync when connection is restored',
            },
          });
        } catch {
          // Queue failed - just propagate original error
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
