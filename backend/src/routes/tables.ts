import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';
import { emitTableWaiterAssigned, emitTableWaiterUnassigned } from '../sockets';
import { getSocketIO } from '../sockets/emitter';

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
  positionX: z.number().int().optional(),
  positionY: z.number().int().optional(),
});

const statusSchema = z.object({ isActive: z.boolean() });

const availabilitySchema = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED', 'CLEANING', 'OUT_OF_SERVICE']),
});

const sortFields = new Set(['name', 'code', 'capacity', 'status', 'displayOrder', 'createdAt', 'updatedAt']);

// GET /api/tables
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, diningAreaId, status, isActive, page = '1', limit = '50', sort = 'displayOrder', order = 'asc' } = req.query;
    const sortField = typeof sort === 'string' && sortFields.has(sort) ? sort : 'displayOrder';
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
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
        include: {
          diningArea: { select: { id: true, name: true } },
          assignedWaiter: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { [sortField]: sortOrder },
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

// ==========================================
// ASSIGN WAITER TO TABLE (ADMIN / MANAGER)
// ==========================================

const assignTableWaiterSchema = z.object({
  waiterId: z.string().uuid().nullable(),
});

router.patch('/:id/assign-waiter', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignTableWaiterSchema.parse(req.body);
    const restaurantId = req.user!.restaurantId;

    const table = await prisma.restaurantTable.findFirst({
      where: { id: req.params.id, restaurantId },
    });
    if (!table) throw new NotFoundError('Table not found');

    let waiterName = '';
    if (parsed.waiterId) {
      const waiter = await prisma.user.findFirst({
        where: {
          id: parsed.waiterId,
          restaurantId,
          status: 'ACTIVE',
          roles: {
            some: { role: { name: { in: ['WAITER', 'ADMIN', 'MANAGER'] } } },
          },
        },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!waiter) {
        throw new BadRequestError('Invalid waiter. User must be ACTIVE with WAITER/ADMIN/MANAGER role.');
      }
      waiterName = `${waiter.firstName} ${waiter.lastName}`;
    }

    const previousWaiterId = table.assignedWaiterId;

    const updated = await prisma.restaurantTable.update({
      where: { id: req.params.id },
      data: { assignedWaiterId: parsed.waiterId },
      include: {
        diningArea: { select: { id: true, name: true } },
        assignedWaiter: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await createAuditLog({
      restaurantId,
      userId: req.user!.id,
      action: 'TABLE_WAITER_ASSIGNED',
      entityType: 'RESTAURANT_TABLE',
      entityId: table.id,
      description: parsed.waiterId
        ? `Waiter ${waiterName} assigned to table ${table.code}`
        : `Waiter unassigned from table ${table.code}`,
      metadata: { previousWaiterId, newWaiterId: parsed.waiterId },
    });

    // Emit socket events
    try {
      const io = getSocketIO();
      emitTableWaiterAssigned(io, restaurantId, {
        tableId: table.id,
        tableCode: table.code,
        waiterId: parsed.waiterId,
        waiterName: parsed.waiterId ? waiterName : null,
      });
      if (previousWaiterId && previousWaiterId !== parsed.waiterId) {
        emitTableWaiterUnassigned(io, restaurantId, {
          tableId: table.id,
          tableCode: table.code,
          waiterId: previousWaiterId,
        });
      }
    } catch { /* Socket may not be initialized */ }

    res.json({ success: true, message: parsed.waiterId ? `Waiter ${waiterName} assigned` : 'Waiter unassigned', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// GET ALL TABLE-ASSIGNMENT DATA (waiters with their assigned tables + workload)
// ==========================================

router.get('/assignments/workload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.user!.restaurantId;

    // Get all ACTIVE waiters with role
    const waiters = await prisma.user.findMany({
      where: {
        restaurantId,
        status: 'ACTIVE',
        roles: {
          some: { role: { name: 'WAITER' } },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        assignedTables: {
          select: { id: true, name: true, code: true, status: true, capacity: true },
        },
        _count: {
          select: {
            ordersAsWaiter: {
              where: { status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED'] } },
            },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    // Check clocked-in status for each waiter today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const clockedInUsers = await prisma.shiftAssignment.findMany({
      where: {
        restaurantId,
        userId: { in: waiters.map(w => w.id) },
        status: 'CLOCKED_IN',
        clockedInAt: { gte: todayStart, lte: todayEnd },
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const clockedInUserIds = new Set(clockedInUsers.map(c => c.userId));

    res.json({
      success: true,
      data: waiters.map((w) => ({
        id: w.id,
        firstName: w.firstName,
        lastName: w.lastName,
        employeeCode: w.employeeCode,
        assignedTables: w.assignedTables,
        activeOrderCount: w._count.ordersAsWaiter,
        isClockedIn: clockedInUserIds.has(w.id),
      })),
    });
  } catch (error) { next(error); }
});

export default router;
