import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../types';
import * as tipService from '../services/tip.service';

const router = Router();
router.use(requireAuth);

// ==========================================
// RECORD TIP
// ==========================================

const recordTipSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.string().min(1, 'Amount is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  paymentId: z.string().uuid().optional().nullable(),
  directRecipientUserId: z.string().uuid().optional().nullable(),
  tipPoolId: z.string().uuid().optional().nullable(),
});

router.post('/', requireRole('ADMIN', 'MANAGER', 'WAITER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = recordTipSchema.parse(req.body);
    const tip = await tipService.recordTip({
      orderId: parsed.orderId,
      amount: parsed.amount,
      paymentMethod: parsed.paymentMethod,
      paymentId: parsed.paymentId ?? undefined,
      directRecipientUserId: parsed.directRecipientUserId ?? undefined,
      tipPoolId: parsed.tipPoolId ?? undefined,
      recordedById: req.user!.id,
      restaurantId: req.user!.restaurantId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ success: true, data: tip, message: 'Tip recorded' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// LIST TIPS
// ==========================================

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, userId, poolId, status, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
    const result = await tipService.getTips({
      restaurantId: req.user!.restaurantId,
      orderId: orderId as string | undefined,
      userId: userId as string | undefined,
      poolId: poolId as string | undefined,
      status: status as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      page: parseInt(page as string) || 1,
      limit: Math.min(parseInt(limit as string) || 50, 100),
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// ==========================================
// TIP SUMMARY
// ==========================================

router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, userId, poolId } = req.query;
    const summary = await tipService.getTipSummary({
      restaurantId: req.user!.restaurantId,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      userId: userId as string | undefined,
      poolId: poolId as string | undefined,
    });
    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
});

// ==========================================
// REVERSE TIP
// ==========================================

const reverseTipSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
});

router.post('/:id/reverse', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = reverseTipSchema.parse(req.body);
    const tip = await tipService.reverseTip(
      req.params.id,
      parsed.reason,
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, data: tip, message: 'Tip reversed' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// TIP POOL ROUTES
// ==========================================

const createPoolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  allocationMethod: z.enum(['DIRECT_EMPLOYEE', 'EQUAL_SHARE', 'HOURS_WORKED', 'ROLE_WEIGHTED', 'CUSTOM_PERCENTAGE']),
  includedPaymentMethods: z.array(z.string()).optional(),
  eligibleRoles: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

router.post('/pools', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPoolSchema.parse(req.body);
    const pool = await tipService.createTipPool({
      ...parsed,
      restaurantId: req.user!.restaurantId,
      createdById: req.user!.id,
    });
    res.status(201).json({ success: true, data: pool, message: 'Tip pool created' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.get('/pools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const result = await tipService.getTipPools(
      req.user!.restaurantId,
      status as string | undefined,
      parseInt(page as string) || 1,
      Math.min(parseInt(limit as string) || 20, 100)
    );
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

router.get('/pools/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await tipService.getTipPool(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: pool });
  } catch (error) { next(error); }
});

router.post('/pools/:id/calculate', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await tipService.calculateTipPool(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId
    );
    res.json({ success: true, data: pool, message: 'Pool calculated' });
  } catch (error) { next(error); }
});

router.post('/pools/:id/approve', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pool = await tipService.approveTipPool(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, data: pool, message: 'Pool approved' });
  } catch (error) { next(error); }
});

const adjustmentSchema = z.object({
  userId: z.string().uuid(),
  allocatedAmount: z.string().min(1),
  reason: z.string().min(1),
});

router.post('/pools/:id/adjustment', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = adjustmentSchema.parse(req.body);
    const pool = await tipService.manualPoolAdjustment({
      poolId: req.params.id,
      userId: parsed.userId,
      allocatedAmount: parsed.allocatedAmount,
      reason: parsed.reason,
      actorUserId: req.user!.id,
      restaurantId: req.user!.restaurantId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ success: true, data: pool, message: 'Adjustment applied' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// TIP REPORTS
// ==========================================

router.get('/reports/waiter', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, userId, includePoolTips } = req.query;
    const report = await tipService.getWaiterTipReport({
      restaurantId: req.user!.restaurantId,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      userId: userId as string | undefined,
      includePoolTips: includePoolTips !== 'false',
    });
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
});

router.get('/reports/shift', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const report = await tipService.getShiftTipReport({
      restaurantId: req.user!.restaurantId,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
});

export default router;
