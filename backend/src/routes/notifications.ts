import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import * as notificationService from '../services/notification.service';
import { emitUnreadCountUpdate } from '../sockets';
import { getSocketIO } from '../sockets/emitter';
import { BadRequestError } from '../types';
import { z } from 'zod';

const router = Router();
router.use(requireAuth);

const preferenceSchema = z.object({
  preferences: z.array(z.object({
    category: z.enum(['ORDER', 'KITCHEN', 'PAYMENT', 'STOCK', 'RESERVATION', 'APPROVAL', 'TIP', 'SHIFT']),
    inAppEnabled: z.boolean(),
    soundEnabled: z.boolean(),
  })).min(1),
});

// ==========================================
// GET /notifications/preferences
// ==========================================
router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = (req.query.userId as string) || req.user!.id;
    await notificationService.assertCanManageNotificationPreferences(req.user!, targetUserId);
    const preferences = await notificationService.getNotificationPreferences(req.user!.restaurantId, targetUserId);
    res.json({ success: true, data: { preferences } });
  } catch (error) { next(error); }
});

// ==========================================
// PUT /notifications/preferences
// ==========================================
router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = (req.query.userId as string) || req.user!.id;
    await notificationService.assertCanManageNotificationPreferences(req.user!, targetUserId);
    const { preferences } = preferenceSchema.parse(req.body);
    const updated = await notificationService.updateNotificationPreferences(
      req.user!.restaurantId,
      targetUserId,
      preferences
    );
    res.json({ success: true, message: 'Notification preferences updated', data: { preferences: updated } });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// GET /notifications - List with cursor pagination
// ==========================================
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getNotifications({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type as string,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      cursor: req.query.cursor as string,
    });
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// ==========================================
// GET /notifications/unread-count
// ==========================================
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await notificationService.getUnreadCount(
      req.user!.restaurantId,
      req.user!.id
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// ==========================================
// PATCH /notifications/:id/read
// ==========================================
router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user!.id);
    // Emit updated count
    const count = await notificationService.getUnreadCount(req.user!.restaurantId, req.user!.id);
    const sio = getSocketIO();
    emitUnreadCountUpdate(sio, req.user!.restaurantId, req.user!.id, count);
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) { next(error); }
});

// ==========================================
// POST /notifications/read-all
// ==========================================
router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllAsRead(req.user!.restaurantId, req.user!.id);
    // Emit updated count
    const sio = getSocketIO();
    emitUnreadCountUpdate(sio, req.user!.restaurantId, req.user!.id, { count: 0 });
    res.json({ success: true, message: 'All marked as read' });
  } catch (error) { next(error); }
});

export default router;
