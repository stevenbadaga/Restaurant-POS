import { prisma } from '../database';
import { NotFoundError } from '../types';
import type { NotificationType } from '@prisma/client';

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
}

export async function createNotification(input: CreateNotificationInput) {
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
}

export async function createBulkNotification(input: CreateBulkNotificationInput) {
  const notifications = await Promise.all(
    input.userIds.map((userId) =>
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
