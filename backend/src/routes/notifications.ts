import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../database';
import { requireAuth } from '../middleware/auth';
import * as notificationService from '../services/notification.service';
import { emitNewNotification, emitUnreadCountUpdate } from '../sockets';
import { getSocketIO } from '../sockets/emitter';

const router = Router();
router.use(requireAuth);

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
