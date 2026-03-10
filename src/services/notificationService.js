import { apiClient as api } from './apiClient';

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export const notificationService = {
  getUnreadCount: async () => {
    const res = await api.get('/api/user/notifications/unread-count', {
      params: { time: new Date().toISOString() },
    });
    const data = unwrap(res);
    // support shapes: {count}, {unreadCount}, {data:{count}}
    return (
      data?.count ??
      data?.unreadCount ??
      data?.unread ??
      data?.data?.count ??
      0
    );
  },

  list: async ({ page = 1, limit = 10, unreadOnly = false } = {}) => {
    const res = await api.get('/api/user/notifications', {
      params: { page, limit, unreadOnly },
    });
    const data = unwrap(res);
    // support shapes: {items, total}, {notifications}, {rows}
    const items =
      data?.items ??
      data?.notifications ??
      data?.rows ??
      data?.data?.items ??
      data?.data?.notifications ??
      [];
    return Array.isArray(items) ? items : [];
  },

  markRead: async (id) => {
    const res = await api.patch(`/api/user/notifications/${id}/read`);
    return unwrap(res);
  },

  markAllRead: async () => {
    const res = await api.patch('/api/user/notifications/read-all');
    return unwrap(res);
  },
};

