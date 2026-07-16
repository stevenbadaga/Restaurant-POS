import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../database';
import { requireAuth} from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '25' } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (status) where.status = status as string;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 25));

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { waiter: { select: { id: true, firstName: true, lastName: true } }, table: { select: { name: true, code: true } }, items: true },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, data: orders, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) { next(error); }
});

router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: req.user!.restaurantId, status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED'] } },
      include: { waiter: { select: { id: true, firstName: true, lastName: true } }, table: { select: { name: true, code: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (error) { next(error); }
});

export default router;
