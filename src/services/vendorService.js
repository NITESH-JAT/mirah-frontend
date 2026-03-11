import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
}

export const vendorService = {
  getDetails: async (vendorId, { signal } = {}) => {
    if (!vendorId) return null;
    const res = await api.get(`/api/user/users/vendors/${vendorId}/details`, { signal });
    const data = unwrap(res);
    if (data?.vendor) {
      const v = data.vendor || {};
      const stats = data?.stats ?? v?.stats ?? null;
      return stats ? { ...v, stats } : v;
    }
    return data?.user ?? data?.data ?? data;
  },

  listReviews: async (vendorId, { page = 1, limit = 6, signal } = {}) => {
    if (!vendorId) return { items: [], meta: { page: 1, totalPages: 1, total: null } };
    const res = await api.get(`/api/user/vendor-reviews/vendor/${vendorId}`, { params: { page, limit }, signal });
    const data = unwrap(res) || {};
    const itemsRaw = data?.reviews ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const items = coerceArray(itemsRaw).filter(Boolean);
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages = Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total = metaRaw?.total ?? metaRaw?.totalItems ?? metaRaw?.count ?? data?.total ?? null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items, meta: { page: currentPage, totalPages, total } };
  },

  submitVendorReview: async ({ projectId, vendorId, rating, comment, isAnonymous } = {}, { signal } = {}) => {
    if (!projectId) return null;
    const payload = {
      projectId,
      rating,
      comment,
      isAnonymous: Boolean(isAnonymous),
    };
    if (vendorId != null && vendorId !== '') payload.vendorId = vendorId;
    const res = await api.post('/api/user/vendor-reviews', payload, { signal });
    return unwrap(res);
  },
};

