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
  // Replace localStorage logic with fetch('api/endpoint') later
  login: async (phone) => {
    const users = JSON.parse(localStorage.getItem(KEYS.users) || '[]');
    const user = users.find(u => u.phone === phone);
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