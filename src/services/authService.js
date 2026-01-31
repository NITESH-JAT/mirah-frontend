import axios from 'axios';

// Public APIs for Location Data
const COUNTRIES_API = "https://countriesnow.space/api/v0.1/countries";
const CITIES_API = "https://countriesnow.space/api/v0.1/countries/state/cities";
const STATES_API = "https://countriesnow.space/api/v0.1/countries/states";

export const authService = {
  // --- Location Data Fetchers ---

  getCountries: async () => {
    try {
      const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,idd,cca2');
      return response.data
        .map(c => ({
          name: c.name.common,
          code: c.cca2,
          dialCode: c.idd.root + (c.idd.suffixes ? c.idd.suffixes[0] : ''),
          // Simple length mapping for demo purposes (Default to 10)
          phoneLength: (['AE', 'SA', 'KW'].includes(c.cca2)) ? 9 : 
                       (['GB', 'CN'].includes(c.cca2)) ? 11 : 10
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("Error fetching countries:", error);
      return [];
    }
  },

  getStates: async (countryName) => {
    try {
      const response = await axios.post(STATES_API, { country: countryName });
      return response.data.data.states || [];
    } catch (error) {
      return [];
    }
  },

  getCities: async (countryName, stateName) => {
    try {
      const response = await axios.post(CITIES_API, { country: countryName, state: stateName });
      return response.data.data || [];
    } catch (error) {
      return [];
    }
  },

  // --- Auth Endpoints (DEMO MODE) ---

  register: async (payload) => {
    // --- REAL API (COMMENTED OUT FOR DEMO) ---
    /*
    try {
      const response = await axios.post("https://signs-implementing-spirit-warrior.trycloudflare.com/api/user/auth/signup", payload, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data) {
        localStorage.setItem('mirah_session_user', JSON.stringify(response.data));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || "Registration failed.";
    }
    */

    // --- DUMMY DATA LOGIC (ACTIVE) ---
    return new Promise((resolve) => {
      setTimeout(() => {
        const newUser = { ...payload, id: Date.now() };
        localStorage.setItem('mirah_session_user', JSON.stringify(newUser));
        // Also save to a dummy 'users' list if needed, or just proceed
        resolve(newUser);
      }, 1000);
    });
  },

  login: async (phone) => {
    // Dummy login response
    return { success: true };
  },

  getCurrentUser: () => JSON.parse(localStorage.getItem('mirah_session_user')),
  
  logout: () => {
    localStorage.removeItem('mirah_session_user');
    localStorage.removeItem('mirah_pending_phone');
  }
};