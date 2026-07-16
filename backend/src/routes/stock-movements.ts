import { Router, Request, Response, NextFunction } from 'express';
import { stockMovementService } from '../services';
import { adjustmentSchema, transferSchema } from '../services/stock-movement.service';
import { requireAuth, requireRole } from '../middleware/auth';
import * as notificationService from '../services/notification.service';
import { emitNewNotification } from '../sockets';
import { getSocketIO } from '../sockets/emitter';

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
  const restaurantId = getRestaurantId(req);
  const summary = await stockMovementService.getInventorySummary(restaurantId);
  res.json({ success: true, data: summary });
}));

router.get('/alerts', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const alerts = await stockMovementService.getInventoryAlerts(restaurantId);
  res.json({ success: true, data: alerts });
}));

router.post('/adjustments', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const userRoles = req.user?.roles ?? JSON.parse((req.headers['x-user-roles'] as string) || '[]');
  const data = adjustmentSchema.parse(req.body);
  const movement = await stockMovementService.createAdjustment(restaurantId, data, userId, userRoles);

  // Notify managers about adjustments by non-admin users
  try {
    const isAdminOrManager = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');
    if (!isAdminOrManager) {
      const io = getSocketIO();
      const managerIds = await notificationService.getUsersByRole(restaurantId, ['MANAGER']);
      if (managerIds.length > 0) {
        const notifs = await notificationService.createBulkNotification({
          restaurantId,
          userIds: managerIds,
          type: 'APPROVAL_NEEDED',
          title: `Stock Adjustment Completed — ${data.movementType}`,
          message: `${data.quantity} units — ${data.reason}`,
          entityType: 'stock_adjustment',
          entityId: data.inventoryItemId,
        });
        for (const n of notifs) {
          emitNewNotification(io, restaurantId, n.userId, { notification: n });
        }
      }
    }
  } catch (err) { console.error('Failed to notify managers about adjustment:', err); }

  res.status(201).json({ success: true, data: movement, message: 'Adjustment recorded' });
}));

router.post('/transfer', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = transferSchema.parse(req.body);
  const movement = await stockMovementService.createTransfer(restaurantId, data, userId);
  res.status(201).json({ success: true, data: movement, message: 'Stock transferred' });
}));

router.get('/usage/waiters', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const result = await stockMovementService.getWaiterUsage(restaurantId, {
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
  const restaurantId = getRestaurantId(req);
  const result = await stockMovementService.getWaiterUsage(restaurantId, {
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
