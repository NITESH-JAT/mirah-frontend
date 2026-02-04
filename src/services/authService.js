import axios from 'axios';

const API_URL = "https://mira-backend-production-0a62.up.railway.app";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authService = {
  getCountryCodes: async () => {
    try {
      const response = await api.get('/api/public/country-codes');
      return response.data || [];
    } catch (error) {
      console.error("Error fetching country codes:", error);
      return [];
    }
  },

  // 1. Register User
  signup: async (userData) => {
    try {
      const response = await api.post('/api/user/auth/signup', userData);
      localStorage.setItem('mirah_temp_user', JSON.stringify({
        email: userData.email,
        phone: userData.phone,
        countryCode: userData.countryCode
      }));
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Registration failed" };
    }
  },

  // 2. Verify Phone OTP
  verifyPhoneOtp: async (phone, otp, countryCode) => {
    try {
      const response = await api.post('/api/user/auth/verify-otp', { phone, otp, countryCode });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Phone verification failed" };
    }
  },

  // 3. Verify Email OTP
  verifyEmailOtp: async (email, otp) => {
    try {
      const response = await api.post('/api/user/auth/verify-email-otp', { email, otp });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Email verification failed" };
    }
  },

  // 4. Resend Phone OTP
  resendPhoneOtp: async (phone, countryCode) => {
    try {
      await api.post('/api/user/auth/resend-otp', { phone, countryCode });
      return true;
    } catch (error) {
      throw error.response?.data || { message: "Failed to resend phone OTP" };
    }
  },

  // 5. Resend Email OTP
  resendEmailOtp: async (email) => {
    try {
      await api.post('/api/user/auth/resend-email-otp', { email });
      return true;
    } catch (error) {
      throw error.response?.data || { message: "Failed to resend email OTP" };
    }
  },

  // 6. User Login
  login: async (credentials) => {
    try {
      const response = await api.post('/api/user/auth/login', credentials);
      return response.data; 
    } catch (error) {
      throw error.response?.data || { message: "Login failed" };
    }
  },

  // 7. Forgot Password - Send Reset OTP
  forgotPassword: async (data) => {
    try {
      const response = await api.post('/api/user/auth/forgot-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to send reset OTP" };
    }
  },

  // 8. Reset Password
  resetPassword: async (data) => {
    try {
      const response = await api.post('/api/user/auth/reset-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Password reset failed" };
    }
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem('mirah_session_user');
    return user ? JSON.parse(user) : null;
  },

  logout: () => {
    localStorage.removeItem('mirah_session_user');
    localStorage.removeItem('mirah_temp_user');
  }
};