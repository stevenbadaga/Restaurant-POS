import { Router, Request, Response, NextFunction } from 'express';
import { inventoryItemService } from '../services';
import { itemSchema, itemUpdateSchema } from '../services/inventory-item.service';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const result = await inventoryItemService.getItems(restaurantId, {
    search: req.query.search as string,
    categoryId: req.query.categoryId as string,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    lowStock: req.query.lowStock === 'true',
    outOfStock: req.query.outOfStock === 'true',
    unit: req.query.unit as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });

  return res.json({ success: true, ...result });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const item = await inventoryItemService.getItemById(restaurantId, req.params.id);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  return res.json({ success: true, data: item });
}));

router.post('/', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = itemSchema.parse(req.body);
  const item = await inventoryItemService.createItem(restaurantId, data, userId);
  res.status(201).json({ success: true, data: item, message: 'Inventory item created' });
}));

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = itemUpdateSchema.parse(req.body);
  const item = await inventoryItemService.updateItem(restaurantId, req.params.id, data, userId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  return res.json({ success: true, data: item, message: 'Item updated' });
}));

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const { isActive } = req.body;
  const item = await inventoryItemService.updateItemStatus(restaurantId, req.params.id, isActive, userId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not found' });

  return res.json({ success: true, data: item });
}));

router.get('/:id/balances', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const balances = await inventoryItemService.getItemBalances(restaurantId, req.params.id);

  return res.json({ success: true, data: balances });
}));

router.get('/:id/movements', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const result = await inventoryItemService.getItemMovements(restaurantId, req.params.id, {
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });

  return res.json({ success: true, ...result });
}));

router.post('/:id/opening-balance', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const { quantity, unitCost, locationId, reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Reason is required' });
  const result = await inventoryItemService.createOpeningBalance(restaurantId, req.params.id, locationId, quantity, unitCost, reason, userId);
  if (!result) return res.status(404).json({ success: false, message: 'Item not found' });

  return res.json({ success: true, data: result, message: 'Opening balance recorded' });
}));

export default router;

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}
