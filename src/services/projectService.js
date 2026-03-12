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

export const projectService = {
  list: async ({ page = 1, limit = 10, status, signal } = {}) => {
    const params = { page, limit };
    if (status) params.status = status;
    const res = await api.get('/api/user/projects', { params, signal });
    const data = unwrap(res) || {};
    const itemsRaw = data?.projects ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const items = coerceArray(itemsRaw).filter(Boolean);
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages = Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total = metaRaw?.total ?? metaRaw?.totalItems ?? metaRaw?.count ?? data?.total ?? null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items, meta: { page: currentPage, totalPages, total } };
  },

  create: async (payload, { signal } = {}) => {
    const res = await api.post('/api/user/projects', payload, { signal });
    const data = unwrap(res);
    return data?.project ?? data?.item ?? data?.data ?? data;
  },

  getById: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.get(`/api/user/projects/${projectId}`, { signal });
    const data = unwrap(res);
    return data?.project ?? data?.item ?? data?.data ?? data;
  },

  update: async (projectId, payload, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.patch(`/api/user/projects/${projectId}`, payload, { signal });
    const data = unwrap(res);
    return data?.project ?? data?.item ?? data?.data ?? data;
  },

  delete: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.delete(`/api/user/projects/${projectId}`, { signal });
    return unwrap(res);
  },

  uploadAttachments: async (files, { signal } = {}) => {
    const formData = new FormData();
    const list = Array.isArray(files) ? files : files ? [files] : [];
    for (const f of list) formData.append('files', f);
    const res = await api.post('/api/user/projects/attachments/upload', formData, { signal });
    const data = unwrap(res) || {};
    const urls = data?.urls ?? data?.data?.urls ?? [];
    return { urls: Array.isArray(urls) ? urls : urls ? [urls] : [] };
  },

  cancel: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/cancel`, {}, { signal });
    return unwrap(res);
  },

  complete: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/complete`, {}, { signal });
    return unwrap(res);
  },

  startBid: async (projectId, { finishingTimestamp, endsAt, noOfDays = 3 } = {}, { signal } = {}) => {
    if (!projectId) return null;
    const tsRaw = finishingTimestamp ?? endsAt ?? null;
    const ts =
      tsRaw != null
        ? new Date(tsRaw).toISOString()
        : new Date(Date.now() + Math.max(1, Number(noOfDays) || 0) * 24 * 60 * 60 * 1000).toISOString();
    const payload = { finishingTimestamp: ts };
    const res = await api.post(`/api/user/projects/${projectId}/start-bid`, payload, { signal });
    return unwrap(res);
  },

  manualEndBid: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/manual-end`, {}, { signal });
    return unwrap(res);
  },

  listBids: async (projectId, { signal } = {}) => {
    if (!projectId) return [];
    const res = await api.get(`/api/user/projects/${projectId}/bids`, { signal });
    const data = unwrap(res);
    const items = data?.bids ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    return Array.isArray(items) ? items : items ? [items] : [];
  },

  listActiveBids: async (projectId, { signal } = {}) => {
    if (!projectId) return [];
    const res = await api.get(`/api/user/projects/${projectId}/bids/active`, { signal });
    const data = unwrap(res);
    const items = data?.bids ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    return Array.isArray(items) ? items : items ? [items] : [];
  },

  // Vendor bid participation list (projects where vendor has placed at least one bid)
  listBidParticipation: async ({ page = 1, limit = 24, signal } = {}) => {
    const params = { page, limit };
    const res = await api.get('/api/user/projects/bid-participation', { params, signal });
    const data = unwrap(res) || {};
    const itemsRaw = data?.projects ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const items = coerceArray(itemsRaw).filter(Boolean);
    const pagination = data?.pagination ?? data?.meta ?? data?.pageInfo ?? {};
    const totalPages = Number(pagination?.totalPages ?? pagination?.pages ?? pagination?.lastPage ?? 1) || 1;
    const total = pagination?.total ?? pagination?.totalItems ?? pagination?.count ?? null;
    const currentPage = Number(pagination?.page ?? pagination?.currentPage ?? page) || page;
    return { items, meta: { page: currentPage, totalPages, total }, pagination };
  },

  // Vendor marketplace: running projects list for bidding
  listRunning: async ({ page = 1, limit = 12, signal } = {}) => {
    const params = { page, limit };
    const res = await api.get('/api/user/projects/running', { params, signal });
    const data = unwrap(res) || {};
    const itemsRaw = data?.projects ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const items = coerceArray(itemsRaw).filter(Boolean);
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages = Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total = metaRaw?.total ?? metaRaw?.totalItems ?? metaRaw?.count ?? data?.total ?? null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items, meta: { page: currentPage, totalPages, total } };
  },

  // Vendor bid actions
  placeBid: async (projectId, { price, daysToComplete } = {}, { signal } = {}) => {
    if (!projectId) return null;
    const payload = { price, daysToComplete };
    const res = await api.post(`/api/user/projects/${projectId}/bid`, payload, { signal });
    return unwrap(res);
  },

  withdrawLatestBid: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.delete(`/api/user/projects/${projectId}/bid/latest`, { signal });
    return unwrap(res);
  },

  withdrawAllBids: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/withdraw`, {}, { signal });
    return unwrap(res);
  },

  selectWinner: async (projectId, payload, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/select-winner`, payload, { signal });
    return unwrap(res);
  },

  reassignWinner: async (projectId, payload, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/reassign-winner`, payload, { signal });
    return unwrap(res);
  },

  getDetails: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.get(`/api/user/projects/${projectId}`, { signal });
    return unwrap(res);
  },

  createPaymentOrder: async (projectId, { type } = {}, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/payments/razorpay/create-order`, { type }, { signal });
    return unwrap(res);
  },

  verifyPayment: async (projectId, payload, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/payments/razorpay/verify`, payload, { signal });
    return unwrap(res);
  },

  downloadInvoice: async (projectId) => {
    if (!projectId) return;
    const res = await api.get(`/api/user/projects/${projectId}/invoice`, { responseType: 'blob' });
    const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data], { type: 'application/pdf' });
    const filename =
      parseFilenameFromDisposition(res?.headers?.['content-disposition']) ||
      `project-${projectId}-invoice.pdf`;

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
