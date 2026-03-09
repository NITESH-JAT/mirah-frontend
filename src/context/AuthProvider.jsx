import React, { useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { AuthContext, safeGetStoredUser } from './AuthContext';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => safeGetStoredUser());
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const stored = safeGetStoredUser();
    if (!stored?.token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const hydrated = await authService.me();
      setUser(hydrated);
      return hydrated;
    } catch {
      localStorage.removeItem('mirah_session_user');
      localStorage.removeItem('mirah_temp_user');
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, setUser, loading, refresh, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

