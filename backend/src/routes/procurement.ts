import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  requisitionSchema, purchaseOrderSchema, invoiceSchema, supplierReturnSchema, stockCountSchema,
  getRequisitions, getRequisitionById, createRequisition, approveRequisition, rejectRequisition, cancelRequisition,
  getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, approvePurchaseOrder, receivePurchaseOrder,
  closePurchaseOrder, cancelPurchaseOrder, getReorderSuggestions,
  getInvoices, getInvoiceById, createInvoice, payInvoice, cancelInvoice,
  getSupplierReturns, getSupplierReturnById, createSupplierReturn,
  getStockCounts, getStockCountById, createStockCount, recordStockCountLine,
  submitStockCount, approveStockCount, rejectStockCount, getPurchaseHistory,
} from '../services/procurement.service';

const router = Router();
router.use(requireAuth);

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
}

function getRestaurantId(req: Request): string { return req.user?.restaurantId ?? req.headers['x-restaurant-id'] as string; }
function getUserId(req: Request): string { return req.user?.id ?? req.headers['x-user-id'] as string; }

// ===== REQUISITIONS =====
router.get('/requisitions', asyncHandler(async (req: Request, res: Response) => {
  const result = await getRequisitions(getRestaurantId(req), {
    status: req.query.status as string || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });
  res.json({ success: true, ...result });
}));

router.get('/requisitions/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await getRequisitionById(getRestaurantId(req), req.params.id);
  res.json({ success: true, data });
}));

router.post('/requisitions', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = requisitionSchema.parse(req.body);
  const result = await createRequisition(getRestaurantId(req), getUserId(req), data, req.ip);
  res.status(201).json({ success: true, data: result, message: 'Requisition created' });
}));

router.post('/requisitions/:id/approve', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await approveRequisition(getRestaurantId(req), getUserId(req), req.params.id, req.body.lines, req.ip);
  res.json({ success: true, data, message: 'Requisition approved' });
}));

router.post('/requisitions/:id/reject', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  const data = await rejectRequisition(getRestaurantId(req), getUserId(req), req.params.id, reason, req.ip);
  res.json({ success: true, data, message: 'Requisition rejected' });
}));

router.post('/requisitions/:id/cancel', asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  const data = await cancelRequisition(getRestaurantId(req), getUserId(req), req.params.id, reason || 'Cancelled', req.ip);
  res.json({ success: true, data });
}));

// ===== PURCHASE ORDERS =====
router.get('/purchase-orders', asyncHandler(async (req: Request, res: Response) => {
  const result = await getPurchaseOrders(getRestaurantId(req), {
    status: req.query.status as string || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });
  res.json({ success: true, ...result });
}));

router.get('/purchase-orders/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await getPurchaseOrderById(getRestaurantId(req), req.params.id);
  res.json({ success: true, data });
}));

router.post('/purchase-orders', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = purchaseOrderSchema.parse(req.body);
  const result = await createPurchaseOrder(getRestaurantId(req), getUserId(req), data, req.ip);
  res.status(201).json({ success: true, data: result, message: 'Purchase order created' });
}));

router.post('/purchase-orders/:id/approve', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await approvePurchaseOrder(getRestaurantId(req), getUserId(req), req.params.id, req.ip);
  res.json({ success: true, data, message: 'Purchase order approved' });
}));

router.post('/purchase-orders/:id/receive', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await receivePurchaseOrder(getRestaurantId(req), getUserId(req), req.params.id, req.body.lines, req.ip);
  res.json({ success: true, data, message: 'Purchase order received' });
}));

router.post('/purchase-orders/:id/close', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await closePurchaseOrder(getRestaurantId(req), getUserId(req), req.params.id, req.ip);
  res.json({ success: true, data, message: 'Purchase order closed' });
}));

router.post('/purchase-orders/:id/cancel', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  const data = await cancelPurchaseOrder(getRestaurantId(req), getUserId(req), req.params.id, reason || 'Cancelled', req.ip);
  res.json({ success: true, data });
}));

// ===== REORDER SUGGESTIONS =====
router.get('/reorder-suggestions', asyncHandler(async (req: Request, res: Response) => {
  const data = await getReorderSuggestions(getRestaurantId(req));
  res.json({ success: true, data });
}));

// ===== SUPPLIER INVOICES =====
router.get('/invoices', asyncHandler(async (req: Request, res: Response) => {
  const result = await getInvoices(getRestaurantId(req), {
    status: req.query.status as string || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });
  res.json({ success: true, ...result });
}));

router.get('/invoices/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await getInvoiceById(getRestaurantId(req), req.params.id);
  res.json({ success: true, data });
}));

router.post('/invoices', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = invoiceSchema.parse(req.body);
  const result = await createInvoice(getRestaurantId(req), getUserId(req), data, req.ip);
  res.status(201).json({ success: true, data: result, message: 'Invoice created' });
}));

router.post('/invoices/:id/pay', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await payInvoice(getRestaurantId(req), getUserId(req), req.params.id, req.body.paidDate, req.ip);
  res.json({ success: true, data, message: 'Invoice paid' });
}));

router.post('/invoices/:id/cancel', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  const data = await cancelInvoice(getRestaurantId(req), getUserId(req), req.params.id, reason || 'Cancelled', req.ip);
  res.json({ success: true, data });
}));

// ===== SUPPLIER RETURNS =====
router.get('/returns', asyncHandler(async (req: Request, res: Response) => {
  const result = await getSupplierReturns(getRestaurantId(req), {
    status: req.query.status as string || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });
  res.json({ success: true, ...result });
}));

router.get('/returns/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await getSupplierReturnById(getRestaurantId(req), req.params.id);
  res.json({ success: true, data });
}));

router.post('/returns', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = supplierReturnSchema.parse(req.body);
  const result = await createSupplierReturn(getRestaurantId(req), getUserId(req), data, req.ip);
  res.status(201).json({ success: true, data: result, message: 'Return created' });
}));

// ===== STOCK COUNTS =====
router.get('/stock-counts', asyncHandler(async (req: Request, res: Response) => {
  const result = await getStockCounts(getRestaurantId(req), {
    status: req.query.status as string || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  });
  res.json({ success: true, ...result });
}));

router.get('/stock-counts/:id', asyncHandler(async (req: Request, res: Response) => {
  const data = await getStockCountById(getRestaurantId(req), req.params.id);
  res.json({ success: true, data });
}));

router.post('/stock-counts', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = stockCountSchema.parse(req.body);
  const result = await createStockCount(getRestaurantId(req), getUserId(req), data, req.ip);
  res.status(201).json({ success: true, data: result, message: 'Stock count created' });
}));

router.post('/stock-counts/:id/lines/:lineId/record', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const { countedQty, notes } = req.body;
  if (countedQty === undefined || countedQty === null) return res.status(400).json({ success: false, message: 'countedQty is required' });
  const data = await recordStockCountLine(getRestaurantId(req), req.params.id, req.params.lineId, getUserId(req), Number(countedQty), notes, req.ip);
  res.json({ success: true, data });
}));

router.post('/stock-counts/:id/submit', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await submitStockCount(getRestaurantId(req), getUserId(req), req.params.id, req.ip);
  res.json({ success: true, data, message: 'Stock count submitted for approval' });
}));

router.post('/stock-counts/:id/approve', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const data = await approveStockCount(getRestaurantId(req), getUserId(req), req.params.id, req.ip);
  res.json({ success: true, data, message: 'Stock count approved and posted' });
}));

router.post('/stock-counts/:id/reject', requireRole('ADMIN', 'MANAGER'), asyncHandler(async (req: Request, res: Response) => {
  const { reason } = req.body;
  if (!reason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  const data = await rejectStockCount(getRestaurantId(req), getUserId(req), req.params.id, reason, req.ip);
  res.json({ success: true, data });
}));

// ===== PURCHASE HISTORY =====
router.get('/purchase-history', asyncHandler(async (req: Request, res: Response) => {
  const result = await getPurchaseHistory(getRestaurantId(req), {
    inventoryItemId: req.query.inventoryItemId as string || undefined,
    supplierId: req.query.supplierId as string || undefined,
    dateFrom: req.query.dateFrom as string || undefined,
    dateTo: req.query.dateTo as string || undefined,
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 50,
  });
  res.json({ success: true, ...result });
}));

export default router;
