const FALLBACK_API_URL = "https://mira-backend-production-0a62.up.railway.app";

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
  FALLBACK_API_URL;

