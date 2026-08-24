import { apiClient as api } from './apiClient';

export const systemService = {
  async getOfflineShopCheckout() {
    const response = await api.get('/api/user/system/offline-shop-checkout');
    const payload = response?.data;
    if (!payload?.success) {
      throw new Error(payload?.message || 'Failed to load offline shop checkout settings');
    }
    return payload.data;
  },

  async getCustomerStorefront() {
    const response = await api.get('/api/user/system/customer-storefront');
    const payload = response?.data;
    if (!payload?.success) {
      throw new Error(payload?.message || 'Failed to load storefront settings');
    }
    return payload.data;
  },
};
