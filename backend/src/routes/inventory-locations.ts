import { Router, Request, Response, NextFunction } from 'express';
import { inventoryLocationService } from '../services';
import { locationSchema, locationUpdateSchema } from '../services/inventory-location.service';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const locations = await inventoryLocationService.getLocations(restaurantId, {
    search: req.query.search as string,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
  });

  return res.json({ success: true, data: locations });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const location = await inventoryLocationService.getLocationById(restaurantId, req.params.id);
  if (!location) return res.status(404).json({ success: false, message: 'Location not found' });

  return res.json({ success: true, data: location });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = locationSchema.parse(req.body);
  const location = await inventoryLocationService.createLocation(restaurantId, data, userId);
  res.status(201).json({ success: true, data: location, message: 'Stock location created' });
}));

router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = locationUpdateSchema.parse(req.body);
  const location = await inventoryLocationService.updateLocation(restaurantId, req.params.id, data, userId);
  if (!location) return res.status(404).json({ success: false, message: 'Location not found' });

  return res.json({ success: true, data: location, message: 'Stock location updated' });
}));

router.patch('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const { isActive } = req.body;
  const location = await inventoryLocationService.updateLocationStatus(restaurantId, req.params.id, isActive, userId);
  if (!location) return res.status(404).json({ success: false, message: 'Location not found' });

  return res.json({ success: true, data: location });
}));

router.post('/:id/set-default', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const location = await inventoryLocationService.setDefaultLocation(restaurantId, req.params.id, userId);
  if (!location) return res.status(404).json({ success: false, message: 'Location not found' });

  return res.json({ success: true, data: location, message: 'Default location updated' });
}));

export default router;

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}
