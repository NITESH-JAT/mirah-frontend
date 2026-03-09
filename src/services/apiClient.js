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

