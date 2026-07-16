import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  Clock,
  ChefHat,
  CreditCard,
  ShoppingCart,
  AlertTriangle,
  Users,
  DollarSign,
  CalendarDays,
  ThumbsUp,
  Package,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  PageHeader,
  Card,
  CardContent,
  CardHeader,
  Button,
  Badge,
  Loading,
  EmptyState,
  ErrorState,
} from '@/components/ui';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  type AppNotification,
} from '@/services/notifications';
import { connectSocket, disconnectSocket } from '@/services/socket';
import { formatDate, formatRelativeTime } from '@/lib';

const NOTIFICATION_ICONS: Record<string, any> = {
  ORDER_SUBMITTED: ShoppingCart,
  KITCHEN_ITEM_READY: ChefHat,
  ORDER_READY: Clock,
  ORDER_CANCELLED: ShoppingCart,
  PAYMENT_RECEIVED: CreditCard,
  LOW_STOCK: Package,
  RESERVATION_CREATED: CalendarDays,
  WAITER_ASSIGNED: Users,
  APPROVAL_NEEDED: ThumbsUp,
  TIP_RECEIVED: DollarSign,
  SYSTEM: Bell,
};

const NOTIFICATION_COLORS: Record<string, string> = {
  ORDER_SUBMITTED: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600',
  KITCHEN_ITEM_READY: 'bg-green-100 dark:bg-green-900/20 text-green-600',
  ORDER_READY: 'bg-green-100 dark:bg-green-900/20 text-green-600',
  ORDER_CANCELLED: 'bg-red-100 dark:bg-red-900/20 text-red-600',
  PAYMENT_RECEIVED: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600',
  LOW_STOCK: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600',
  RESERVATION_CREATED: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600',
  WAITER_ASSIGNED: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600',
  APPROVAL_NEEDED: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600',
  TIP_RECEIVED: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600',
  SYSTEM: 'bg-gray-100 dark:bg-gray-900/20 text-gray-600',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user, restaurant } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const socketRef = useRef<any>(null);

  const fetchNotifications = useCallback(async (cursor?: string, append = false) => {
    try {
      const params: Record<string, string> = { limit: '50' };
      if (filter !== 'all') params.unreadOnly = 'true';
      if (cursor) params.cursor = cursor;

      const result = await getNotifications(params);
      const data = result.data;

      if (append) {
        setNotifications((prev) => [...prev, ...data.notifications]);
      } else {
        setNotifications(data.notifications);
      }
      setHasMore(data.pagination.hasMore);
      setNextCursor(data.pagination.nextCursor);
    } catch (err: any) {
      throw err;
    }
  }, [filter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await getUnreadCount();
      setUnreadCount(result.data.count);
    } catch {
      // silent
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    loadData();
  }, [loadData, filter]);

  // Socket.IO for real-time notifications
  useEffect(() => {
    const socket = connectSocket(restaurant?.id || '');
    socketRef.current = socket;

    socket.on('notification:new', () => {
      fetchNotifications();
      fetchUnreadCount();
    });

    socket.on('notification:unread-count', (data: any) => {
      if (data?.count !== undefined) {
        setUnreadCount(data.count);
      }
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:unread-count');
      socket.disconnect();
    };
  }, [restaurant?.id, fetchNotifications, fetchUnreadCount]);

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // silent
    } finally {
      setMarkingAll(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      fetchUnreadCount();
    } catch {
      // silent
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      await fetchNotifications(nextCursor, true);
    } catch {
      // silent
    } finally {
      setLoadingMore(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    const Icon = NOTIFICATION_ICONS[type] || Bell;
    return <Icon className="h-5 w-5" />;
  };

  const getNotificationColor = (type: string) => {
    return NOTIFICATION_COLORS[type] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-600';
  };

  const handleNavigate = (notification: AppNotification) => {
    if (!notification.isRead) {
      handleMarkRead(notification.id);
    }

    if (notification.entityType === 'order' || notification.orderId) {
      navigate(`/orders?id=${notification.orderId}`);
    } else if (notification.entityType === 'reservation') {
      navigate(`/reservations?id=${notification.entityId}`);
    } else if (notification.type === 'LOW_STOCK') {
      navigate('/inventory/alerts');
    } else if (notification.type === 'TIP_RECEIVED') {
      navigate('/tips');
    }
  };

  if (loading) return <Loading message="Loading notifications..." />;
  if (error) return <ErrorState title="Error" message={error} action={<Button onClick={loadData}>Retry</Button>} />;

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Notifications"
        description="Stay updated with real-time alerts and activity"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadData}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleMarkAllRead}
                isLoading={markingAll}
                leftIcon={<CheckCheck className="h-4 w-4" />}
              >
                Mark All Read ({unreadCount})
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'all'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === 'unread'
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {/* Notification List */}
      <Card>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={<Bell className="h-12 w-12" />}
                title="No notifications"
                description={filter === 'unread' ? 'No unread notifications' : 'Notifications will appear here when events happen'}
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {notifications.map((notification) => {
                const isUnread = !notification.isRead;
                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNavigate(notification)}
                    className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)] ${
                      isUnread ? 'bg-[var(--color-accent)]/[0.03]' : ''
                    }`}
                  >
                    {/* Icon */}
                    <div className={`p-2.5 rounded-lg shrink-0 ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className={`text-sm ${isUnread ? 'font-semibold text-[var(--color-text-primary)]' : 'text-[var(--color-text-primary)]'}`}>
                            {notification.title}
                          </p>
                          {notification.message && (
                            <p className="text-sm text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                          )}
                        </div>
                        {isUnread && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(notification.id); }}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)] shrink-0"
                            title="Mark as read"
                          >
                            <CheckCheck className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="neutral">{notification.type.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {formatRelativeTime(notification.createdAt)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="px-6 py-4 border-t border-[var(--color-border)] text-center">
              <Button variant="ghost" size="sm" onClick={handleLoadMore} isLoading={loadingMore}>
                Load More
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
