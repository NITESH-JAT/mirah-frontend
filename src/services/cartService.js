import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
}

export const cartService = {
  getCart: async ({ signal } = {}) => {
    const res = await api.get('/api/user/cart', { signal });
    const data = unwrap(res) || {};
    const itemsRaw = data?.items ?? data?.cart?.items ?? data?.cartItems ?? data?.data ?? data ?? [];
    const items = coerceArray(itemsRaw).filter(Boolean);
    const meta = data?.meta ?? data?.cart?.meta ?? {};
    return { raw: data, items, meta };
  },

  addItem: async ({ productId, quantity = 1 } = {}) => {
    const res = await api.post('/api/user/cart', { productId, quantity });
    return unwrap(res);
  },

  updateQuantity: async ({ productId, quantity } = {}) => {
    const res = await api.put(`/api/user/cart/${productId}`, { quantity });
    return unwrap(res);
  },

  removeItem: async (productId) => {
    const res = await api.delete(`/api/user/cart/${productId}`);
    return unwrap(res);
  },

  clear: async () => {
    const res = await api.delete('/api/user/cart');
    return unwrap(res);
  },

  checkout: async ({ paymentMethod = 'razorpay', currency = 'INR', productIds = [] } = {}) => {
    const res = await api.post('/api/user/cart/checkout', { paymentMethod, currency, productIds });
    return unwrap(res);
  },
};

