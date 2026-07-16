import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as receiptService from '../services/receipt.service';

const router = Router();

// All receipt routes require authentication
router.use(requireAuth);

// ==========================================
// GET /api/receipts - Receipt list
// ==========================================
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await receiptService.getReceiptList(req.user!.restaurantId, {
      search: req.query.search as string,
      waiterId: req.query.waiterId as string,
      cashierId: req.query.cashierId as string,
      tableId: req.query.tableId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as string,
      paymentMethod: req.query.paymentMethod as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/receipts/order/:orderId - Receipt by order
// ==========================================
router.get('/order/:orderId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await receiptService.getReceiptByOrder(req.params.orderId, req.user!.restaurantId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/receipts/:id - Receipt detail
// ==========================================
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await receiptService.getReceiptDetail(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/receipts/:id/pdf - Download PDF
// ==========================================
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paperSize = (req.query.paperSize as string) || 'THERMAL_80MM';
    const validSizes = ['THERMAL_58MM', 'THERMAL_80MM', 'A4'];
    const size = validSizes.includes(paperSize) ? paperSize as any : 'THERMAL_80MM';

    const pdf = await receiptService.generateReceiptPdf(
      req.params.id,
      req.user!.restaurantId,
      size
    );

    const receipt = await receiptService.getReceiptDetail(req.params.id, req.user!.restaurantId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Receipt-${receipt.receiptNumber}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/receipts/:id/reprint - Reprint receipt
// ==========================================
router.post('/:id/reprint', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await receiptService.reprintReceipt(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Receipt reprinted', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/receipts/:id/void - Void receipt
// ==========================================
router.post('/:id/void', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      reason: z.string().min(1, 'Reason is required'),
    });

    const { reason } = schema.parse(req.body);

    const result = await receiptService.voidReceipt(
      req.params.id,
      reason,
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Receipt voided', data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
