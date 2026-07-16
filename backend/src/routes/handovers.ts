import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth } from '../middleware/auth';
import * as handoverService from '../services/handover.service';
import { BadRequestError } from '../types';

const router = Router();
router.use(requireAuth);

const createHandoverSchema = z.object({
  workShiftId: z.string(),
  toUserId: z.string().optional(),
  assignedRoleName: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  notes: z.string().min(1, 'Notes are required'),
  unresolvedOrders: z.any().optional(),
  stockConcerns: z.any().optional(),
  cashConcerns: z.any().optional(),
  maintenanceConcerns: z.any().optional(),
});

const updateHandoverSchema = createHandoverSchema.partial();

// GET /api/handovers
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      workShiftId, fromUserId, toUserId, assignedRoleName,
      status, dateFrom, dateTo, page, limit
    } = req.query;

    const result = await handoverService.listHandovers(req.user!.restaurantId, {
      workShiftId: workShiftId as string,
      fromUserId: fromUserId as string,
      toUserId: toUserId as string,
      assignedRoleName: assignedRoleName as string,
      status: status as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });

    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/handovers/suggestions/:shiftId
router.get('/suggestions/:shiftId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assignedRoleName } = req.query;
    const suggestions = await handoverService.getSuggestedHandoverContent(
      req.params.shiftId,
      req.user!.restaurantId,
      assignedRoleName as string
    );
    res.json({ success: true, data: suggestions });
  } catch (error) { next(error); }
});

// GET /api/handovers/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const handover = await prisma.shiftHandover.findFirst({
      where: { id: req.params.id, restaurantId: req.user!.restaurantId },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true } },
        toUser: { select: { id: true, firstName: true, lastName: true } },
        acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
        workShift: { select: { nameSnapshot: true, codeSnapshot: true, businessDate: true } },
      },
    });
    if (!handover) {
      res.status(404).json({ success: false, message: 'Handover not found' });
      return;
    }
    res.json({ success: true, data: handover });
  } catch (error) { next(error); }
});

// POST /api/handovers
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createHandoverSchema.parse(req.body);
    const result = await handoverService.createHandover(
      req.user!.restaurantId,
      req.user!.id,
      parsed,
      req.ip,
      req.headers['user-agent']
    );
    res.status(201).json({ success: true, message: 'Handover created', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/handovers/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateHandoverSchema.parse(req.body);
    const result = await handoverService.updateHandover(
      req.params.id,
      req.user!.restaurantId,
      req.user!.id,
      parsed,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Handover updated', data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/handovers/:id/submit
router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await handoverService.submitHandover(
      req.params.id,
      req.user!.restaurantId,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Handover submitted', data: result });
  } catch (error) { next(error); }
});

// POST /api/handovers/:id/acknowledge
router.post('/:id/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await handoverService.acknowledgeHandover(
      req.params.id,
      req.user!.restaurantId,
      req.user!.id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({ success: true, message: 'Handover acknowledged', data: result });
  } catch (error) { next(error); }
});

export default router;
