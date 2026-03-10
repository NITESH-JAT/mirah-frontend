import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
}

export const addressService = {
  list: async ({ type } = {}) => {
    const res = await api.get('/api/user/sales/addresses', { params: { type } });
    const data = unwrap(res) || {};
    const items = data?.addresses ?? data?.items ?? data?.results ?? data;
    return coerceArray(items).filter(Boolean);
  },

  create: async (payload) => {
    const res = await api.post('/api/user/sales/addresses', payload);
    return unwrap(res);
  },

  update: async ({ id, payload }) => {
    const res = await api.put(`/api/user/sales/addresses/${id}`, payload);
    return unwrap(res);
  },

  remove: async (id) => {
    const res = await api.delete(`/api/user/sales/addresses/${id}`);
    return unwrap(res);
  },
};

