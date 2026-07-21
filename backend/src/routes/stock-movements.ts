import { Router, Request, Response, NextFunction } from 'express';
import { stockMovementService } from '../services';
import { adjustmentSchema, transferSchema } from '../services/stock-movement.service';
import { requireAuth, requireRole } from '../middleware/auth';
import { createApprovalRequest } from '../services/approval-request.service';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const result = await stockMovementService.getMovements(restaurantId, {
    inventoryItemId: req.query.inventoryItemId as string,
    stockLocationId: req.query.stockLocationId as string,
    movementType: req.query.movementType as string,
    actorUserId: req.query.actorUserId as string,
    attributedWaiterId: req.query.attributedWaiterId as string,
    orderId: req.query.orderId as string,
    receiptId: req.query.receiptId as string,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  res.json({ success: true, ...result });
}));

router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const summary = await stockMovementService.getInventorySummary(getRestaurantId(req));
  res.json({ success: true, data: summary });
}));

router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const alerts = await stockMovementService.getInventoryAlerts(getRestaurantId(req));
  res.json({ success: true, data: alerts });
}));

router.post('/adjustments', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = adjustmentSchema.parse(req.body);
  const request = await createApprovalRequest({
    restaurantId,
    requestedById: userId,
    requestType: 'STOCK_ADJUSTMENT',
    title: `Stock adjustment requested: ${data.movementType}`,
    description: `${data.quantity} units - ${data.reason}`,
    entityType: 'stock_adjustment',
    entityId: `${data.inventoryItemId}:${data.stockLocationId || 'default'}:${data.movementType}`,
    payload: data as any,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(202).json({ success: true, data: request, message: 'Stock adjustment request submitted for approval' });
}));

router.post('/transfer', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = transferSchema.parse(req.body);
  const movement = await stockMovementService.createTransfer(restaurantId, data, userId);
  res.status(201).json({ success: true, data: movement, message: 'Stock transferred' });
}));

router.get('/usage/waiters', asyncHandler(async (req: Request, res: Response) => {
  const result = await stockMovementService.getWaiterUsage(getRestaurantId(req), {
    waiterId: req.query.waiterId as string,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
    inventoryItemId: req.query.inventoryItemId as string,
    orderId: req.query.orderId as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  res.json({ success: true, ...result });
}));

router.get('/usage/waiters/:waiterId', asyncHandler(async (req: Request, res: Response) => {
  const result = await stockMovementService.getWaiterUsage(getRestaurantId(req), {
    waiterId: req.params.waiterId,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  res.json({ success: true, ...result });
}));

export default router;

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}
