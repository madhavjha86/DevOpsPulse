import api from './api';

export const notificationService = {
  getAll: (page: number = 1, unread_only: boolean = false) =>
    api.get('/api/v1/notifications', { params: { page, unread_only } }),

  getUnreadCount: () => api.get('/api/v1/notifications/unread-count'),

  markAsRead: (ids: number[]) =>
    api.post('/api/v1/notifications/mark-read', { notification_ids: ids }),

  markAllAsRead: () => api.post('/api/v1/notifications/mark-all-read'),
};
