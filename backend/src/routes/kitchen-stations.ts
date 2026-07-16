import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  displayOrder: z.number().int().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, isActive } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const stations = await prisma.kitchenStation.findMany({
      where,
      include: { _count: { select: { menuItems: true } } },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: stations.map((s) => ({ id: s.id, name: s.name, description: s.description, displayOrder: s.displayOrder, isActive: s.isActive, menuItemCount: s._count.menuItems })),
    });
  } catch (error) { next(error); }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);
    const existing = await prisma.kitchenStation.findUnique({ where: { restaurantId_name: { restaurantId: req.user!.restaurantId, name: parsed.name } } });
    if (existing) throw new BadRequestError('Station name already exists');
    const station = await prisma.kitchenStation.create({ data: { restaurantId: req.user!.restaurantId, ...parsed } });
    await createAuditLog({ restaurantId: req.user!.restaurantId, userId: req.user!.id, action: 'KITCHEN_STATION_CREATED', entityType: 'KITCHEN_STATION', entityId: station.id, description: `Created station "${station.name}"` });
    res.status(201).json({ success: true, message: 'Station created', data: station });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.partial().parse(req.body);
    const station = await prisma.kitchenStation.findFirst({ where: { id: req.params.id, restaurantId: req.user!.restaurantId } });
    if (!station) throw new NotFoundError('Station not found');
    if (parsed.name) {
      const existing = await prisma.kitchenStation.findFirst({ where: { restaurantId: req.user!.restaurantId, name: parsed.name, id: { not: req.params.id } } });
      if (existing) throw new BadRequestError('Name already in use');
    }
    const updated = await prisma.kitchenStation.update({ where: { id: req.params.id }, data: parsed });
    await createAuditLog({ restaurantId: req.user!.restaurantId, userId: req.user!.id, action: 'KITCHEN_STATION_UPDATED', entityType: 'KITCHEN_STATION', entityId: updated.id, description: `Updated station "${updated.name}"` });
    res.json({ success: true, message: 'Station updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const station = await prisma.kitchenStation.findFirst({ where: { id: req.params.id, restaurantId: req.user!.restaurantId } });
    if (!station) throw new NotFoundError('Station not found');
    const updated = await prisma.kitchenStation.update({ where: { id: req.params.id }, data: { isActive } });
    res.json({ success: true, message: `Station ${isActive ? 'activated' : 'deactivated'}`, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
