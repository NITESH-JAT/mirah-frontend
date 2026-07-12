import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export const showroomService = {
  /**
   * List active partner showrooms near a country + postcode for offline / partial checkout.
   * Returns an array (possibly empty when none are available in that location).
   */
  listNearby: async ({ country, postcode, signal } = {}) => {
    if (!country || !String(country).trim()) return [];
    const params = { country: String(country).trim() };
    const pc = String(postcode ?? '').trim();
    if (pc) params.postcode = pc;
    const res = await api.get('/api/user/showrooms', { params, signal });
    const data = unwrap(res) || {};
    const rows = data?.showrooms ?? data?.items ?? data ?? [];
    return Array.isArray(rows) ? rows.filter(Boolean) : [];
  },
};
