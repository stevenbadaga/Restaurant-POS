import { Router, Request, Response, NextFunction } from 'express';
import { inventoryCategoryService } from '../services';
import { categorySchema, categoryUpdateSchema } from '../services/inventory-category.service';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const categories = await inventoryCategoryService.getCategories(restaurantId, {
    search: req.query.search as string,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
  });

  return res.json({ success: true, data: categories });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const category = await inventoryCategoryService.getCategoryById(restaurantId, req.params.id);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  return res.json({ success: true, data: category });
}));

router.post('/', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = categorySchema.parse(req.body);
  const category = await inventoryCategoryService.createCategory(restaurantId, data, userId);
  res.status(201).json({ success: true, data: category, message: 'Category created' });
}));

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = categoryUpdateSchema.parse(req.body);
  const category = await inventoryCategoryService.updateCategory(restaurantId, req.params.id, data, userId);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  return res.json({ success: true, data: category, message: 'Category updated' });
}));

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const { isActive } = req.body;
  const category = await inventoryCategoryService.updateCategoryStatus(restaurantId, req.params.id, isActive, userId);
  if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

  return res.json({ success: true, data: category });
}));

export default router;

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}
