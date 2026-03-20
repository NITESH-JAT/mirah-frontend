import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export const faqService = {
  list: async () => {
    const res = await api.get('/api/user/faq');
    const data = unwrap(res) || {};
    const faqs = data?.faqs ?? data?.items ?? data?.faqList ?? [];
    return Array.isArray(faqs) ? faqs : [];
  },
};

