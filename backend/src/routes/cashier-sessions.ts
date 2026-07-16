import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as cashierService from '../services/cashier.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

const openSessionSchema = z.object({
  cashRegisterId: z.string(),
  openingFloat: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  workShiftId: z.string().optional(),
  notes: z.string().optional(),
});

const closingCountSchema = z.object({
  countedCash: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount').optional(),
  denominations: z.array(z.object({
    denomination: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
    quantity: z.number().int().min(0),
  })).optional(),
}).refine((data) => data.countedCash || (data.denominations && data.denominations.length > 0), {
  message: 'Either countedCash or denominations must be provided',
});

const movementSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  reason: z.string().min(1, 'Reason is required'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

const approvalSchema = z.object({
  notes: z.string().optional(),
});

const rejectionSchema = z.object({
  reason: z.string().min(1, 'Reason is required'),
});

// GET /api/cashier-sessions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      businessDate, dateFrom, dateTo, cashRegisterId,
      cashierId, status, varianceStatus, page, limit
    } = req.query;

    const result = await cashierService.listSessions(req.user!.restaurantId, {
      businessDate: businessDate as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      cashRegisterId: cashRegisterId as string,
      cashierId: cashierId as string,
      status: status as string,
      varianceStatus: varianceStatus as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/cashier-sessions/current
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await cashierService.getCurrentSession(req.user!.id, req.user!.restaurantId);
    res.json({ success: true, data: session || null });
  } catch (error) { next(error); }
});

// GET /api/cashier-sessions/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await cashierService.getSessionDetail(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: session });
  } catch (error) { next(error); }
});

// POST /api/cashier-sessions/open
router.post('/open', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = openSessionSchema.parse(req.body);
    const result = await cashierService.openCashierSession(
      req.user!.restaurantId,
      req.user!.id,
      parsed,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Session opened', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/begin-closing
router.post('/:id/begin-closing', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cashierService.beginClosingSession(
      req.params.id, req.user!.restaurantId, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Closing started', ...result });
  } catch (error) { next(error); }
});

// POST /api/cashier-sessions/:id/count
router.post('/:id/count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = closingCountSchema.parse(req.body);
    const result = await cashierService.recordClosingCount(
      req.params.id, req.user!.restaurantId, parsed, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Closing count recorded', ...result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/submit
router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { closingNotes } = req.body || {};
    const result = await cashierService.closeSession(
      req.params.id, req.user!.restaurantId, req.user!.id, closingNotes,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Session submitted', data: result });
  } catch (error) { next(error); }
});

// POST /api/cashier-sessions/:id/approve
router.post('/:id/approve', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = approvalSchema.parse(req.body);
    const result = await cashierService.approveSession(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.notes,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Session approved', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/reject
router.post('/:id/reject', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = rejectionSchema.parse(req.body);
    const result = await cashierService.rejectSession(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.reason,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Session rejected', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/close
router.post('/:id/close', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cashierService.closeSession(
      req.params.id, req.user!.restaurantId, req.user!.id, undefined,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Session closed', data: result });
  } catch (error) { next(error); }
});

// POST /api/cashier-sessions/:id/suspend
router.post('/:id/suspend', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = rejectionSchema.parse(req.body);
    const result = await cashierService.suspendSession(
      req.params.id, req.user!.restaurantId, req.user!.id, reason,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, message: 'Session suspended', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// MOVEMENT ENDPOINTS
// ==========================================

// GET /api/cashier-sessions/:id/movements
router.get('/:id/movements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await cashierService.getSessionMovements(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/cashier-sessions/:id/cash-in
router.post('/:id/cash-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = movementSchema.parse(req.body);
    const result = await cashierService.addCashIn(
      req.params.id, req.user!.restaurantId, parsed, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Cash-in recorded', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/cash-out
router.post('/:id/cash-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = movementSchema.parse(req.body);
    const result = await cashierService.addCashOut(
      req.params.id, req.user!.restaurantId, parsed, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Cash-out recorded', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/safe-drop
router.post('/:id/safe-drop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = movementSchema.parse(req.body);
    const result = await cashierService.addSafeDrop(
      req.params.id, req.user!.restaurantId, parsed, req.user!.id,
      undefined, // approvedById — would need manager flow
      req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Safe drop recorded', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/cashier-sessions/:id/adjustment
router.post('/:id/adjustment', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = movementSchema.extend({
      movementType: z.enum(['ADJUSTMENT_IN', 'ADJUSTMENT_OUT']),
    });
    const parsed = schema.parse(req.body);
    const result = await cashierService.addAdjustment(
      req.params.id, req.user!.restaurantId, parsed, req.user!.id, req.user!.id,
      req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Adjustment recorded', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
