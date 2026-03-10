import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
}

function parseFilenameFromDisposition(disposition) {
  const raw = String(disposition || '');
  // RFC 5987 (filename*=UTF-8''...)
  const m5987 = raw.match(/filename\*\s*=\s*([^']*)''([^;]+)/i);
  if (m5987 && m5987[2]) {
    try {
      return decodeURIComponent(m5987[2].trim());
    } catch {
      return m5987[2].trim();
    }
  }
  const m = raw.match(/filename\s*=\s*"?([^"]+)"?/i);
  return m?.[1]?.trim() || null;
}

export const orderService = {
  list: async ({ page = 1, limit = 10, signal } = {}) => {
    const res = await api.get('/api/user/orders', { params: { page, limit }, signal });
    const data = unwrap(res) || {};
    const itemsRaw = data?.orders ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const items = coerceArray(itemsRaw).filter(Boolean);
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages = Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total = metaRaw?.total ?? metaRaw?.totalItems ?? metaRaw?.count ?? data?.total ?? null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items, meta: { page: currentPage, totalPages, total } };
  },

  getById: async (id, { signal } = {}) => {
    if (!id) return null;
    const res = await api.get(`/api/user/orders/${id}`, { signal });
    const data = unwrap(res);
    return data?.order ?? data?.item ?? data?.data ?? data;
  },

  cancel: async (orderId) => {
    if (!orderId) return null;
    const res = await api.post(`/api/user/cart/orders/${orderId}/cancel`);
    return unwrap(res);
  },

  downloadInvoice: async (orderId) => {
    if (!orderId) return;
    const res = await api.get(`/api/user/orders/${orderId}/invoice`, { responseType: 'blob' });
    const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data], { type: 'application/pdf' });
    const filename =
      parseFilenameFromDisposition(res?.headers?.['content-disposition']) ||
      `order-${orderId}-invoice.pdf`;

    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

