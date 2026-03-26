import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function normalizeVariants(variants) {
  if (!variants || typeof variants !== 'object' || Array.isArray(variants)) return undefined;
  const out = {
    type: variants?.type ?? undefined,
    size: variants?.size ?? undefined,
    sizeDimensions: variants?.sizeDimensions ?? variants?.size_dimensions ?? undefined,
    sizeDimensionsUnit: variants?.sizeDimensionsUnit ?? variants?.size_dimensions_unit ?? undefined,
  };
  // Remove empty keys so backend doesn't see noise
  for (const k of Object.keys(out)) {
    if (out[k] == null || out[k] === '') delete out[k];
  }
  return Object.keys(out).length ? out : undefined;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
}

function emitCartUpdated({ markNew = false } = {}) {
  try {
    if (markNew) localStorage.setItem('mirah_cart_has_new', '1');
    window.dispatchEvent(new Event('mirah_cart_updated'));
  } catch {
    // ignore storage/event failures
  }
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

  addItem: async ({ productId, quantity = 1, variants } = {}) => {
    const body = { productId, quantity };
    const v = normalizeVariants(variants);
    if (v) body.variants = v;
    const res = await api.post('/api/user/cart', body);
    const data = unwrap(res);
    // Mark cart as "updated" so UI can show a red dot / update badge.
    emitCartUpdated({ markNew: true });
    return data;
  },

  updateQuantity: async ({ productId, quantity, variants } = {}) => {
    const body = { quantity };
    const v = normalizeVariants(variants);
    if (v) body.variants = v;
    const res = await api.put(`/api/user/cart/${productId}`, body);
    const data = unwrap(res);
    emitCartUpdated({ markNew: false });
    return data;
  },

  removeItem: async ({ productId, variants } = {}) => {
    const body = {};
    const v = normalizeVariants(variants);
    if (v) body.variants = v;
    const res = await api.delete(`/api/user/cart/${productId}`, Object.keys(body).length ? { data: body } : undefined);
    const data = unwrap(res);
    emitCartUpdated({ markNew: false });
    return data;
  },

  clear: async () => {
    const res = await api.delete('/api/user/cart');
    const data = unwrap(res);
    try {
      localStorage.removeItem('mirah_cart_has_new');
    } catch {
      // ignore
    }
    emitCartUpdated({ markNew: false });
    return data;
  },

  checkout: async ({ paymentMethod = 'razorpay', currency = 'INR', cartItemIds = [], productIds = [] } = {}) => {
    const body = { paymentMethod, currency };
    if (Array.isArray(cartItemIds) && cartItemIds.length) body.cartItemIds = cartItemIds;
    else body.productIds = productIds;
    const res = await api.post('/api/user/cart/checkout', body);
    return unwrap(res);
  },

  calculatePartialPayment: async ({ currency = 'INR', cartItemIds = [], productIds = [] } = {}) => {
    const body = { currency };
    if (Array.isArray(cartItemIds) && cartItemIds.length) body.cartItemIds = cartItemIds;
    else body.productIds = productIds;
    const res = await api.post('/api/user/cart/partial-payment/calculate', body);
    return unwrap(res);
  },

  verifyPayment: async ({
    localOrderId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
  } = {}) => {
    const res = await api.post('/api/user/cart/payment/verify', {
      localOrderId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      // Also send snake_case keys for compatibility with some backends/PRDs.
      razorpay_payment_id: razorpayPaymentId,
      razorpay_order_id: razorpayOrderId,
      razorpay_signature: razorpaySignature,
    });
    return unwrap(res);
  },
};

