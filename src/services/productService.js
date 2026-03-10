import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export const productService = {
  listVendorProducts: async ({ page = 1, limit = 20 } = {}) => {
    const res = await api.get('/api/user/product/vendor', { params: { page, limit } });
    const data = unwrap(res);
    const items = data?.products ?? data?.items ?? data ?? [];
    return Array.isArray(items) ? items : [];
  },

  getVendorProduct: async (id) => {
    const res = await api.get(`/api/user/product/vendor/${id}`);
    return unwrap(res);
  },

  createVendorProduct: async (payload) => {
    const res = await api.post('/api/user/product/vendor', payload);
    return unwrap(res);
  },

  updateVendorProduct: async ({ id, payload }) => {
    const res = await api.put(`/api/user/product/vendor/${id}`, payload);
    return unwrap(res);
  },

  deleteVendorProduct: async (id) => {
    const res = await api.delete(`/api/user/product/vendor/${id}`);
    return unwrap(res);
  },

  submitVendorProductForApproval: async (id) => {
    const res = await api.post(`/api/user/product/vendor/${id}/submit-for-approval`);
    return unwrap(res);
  },

  uploadVendorImage: async (file) => {
    const form = new FormData();
    // Backend expects multipart field: `file`
    form.append('file', file);
    const res = await api.post('/api/user/product/vendor/upload-image', form);
    const data = unwrap(res);
    const url =
      data?.url ??
      data?.imageUrl ??
      data?.imageURL ??
      data?.location ??
      data?.publicUrl ??
      data?.fileUrl ??
      data?.fileURL ??
      data?.key ??
      null;
    return { raw: data, url };
  },

  uploadVendorVideo: async (file) => {
    const form = new FormData();
    // Backend expects multipart field: `file`
    form.append('file', file);
    const res = await api.post('/api/user/product/vendor/upload-video', form);
    const data = unwrap(res);
    const url =
      data?.url ??
      data?.videoUrl ??
      data?.videoURL ??
      data?.location ??
      data?.publicUrl ??
      data?.fileUrl ??
      data?.fileURL ??
      data?.key ??
      null;
    return { raw: data, url };
  },
};

