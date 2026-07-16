import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth} from '../middleware/auth';
import * as reservationService from '../services/reservation.service';
import * as notificationService from '../services/notification.service';
import { BadRequestError } from '../types';
import { prisma } from '../database';
import { emitNewNotification } from '../sockets';
import { getSocketIO } from '../sockets/emitter';

const router = Router();
router.use(requireAuth);

const createReservationSchema = z.object({
  customerId: z.string().uuid().optional(),
  customerName: z.string().min(1, 'Customer name required'),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  reservationSource: z.enum(['PHONE', 'WALK_IN', 'IN_PERSON', 'STAFF_ENTRY', 'WEBSITE', 'OTHER']).default('PHONE'),
  reservationDate: z.string().min(1),
  startAt: z.string().min(1),
  expectedEndAt: z.string().optional(),
  partySize: z.number().int().min(1),
  diningAreaId: z.string().uuid().optional(),
  tableId: z.string().uuid().optional(),
  specialRequests: z.string().optional(),
  dietaryNotes: z.string().optional(),
  occasion: z.string().optional(),
  internalNotes: z.string().optional(),
  status: z.enum(['PENDING', 'CONFIRMED']).optional().default('PENDING'),
});

// GET /api/reservations
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reservationService.listReservations(req.user!.restaurantId, {
      date: req.query.date as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      status: req.query.status as string,
      customerId: req.query.customerId as string,
      diningAreaId: req.query.diningAreaId as string,
      tableId: req.query.tableId as string,
      partySize: req.query.partySize ? parseInt(req.query.partySize as string) : undefined,
      source: req.query.source as string,
      search: req.query.search as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) { next(error); }
});

// GET /api/reservations/calendar
router.get('/calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const reservations = await reservationService.getReservationCalendar(req.user!.restaurantId, date);
    res.json({ success: true, data: reservations });
  } catch (error) { next(error); }
});

// GET /api/reservations/availability
router.get('/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      startAt: z.string().min(1),
      expectedEndAt: z.string().optional(),
      partySize: z.string().transform(Number),
      diningAreaId: z.string().optional(),
    });
    const parsed = schema.parse(req.query);
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: req.user!.restaurantId } });
    const duration = settings?.defaultReservationDurationMinutes || 120;
    const startAt = new Date(parsed.startAt);
    const expectedEndAt = parsed.expectedEndAt ? new Date(parsed.expectedEndAt) : new Date(startAt.getTime() + duration * 60000);

    const availability = await reservationService.getTableAvailability({
      restaurantId: req.user!.restaurantId,
      startAt,
      expectedEndAt,
      partySize: parsed.partySize,
      diningAreaId: parsed.diningAreaId,
    });
    res.json({ success: true, data: availability });
  } catch (error) { next(error); }
});

// GET /api/reservations/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await reservationService.getReservationDetail(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: reservation });
  } catch (error) { next(error); }
});

// POST /api/reservations
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createReservationSchema.parse(req.body);
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: req.user!.restaurantId } });
    const reservation = await reservationService.createReservation(
      req.user!.restaurantId, req.user!.id, parsed, settings, req.ip, req.headers['user-agent']
    );

    // Notify managers about new reservation
    try {
      const io = getSocketIO();
      const managerIds = await notificationService.getUsersByRole(req.user!.restaurantId, ['MANAGER']);
      if (managerIds.length > 0) {
        const notifs = await notificationService.createBulkNotification({
          restaurantId: req.user!.restaurantId,
          userIds: managerIds,
          type: 'RESERVATION_CREATED',
          title: `New Reservation — ${parsed.customerName}`,
          message: `${parsed.partySize} guests at ${new Date(parsed.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          entityType: 'reservation',
          entityId: reservation.id,
        });
        for (const n of notifs) {
          emitNewNotification(io, req.user!.restaurantId, n.userId, { notification: n });
        }
      }
    } catch (err) { console.error('Failed to send reservation notification:', err); }

    res.status(201).json({ success: true, data: reservation });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// PATCH /api/reservations/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      customerEmail: z.string().optional(),
      startAt: z.string().optional(),
      expectedEndAt: z.string().optional(),
      partySize: z.number().int().optional(),
      diningAreaId: z.string().uuid().nullable().optional(),
      tableId: z.string().uuid().nullable().optional(),
      specialRequests: z.string().optional(),
      dietaryNotes: z.string().optional(),
      occasion: z.string().optional(),
      internalNotes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: req.user!.restaurantId } });
    const result = await reservationService.updateReservation(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed, settings, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/reservations/:id/confirm
router.post('/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: req.user!.restaurantId } });
    const result = await reservationService.confirmReservation(
      req.params.id, req.user!.restaurantId, req.user!.id, settings, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/reservations/:id/check-in
router.post('/:id/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ reassignTableId: z.string().uuid().optional() });
    const parsed = schema.parse(req.body);
    const result = await reservationService.checkInReservation(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.reassignTableId, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/reservations/:id/seat
router.post('/:id/seat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      tableId: z.string().uuid(),
      createOrder: z.boolean().default(true),
      waiterId: z.string().uuid().optional(),
      guestCount: z.number().int().optional(),
    });
    const parsed = schema.parse(req.body);
    const result = await reservationService.seatReservation(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/reservations/:id/complete
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reservationService.completeReservation(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/reservations/:id/cancel
router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ reason: z.string().min(1) });
    const parsed = schema.parse(req.body);
    const result = await reservationService.cancelReservation(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.reason, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// POST /api/reservations/:id/no-show
router.post('/:id/no-show', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await reservationService.markNoShow(
      req.params.id, req.user!.restaurantId, req.user!.id, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) { next(error); }
});

// POST /api/reservations/:id/reassign-table
router.post('/:id/reassign-table', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({ tableId: z.string().uuid(), reason: z.string().optional() });
    const parsed = schema.parse(req.body);
    const result = await reservationService.reassignTable(
      req.params.id, req.user!.restaurantId, req.user!.id, parsed.tableId, parsed.reason, req.ip, req.headers['user-agent']
    );
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

export default router;
