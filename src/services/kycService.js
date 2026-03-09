import axios from 'axios';

const API_URL = "https://mira-backend-production-0a62.up.railway.app";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- INTERCEPTOR ---
api.interceptors.request.use(
  (config) => {
    const userStr = localStorage.getItem('mirah_session_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const kycService = {
  getStatus: async () => {
    try {
      const response = await api.get('/api/user/kyc/status');
      return response.data?.data || response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch KYC status" };
    }
  },

  getFields: async (countryCode) => {
    try {
      const response = await api.get(`/api/user/kyc/fields?country=${countryCode}`);
      return response.data?.data || response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch KYC fields" };
    }
  },

  uploadDocument: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/user/kyc/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return response.data?.data || response.data;
    } catch (error) {
      throw error.response?.data || { message: "Document upload failed" };
    }
  },

  // FIXED: Changed payload from { sectionId, data } to { section, data }
  saveProgress: async (section, data) => {
    try {
      const response = await api.post('/api/user/kyc/save', { section, data });
      return response.data?.data || response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to save KYC progress" };
    }
  },

  submitKYC: async () => {
    try {
      const response = await api.post('/api/user/kyc/submit');
      return response.data?.data || response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to submit KYC application" };
    }
  }
};