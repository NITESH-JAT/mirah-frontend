import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export const chatService = {
  listConversations: async () => {
    const res = await api.get('/api/user/chat/conversations');
    const data = unwrap(res);
    const items = data?.conversations ?? data?.items ?? data ?? [];
    return Array.isArray(items) ? items : [];
  },

  getMessages: async ({ conversationId, page = 1, limit = 50 }) => {
    const res = await api.get(`/api/user/chat/conversations/${conversationId}/messages`, {
      params: { page, limit },
    });
    const data = unwrap(res);
    const items = data?.messages ?? data?.items ?? [];
    const messages = Array.isArray(items) ? items : (Array.isArray(data) ? data : []);
    const conversation = data?.conversation ?? null;
    return { messages, conversation };
  },

  createOrFindConversation: async ({ recipientId }) => {
    const res = await api.post('/api/user/chat/conversations', { recipientId });
    return unwrap(res);
  },

  sendMessage: async ({ conversationId, content, messageType = 'text' }) => {
    const res = await api.post(`/api/user/chat/conversations/${conversationId}/messages`, {
      content,
      messageType,
    });
    return unwrap(res);
  },

  sendMessageMultipart: async ({ conversationId, content = '', messageType = 'file', file }) => {
    const form = new FormData();
    form.append('content', content);
    form.append('messageType', messageType);
    if (file) form.append('file', file);
    const res = await api.post(`/api/user/chat/conversations/${conversationId}/messages`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  },

  markMessageRead: async ({ conversationId, messageId }) => {
    const res = await api.put(
      `/api/user/chat/conversations/${conversationId}/messages/${messageId}/read`
    );
    return unwrap(res);
  },

  // Admin support chat: creates/finds admin conversation and sends message
  sendAdminSupportMessage: async ({ content, messageType = 'text' }) => {
    const res = await api.post('/api/user/chat/admin/message', { content, messageType });
    return unwrap(res);
  },

  sendAdminSupportMessageMultipart: async ({ content = '', messageType = 'file', file }) => {
    const form = new FormData();
    form.append('content', content);
    form.append('messageType', messageType);
    if (file) form.append('file', file);
    const res = await api.post('/api/user/chat/admin/message', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  },

  searchUsers: async ({ type, search = '', page = 1, limit = 20 }) => {
    const res = await api.get('/api/user/users/search', {
      params: { type, search, page, limit },
    });
    const data = unwrap(res);
    const users = data?.users ?? data?.items ?? data ?? [];
    return Array.isArray(users) ? users : [];
  },
};

