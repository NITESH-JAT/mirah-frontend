import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // If we're sending FormData, let the browser set the multipart boundary.
    // Our axios instance has a default JSON Content-Type, which breaks file uploads otherwise.
    try {
      if (typeof FormData !== 'undefined' && config?.data instanceof FormData) {
        if (config.headers?.delete) {
          config.headers.delete('Content-Type');
        } else if (config.headers) {
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
        }
      }
    } catch {
      // ignore
    }

    const userStr = localStorage.getItem('mirah_session_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        if (user?.token) {
          config.headers.Authorization = `Bearer ${user.token}`;
        }
      } catch {
        // ignore corrupted storage
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    // Prefer backend-provided messages over generic axios status lines
    // so UI toasts show actionable errors (e.g. stock exceeded).
    try {
      const data = error?.response?.data ?? null;
      const serverMessage =
        data?.message ??
        data?.error ??
        data?.data?.message ??
        null;
      if (serverMessage) {
        error.message = String(serverMessage).trim();
      }
    } catch {
      // ignore normalization errors
    }

    if (status === 401) {
      localStorage.removeItem('mirah_session_user');
      localStorage.removeItem('mirah_temp_user');

      // Avoid redirect loops if we're already on auth routes
      const path = window.location?.pathname || '';
      const isAuthRoute =
        path === '/login' ||
        path === '/register' ||
        path === '/verification' ||
        path === '/terms' ||
        path === '/';

      if (!isAuthRoute) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

