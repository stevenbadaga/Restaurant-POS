import { prisma } from '../database';
import { ForbiddenError, NotFoundError } from '../types';
import type { NotificationPreferenceCategory, NotificationType } from '@prisma/client';
import { emitNewNotification } from '../sockets';
import { getSocketIO } from '../sockets/emitter';

// ==========================================
// CREATE NOTIFICATION
// ==========================================

interface CreateNotificationInput {
  restaurantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  orderId?: string;
  entityType?: string;
  entityId?: string;
  forceInApp?: boolean;
}

export const NOTIFICATION_CATEGORIES: NotificationPreferenceCategory[] = [
  'ORDER',
  'KITCHEN',
  'PAYMENT',
  'STOCK',
  'RESERVATION',
  'APPROVAL',
  'TIP',
  'SHIFT',
];

export async function createNotification(input: CreateNotificationInput) {
  const category = resolveNotificationCategory(input.type, input.entityType);
  if (!input.forceInApp && !isCriticalSecurityNotification(input.type, input.entityType) && !(await isInAppEnabled(input.restaurantId, input.userId, category))) {
    return null;
  }

  const notification = await prisma.appNotification.create({
    data: {
      restaurantId: input.restaurantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message || null,
      orderId: input.orderId || null,
      entityType: input.entityType || null,
      entityId: input.entityId || null,
    },
  });

  return notification;
}

// ==========================================
// CREATE NOTIFICATION FOR MULTIPLE USERS
// ==========================================

interface CreateBulkNotificationInput {
  restaurantId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message?: string;
  orderId?: string;
  entityType?: string;
  entityId?: string;
  forceInApp?: boolean;
}

export async function createBulkNotification(input: CreateBulkNotificationInput) {
  const category = resolveNotificationCategory(input.type, input.entityType);
  const enabledUserIds = input.forceInApp || isCriticalSecurityNotification(input.type, input.entityType)
    ? input.userIds
    : await filterUsersWithInAppEnabled(input.restaurantId, input.userIds, category);

  const notifications = await Promise.all(
    enabledUserIds.map((userId) =>
      prisma.appNotification.create({
        data: {
          restaurantId: input.restaurantId,
          userId,
          type: input.type,
          title: input.title,
          message: input.message || null,
          orderId: input.orderId || null,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
        },
      })
    )
  );

  return notifications;
}

export async function emitNotification(notification: { restaurantId: string; userId: string; type: NotificationType; entityType?: string | null } & Record<string, unknown>) {
  try {
    const category = resolveNotificationCategory(notification.type, notification.entityType || undefined);
    const soundEnabled = isCriticalSecurityNotification(notification.type, notification.entityType || undefined)
      ? true
      : await isSoundEnabled(notification.restaurantId, notification.userId, category);
    const io = getSocketIO();
    emitNewNotification(io, notification.restaurantId, notification.userId, {
      notification,
      soundEnabled,
      category,
    });
  } catch {
    // Socket emission should not fail request processing.
  }
}

export async function emitNotifications(notifications: Array<{ restaurantId: string; userId: string; type: NotificationType; entityType?: string | null } & Record<string, unknown>>) {
  for (const notification of notifications) {
    await emitNotification(notification);
  }
}

export async function getNotificationPreferences(restaurantId: string, userId: string) {
  await ensureUserInRestaurant(restaurantId, userId);
  const stored = await prisma.notificationPreference.findMany({
    where: { restaurantId, userId },
    orderBy: { category: 'asc' },
  });
  const byCategory = new Map(stored.map((pref) => [pref.category, pref]));

  return NOTIFICATION_CATEGORIES.map((category) => {
    const pref = byCategory.get(category);
    return {
      category,
      inAppEnabled: pref?.inAppEnabled ?? true,
      soundEnabled: pref?.soundEnabled ?? true,
      locked: false,
    };
  });
}

export async function updateNotificationPreferences(
  restaurantId: string,
  userId: string,
  preferences: Array<{ category: NotificationPreferenceCategory; inAppEnabled: boolean; soundEnabled: boolean }>
) {
  await ensureUserInRestaurant(restaurantId, userId);
  const normalized = preferences.map((pref) => ({
    ...pref,
    soundEnabled: pref.inAppEnabled ? pref.soundEnabled : false,
  }));

  await prisma.$transaction(
    normalized.map((pref) =>
      prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category: pref.category } },
        create: {
          restaurantId,
          userId,
          category: pref.category,
          inAppEnabled: pref.inAppEnabled,
          soundEnabled: pref.soundEnabled,
        },
        update: {
          inAppEnabled: pref.inAppEnabled,
          soundEnabled: pref.soundEnabled,
        },
      })
    )
  );

  return getNotificationPreferences(restaurantId, userId);
}

export async function assertCanManageNotificationPreferences(
  actor: { id: string; restaurantId: string; roles: string[] },
  targetUserId: string
) {
  if (actor.id === targetUserId) return;
  const allowed = actor.roles.includes('ADMIN') || actor.roles.includes('MANAGER');
  if (!allowed) throw new ForbiddenError('Insufficient permissions');
  await ensureUserInRestaurant(actor.restaurantId, targetUserId);
}

// ==========================================
// GET NOTIFICATIONS
// ==========================================

interface GetNotificationsFilters {
  restaurantId: string;
  userId: string;
  unreadOnly?: boolean;
  type?: string;
  limit?: number;
  cursor?: string;
}

export async function getNotifications(filters: GetNotificationsFilters) {
  const limit = Math.min(filters.limit || 50, 100);

  const where: any = {
    restaurantId: filters.restaurantId,
    userId: filters.userId,
  };

  if (filters.unreadOnly) {
    where.isRead = false;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.cursor) {
    where.createdAt = { lt: new Date(filters.cursor) };
  }

  const notifications = await prisma.appNotification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  const nextCursor = items.length > 0 ? items[items.length - 1].createdAt.toISOString() : null;

  return {
    notifications: items,
    pagination: {
      hasMore,
      nextCursor: hasMore ? nextCursor : null,
      limit,
    },
  };
}

// ==========================================
// GET UNREAD COUNT
// ==========================================

export async function getUnreadCount(restaurantId: string, userId: string) {
  const count = await prisma.appNotification.count({
    where: {
      restaurantId,
      userId,
      isRead: false,
    },
  });

  return { count };
}

// ==========================================
// MARK AS READ
// ==========================================

export async function markAsRead(notificationId: string, userId: string) {
  const result = await prisma.appNotification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  if (result.count === 0) {
    throw new NotFoundError('Notification not found');
  }

  return { success: true };
}

// ==========================================
// MARK ALL AS READ
// ==========================================

export async function markAllAsRead(restaurantId: string, userId: string) {
  await prisma.appNotification.updateMany({
    where: {
      restaurantId,
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return { success: true };
}

// ==========================================
// FIND TARGET USERS BY ROLE
// ==========================================

export async function getUsersByRole(restaurantId: string, roles: string[]) {
  const users = await prisma.user.findMany({
    where: {
      restaurantId,
      status: 'ACTIVE',
      roles: {
        some: {
          role: {
            name: { in: roles },
          },
        },
      },
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

export function resolveNotificationCategory(type: NotificationType, entityType?: string): NotificationPreferenceCategory {
  if (type === 'ORDER_SUBMITTED' || type === 'ORDER_READY' || type === 'ORDER_CANCELLED' || type === 'WAITER_ASSIGNED') return 'ORDER';
  if (type === 'KITCHEN_ITEM_READY') return 'KITCHEN';
  if (type === 'PAYMENT_RECEIVED') return 'PAYMENT';
  if (type === 'LOW_STOCK' || entityType?.startsWith('stock')) return 'STOCK';
  if (type === 'RESERVATION_CREATED' || entityType === 'reservation') return 'RESERVATION';
  if (type === 'APPROVAL_NEEDED' || entityType === 'approval_request') return 'APPROVAL';
  if (type === 'TIP_RECEIVED') return 'TIP';
  if (entityType?.includes('shift') || entityType?.includes('attendance')) return 'SHIFT';
  return 'ORDER';
}

function isCriticalSecurityNotification(type: NotificationType, entityType?: string) {
  return type === 'SYSTEM' && ['security', 'auth', 'session'].includes(entityType || '');
}

async function filterUsersWithInAppEnabled(restaurantId: string, userIds: string[], category: NotificationPreferenceCategory) {
  if (userIds.length === 0) return [];
  const disabled = await prisma.notificationPreference.findMany({
    where: {
      restaurantId,
      userId: { in: userIds },
      category,
      inAppEnabled: false,
    },
    select: { userId: true },
  });
  const disabledIds = new Set(disabled.map((pref) => pref.userId));
  return userIds.filter((userId) => !disabledIds.has(userId));
}

async function isInAppEnabled(restaurantId: string, userId: string, category: NotificationPreferenceCategory) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_category: { userId, category } },
    select: { inAppEnabled: true },
  });
  return pref?.inAppEnabled ?? true;
}

async function isSoundEnabled(restaurantId: string, userId: string, category: NotificationPreferenceCategory) {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_category: { userId, category } },
    select: { inAppEnabled: true, soundEnabled: true },
  });
  if (!pref) return true;
  return pref.inAppEnabled && pref.soundEnabled;
}

async function ensureUserInRestaurant(restaurantId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, restaurantId }, select: { id: true } });
  if (!user) throw new NotFoundError('User not found');
}
