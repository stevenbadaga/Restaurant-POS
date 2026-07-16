import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as promotionService from '../services/promotion.service';
import { BadRequestError } from '../types';
import { prisma } from '../database';

const router = Router();
router.use(requireAuth);

// GET /api/orders/:orderId/discounts
router.get('/orders/:orderId/discounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const discounts = await prisma.orderDiscount.findMany({
      where: { orderId: req.params.orderId, restaurantId: req.user!.restaurantId },
      include: {
        appliedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        promotion: { select: { id: true, name: true, code: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });
    res.json({ success: true, data: discounts });
  } catch (error) { next(error); }
});

// POST /api/orders/:orderId/promotions/apply
router.post('/orders/:orderId/promotions/apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ promotionId: z.string().uuid(), code: z.string().optional() });
    const parsed = schema.parse(req.body);
    const result = await promotionService.applyPromotion(
      parsed.promotionId, req.params.orderId, req.user!.restaurantId, req.user!.id,
      parsed.code, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/orders/:orderId/promotions/auto-apply
router.post('/orders/:orderId/promotions/auto-apply', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await promotionService.autoApplyPromotions(
      req.params.orderId, req.user!.restaurantId, req.user!.id
    );
    res.json({ success: true, data: results });
  } catch (error) { next(error); }
});

// DELETE /api/orders/:orderId/discounts/:discountId
router.delete('/orders/:orderId/discounts/:discountId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ reason: z.string().optional() });
    const parsed = schema.parse(req.body);
    const result = await promotionService.removeDiscount(
      req.params.discountId, req.user!.restaurantId, req.user!.id,
      parsed.reason, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/orders/:orderId/manual-discount
router.post('/orders/:orderId/manual-discount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
      value: z.number().positive(),
      reason: z.string().min(1),
      requiresApproval: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);
    const result = await promotionService.applyManualDiscount(
      req.user!.restaurantId, req.user!.id, {
        orderId: req.params.orderId,
        discountType: parsed.discountType,
        value: parsed.value,
        reason: parsed.reason,
        source: 'MANUAL_MANAGER_DISCOUNT',
        requiresApproval: parsed.requiresApproval,
      },
      req.user!.roles,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/orders/:orderId/items/:itemId/manual-discount
router.post('/orders/:orderId/items/:itemId/manual-discount', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
      value: z.number().positive(),
      reason: z.string().min(1),
    });
    const parsed = schema.parse(req.body);
    const result = await promotionService.applyManualDiscount(
      req.user!.restaurantId, req.user!.id, {
        orderId: req.params.orderId,
        orderItemId: req.params.itemId,
        discountType: parsed.discountType,
        value: parsed.value,
        reason: parsed.reason,
        source: 'MANUAL_MANAGER_DISCOUNT',
      },
      req.user!.roles,
      req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// === Discount Requests ===

// POST /api/orders/:orderId/discount-requests
router.post('/orders/:orderId/discount-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      discountType: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
      value: z.number().positive(),
      reason: z.string().min(1),
    });
    const parsed = schema.parse(req.body);
    const result = await promotionService.createDiscountRequest(
      req.user!.restaurantId, req.user!.id, {
        orderId: req.params.orderId,
        discountType: parsed.discountType,
        value: parsed.value,
        reason: parsed.reason,
        source: 'MANUAL_MANAGER_DISCOUNT',
      }
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// GET /api/discount-requests
router.get('/discount-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await promotionService.listDiscountRequests(
      req.user!.restaurantId, req.query.status as string
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/discount-requests/:id/approve
router.post('/discount-requests/:id/approve', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await promotionService.approveDiscountRequest(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/discount-requests/:id/reject
router.post('/discount-requests/:id/reject', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ reason: z.string().min(1) });
    const parsed = schema.parse(req.body);
    const result = await promotionService.rejectDiscountRequest(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.reason, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
