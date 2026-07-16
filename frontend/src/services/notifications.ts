import api from './api';

export interface AppNotification {
  id: string;
  restaurantId: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  orderId: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

// Get notifications list (cursor pagination)
export const getNotifications = async (params?: Record<string, string>) => {
  const res = await api.get('/notifications', { params });
  return res.data;
};

// Get unread count
export const getUnreadCount = async () => {
  const res = await api.get('/notifications/unread-count');
  return res.data;
};

// Mark single notification as read
export const markAsRead = async (id: string) => {
  const res = await api.patch(`/notifications/${id}/read`);
  return res.data;
};

// Mark all notifications as read
export const markAllAsRead = async () => {
  const res = await api.post('/notifications/read-all');
  return res.data;
};
