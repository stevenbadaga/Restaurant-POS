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

api.interceptors.request.use(async (request) => {
  const method = request.method?.toLowerCase();
  if (method && unsafeMethods.has(method)) {
    request.headers.set('x-csrf-token', await getCsrfToken());
  }
  return request;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.message?.includes('CSRF')) {
      csrfToken = null;
    }
    return Promise.reject(error);
  }
);

export default api;
