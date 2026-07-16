import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric'),
  description: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:mm format'),
  crossesMidnight: z.boolean().optional(),
  defaultBreakMinutes: z.number().int().min(0).optional(),
  lateGraceMinutes: z.number().int().min(0).optional(),
  earlyDepartureToleranceMinutes: z.number().int().min(0).optional(),
  overtimeThresholdMinutes: z.number().int().min(0).optional(),
  colorKey: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    const templates = await prisma.shiftTemplate.findMany({ where, orderBy: { startTime: 'asc' } });
    res.json({ success: true, data: templates });
  } catch (error) { next(error); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.shiftTemplate.findFirst({ where: { id: req.params.id, restaurantId: req.user!.restaurantId } });
    if (!template) throw new NotFoundError('Template not found');
    res.json({ success: true, data: template });
  } catch (error) { next(error); }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);
    const existing = await prisma.shiftTemplate.findFirst({
      where: { restaurantId: req.user!.restaurantId, OR: [{ name: parsed.name }, { code: parsed.code }] },
    });
    if (existing) throw new BadRequestError('Template name or code already exists');
    const template = await prisma.shiftTemplate.create({ data: { restaurantId: req.user!.restaurantId, ...parsed } });
    res.status(201).json({ success: true, message: 'Template created', data: template });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.partial().parse(req.body);
    const template = await prisma.shiftTemplate.findFirst({ where: { id: req.params.id, restaurantId: req.user!.restaurantId } });
    if (!template) throw new NotFoundError('Template not found');
    if (parsed.name || parsed.code) {
      const conflict = await prisma.shiftTemplate.findFirst({
        where: { restaurantId: req.user!.restaurantId, id: { not: req.params.id }, OR: [{ name: parsed.name! }, { code: parsed.code! }].filter(Boolean) },
      });
      if (conflict) throw new BadRequestError('Name or code already in use');
    }
    const updated = await prisma.shiftTemplate.update({ where: { id: req.params.id }, data: parsed });
    res.json({ success: true, message: 'Template updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const updated = await prisma.shiftTemplate.updateMany({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      data: { isActive },
    });
    if (updated.count === 0) throw new NotFoundError('Template not found');
    res.json({ success: true, message: `Template ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
