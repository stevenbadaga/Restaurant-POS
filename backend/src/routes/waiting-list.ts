import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/auth';
import * as waitingListService from '../services/waiting-list.service';
import { BadRequestError } from '../types';
import { prisma } from '../database';
import {
  emitWaitingListCreated,
  emitWaitingListNotified,
  emitWaitingListSeated,
  emitWaitingListUpdated,
} from '../sockets';
import { getSocketIO } from '../sockets/emitter';

const router = Router();
router.use(requireAuth);

const createEntrySchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1, 'Customer name required'),
  phone: z.string().optional(),
  partySize: z.number().int().min(1),
  priority: z.number().int().min(0).max(5).optional(),
  preferredDiningAreaId: z.string().uuid().optional(),
  estimatedWaitMinutes: z.number().int().optional(),
  notes: z.string().optional(),
});

// GET /api/waiting-list
router.get('/', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await waitingListService.listWaitingList(req.user!.restaurantId, {
      status: req.query.status as string,
      diningAreaId: req.query.diningAreaId as string,
      partySize: req.query.partySize ? parseInt(req.query.partySize as string) : undefined,
      search: req.query.search as string,
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/waiting-list/:id
router.get('/:id', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await waitingListService.getWaitingListEntry(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// POST /api/waiting-list
router.post('/', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createEntrySchema.parse(req.body);
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: req.user!.restaurantId } });
    const entry = await waitingListService.createWaitingListEntry(
      req.user!.restaurantId, req.user!.id, parsed, settings, req.ip, req.headers['user-agent']
    );
    emitWaitingListEvent('created', req.user!.restaurantId, entry);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/waiting-list/:id
router.patch('/:id', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      customerName: z.string().optional(),
      phone: z.string().optional(),
      partySize: z.number().int().optional(),
      priority: z.number().int().min(0).max(5).optional(),
      preferredDiningAreaId: z.string().uuid().nullable().optional(),
      estimatedWaitMinutes: z.number().int().optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);
    const entry = await waitingListService.updateWaitingListEntry(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed, req.ip, req.headers['user-agent']
    );
    emitWaitingListEvent('updated', req.user!.restaurantId, entry);
    res.json({ success: true, data: entry });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/waiting-list/:id/notify
router.post('/:id/notify', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await waitingListService.notifyWaitingListEntry(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    emitWaitingListEvent('notified', req.user!.restaurantId, entry);
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// POST /api/waiting-list/:id/seat
router.post('/:id/seat', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      tableId: z.string().uuid(),
      createOrder: z.boolean().default(true),
      waiterId: z.string().uuid().optional(),
      guestCount: z.number().int().optional(),
    });
    const parsed = schema.parse(req.body);
    const entry = await waitingListService.seatWaitingListEntry(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed, req.ip, req.headers['user-agent']
    );
    emitWaitingListEvent('seated', req.user!.restaurantId, entry);
    res.json({ success: true, data: entry });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/waiting-list/:id/left
router.post('/:id/left', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await waitingListService.markLeft(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    emitWaitingListEvent('updated', req.user!.restaurantId, entry);
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

// POST /api/waiting-list/:id/cancel
router.post('/:id/cancel', requireRole('ADMIN', 'MANAGER', 'WAITER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await waitingListService.cancelWaitingListEntry(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    emitWaitingListEvent('updated', req.user!.restaurantId, entry);
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
});

export default router;

function emitWaitingListEvent(event: 'created' | 'updated' | 'notified' | 'seated', restaurantId: string, entry: unknown) {
  try {
    const io = getSocketIO();
    if (event === 'created') emitWaitingListCreated(io, restaurantId, { entry });
    else if (event === 'notified') emitWaitingListNotified(io, restaurantId, { entry });
    else if (event === 'seated') emitWaitingListSeated(io, restaurantId, { entry });
    else emitWaitingListUpdated(io, restaurantId, { entry });
  } catch {
    // Socket emission should not fail request processing.
  }
}
