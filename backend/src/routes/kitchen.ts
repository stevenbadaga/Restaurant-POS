import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../types';
import { createAuditLog } from '../services/audit.service';
import { emitKitchenTicketAccepted, emitKitchenTicketPreparing, emitKitchenTicketReady } from '../sockets';
import { getSocketIO } from '../sockets/emitter';
import * as notificationService from '../services/notification.service';

const router = Router();
router.use(requireAuth);

// ==========================================
// GET KITCHEN DISPLAY (all active tickets)
// ==========================================
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = await prisma.kitchenTicket.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        status: { in: ['NEW', 'ACCEPTED', 'PREPARING', 'PARTIALLY_READY'] },
      },
      include: {
        kitchenStation: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            orderNumber: true,
            orderType: true,
            table: { select: { name: true, code: true } },
            waiter: { select: { firstName: true, lastName: true } },
            notes: true,
            submittedAt: true,
          },
        },
        assignedChef: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            orderItem: {
              select: {
                id: true,
                menuItemNameSnapshot: true,
                menuItemCodeSnapshot: true,
                quantity: true,
                specialInstructions: true,
                status: true,
                unitPrice: true,
              },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: tickets });
  } catch (error) { next(error); }
});

// ==========================================
// GET TICKETS BY STATION
// ==========================================
router.get('/stations/:stationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tickets = await prisma.kitchenTicket.findMany({
      where: {
        restaurantId: req.user!.restaurantId,
        kitchenStationId: req.params.stationId,
        status: { in: ['NEW', 'ACCEPTED', 'PREPARING', 'PARTIALLY_READY'] },
      },
      include: {
        kitchenStation: { select: { id: true, name: true } },
        order: {
          select: {
            id: true, orderNumber: true, orderType: true,
            table: { select: { name: true, code: true } },
            waiter: { select: { firstName: true, lastName: true } },
            notes: true, submittedAt: true,
          },
        },
        assignedChef: { select: { id: true, firstName: true, lastName: true } },
        items: {
          include: {
            orderItem: {
              select: {
                id: true, menuItemNameSnapshot: true, menuItemCodeSnapshot: true,
                quantity: true, specialInstructions: true, status: true,
              },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: tickets });
  } catch (error) { next(error); }
});

// ==========================================
// ACCEPT TICKET (chef takes ownership)
// ==========================================
router.patch('/tickets/:ticketId/accept', requireRole('ADMIN', 'MANAGER', 'CHEF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: req.params.ticketId, restaurantId: req.user!.restaurantId },
    });
    if (!ticket) throw new NotFoundError('Kitchen ticket not found');
    if (ticket.status !== 'NEW') throw new BadRequestError('Ticket is not in NEW status');

    const updated = await prisma.kitchenTicket.update({
      where: { id: req.params.ticketId },
      data: { status: 'ACCEPTED', assignedChefId: req.user!.id, acceptedAt: new Date() },
    });

    // Update associated order items to ACCEPTED
    const ticketItems = await prisma.kitchenTicketItem.findMany({
      where: { kitchenTicketId: req.params.ticketId },
    });
    await prisma.orderItem.updateMany({
      where: { id: { in: ticketItems.map(ti => ti.orderItemId) }, status: 'SENT' },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'KITCHEN_TICKET_ACCEPTED',
      entityType: 'KitchenTicket',
      entityId: req.params.ticketId,
      description: `Kitchen ticket ${ticket.ticketNumber} accepted`,
    });

    try {
      const io = getSocketIO();
      emitKitchenTicketAccepted(io, req.user!.restaurantId, {
        ticketId: req.params.ticketId,
        ticketNumber: ticket.ticketNumber,
        status: 'ACCEPTED',
        assignedChefId: req.user!.id,
      });
    } catch {
      // Socket broadcasts are best-effort; the API response should not fail if sockets are unavailable.
    }

    res.json({ success: true, data: updated, message: 'Ticket accepted' });
  } catch (error) { next(error); }
});

// ==========================================
// START PREPARING TICKET
// ==========================================
router.patch('/tickets/:ticketId/prepare', requireRole('ADMIN', 'MANAGER', 'CHEF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: req.params.ticketId, restaurantId: req.user!.restaurantId },
    });
    if (!ticket) throw new NotFoundError('Kitchen ticket not found');
    if (ticket.status !== 'ACCEPTED') throw new BadRequestError('Ticket must be accepted first');

    const updated = await prisma.kitchenTicket.update({
      where: { id: req.params.ticketId },
      data: { status: 'PREPARING', preparationStartedAt: new Date() },
    });

    // Update order items to PREPARING
    const ticketItems = await prisma.kitchenTicketItem.findMany({
      where: { kitchenTicketId: req.params.ticketId },
    });
    await prisma.orderItem.updateMany({
      where: { id: { in: ticketItems.map(ti => ti.orderItemId) }, status: 'ACCEPTED' },
      data: { status: 'PREPARING', preparationStartedAt: new Date() },
    });

    // Update order status
    await prisma.order.update({
      where: { id: ticket.orderId },
      data: { status: 'IN_PREPARATION', preparationStartedAt: new Date() },
    });

    try {
      const io = getSocketIO();
      emitKitchenTicketPreparing(io, req.user!.restaurantId, {
        ticketId: req.params.ticketId,
        ticketNumber: ticket.ticketNumber,
        status: 'PREPARING',
        orderId: ticket.orderId,
      });
    } catch {
      // Socket broadcasts are best-effort; the API response should not fail if sockets are unavailable.
    }

    res.json({ success: true, data: updated, message: 'Preparation started' });
  } catch (error) { next(error); }
});

// ==========================================
// MARK TICKET ITEM AS READY
// ==========================================
const markReadySchema = z.object({
  orderItemIds: z.array(z.string().uuid()).min(1),
});

router.patch('/tickets/:ticketId/mark-ready', requireRole('ADMIN', 'MANAGER', 'CHEF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = markReadySchema.parse(req.body);
    const ticket = await prisma.kitchenTicket.findFirst({
      where: { id: req.params.ticketId, restaurantId: req.user!.restaurantId },
      include: { items: true },
    });
    if (!ticket) throw new NotFoundError('Kitchen ticket not found');

    // Verify all orderItemIds belong to this ticket
    const validItemIds = ticket.items.map(ti => ti.orderItemId);
    const invalidIds = parsed.orderItemIds.filter(id => !validItemIds.includes(id));
    if (invalidIds.length > 0) {
      throw new BadRequestError('Some items do not belong to this ticket');
    }

    // Mark items as READY
    await prisma.orderItem.updateMany({
      where: { id: { in: parsed.orderItemIds }, status: { in: ['ACCEPTED', 'PREPARING'] } },
      data: { status: 'READY', readyAt: new Date() },
    });

    // Check if all items in ticket are ready
    const allTicketItems = await prisma.kitchenTicketItem.findMany({
      where: { kitchenTicketId: req.params.ticketId },
      include: { orderItem: true },
    });
    const allReady = allTicketItems.every(ti => ti.orderItem.status === 'READY' || ti.orderItem.status === 'SERVED');
    const anyReady = allTicketItems.some(ti => ti.orderItem.status === 'READY');

    if (allReady) {
      await prisma.kitchenTicket.update({
        where: { id: req.params.ticketId },
        data: { status: 'READY', readyAt: new Date() },
      });
    } else if (anyReady) {
      await prisma.kitchenTicket.update({
        where: { id: req.params.ticketId },
        data: { status: 'PARTIALLY_READY' },
      });
    }

    // Update order status
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: ticket.orderId, status: { not: 'CANCELLED' } },
    });
    const allItemsReady = orderItems.every(i => i.status === 'READY' || i.status === 'SERVED');
    if (allItemsReady) {
      await prisma.order.update({
        where: { id: ticket.orderId },
        data: { status: 'READY', readyAt: new Date() },
      });
    }

    // Create notification for the order's waiter about ready items
    try {
      const io = getSocketIO();
      const newStatus = allReady ? 'READY' : anyReady ? 'PARTIALLY_READY' : 'PREPARING';
      emitKitchenTicketReady(io, req.user!.restaurantId, {
        ticketId: req.params.ticketId,
        ticketNumber: ticket.ticketNumber,
        status: newStatus,
        orderId: ticket.orderId,
        readyItemCount: parsed.orderItemIds.length,
      });

      // Get the order to find the waiter
      const order = await prisma.order.findUnique({
        where: { id: ticket.orderId },
        select: { waiterId: true, orderNumber: true },
      });

      if (order?.waiterId) {
        const itemNames = await prisma.orderItem.findMany({
          where: { id: { in: parsed.orderItemIds } },
          select: { menuItemNameSnapshot: true },
        });

        const notif = await notificationService.createNotification({
          restaurantId: req.user!.restaurantId,
          userId: order.waiterId,
          type: 'KITCHEN_ITEM_READY',
          title: `Items Ready — Order #${order.orderNumber}`,
          message: `${itemNames.map(i => i.menuItemNameSnapshot).join(', ')}`,
          orderId: ticket.orderId,
          entityType: 'order',
          entityId: ticket.orderId,
        });
        if (notif) await notificationService.emitNotification(notif);
      }
    } catch {
      // Notifications are best-effort; marking items ready should still complete if notification delivery fails.
    }

    res.json({ success: true, message: `${parsed.orderItemIds.length} item(s) marked ready` });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// GET COMPLETED TICKETS
// ==========================================
router.get('/tickets/completed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));

    const [tickets, total] = await Promise.all([
      prisma.kitchenTicket.findMany({
        where: {
          restaurantId: req.user!.restaurantId,
          status: { in: ['READY', 'CANCELLED'] },
        },
        include: {
          kitchenStation: { select: { name: true } },
          order: { select: { orderNumber: true } },
          assignedChef: { select: { firstName: true, lastName: true } },
          items: {
            include: {
              orderItem: { select: { menuItemNameSnapshot: true, quantity: true, status: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.kitchenTicket.count({
        where: { restaurantId: req.user!.restaurantId, status: { in: ['READY', 'CANCELLED'] } },
      }),
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error) { next(error); }
});

export default router;
