import React, { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

export function safeGetStoredUser() {
  const raw = localStorage.getItem('mirah_session_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

