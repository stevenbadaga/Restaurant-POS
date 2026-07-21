import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { createAuditLog } from '../services/audit.service';
import { BadRequestError, NotFoundError } from '../types';

const router = Router();
router.use(requireAuth);

const imageUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}, 'Image URL must be a valid http(s) URL');

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().or(z.literal('')),
  imageUrl: imageUrlSchema.optional().or(z.literal('')),
  displayOrder: z.number().int().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  imageUrl: imageUrlSchema.optional(),
  displayOrder: z.number().int().optional(),
});

const sortFields = new Set(['name', 'displayOrder', 'createdAt', 'updatedAt']);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, isActive, sort = 'displayOrder', order = 'asc' } = req.query;
    const sortField = typeof sort === 'string' && sortFields.has(sort) ? sort : 'displayOrder';
    const sortOrder = order === 'desc' ? 'desc' : 'asc';
    const where: any = { restaurantId: req.user!.restaurantId };
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) where.name = { contains: search as string, mode: 'insensitive' };

    const categories = await prisma.menuCategory.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { [sortField]: sortOrder },
    });

    res.json({
      success: true,
      data: categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
        totalItems: c._count.items,
        activeItems: 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cat = await prisma.menuCategory.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: { _count: { select: { items: true } } },
    });
    if (!cat) throw new NotFoundError('Category not found');
    res.json({ success: true, data: cat });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);
    const existing = await prisma.menuCategory.findUnique({
      where: { restaurantId_name: { restaurantId: req.user!.restaurantId, name: parsed.name } },
    });
    if (existing) throw new BadRequestError('Category name already exists');

    const cat = await prisma.menuCategory.create({
      data: { restaurantId: req.user!.restaurantId, ...parsed },
    });

    await createAuditLog({ restaurantId: req.user!.restaurantId, userId: req.user!.id, action: 'MENU_CATEGORY_CREATED', entityType: 'MENU_CATEGORY', entityId: cat.id, description: `Created category "${cat.name}"` });
    res.status(201).json({ success: true, message: 'Category created', data: cat });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateSchema.parse(req.body);
    const cat = await prisma.menuCategory.findFirst({ where: { id: req.params.id, restaurantId: req.user!.restaurantId } });
    if (!cat) throw new NotFoundError('Category not found');
    if (parsed.name) {
      const existing = await prisma.menuCategory.findFirst({ where: { restaurantId: req.user!.restaurantId, name: parsed.name, id: { not: req.params.id } } });
      if (existing) throw new BadRequestError('Name already in use');
    }
    const updated = await prisma.menuCategory.update({ where: { id: req.params.id }, data: parsed });
    await createAuditLog({ restaurantId: req.user!.restaurantId, userId: req.user!.id, action: 'MENU_CATEGORY_UPDATED', entityType: 'MENU_CATEGORY', entityId: updated.id, description: `Updated category "${updated.name}"` });
    res.json({ success: true, message: 'Category updated', data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const cat = await prisma.menuCategory.findFirst({ where: { id: req.params.id, restaurantId: req.user!.restaurantId } });
    if (!cat) throw new NotFoundError('Category not found');
    const updated = await prisma.menuCategory.update({ where: { id: req.params.id }, data: { isActive } });
    await createAuditLog({ restaurantId: req.user!.restaurantId, userId: req.user!.id, action: isActive ? 'MENU_CATEGORY_ACTIVATED' : 'MENU_CATEGORY_DEACTIVATED', entityType: 'MENU_CATEGORY', entityId: updated.id, description: `${isActive ? 'Activated' : 'Deactivated'} category "${updated.name}"` });
    res.json({ success: true, message: `Category ${isActive ? 'activated' : 'deactivated'}`, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
