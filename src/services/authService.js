import { apiClient as api } from './apiClient';

// --- HELPER ---
const saveSession = (key, data) => {

    const token = data.token 
               || data.accessToken 
               || (data.data && data.data.token) 
               || (data.data && data.data.accessToken)
               || (data.user && data.user.token);


    let finalToken = token;
    if (!finalToken) {
        const existing = localStorage.getItem(key);
        if (existing) {
            const parsed = JSON.parse(existing);
            finalToken = parsed.token;
        }
    }

    if (finalToken) {
        console.log(`[Auth] Saving Session to ${key} with Token:`, finalToken.substring(0, 10) + "...");
        const userObj = data.user || data.data?.user || data.data || data;
        
        const storageData = {
            ...userObj,
            token: finalToken
        };
        localStorage.setItem(key, JSON.stringify(storageData));
        return storageData;
    } else {
        console.warn(`[Auth] No token found in response for ${key}`, data);
        localStorage.setItem(key, JSON.stringify(data));
        return data;
    }
};

export const authService = {
  me: async () => {
    try {
      const response = await api.get('/api/user/auth/me');
      const saved = saveSession('mirah_session_user', response.data);
      return saved;
    } catch (error) {
      throw error.response?.data || { message: "Failed to hydrate session" };
    }
  },

  getCountryCodes: async () => {
    try {
      const response = await api.get('/api/public/country-codes');
      return response.data || [];
    } catch {
      return [];
    }
  },

  //  SIGNUP
  signup: async (userData) => {
    try {
      const response = await api.post('/api/user/auth/signup', userData);
      saveSession('mirah_temp_user', { ...userData, ...response.data });
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Registration failed" };
    }
  },

  //  VERIFY PHONE 
  verifyPhoneOtp: async (phone, otp, countryCode) => {
    try {
      const response = await api.post('/api/user/auth/verify-otp', { phone, otp, countryCode });
      console.log("[Auth] Phone Verify Response:", response.data);
      
      const updatedUser = saveSession('mirah_temp_user', response.data);
      return updatedUser;
    } catch (error) {
      throw error.response?.data || { message: "Phone verification failed" };
    }
  },

  //  VERIFY EMAIL
  verifyEmailOtp: async (email, otp) => {
    try {
      const response = await api.post('/api/user/auth/verify-email-otp', { email, otp });
      console.log("[Auth] Email Verify Response:", response.data);
      

      const updatedUser = saveSession('mirah_temp_user', response.data);
      return updatedUser;
    } catch (error) {
      throw error.response?.data || { message: "Email verification failed" };
    }
  },

  resendPhoneOtp: async (phone, countryCode) => {
    try {
      await api.post('/api/user/auth/resend-otp', { phone, countryCode });
      return true;
    } catch (error) {
      throw error.response?.data || { message: "Failed to resend phone OTP" };
    }
  },

  resendEmailOtp: async (email) => {
    try {
      await api.post('/api/user/auth/resend-email-otp', { email });
      return true;
    } catch (error) {
      throw error.response?.data || { message: "Failed to resend email OTP" };
    }
  },

  //  LOGIN
  login: async (credentials) => {
    try {
      const response = await api.post('/api/user/auth/login', credentials);
      console.log("[Auth] Login Response:", response.data);
      
 
      const savedData = saveSession('mirah_session_user', response.data);
      return savedData; 
    } catch (error) {
      throw error.response?.data || { message: "Login failed" };
    }
  },

  logout: async () => {
    try {
        await api.post('/api/user/auth/logout');
    } catch (error) {
        console.error("Logout warning", error);
    } finally {
        localStorage.removeItem('mirah_session_user');
        localStorage.removeItem('mirah_temp_user');
    }
  },

  forgotPassword: async (data) => {
    try {
      const response = await api.post('/api/user/auth/forgot-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Failed to send reset OTP" };
    }
  },

  resetPassword: async (data) => {
    try {
      const response = await api.post('/api/user/auth/reset-password', data);
      return response.data;
    } catch (error) {
      throw error.response?.data || { message: "Password reset failed" };
    }
  },

  // --- PROFILE ENDPOINTS ---
  getProfile: async () => {
    try {
        const response = await api.get('/api/user/profile');
        return response.data?.data || response.data;
    } catch (error) {
        if(error.response?.status === 401) {
            console.error("[Auth] 401 Unauthorized in getProfile. Token might be invalid.");
        }
        throw error.response?.data || { message: "Failed to fetch profile" };
    }
  },

  updateProfile: async (data) => {
    try {
        const response = await api.put('/api/user/profile', data);
        const updatedData = response.data?.data || response.data;
        

        saveSession('mirah_session_user', updatedData);
        return updatedData;
    } catch (error) {
        throw error.response?.data || { message: "Failed to update profile" };
    }
  },

  uploadProfilePicture: async (file) => {
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await api.post('/api/user/profile/profile-picture', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data?.data || response.data || {};
      const profileImageUrl = data?.profileImageUrl;
      if (!profileImageUrl) return authService.getCurrentUser();

      const existing = authService.getCurrentUser() || {};
      const merged = { ...existing, profileImageUrl };
      return saveSession('mirah_session_user', merged);
    } catch (error) {
      throw error.response?.data || { message: "Failed to upload profile picture" };
    }
  },

  createSellingRequest: async () => {
    try {
      await api.post('/api/user/profile/selling-request');
      // PRD: rehydrate via /me to get sellingRequest + canSellProducts updates
      const hydrated = await authService.me();
      return hydrated;
    } catch (error) {
      throw error.response?.data || { message: "Failed to create selling request" };
    }
  },

  getVendorSellingEnabled: async () => {
    try {
      const response = await api.get('/api/user/system/vendor-selling-enabled');
      return Boolean(response?.data?.data?.sellingForVendorEnabled);
    } catch (error) {
      throw error.response?.data || { message: "Failed to fetch vendor selling config" };
    }
  },

  changePassword: async (data) => {
    try {
        try {
          const response = await api.post('/api/user/profile/change-password', data);
          return response.data;
        } catch (postError) {
          const status = postError?.response?.status;
          if (status === 404 || status === 405) {
            const response = await api.put('/api/user/profile/change-password', data);
            return response.data;
          }
          throw postError;
        }
    } catch (error) {
        throw error.response?.data || { message: "Failed to change password" };
    }
  },

  deleteProfile: async () => {
    try {
        await api.delete('/api/user/profile');
        localStorage.removeItem('mirah_session_user');
    } catch (error) {
        throw error.response?.data || { message: "Failed to delete account" };
    }
  },
  
  getCurrentUser: () => {
    const user = localStorage.getItem('mirah_session_user');
    return user ? JSON.parse(user) : null;
  }
};