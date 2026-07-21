import { useState, useEffect, useRef } from 'react';
import { LogOut, Menu, Bell, Search, CheckCheck, ShoppingCart, ChefHat, Clock, CreditCard, Package, Users, DollarSign, CalendarDays, ThumbsUp, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib';
import { useAuth } from '@/contexts';
import { connectSocket } from '@/services/socket';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, type AppNotification } from '@/services/notifications';
import { formatRelativeTime } from '@/lib';

interface TopNavProps {
  onMenuClick: () => void;
  isCollapsed: boolean;
}

const NOTIF_ICONS: Record<string, any> = {
  ORDER_SUBMITTED: ShoppingCart,
  KITCHEN_ITEM_READY: ChefHat,
  ORDER_READY: Clock,
  PAYMENT_RECEIVED: CreditCard,
  LOW_STOCK: Package,
  RESERVATION_CREATED: CalendarDays,
  WAITER_ASSIGNED: Users,
  APPROVAL_NEEDED: ThumbsUp,
  TIP_RECEIVED: DollarSign,
};

const NOTIF_COLORS: Record<string, string> = {
  ORDER_SUBMITTED: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600',
  KITCHEN_ITEM_READY: 'bg-green-100 dark:bg-green-900/20 text-green-600',
  ORDER_READY: 'bg-green-100 dark:bg-green-900/20 text-green-600',
  PAYMENT_RECEIVED: 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600',
  LOW_STOCK: 'bg-amber-100 dark:bg-amber-900/20 text-amber-600',
  RESERVATION_CREATED: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600',
  WAITER_ASSIGNED: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600',
  APPROVAL_NEEDED: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600',
  TIP_RECEIVED: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600',
};

function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.12);
  } catch {
    // Browser may block audio until the user interacts with the page.
  }
}

export function TopNav({ onMenuClick, isCollapsed: _isCollapsed }: TopNavProps) {
  const navigate = useNavigate();
  const { user, restaurant, logout } = useAuth();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'User';
  const role = user?.roles?.[0]?.replace(/_/g, ' ') ?? 'Staff';
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : 'U';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<AppNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const fetchUnreadCount = async () => {
    try {
      const res = await getUnreadCount();
      setUnreadCount(res.data.count);
    } catch { /* silent */ }
  };

  const fetchRecentNotifs = async () => {
    setLoadingNotifs(true);
    try {
      const res = await getNotifications({ limit: '5' });
      setRecentNotifs(res.data.notifications || []);
    } catch { /* silent */ }
    finally { setLoadingNotifs(false); }
  };

  useEffect(() => {
    fetchUnreadCount();
    fetchRecentNotifs();
  }, []);

  // Socket.IO for real-time
  useEffect(() => {
    const socket = connectSocket(restaurant?.id || '', user?.id);

    socket.on('notification:new', (payload: any) => {
      if (payload?.soundEnabled) playNotificationSound();
      fetchUnreadCount();
      fetchRecentNotifs();
    });

    socket.on('notification:unread-count', (data: any) => {
      if (data?.count !== undefined) setUnreadCount(data.count);
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:unread-count');
      socket.disconnect();
    };
  }, [restaurant?.id, user?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [dropdownOpen]);

  const handleToggleDropdown = () => {
    if (!dropdownOpen) {
      fetchRecentNotifs();
    }
    setDropdownOpen(!dropdownOpen);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setUnreadCount(0);
      setRecentNotifs((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* silent */ }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markAsRead(id);
      setRecentNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      fetchUnreadCount();
    } catch { /* silent */ }
  };

  const handleNotifClick = (notification: AppNotification) => {
    setDropdownOpen(false);
    if (!notification.isRead) handleMarkRead(notification.id);
    if (notification.entityType === 'order' || notification.orderId) {
      navigate(`/orders?id=${notification.orderId}`);
    } else if (notification.type === 'LOW_STOCK') {
      navigate('/inventory/alerts');
    } else if (notification.type === 'TIP_RECEIVED') {
      navigate('/tips');
    } else {
      navigate('/notifications');
    }
  };

  const getNotifIcon = (type: string) => {
    const Icon = NOTIF_ICONS[type] || Bell;
    return <Icon className="h-4 w-4" />;
  };

  const getNotifColor = (type: string) => {
    return NOTIF_COLORS[type] || 'bg-gray-100 dark:bg-gray-900/20 text-gray-600';
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-4 sm:px-6 transition-all duration-300',
        'lg:ml-0'
      )}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="hidden sm:flex flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border text-sm bg-[var(--color-input-bg)] border-[var(--color-input-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-transparent transition-all duration-200"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={handleToggleDropdown}
            className="relative p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--color-card-bg)] border border-[var(--color-card-border)] rounded-xl shadow-xl z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</h3>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs text-[var(--color-accent)] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loadingNotifs ? (
                  <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">Loading...</div>
                ) : recentNotifs.length === 0 ? (
                  <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">No notifications yet</div>
                ) : (
                  recentNotifs.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--color-bg-secondary)] ${
                        !notif.isRead ? 'bg-[var(--color-accent)]/[0.03]' : ''
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 ${getNotifColor(notif.type)}`}>
                        {getNotifIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs ${!notif.isRead ? 'font-semibold' : ''} text-[var(--color-text-primary)]`}>
                          {notif.title}
                        </p>
                        {notif.message && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">{notif.message}</p>
                        )}
                        <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{formatRelativeTime(notif.createdAt)}</p>
                      </div>
                      {!notif.isRead && (
                        <span className="h-2 w-2 rounded-full bg-[var(--color-accent)] shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-[var(--color-border)] p-2">
                <button
                  onClick={() => { setDropdownOpen(false); navigate('/notifications'); }}
                  className="w-full py-2 text-center text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-bg-secondary)] rounded-lg transition-colors"
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-3 ml-2">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{displayName}</p>
            <p className="text-xs text-[var(--color-text-muted)] capitalize">{role.toLowerCase()}</p>
          </div>
          <div className="h-9 w-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white font-medium text-sm">
            {initials}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-secondary)] transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
