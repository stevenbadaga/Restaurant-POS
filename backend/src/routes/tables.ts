import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  diningAreaId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name required'),
  code: z.string().min(1, 'Code required'),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  shape: z.enum(['SQUARE', 'RECTANGLE', 'ROUND', 'OVAL']).optional(),
  notes: z.string().optional().or(z.literal('')),
  displayOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  diningAreaId: z.string().uuid().optional().nullable(),
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  capacity: z.number().int().min(1).optional(),
  shape: z.enum(['SQUARE', 'RECTANGLE', 'ROUND', 'OVAL']).optional(),
  notes: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

const statusSchema = z.object({ isActive: z.boolean() });

const availabilitySchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE']),
});

// GET /api/tables
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, diningAreaId, status, isActive, page = '1', limit = '50', sort = 'displayOrder', order = 'asc' } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (diningAreaId) where.diningAreaId = diningAreaId as string;
    if (status) where.status = status as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));

    const [tables, total] = await Promise.all([
      prisma.restaurantTable.findMany({
        where,
        include: { diningArea: { select: { id: true, name: true } } },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { [sort as string]: order as string },
      }),
      prisma.restaurantTable.count({ where }),
    ]);

    res.json({
      success: true,
      data: tables,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/tables/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { diningArea: { select: { id: true, name: true } } },
    });
    if (!table) throw new NotFoundError('Table not found');
    res.json({ success: true, data: table });
  } catch (error) {
    next(error);
  }
});

// POST /api/tables
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);

    const existing = await prisma.restaurantTable.findUnique({
      where: { restaurantId_code: { restaurantId: req.user!.restaurantId, code: parsed.code } },
    });
    if (existing) throw new BadRequestError('Table code already exists');

    if (parsed.diningAreaId) {
      const area = await prisma.diningArea.findFirst({
        where: { id: parsed.diningAreaId, restaurantId: req.user!.restaurantId },
      });
      if (!area) throw new BadRequestError('Invalid dining area');
    }

    const table = await prisma.restaurantTable.create({
      data: { restaurantId: req.user!.restaurantId, ...parsed },
      include: { diningArea: { select: { id: true, name: true } } },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'TABLE_CREATED',
      entityType: 'RESTAURANT_TABLE',
      entityId: table.id,
      description: `Created table ${table.code} - ${table.name}`,
    });

    res.status(201).json({ success: true, message: 'Table created', data: table });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/tables/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const table = await prisma.restaurantTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!table) throw new NotFoundError('Table not found');

    if (parsed.code) {
      const existing = await prisma.restaurantTable.findFirst({
        where: { restaurantId: req.user!.restaurantId, code: parsed.code, id: { not: req.params.id } },
      });
      if (existing) throw new BadRequestError('Code already in use');
    }

    if (parsed.diningAreaId) {
      const area = await prisma.diningArea.findFirst({
        where: { id: parsed.diningAreaId, restaurantId: req.user!.restaurantId },
      });
      if (!area) throw new BadRequestError('Invalid dining area');
    }

    const updated = await prisma.restaurantTable.update({
      where: { id: req.params.id },
      data: parsed,
      include: { diningArea: { select: { id: true, name: true } } },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'TABLE_UPDATED',
      entityType: 'RESTAURANT_TABLE',
      entityId: updated.id,
      description: `Updated table ${updated.code}`,
    });

    res.json({ success: true, message: 'Table updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/tables/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = statusSchema.parse(req.body);
    const table = await prisma.restaurantTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!table) throw new NotFoundError('Table not found');

    const updated = await prisma.restaurantTable.update({
      where: { id: req.params.id },
      data: { isActive: parsed.isActive },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: parsed.isActive ? 'TABLE_ACTIVATED' : 'TABLE_DEACTIVATED',
      entityType: 'RESTAURANT_TABLE',
      entityId: updated.id,
      description: `Table ${updated.code} ${parsed.isActive ? 'activated' : 'deactivated'}`,
    });

    res.json({ success: true, message: `Table ${parsed.isActive ? 'activated' : 'deactivated'}`, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/tables/:id/availability
router.patch('/:id/availability', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = availabilitySchema.parse(req.body);
    const table = await prisma.restaurantTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!table) throw new NotFoundError('Table not found');

    const updated = await prisma.restaurantTable.update({
      where: { id: req.params.id },
      data: { status: parsed.status },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'TABLE_STATUS_CHANGED',
      entityType: 'RESTAURANT_TABLE',
      entityId: updated.id,
      description: `Table ${updated.code} status changed to ${parsed.status}`,
      metadata: { previousStatus: table.status, newStatus: parsed.status },
    });

    res.json({ success: true, message: `Table status changed to ${parsed.status}`, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// DELETE /api/tables/:id
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const table = await prisma.restaurantTable.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!table) throw new NotFoundError('Table not found');

    const [orderCount, reservationCount, waitingListCount] = await Promise.all([
      prisma.order.count({ where: { restaurantId: req.user!.restaurantId, tableId: table.id } }),
      prisma.reservation.count({ where: { restaurantId: req.user!.restaurantId, tableId: table.id } }),
      prisma.waitingListEntry.count({ where: { restaurantId: req.user!.restaurantId, tableId: table.id } }),
    ]);

    if (orderCount > 0 || reservationCount > 0 || waitingListCount > 0) {
      throw new BadRequestError('This table has operational history. Deactivate it instead of deleting it.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.tableQrToken.deleteMany({ where: { restaurantId: req.user!.restaurantId, tableId: table.id } });
      await tx.restaurantTable.delete({ where: { id: table.id } });
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'TABLE_DELETED',
      entityType: 'RESTAURANT_TABLE',
      entityId: table.id,
      description: `Deleted table ${table.code}`,
    });

    res.json({ success: true, message: 'Table deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
