import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../types';
import { createAuditLog } from '../services/audit.service';

const router = Router();
router.use(requireAuth);

const imageUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  if (/^\/uploads\/menu\/[a-zA-Z0-9._-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}, 'Image URL must be a valid http(s) URL');

const menuItemSchema = z.object({
  categoryId: z.string().uuid().optional().nullable(),
  kitchenStationId: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').transform((value) => value.toUpperCase()),
  description: z.string().optional().or(z.literal('')),
  itemType: z.enum(['FOOD', 'DRINK', 'DESSERT', 'OTHER']).default('FOOD'),
  price: z.number().min(0, 'Price cannot be negative'),
  costPrice: z.number().min(0).optional().nullable(),
  taxRate: z.number().min(0).optional(),
  preparationTimeMinutes: z.number().int().min(0).optional().nullable(),
  requiresPreparation: z.boolean().optional(),
  trackInventory: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  isActive: z.boolean().optional(),
  imageUrl: imageUrlSchema.optional().nullable().or(z.literal('')),
  displayOrder: z.number().int().optional(),
  publicDescription: z.string().optional().or(z.literal('')),
  publicImageUrl: imageUrlSchema.optional().nullable().or(z.literal('')),
  isFeatured: z.boolean().optional(),
  isPubliclyVisible: z.boolean().optional(),
  dietaryLabels: z.string().optional().or(z.literal('')),
  allergenInformation: z.string().optional().or(z.literal('')),
  publicSortOrder: z.number().int().optional(),
});

const menuItemUpdateSchema = menuItemSchema.partial();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, categoryId, kitchenStationId, isActive, isAvailable, itemType } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (categoryId) where.categoryId = categoryId as string;
    if (kitchenStationId) where.kitchenStationId = kitchenStationId as string;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';
    if (itemType) where.itemType = itemType as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { code: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        kitchenStation: { select: { id: true, name: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.get('/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await prisma.menuItem.findMany({
      where: { restaurantId: req.user!.restaurantId, isActive: true, isAvailable: true },
      include: { category: true, kitchenStation: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.menuItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { category: true, kitchenStation: true },
    });
    if (!item) throw new NotFoundError('Menu item not found');
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = menuItemSchema.parse(req.body);
    await validateMenuItemReferences(req.user!.restaurantId, parsed.categoryId, parsed.kitchenStationId);

    const existing = await prisma.menuItem.findUnique({
      where: { restaurantId_code: { restaurantId: req.user!.restaurantId, code: parsed.code } },
    });
    if (existing) throw new BadRequestError('Menu item code already exists');

    const data: Prisma.MenuItemUncheckedCreateInput = {
        restaurantId: req.user!.restaurantId,
        ...parsed,
        categoryId: parsed.categoryId || null,
        kitchenStationId: parsed.kitchenStationId || null,
        description: parsed.description || null,
        imageUrl: parsed.imageUrl || null,
        publicDescription: parsed.publicDescription || null,
        publicImageUrl: parsed.publicImageUrl || null,
        dietaryLabels: parsed.dietaryLabels || null,
        allergenInformation: parsed.allergenInformation || null,
    };

    const item = await prisma.menuItem.create({
      data,
      include: { category: true, kitchenStation: true },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'MENU_ITEM_CREATED',
      entityType: 'MENU_ITEM',
      entityId: item.id,
      description: `Created menu item "${item.name}"`,
    });

    res.status(201).json({ success: true, message: 'Menu item created', data: item });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = menuItemUpdateSchema.parse(req.body);
    const item = await prisma.menuItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!item) throw new NotFoundError('Menu item not found');

    await validateMenuItemReferences(req.user!.restaurantId, parsed.categoryId, parsed.kitchenStationId);

    if (parsed.code) {
      const existing = await prisma.menuItem.findFirst({
        where: { restaurantId: req.user!.restaurantId, code: parsed.code, id: { not: req.params.id } },
      });
      if (existing) throw new BadRequestError('Menu item code already exists');
    }

    const data: Prisma.MenuItemUncheckedUpdateInput = {
        ...parsed,
        categoryId: parsed.categoryId === undefined ? undefined : parsed.categoryId || null,
        kitchenStationId: parsed.kitchenStationId === undefined ? undefined : parsed.kitchenStationId || null,
    };

    const updated = await prisma.menuItem.update({
      where: { id: req.params.id },
      data,
      include: { category: true, kitchenStation: true },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'MENU_ITEM_UPDATED',
      entityType: 'MENU_ITEM',
      entityId: updated.id,
      description: `Updated menu item "${updated.name}"`,
    });

    res.json({ success: true, message: 'Menu item updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = z.object({
      isActive: z.boolean().optional(),
      isAvailable: z.boolean().optional(),
    }).parse(req.body);

    const item = await prisma.menuItem.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
    });
    if (!item) throw new NotFoundError('Menu item not found');

    const updated = await prisma.menuItem.update({
      where: { id: req.params.id },
      data: parsed,
      include: { category: true, kitchenStation: true },
    });

    res.json({ success: true, message: 'Menu item status updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

async function validateMenuItemReferences(
  restaurantId: string,
  categoryId?: string | null,
  kitchenStationId?: string | null
): Promise<void> {
  if (categoryId) {
    const category = await prisma.menuCategory.findFirst({ where: { id: categoryId, restaurantId } });
    if (!category) throw new BadRequestError('Invalid menu category');
  }

  if (kitchenStationId) {
    const station = await prisma.kitchenStation.findFirst({ where: { id: kitchenStationId, restaurantId } });
    if (!station) throw new BadRequestError('Invalid kitchen station');
  }
}

export default router;
