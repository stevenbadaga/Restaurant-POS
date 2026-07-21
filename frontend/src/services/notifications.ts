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

export interface NotificationPreference {
  category: 'ORDER' | 'KITCHEN' | 'PAYMENT' | 'STOCK' | 'RESERVATION' | 'APPROVAL' | 'TIP' | 'SHIFT';
  inAppEnabled: boolean;
  soundEnabled: boolean;
  locked?: boolean;
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

export const getNotificationPreferences = async (userId?: string) => {
  const res = await api.get('/notifications/preferences', { params: userId ? { userId } : undefined });
  return res.data;
};

export const updateNotificationPreferences = async (preferences: NotificationPreference[], userId?: string) => {
  const res = await api.put('/notifications/preferences', { preferences }, { params: userId ? { userId } : undefined });
  return res.data;
};
