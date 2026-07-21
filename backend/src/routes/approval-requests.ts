import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import {
  approveApprovalRequest,
  createApprovalRequest,
  listApprovalRequests,
  rejectApprovalRequest,
} from '../services/approval-request.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await listApprovalRequests(req.user!.restaurantId, {
      status: req.query.status as string,
      requestType: req.query.requestType as string,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      requestType: z.enum(['PAYMENT_VOID', 'REFUND', 'STOCK_ADJUSTMENT', 'ATTENDANCE_CORRECTION', 'MANAGER_REQUEST']),
      title: z.string().min(1),
      description: z.string().optional(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      payload: z.record(z.unknown()),
    });
    const data = schema.parse(req.body);
    const request = await createApprovalRequest({
      restaurantId: req.user!.restaurantId,
      requestedById: req.user!.id,
      requestType: data.requestType,
      title: data.title,
      description: data.description,
      entityType: data.entityType,
      entityId: data.entityId,
      payload: data.payload as any,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({ success: true, message: 'Approval request submitted', data: request });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.post('/:id/approve', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { note } = z.object({ note: z.string().optional() }).parse(req.body || {});
    const request = await approveApprovalRequest(
      req.params.id,
      req.user!.restaurantId,
      req.user!.id,
      note,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Approval request approved', data: request });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

router.post('/:id/reject', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = z.object({ reason: z.string().min(1, 'Rejection reason is required') }).parse(req.body || {});
    const request = await rejectApprovalRequest(
      req.params.id,
      req.user!.restaurantId,
      req.user!.id,
      reason,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Approval request rejected', data: request });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
