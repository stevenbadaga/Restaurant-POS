import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import * as cashierService from '../services/cashier.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').regex(/^[A-Z0-9_]+$/, 'Code must be uppercase alphanumeric'),
  locationDescription: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'OUT_OF_SERVICE']),
});

// GET /api/cash-registers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const registers = await cashierService.listCashRegisters(req.user!.restaurantId);
    res.json({ success: true, data: registers });
  } catch (error) { next(error); }
});

// GET /api/cash-registers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const register = await prisma.cashRegister.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        sessions: {
          where: { status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] } },
          orderBy: { openedAt: 'desc' },
          take: 1,
          include: {
            cashier: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!register) throw new NotFoundError('Register not found');
    res.json({ success: true, data: register });
  } catch (error) { next(error); }
});

// POST /api/cash-registers
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);
    const result = await cashierService.createCashRegister(
      req.user!.restaurantId, parsed, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Cash register created', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/cash-registers/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.partial().parse(req.body);
    const result = await cashierService.updateCashRegister(
      req.params.id, req.user!.restaurantId, parsed, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Register updated', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/cash-registers/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = statusSchema.parse(req.body);
    const result = await cashierService.setRegisterStatus(
      req.params.id, req.user!.restaurantId, parsed.status, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: `Status changed to ${parsed.status}`, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cash-registers/:id/set-default
router.post('/:id/set-default', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cashierService.setDefaultRegister(
      req.params.id, req.user!.restaurantId, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Default register updated', data: result });
  } catch (error) { next(error); }
});

export default router;
