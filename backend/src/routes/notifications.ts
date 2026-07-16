import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../database';
import { requireAuth } from '../middleware/auth';
const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.appNotification.findMany({
      where: { userId: req.user!.id, restaurantId: req.user!.restaurantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: notifications });
  } catch (error) { next(error); }
});

router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await prisma.appNotification.count({
      where: { userId: req.user!.id, restaurantId: req.user!.restaurantId, isRead: false },
    });
    res.json({ success: true, data: { count } });
  } catch (error) { next(error); }
});

router.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.appNotification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true, message: 'Marked as read' });
  } catch (error) { next(error); }
});

router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.appNotification.updateMany({
      where: { userId: req.user!.id, restaurantId: req.user!.restaurantId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true, message: 'All marked as read' });
  } catch (error) { next(error); }
});

export default router;
