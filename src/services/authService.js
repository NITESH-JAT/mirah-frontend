import initialData from '../data/db.json';

const KEYS = {
  users: 'mirah_users',
  session: 'mirah_session_user',
  pendingPhone: 'mirah_pending_phone'
};

export const initDB = () => {
  if (!localStorage.getItem(KEYS.users)) {
    localStorage.setItem(KEYS.users, JSON.stringify(initialData.users));
  }
};

export const authService = {

  getUAECities: async () => {
    return [
      "Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", 
      "Fujairah", "Umm Al Quwain", "Al Ain", "Khor Fakkan"
    ].sort();
  },

  login: async (phone) => {
    const users = JSON.parse(localStorage.getItem(KEYS.users) || '[]');
    const cleanPhone = phone.replace(/\D/g, '');
    const user = users.find(u => u.phone.replace(/\D/g, '') === cleanPhone);
    if (user) {
      localStorage.setItem(KEYS.session, JSON.stringify(user));
      return { success: true, user };
    }
    return { success: false, needsRegistration: true };
  },

  register: async (userData) => {
    const users = JSON.parse(localStorage.getItem(KEYS.users) || '[]');
    const newUser = { 
      ...userData, 
      id: Date.now().toString(), 
      createdAt: new Date().toISOString() 
    };
    users.push(newUser);
    localStorage.setItem(KEYS.users, JSON.stringify(users));
    localStorage.setItem(KEYS.session, JSON.stringify(newUser));
    return newUser;
  },

  getCurrentUser: () => JSON.parse(localStorage.getItem(KEYS.session)),
  logout: () => {
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.pendingPhone);
  }
};