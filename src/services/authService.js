import axios from 'axios';

const API_URL = "https://mira-backend-production-0a62.up.railway.app";

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authService = {
  // --- Public Data ---
  getCountryCodes: async () => {
    try {
      const response = await api.get('/api/public/country-codes');

      return response.data || [];
    } catch (error) {
      console.error("Error fetching country codes:", error);
      return [];
    }
  },

  // --- Auth Flow ---
  
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
      throw error.response?.data?.message || "Registration failed";
    }
  },

  // 2. Verify Phone OTP
  verifyPhoneOtp: async (phone, otp, countryCode) => {
  try {
    const response = await api.post('/api/user/auth/verify-otp', { phone, otp, countryCode });
    return response.data;
  } catch (error) {
    throw error.response?.data?.message || "Phone verification failed";
  }
},

  // 3. Verify Email OTP
  verifyEmailOtp: async (email, otp) => {
    try {
      const response = await api.post('/api/user/auth/verify-email-otp', { email, otp });
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || "Email verification failed";
    }
  },

  // 4. Resend Phone OTP
  resendPhoneOtp: async (phone, countryCode) => {
    try {
      await api.post('/api/user/auth/resend-otp', { phone, countryCode });
      return true;
    } catch (error) {
      throw error.response?.data?.message || "Failed to resend phone OTP";
    }
  },

  // 5. Resend Email OTP
  resendEmailOtp: async (email) => {
    try {
      await api.post('/api/user/auth/resend-email-otp', { email });
      return true;
    } catch (error) {
      throw error.response?.data?.message || "Failed to resend email OTP";
    }
  },

  // --- Session Management ---
  login: async (credentials) => {
    // Implement standard login here later
    // Return { needsVerification: true } if verify is pending
    return { success: true }; 
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