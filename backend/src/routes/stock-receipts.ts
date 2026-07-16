import { Router, Request, Response, NextFunction } from 'express';
import { stockReceiptService } from '../services';
import { receiptSchema, receiptLineSchema } from '../services/stock-receipt.service';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function getRestaurantId(req: Request): string {
  return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string;
}

function getUserId(req: Request): string {
  return req.user?.id ?? req.headers['x-user-id'] as string;
}

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const result = await stockReceiptService.getReceipts(restaurantId, {
    status: req.query.status as string,
    supplierId: req.query.supplierId as string,
    locationId: req.query.locationId as string,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });

  return res.json({ success: true, ...result });
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const receipt = await stockReceiptService.getReceiptById(restaurantId, req.params.id);
  if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });

  return res.json({ success: true, data: receipt });
}));

router.post('/', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = receiptSchema.parse(req.body);
  const receipt = await stockReceiptService.createReceipt(restaurantId, data, userId);
  res.status(201).json({ success: true, data: receipt, message: 'Stock receipt created' });
}));

router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const receipt = await stockReceiptService.getReceiptById(restaurantId, req.params.id);
  if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });
  // Only draft receipts can be edited

  return res.json({ success: true, data: receipt });
}));

router.post('/:id/lines', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const data = receiptLineSchema.parse(req.body);
  const line = await stockReceiptService.addReceiptLine(req.params.id, restaurantId, data, userId);
  if (!line) return res.status(400).json({ success: false, message: 'Cannot add lines to this receipt' });
  return res.status(201).json({ success: true, data: line, message: 'Line added' });
}));

router.patch('/:id/lines/:lineId', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const line = await stockReceiptService.updateReceiptLine(req.params.id, req.params.lineId, restaurantId, req.body);
  if (!line) return res.status(404).json({ success: false, message: 'Line not found or receipt not editable' });

  return res.json({ success: true, data: line, message: 'Line updated' });
}));

router.delete('/:id/lines/:lineId', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const removed = await stockReceiptService.removeReceiptLine(req.params.id, req.params.lineId, restaurantId);
  if (!removed) return res.status(404).json({ success: false, message: 'Line not found or receipt not editable' });

  return res.json({ success: true, message: 'Line removed' });
}));

router.post('/:id/post', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const receipt = await stockReceiptService.postReceipt(req.params.id, restaurantId, userId);
  if (!receipt) return res.status(400).json({ success: false, message: 'Cannot post this receipt' });

  return res.json({ success: true, data: receipt, message: 'Receipt posted' });
}));

router.post('/:id/cancel', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const restaurantId = getRestaurantId(req);
  const userId = getUserId(req);
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Cancellation reason is required' });
  const receipt = await stockReceiptService.cancelReceipt(req.params.id, restaurantId, userId, reason);
  if (!receipt) return res.status(400).json({ success: false, message: 'Cannot cancel this receipt' });

  return res.json({ success: true, data: receipt, message: 'Receipt cancelled' });
}));

export default router;
