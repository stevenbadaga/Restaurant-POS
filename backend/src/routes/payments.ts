import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as paymentService from '../services/payment.service';
import { createApprovalRequest } from '../services/approval-request.service';

const router = Router();
router.use(requireAuth);

router.get('/queue', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getPaymentQueue(req.user!.restaurantId, {
      search: req.query.search as string,
      orderType: req.query.orderType as string,
      paymentStatus: req.query.paymentStatus as string,
      requested: req.query.requested as string,
      waiterId: req.query.waiterId as string,
      diningAreaId: req.query.diningAreaId as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as string,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getPaymentReportsSummary(req.user!.restaurantId, {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      receivedById: req.query.receivedById as string,
      waiterId: req.query.waiterId as string,
      method: req.query.method as string,
      diningAreaId: req.query.diningAreaId as string,
      orderType: req.query.orderType as string,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getPaymentList(req.user!.restaurantId, {
      search: req.query.search as string,
      method: req.query.method as string,
      status: req.query.status as string,
      transactionType: req.query.transactionType as string,
      receivedById: req.query.receivedById as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await paymentService.getPaymentList(req.user!.restaurantId, {
      search: req.params.id,
      page: 1,
      limit: 1,
    });
    const payment = (result.payments as any[]).find((p: any) => p.id === req.params.id);
    if (!payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    res.json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/void', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1, 'Reason is required') }).parse(req.body);
    const result = await createApprovalRequest({
      restaurantId: req.user!.restaurantId,
      requestedById: req.user!.id,
      requestType: 'PAYMENT_VOID',
      title: 'Payment void requested',
      description: reason,
      entityType: 'payment',
      entityId: req.params.id,
      payload: { paymentId: req.params.id, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(202).json({ success: true, message: 'Payment void request submitted for approval', data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/refund', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      amount: z.string().min(1, 'Refund amount is required'),
      method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER', 'VOUCHER', 'OTHER']),
      reason: z.string().min(1, 'Reason is required'),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
      idempotencyKey: z.string().optional(),
    });
    const data = schema.parse(req.body);
    const result = await createApprovalRequest({
      restaurantId: req.user!.restaurantId,
      requestedById: req.user!.id,
      requestType: 'REFUND',
      title: `Refund requested: ${data.amount} ${data.method}`,
      description: data.reason,
      entityType: 'payment',
      entityId: req.params.id,
      payload: { paymentId: req.params.id, ...data },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(202).json({ success: true, message: 'Refund request submitted for approval', data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
