import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as paymentService from '../services/payment.service';
import * as receiptService from '../services/receipt.service';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ==========================================
// GET /api/orders/:id/payment-summary
// ==========================================
router.get('/:id/payment-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getOrderPaymentSummary(req.params.id);
    // Verify restaurant access
    if ((result.order as any).restaurantId && (result.order as any).restaurantId !== req.user!.restaurantId) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/orders/:id/request-payment
// ==========================================
router.post('/:id/request-payment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.requestPayment(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Payment requested', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/orders/:id/cancel-payment-request
// ==========================================
router.post('/:id/cancel-payment-request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await paymentService.cancelPaymentRequest(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId
    );

    res.json({ success: true, message: 'Payment request cancelled' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/orders/:id/payments - Record payment
// ==========================================
router.post('/:id/payments', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'VOUCHER', 'OTHER']),
      amount: z.string().min(1, 'Amount is required'),
      amountTendered: z.string().optional(),
      referenceNumber: z.string().optional(),
      providerName: z.string().optional(),
      notes: z.string().optional(),
      idempotencyKey: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const result = await paymentService.recordPayment(req.params.id, {
      method: data.method,
      amount: data.amount,
      amountTendered: data.amountTendered,
      referenceNumber: data.referenceNumber,
      providerName: data.providerName,
      notes: data.notes,
      idempotencyKey: data.idempotencyKey,
      userId: req.user!.id,
      restaurantId: req.user!.restaurantId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Payment recorded successfully', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/orders/:id/payments/split - Split payment
// ==========================================
router.post('/:id/payments/split', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      payments: z.array(z.object({
        method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'VOUCHER', 'OTHER']),
        amount: z.string().min(1, 'Amount is required'),
        amountTendered: z.string().optional(),
        referenceNumber: z.string().optional(),
        providerName: z.string().optional(),
        notes: z.string().optional(),
      })).min(2, 'At least 2 payment entries required'),
    });

    const { payments } = schema.parse(req.body);

    const result = await paymentService.recordSplitPayment(req.params.id, payments, {
      userId: req.user!.id,
      restaurantId: req.user!.restaurantId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Split payment completed', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/orders/:id/receipt - Generate receipt
// ==========================================
router.post('/:id/receipt', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await receiptService.generateReceipt(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Receipt generated', data: result });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// POST /api/orders/:id/close - Close order
// ==========================================
router.post('/:id/close', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      exceptionReason: z.string().optional(),
    });

    const { exceptionReason } = schema.parse(req.body || {});

    const result = await paymentService.closeOrder(
      req.params.id,
      req.user!.id,
      req.user!.restaurantId,
      exceptionReason,
      req.ip,
      req.headers['user-agent']
    );

    // Generate receipt on close
    try {
      await receiptService.generateReceipt(
        req.params.id,
        req.user!.id,
        req.user!.restaurantId,
        req.ip,
        req.headers['user-agent']
      );
    } catch { /* Receipt may already exist */ }

    res.json({ success: true, message: 'Order closed successfully', data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
