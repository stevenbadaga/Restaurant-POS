import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional().or(z.literal('')),
  displayOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

// GET /api/dining-areas
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, isActive, sort = 'displayOrder', order = 'asc' } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const areas = await prisma.diningArea.findMany({
      where,
      include: {
        _count: { select: { tables: true } },
        tables: { where: { isActive: true }, select: { id: true } },
      },
      orderBy: { [sort as string]: order as string },
    });

    res.json({
      success: true,
      data: areas.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        displayOrder: a.displayOrder,
        isActive: a.isActive,
        totalTables: a._count.tables,
        activeTables: a.tables.length,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/dining-areas/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const area = await prisma.diningArea.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { tables: true } } },
    });
    if (!area) throw new NotFoundError('Dining area not found');
    res.json({ success: true, data: area });
  } catch (error) {
    next(error);
  }
});

// POST /api/dining-areas
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);
    const existing = await prisma.diningArea.findUnique({
      where: { restaurantId_name: { restaurantId: req.user!.restaurantId, name: parsed.name } },
    });
    if (existing) throw new BadRequestError('A dining area with this name already exists');

    const area = await prisma.diningArea.create({
      data: { restaurantId: req.user!.restaurantId, ...parsed },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'DINING_AREA_CREATED',
      entityType: 'DINING_AREA',
      entityId: area.id,
      description: `Created dining area "${area.name}"`,
    });

    res.status(201).json({ success: true, message: 'Dining area created', data: area });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/dining-areas/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const area = await prisma.diningArea.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!area) throw new NotFoundError('Dining area not found');

    if (parsed.name) {
      const existing = await prisma.diningArea.findFirst({
        where: { restaurantId: req.user!.restaurantId, name: parsed.name, id: { not: req.params.id } },
      });
      if (existing) throw new BadRequestError('Name already in use');
    }

    const updated = await prisma.diningArea.update({
      where: { id: req.params.id },
      data: parsed,
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'DINING_AREA_UPDATED',
      entityType: 'DINING_AREA',
      entityId: updated.id,
      description: `Updated dining area "${updated.name}"`,
    });

    res.json({ success: true, message: 'Dining area updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/dining-areas/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const area = await prisma.diningArea.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { tables: true } } },
    });
    if (!area) throw new NotFoundError('Dining area not found');

    const updated = await prisma.diningArea.update({
      where: { id: req.params.id },
      data: { isActive },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: isActive ? 'DINING_AREA_ACTIVATED' : 'DINING_AREA_DEACTIVATED',
      entityType: 'DINING_AREA',
      entityId: updated.id,
      description: `${isActive ? 'Activated' : 'Deactivated'} dining area "${updated.name}"`,
      metadata: { activeTables: area._count.tables },
    });

    res.json({
      success: true,
      message: `Dining area ${isActive ? 'activated' : 'deactivated'}`,
      data: updated,
      warning: !isActive && area._count.tables > 0 ? `${area._count.tables} table(s) still belong to this area` : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
