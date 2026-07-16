import { Router, Request, Response, NextFunction } from 'express';
import { supplierService } from '../services';
import { supplierSchema, supplierUpdateSchema } from '../services/supplier.service';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const result = await supplierService.getSuppliers(restaurantId, {
    search: req.query.search as string,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });

  return res.json({ success: true, ...result });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const supplier = await supplierService.getSupplierById(restaurantId, req.params.id);
  if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

  return res.json({ success: true, data: supplier });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = supplierSchema.parse(req.body);
  const supplier = await supplierService.createSupplier(restaurantId, data, userId);
  res.status(201).json({ success: true, data: supplier, message: 'Supplier created' });
}));

router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = supplierUpdateSchema.parse(req.body);
  const supplier = await supplierService.updateSupplier(restaurantId, req.params.id, data, userId);
  if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

  return res.json({ success: true, data: supplier, message: 'Supplier updated' });
}));

router.patch('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const { isActive } = req.body;
  const supplier = await supplierService.updateSupplierStatus(restaurantId, req.params.id, isActive, userId);
  if (!supplier) return res.status(404).json({ success: false, message: 'Supplier not found' });

  return res.json({ success: true, data: supplier });
}));

export default router;

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}
