import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as loyaltyService from '../services/loyalty.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

// POST /api/customers/:customerId/loyalty/enroll
router.post('/customers/:customerId/loyalty/enroll', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.enrollCustomer(
      req.params.customerId, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// PATCH /api/customers/:customerId/loyalty/status
router.patch('/customers/:customerId/loyalty/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ isActive: z.boolean() });
    const parsed = schema.parse(req.body);
    const result = await loyaltyService.updateLoyaltyStatus(
      req.params.customerId, req.user!.restaurantId, req.user!.id, parsed.isActive, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// GET /api/customers/:customerId/loyalty/transactions
router.get('/customers/:customerId/loyalty/transactions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.getLoyaltyTransactions(
      req.params.customerId, req.user!.restaurantId,
      req.query.page ? parseInt(req.query.page as string) : undefined,
      req.query.limit ? parseInt(req.query.limit as string) : undefined
    );
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// POST /api/customers/:customerId/loyalty/adjust
router.post('/customers/:customerId/loyalty/adjust', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      points: z.number().int().positive(),
      reason: z.string().min(1),
      type: z.enum(['MANUAL_ADJUSTMENT_IN', 'MANUAL_ADJUSTMENT_OUT']),
    });
    const parsed = schema.parse(req.body);
    const result = await loyaltyService.manualAdjustment(
      req.params.customerId, req.user!.restaurantId, req.user!.id,
      parsed.points, parsed.reason, parsed.type, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/orders/:orderId/loyalty/redeem
router.post('/orders/:orderId/loyalty/redeem', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ points: z.number().int().positive() });
    const parsed = schema.parse(req.body);
    const result = await loyaltyService.redeemPoints(
      req.params.orderId, req.user!.restaurantId, req.user!.id, parsed.points, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/orders/:orderId/loyalty/remove-redemption
router.post('/orders/:orderId/loyalty/remove-redemption', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await loyaltyService.removeRedemption(
      req.params.orderId, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

export default router;
