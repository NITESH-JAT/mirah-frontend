import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
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

  start: async (projectId, { signal } = {}) => {
    if (!projectId) return null;
    const res = await api.post(`/api/user/projects/${projectId}/start`, {}, { signal });
    return unwrap(res);
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
};
