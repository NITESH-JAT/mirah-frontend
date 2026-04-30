import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

function coerceArray(maybe) {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe) return [];
  return [maybe];
}

export const productService = {
  listVendorProducts: async ({ page = 1, limit = 20, search, status, minPrice, maxPrice, signal } = {}) => {
    const params = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    if (minPrice != null && !Number.isNaN(Number(minPrice))) params.minPrice = Number(minPrice);
    if (maxPrice != null && !Number.isNaN(Number(maxPrice))) params.maxPrice = Number(maxPrice);
    const res = await api.get('/api/user/product/vendor', { params, signal });
    const data = unwrap(res) || {};
    const items = data?.products ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    return Array.isArray(items) ? items : coerceArray(items);
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

  listCustomerProducts: async ({
    page = 1,
    limit = 20,
    category,
    brand,
    minPrice,
    maxPrice,
    featured,
    search,
    sortBy,
    sortOrder,
    signal,
  } = {}) => {
    const params = { page, limit };
    if (category) params.category = category;
    if (brand) params.brand = brand;
    if (minPrice != null && !Number.isNaN(Number(minPrice))) params.minPrice = Number(minPrice);
    if (maxPrice != null && !Number.isNaN(Number(maxPrice))) params.maxPrice = Number(maxPrice);
    if (featured != null) params.featured = Boolean(featured);
    if (search) params.search = search;
    if (sortBy) params.sortBy = sortBy;
    if (sortOrder) params.sortOrder = sortOrder;

    const res = await api.get('/api/user/product/customer', { params, signal });
    const data = unwrap(res);
    const items = data?.products ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const list = Array.isArray(items) ? items : [];
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages =
      Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total =
      metaRaw?.total ??
      metaRaw?.totalItems ??
      metaRaw?.count ??
      data?.total ??
      null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items: list, meta: { page: currentPage, totalPages, total } };
  },

  listCustomerBrands: async ({ signal } = {}) => {
    const res = await api.get('/api/user/product/customer/brands', { signal });
    const data = unwrap(res) || {};
    const items = data?.brands ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    return coerceArray(items)
      .map((x) => (typeof x === 'string' ? x : x?.name ?? x?.label ?? ''))
      .map((x) => String(x || '').trim())
      .filter(Boolean);
  },

  /**
   * PRD: returns full-catalog `totalProducts` and `categories: { category, image }[]`
   * (`image` is admin URL or null). Backward compatible if the list is plain strings.
   */
  listCustomerCategories: async ({ signal } = {}) => {
    const res = await api.get('/api/user/product/customer/categories', { signal });
    const data = unwrap(res) || {};
    const totalRaw =
      data?.totalProducts ?? data?.total_products ?? data?.totalCatalog ?? data?.total ?? null;
    const totalProducts =
      totalRaw != null && totalRaw !== '' && !Number.isNaN(Number(totalRaw)) ? Number(totalRaw) : null;

    const items = data?.categories ?? data?.items ?? data?.results ?? data?.data ?? [];
    const arr = coerceArray(items);
    const categories = arr
      .map((x) => {
        if (typeof x === 'string') {
          const category = String(x || '').trim();
          return category ? { category, image: null } : null;
        }
        const category = String(x?.category ?? x?.name ?? x?.label ?? '').trim();
        if (!category) return null;
        const imageRaw = x?.image ?? x?.imageUrl ?? x?.image_url ?? x?.thumbnail ?? null;
        const image =
          imageRaw != null && String(imageRaw).trim() ? String(imageRaw).trim() : null;
        return { category, image };
      })
      .filter(Boolean);

    return { totalProducts, categories };
  },

  getCustomerProduct: async (id, { signal } = {}) => {
    const res = await api.get(`/api/user/product/customer/${id}`, { signal });
    const data = unwrap(res);
    return (
      data?.product ??
      data?.item ??
      data?.data ??
      data
    );
  },

  listProductReviews: async ({ productId, page = 1, limit = 5, signal } = {}) => {
    if (!productId) return { items: [], meta: { page: 1, totalPages: 1, total: 0 }, summary: null };
    const res = await api.get(`/api/user/reviews/product/${productId}`, {
      params: { page, limit },
      signal,
    });
    const data = unwrap(res);
    const summary = data?.summary ?? data?.data?.summary ?? null;
    const itemsRaw = data?.reviews ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const list = Array.isArray(itemsRaw) ? itemsRaw : coerceArray(itemsRaw);
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages = Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total = metaRaw?.total ?? metaRaw?.totalItems ?? metaRaw?.count ?? data?.total ?? null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items: list.filter(Boolean), meta: { page: currentPage, totalPages, total }, summary };
  },

  listVendorProductReviews: async ({ page = 1, limit = 10, productId, signal } = {}) => {
    const params = { page, limit };
    if (productId != null && productId !== '') params.productId = productId;
    const res = await api.get('/api/user/reviews/vendor', { params, signal });
    const data = unwrap(res);
    const summary = data?.summary ?? data?.data?.summary ?? null;
    const itemsRaw = data?.reviews ?? data?.items ?? data?.results ?? data?.data ?? data ?? [];
    const list = Array.isArray(itemsRaw) ? itemsRaw : coerceArray(itemsRaw);
    const metaRaw = data?.meta ?? data?.pagination ?? data?.pageInfo ?? data ?? {};
    const totalPages = Number(metaRaw?.totalPages ?? metaRaw?.pages ?? metaRaw?.lastPage ?? 1) || 1;
    const total = metaRaw?.total ?? metaRaw?.totalItems ?? metaRaw?.count ?? data?.total ?? null;
    const currentPage = Number(metaRaw?.page ?? metaRaw?.currentPage ?? page) || page;
    return { items: list.filter(Boolean), meta: { page: currentPage, totalPages, total }, summary };
  },

  submitProductReview: async ({ productId, rating, comment, isAnonymous } = {}) => {
    const res = await api.post('/api/user/reviews', { productId, rating, comment, isAnonymous: Boolean(isAnonymous) });
    return unwrap(res);
  },

  getOrderReviews: async (orderId, { signal } = {}) => {
    if (!orderId) return [];
    const res = await api.get(`/api/user/reviews/order/${orderId}`, { signal });
    const data = unwrap(res) || {};
    const items = data?.items ?? data?.data?.items ?? data?.results ?? data?.reviews ?? data ?? [];
    return coerceArray(items).filter(Boolean);
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

