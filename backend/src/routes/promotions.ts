import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as promotionService from '../services/promotion.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

const createPromotionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  description: z.string().optional(),
  promotionType: z.enum(['PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'FIXED_ITEM_PRICE', 'FREE_ITEM', 'BUY_X_GET_Y']),
  promotionScope: z.enum(['ORDER', 'MENU_ITEM', 'MENU_CATEGORY']),
  percentageValue: z.number().positive().max(100).optional(),
  fixedAmountValue: z.number().positive().optional(),
  fixedItemPrice: z.number().min(0).optional(),
  buyQuantity: z.number().int().positive().optional(),
  getQuantity: z.number().int().positive().optional(),
  minimumOrderSubtotal: z.number().min(0).optional(),
  maximumDiscountAmount: z.number().min(0).optional(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  usageLimitTotal: z.number().int().positive().optional(),
  usageLimitPerCustomer: z.number().int().positive().optional(),
  customerRequired: z.boolean().optional().default(false),
  loyaltyMembersOnly: z.boolean().optional().default(false),
  automaticallyApply: z.boolean().optional().default(false),
  allowStacking: z.boolean().optional().default(false),
  priority: z.number().int().optional().default(0),
  schedules: z.array(z.object({
    dayOfWeek: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })).optional(),
  menuItemIds: z.array(z.string().uuid()).optional(),
  menuCategoryIds: z.array(z.string().uuid()).optional(),
});

// GET /api/promotions
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await promotionService.listPromotions(req.user!.restaurantId, {
      search: req.query.search as string,
      status: req.query.status as string,
      type: req.query.type as string,
      scope: req.query.scope as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      autoApply: req.query.autoApply as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });

    return res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/promotions/active
router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const promotions = await promotionService.getActivePromotions(
      req.user!.restaurantId,
      req.query.customerId as string,
      req.query.subtotal as string
    );

    return res.json({ success: true, data: promotions });
  } catch (error) { next(error); }
});

// GET /api/promotions/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../database');
    const promotion = await prisma.promotion.findUnique({
      where: { id: req.params.id },
      include: { schedules: true, menuItems: { include: { menuItem: { select: { id: true, name: true, code: true, price: true } } } }, menuCategories: { include: { menuCategory: { select: { id: true, name: true } } } } },
    });
    if (!promotion || promotion.restaurantId !== req.user!.restaurantId) {
      return res.status(404).json({ success: false, message: 'Promotion not found' });
    }

    return res.json({ success: true, data: promotion });
  } catch (error) { next(error); }
});

// POST /api/promotions
router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createPromotionSchema.parse(req.body);
    const promotion = await promotionService.createPromotion(
      req.user!.restaurantId, req.user!.id, parsed, req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: promotion });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/promotions/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../database');
    const parsed = createPromotionSchema.partial().parse(req.body);
    const promotion = await prisma.promotion.update({
      where: { id: req.params.id },
      data: {
        name: parsed.name,
        description: parsed.description,
        percentageValue: parsed.percentageValue,
        fixedAmountValue: parsed.fixedAmountValue,
        minimumOrderSubtotal: parsed.minimumOrderSubtotal,
        maximumDiscountAmount: parsed.maximumDiscountAmount,
        usageLimitTotal: parsed.usageLimitTotal,
        usageLimitPerCustomer: parsed.usageLimitPerCustomer,
        startAt: parsed.startAt ? new Date(parsed.startAt) : undefined,
        endAt: parsed.endAt ? new Date(parsed.endAt) : undefined,
      },
    });

    return res.json({ success: true, data: promotion });
  } catch (error) { next(error); }
});

// PATCH /api/promotions/:id/status
router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ status: z.enum(['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED']) });
    const parsed = schema.parse(req.body);
    const result = await promotionService.updatePromotionStatus(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.status, req.ip, req.headers['user-agent']
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/promotions/:id/duplicate
router.post('/:id/duplicate', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await promotionService.duplicatePromotion(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) { next(error); }
});

// GET /api/promotions/:id/usage
router.get('/:id/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prisma } = await import('../database');
    const usages = await prisma.promotionUsage.findMany({
      where: { promotionId: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        order: { select: { orderNumber: true, status: true, totalAmount: true } },
        customer: { select: { firstName: true, lastName: true, customerNumber: true } },
      },
      orderBy: { usedAt: 'desc' },
      take: 50,
    });

    return res.json({ success: true, data: usages });
  } catch (error) { next(error); }
});

// POST /api/promotions/validate-code
router.post('/validate-code', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ code: z.string().min(1), customerId: z.string().uuid().optional() });
    const parsed = schema.parse(req.body);
    const promotion = await promotionService.validateCode(
      req.user!.restaurantId, parsed.code, parsed.customerId
    );

    return res.json({ success: true, data: promotion });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
