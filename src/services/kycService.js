import { apiClient as api } from './apiClient';

export const kycService = {
  getFields: async ({ country }) => {
    const response = await api.get('/api/user/kyc/fields', {
      params: { country },
    });
    return response.data?.data || response.data;
  },

  getStatus: async () => {
    const response = await api.get('/api/user/kyc/status');
    return response.data?.data || response.data;
  },

  upload: async ({ file, fieldName, section }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('fieldName', fieldName);
    form.append('section', section);

    const response = await api.post('/api/user/kyc/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data;
  },

  saveSection: async ({ section, data, country }) => {
    const response = await api.post('/api/user/kyc/save', { section, data, country });
    return response.data?.data || response.data;
  },

  submit: async () => {
    const response = await api.post('/api/user/kyc/submit');
    return response.data?.data || response.data;
  },
};

