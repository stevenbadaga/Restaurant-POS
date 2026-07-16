import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../database';
import { requireAuth, requireRole } from '../middleware/auth';
import { BadRequestError, NotFoundError } from '../types';
import { createAuditLog } from '../services/audit.service';
import { toDecimal, roundMoney } from '../services/calculation.service';
import { generateSequenceNumber } from '../services/sequence.service';
import { emitOrderSubmittedToKitchen, emitOrderWaiterAssigned, emitOrderWaiterUnassigned, emitNewNotification } from '../sockets';
import { getSocketIO } from '../sockets/emitter';
import * as notificationService from '../services/notification.service';

const router = Router();
router.use(requireAuth);

// ==========================================
// HELPERS
// ==========================================

async function getOrderWithAccess(orderId: string, restaurantId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { createdAt: 'asc' } },
      table: { select: { id: true, name: true, code: true } },
      waiter: { select: { id: true, firstName: true, lastName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      restaurant: { select: { settings: true } },
    },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new BadRequestError('Access denied');
  return order;
}

async function recalcOrderTotals(orderId: string) {
  const items = await prisma.orderItem.findMany({
    where: { orderId, status: { not: 'CANCELLED' } },
  });

  const subtotal = items.reduce((sum, i) => sum.plus(toDecimal(i.lineSubtotal)), toDecimal(0));
  const taxAmount = items.reduce((sum, i) => sum.plus(toDecimal(i.lineTaxAmount)), toDecimal(0));
  const totalBeforeDiscount = items.reduce((sum, i) => sum.plus(toDecimal(i.lineTotalBeforeDiscount || i.lineTotal)), toDecimal(0));
  const lineDiscounts = items.reduce((sum, i) => sum.plus(toDecimal(i.lineDiscountAmount)), toDecimal(0));

  const restSettings = await prisma.restaurantSettings.findUnique({ where: { restaurantId: (await prisma.order.findUnique({ where: { id: orderId }, select: { restaurantId: true } }))?.restaurantId } });
  const serviceChargeRate = restSettings?.serviceChargeRate || 0;
  const serviceCharge = roundMoney(subtotal.mul(toDecimal(serviceChargeRate).div(100)));

  // Read existing discount amount
  const existingOrder = await prisma.order.findUnique({ where: { id: orderId }, select: { discountAmount: true } });

  const totalAmount = roundMoney(subtotal.plus(serviceCharge).minus(toDecimal(existingOrder?.discountAmount || 0)));
  const amountDue = roundMoney(totalAmount.minus(toDecimal((await prisma.order.findUnique({ where: { id: orderId }, select: { amountPaid: true } }))?.amountPaid || 0)));

  await prisma.order.update({
    where: { id: orderId },
    data: {
      subtotal: roundMoney(subtotal).toFixed(2),
      taxAmount: roundMoney(taxAmount).toFixed(2),
      serviceCharge: serviceCharge.toFixed(2),
      totalBeforeDiscount: roundMoney(totalBeforeDiscount).toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      amountDue: amountDue.greaterThan(0) ? amountDue.toFixed(2) : '0.00',
    },
  });
}

async function generateOrderNumber(restaurantId: string): Promise<string> {
  const rest = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true, settings: { select: { orderNumberPrefix: true } } } });
  const prefix = rest?.settings?.orderNumberPrefix || 'ORD';
  return generateSequenceNumber(restaurantId, 'ORDER', prefix, rest?.timezone ?? 'UTC');
}

// Deduct stock for inventory-tracked menu items (wrapped in transaction for atomicity)
async function deductStockForOrder(orderId: string, restaurantId: string, userId: string) {
  const orderItems = await prisma.orderItem.findMany({
    where: { orderId, status: { not: 'CANCELLED' } },
    select: { id: true, quantity: true, menuItemId: true },
  });

  // Get menu items with inventory links
  const menuItemIds = orderItems.map(oi => oi.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, trackInventory: true, name: true },
  });

  const trackedItemIds = menuItems.filter(mi => mi.trackInventory).map(mi => mi.id);
  if (trackedItemIds.length === 0) return;

  // Get inventory links for tracked items
  const invLinks = await prisma.menuItemInventoryLink.findMany({
    where: { menuItemId: { in: trackedItemIds }, isActive: true },
    select: { menuItemId: true, inventoryItemId: true, stockLocationId: true, quantityPerSale: true },
  });

  // Get active recipes for tracked items
  const recipes = await prisma.recipe.findMany({
    where: { menuItemId: { in: trackedItemIds }, isActive: true },
    select: { id: true, name: true, menuItemId: true },
  });

  const recipeIds = recipes.map(r => r.id);
  const ingredients = recipeIds.length > 0 ? await prisma.recipeIngredient.findMany({
    where: { recipeId: { in: recipeIds } },
    select: { recipeId: true, inventoryItemId: true, stockLocationId: true, quantityRequired: true, wastagePercentage: true },
  }) : [];

  const defaultLocation = await prisma.stockLocation.findFirst({
    where: { restaurantId, isDefault: true },
    select: { id: true },
  });

  const defaultLocId = defaultLocation?.id;

  // All stock mutations in one transaction for atomicity
  // Track inventory items that need low-stock checks
  const affectedItemIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const oi of orderItems) {
      const menuItem = menuItems.find(m => m.id === oi.menuItemId);
      if (!menuItem || !menuItem.trackInventory) continue;

      // Direct inventory links
      const itemLinks = invLinks.filter(l => l.menuItemId === oi.menuItemId);
      for (const link of itemLinks) {
        affectedItemIds.add(link.inventoryItemId);
        const locId = link.stockLocationId || defaultLocId;
        if (!locId) continue;
        const qty = Number(link.quantityPerSale) * oi.quantity;

        const balance = await tx.inventoryBalance.findUnique({
          where: { inventoryItemId_stockLocationId: { inventoryItemId: link.inventoryItemId, stockLocationId: locId } },
        });
        const qtyBefore = balance ? Number(balance.onHandQuantity) : 0;
        const qtyAfter = qtyBefore - qty;

        await tx.inventoryBalance.update({
          where: { inventoryItemId_stockLocationId: { inventoryItemId: link.inventoryItemId, stockLocationId: locId } },
          data: { onHandQuantity: qtyAfter },
        });

        await tx.stockMovement.create({
          data: {
            restaurantId, inventoryItemId: link.inventoryItemId, stockLocationId: locId,
            movementType: 'DIRECT_SALE_CONSUMPTION', quantity: qty,
            quantityBefore: qtyBefore, quantityAfter: qtyAfter,
            reservedBefore: balance ? Number(balance.reservedQuantity) : 0,
            reservedAfter: balance ? Number(balance.reservedQuantity) : 0,
            unitCost: 0, totalCost: 0, orderId, orderItemId: oi.id,
            actorUserId: userId, reason: `Order ${menuItem.name}`,
          },
        });
      }

      // Recipe-based consumption
      const itemRecipes = recipes.filter(r => r.menuItemId === oi.menuItemId);
      for (const recipe of itemRecipes) {
        const recipeIngredients = ingredients.filter(i => i.recipeId === recipe.id);
        for (const ingredient of recipeIngredients) {
          affectedItemIds.add(ingredient.inventoryItemId);
          const locId = ingredient.stockLocationId || defaultLocId;
          if (!locId) continue;
          const qtyRequired = Number(ingredient.quantityRequired) * oi.quantity;
          const wastage = qtyRequired * (Number(ingredient.wastagePercentage) / 100);
          const totalQty = qtyRequired + wastage;

          const balance = await tx.inventoryBalance.findUnique({
            where: { inventoryItemId_stockLocationId: { inventoryItemId: ingredient.inventoryItemId, stockLocationId: locId } },
          });
          const qtyBefore = balance ? Number(balance.onHandQuantity) : 0;
          const qtyAfter = qtyBefore - totalQty;

          await tx.inventoryBalance.update({
            where: { inventoryItemId_stockLocationId: { inventoryItemId: ingredient.inventoryItemId, stockLocationId: locId } },
            data: { onHandQuantity: qtyAfter },
          });

          await tx.stockMovement.create({
            data: {
              restaurantId, inventoryItemId: ingredient.inventoryItemId, stockLocationId: locId,
              movementType: 'RECIPE_CONSUMPTION', quantity: totalQty,
              quantityBefore: qtyBefore, quantityAfter: qtyAfter,
              reservedBefore: 0, reservedAfter: 0, unitCost: 0, totalCost: 0,
              orderId, orderItemId: oi.id,
              actorUserId: userId, reason: `Recipe: ${recipe.name}`,
            },
          });
        }
      }
    }
  });

  // Check for low stock on affected items (outside transaction to avoid holding it open)
  try {
    const io = getSocketIO();
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: {
        id: { in: Array.from(affectedItemIds) },
        reorderLevel: { gt: 0 },
        isActive: true,
      },
      select: { id: true, name: true, reorderLevel: true },
    });

    for (const invItem of lowStockItems) {
      // Get current on-hand quantity across all locations
      const balanceSum = await prisma.inventoryBalance.aggregate({
        where: { inventoryItemId: invItem.id },
        _sum: { onHandQuantity: true },
      });
      const currentQty = balanceSum._sum.onHandQuantity || 0;

      if (currentQty <= invItem.reorderLevel) {
        // Prevent duplicate notifications within last hour
        const existingNotif = await prisma.appNotification.findFirst({
          where: {
            restaurantId,
            type: 'LOW_STOCK',
            entityId: invItem.id,
            createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          },
        });

        if (!existingNotif) {
          const stockKeeperIds = await notificationService.getUsersByRole(restaurantId, ['STOCK_KEEPER', 'MANAGER']);
          if (stockKeeperIds.length > 0) {
            const notifs = await notificationService.createBulkNotification({
              restaurantId,
              userIds: stockKeeperIds,
              type: 'LOW_STOCK',
              title: `Low Stock: ${invItem.name}`,
              message: `Only ${currentQty} remaining (reorder at ${invItem.reorderLevel})`,
              entityType: 'inventory',
              entityId: invItem.id,
            });
            for (const n of notifs) {
              emitNewNotification(io, restaurantId, n.userId, { notification: n });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to check low stock:', err);
  }
}

// Create kitchen tickets for order items
async function createKitchenTickets(orderId: string, restaurantId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        where: { status: { not: 'CANCELLED' }, requiresPreparation: true },
      },
    },
  });
  if (!order) return;

  // Group items by kitchen station
  const itemsByStation = new Map<string, typeof order.items>();
  for (const item of order.items) {
    if (!item.kitchenStationId) continue;
    const existing = itemsByStation.get(item.kitchenStationId) || [];
    existing.push(item);
    itemsByStation.set(item.kitchenStationId, existing);
  }

  for (const [stationId, stationItems] of itemsByStation) {
    const station = await prisma.kitchenStation.findUnique({ where: { id: stationId } });
    if (!station) continue;

    const ticketNumber = `KT-${order.orderNumber}-${station.name.substring(0, 3).toUpperCase()}`;

    const ticket = await prisma.kitchenTicket.create({
      data: {
        restaurantId,
        orderId,
        kitchenStationId: stationId,
        ticketNumber,
        status: 'NEW',
      },
    });

    for (const item of stationItems) {
      await prisma.kitchenTicketItem.create({
        data: {
          kitchenTicketId: ticket.id,
          orderItemId: item.id,
        },
      });
    }
  }
}

// ==========================================
// CREATE ORDER
// ==========================================

const createOrderSchema = z.object({
  orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'PICKUP', 'DELIVERY']).default('DINE_IN'),
  tableId: z.string().uuid().optional().nullable(),
  guestCount: z.number().int().positive().optional().nullable(),
  customerName: z.string().max(100).optional().nullable(),
  customerPhone: z.string().max(30).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive().max(999),
    specialInstructions: z.string().max(200).optional().nullable(),
  })).min(1, 'At least one item required'),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createOrderSchema.parse(req.body);
    const restaurantId = req.user!.restaurantId;

    // Validate menu items
    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: parsed.items.map(i => i.menuItemId) }, restaurantId, isActive: true },
      include: { kitchenStation: { select: { id: true } }, category: { select: { id: true } } },
    });

    if (menuItems.length !== parsed.items.length) {
      throw new BadRequestError('One or more menu items not found or inactive');
    }

    // Validate table if provided
    if (parsed.tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: parsed.tableId, restaurantId },
      });
      if (!table) throw new BadRequestError('Table not found');
    }

    const orderNumber = await generateOrderNumber(restaurantId);

    // Build order items
    let subtotal = toDecimal(0);
    const orderItemData = parsed.items.map((item) => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)!;
      const lineSubtotal = roundMoney(toDecimal(menuItem.price).mul(item.quantity));
      subtotal = subtotal.plus(lineSubtotal);
      return {
        menuItemId: item.menuItemId,
        kitchenStationId: menuItem.kitchenStation?.id || null,
        menuItemNameSnapshot: menuItem.name,
        menuItemCodeSnapshot: menuItem.code,
        itemTypeSnapshot: menuItem.itemType,
        unitPrice: menuItem.price,
        taxRate: menuItem.taxRate,
        quantity: item.quantity,
        lineSubtotal: lineSubtotal.toFixed(2),
        lineTaxAmount: '0.00',
        lineTotal: lineSubtotal.toFixed(2),
        lineTotalBeforeDiscount: lineSubtotal.toFixed(2),
        lineDiscountAmount: '0.00',
        specialInstructions: item.specialInstructions || null,
        requiresPreparation: menuItem.requiresPreparation,
        status: 'DRAFT' as const,
      };
    });

    // Service charge from settings
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
    const serviceChargeRate = settings?.serviceChargeRate || 0;
    const serviceCharge = roundMoney(subtotal.mul(toDecimal(serviceChargeRate).div(100)));
    const totalAmount = roundMoney(subtotal.plus(serviceCharge));

    const order = await prisma.order.create({
      data: {
        restaurantId,
        orderNumber,
        orderType: parsed.orderType,
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        tableId: parsed.tableId || null,
        guestCount: parsed.guestCount || null,
        customerName: parsed.customerName || null,
        customerPhone: parsed.customerPhone || null,
        notes: parsed.notes || null,
        subtotal: roundMoney(subtotal).toFixed(2),
        taxAmount: '0.00',
        serviceCharge: serviceCharge.toFixed(2),
        discountAmount: '0.00',
        totalAmount: totalAmount.toFixed(2),
        amountPaid: '0.00',
        amountDue: totalAmount.toFixed(2),
        totalBeforeDiscount: roundMoney(subtotal).toFixed(2),
        waiterId: req.user!.id,
        createdById: req.user!.id,
        items: { createMany: { data: orderItemData } },
      },
      include: {
        items: true,
        table: { select: { id: true, name: true, code: true } },
      },
    });

    await createAuditLog({
      restaurantId,
      userId: req.user!.id,
      action: 'ORDER_CREATED',
      entityType: 'Order',
      entityId: order.id,
      description: `Order ${orderNumber} created with ${parsed.items.length} items`,
      metadata: { orderType: parsed.orderType, itemCount: parsed.items.length },
    });

    res.status(201).json({ success: true, data: order, message: 'Order created' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// LIST ORDERS (existing)
// ==========================================

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '25' } = req.query;
    const where: any = { restaurantId: req.user!.restaurantId };
    if (status) where.status = status as string;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 25));

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          waiter: { select: { id: true, firstName: true, lastName: true } },
          table: { select: { name: true, code: true } },
          items: true,
          _count: { select: { items: true } },
        },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ success: true, data: orders, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (error) { next(error); }
});

// ==========================================
// GET ORDER BY ID
// ==========================================

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    const payments = await prisma.payment.findMany({
      where: { orderId: req.params.id, status: { not: 'FAILED' } },
      orderBy: { createdAt: 'desc' },
      include: { receivedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    const tickets = await prisma.kitchenTicket.findMany({
      where: { orderId: req.params.id },
      include: {
        kitchenStation: { select: { id: true, name: true } },
        items: { include: { orderItem: { select: { menuItemNameSnapshot: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: { ...order, payments, kitchenTickets: tickets } });
  } catch (error) { next(error); }
});

// ==========================================
// UPDATE ORDER
// ==========================================

const updateOrderSchema = z.object({
  tableId: z.string().uuid().optional().nullable(),
  guestCount: z.number().int().positive().optional().nullable(),
  customerName: z.string().max(100).optional().nullable(),
  customerPhone: z.string().max(30).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateOrderSchema.parse(req.body);
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);

    if (!['DRAFT', 'SUBMITTED'].includes(order.status)) {
      throw new BadRequestError('Can only update draft or submitted orders');
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: parsed,
    });

    res.json({ success: true, data: updated, message: 'Order updated' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// ACTIVE ORDERS (existing)
// ==========================================

router.get('/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId: req.user!.restaurantId, status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED'] } },
      include: {
        waiter: { select: { id: true, firstName: true, lastName: true } },
        table: { select: { name: true, code: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: orders });
  } catch (error) { next(error); }
});

// ==========================================
// ADD ITEM TO ORDER
// ==========================================

const addItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
  specialInstructions: z.string().max(200).optional().nullable(),
});

router.post('/:id/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = addItemSchema.parse(req.body);
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);

    if (order.status !== 'DRAFT') {
      throw new BadRequestError('Can only add items to draft orders');
    }

    const menuItem = await prisma.menuItem.findFirst({
      where: { id: parsed.menuItemId, restaurantId: req.user!.restaurantId, isActive: true },
      include: { kitchenStation: { select: { id: true } } },
    });
    if (!menuItem) throw new BadRequestError('Menu item not found');

    // Check if item already exists, increment qty if so
    const existingItem = await prisma.orderItem.findFirst({
      where: { orderId: req.params.id, menuItemId: parsed.menuItemId, status: 'DRAFT' },
    });

    if (existingItem) {
      const newQty = existingItem.quantity + parsed.quantity;
      const lineSubtotal = roundMoney(toDecimal(menuItem.price).mul(newQty));
      await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQty,
          lineSubtotal: lineSubtotal.toFixed(2),
          lineTotal: lineSubtotal.toFixed(2),
          lineTotalBeforeDiscount: lineSubtotal.toFixed(2),
        },
      });
    } else {
      const lineSubtotal = roundMoney(toDecimal(menuItem.price).mul(parsed.quantity));
      await prisma.orderItem.create({
        data: {
          orderId: req.params.id,
          menuItemId: parsed.menuItemId,
          kitchenStationId: menuItem.kitchenStation?.id || null,
          menuItemNameSnapshot: menuItem.name,
          menuItemCodeSnapshot: menuItem.code,
          itemTypeSnapshot: menuItem.itemType,
          unitPrice: menuItem.price,
          taxRate: menuItem.taxRate,
          quantity: parsed.quantity,
          lineSubtotal: lineSubtotal.toFixed(2),
          lineTaxAmount: '0.00',
          lineTotal: lineSubtotal.toFixed(2),
          lineTotalBeforeDiscount: lineSubtotal.toFixed(2),
          lineDiscountAmount: '0.00',
          specialInstructions: parsed.specialInstructions || null,
          requiresPreparation: menuItem.requiresPreparation,
          status: 'DRAFT',
        },
      });
    }

    await recalcOrderTotals(req.params.id);

    const updatedOrder = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: updatedOrder, message: 'Item added' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// UPDATE ORDER ITEM (qty, instructions)
// ==========================================

const updateItemSchema = z.object({
  quantity: z.number().int().positive().max(999).optional(),
  specialInstructions: z.string().max(200).optional().nullable(),
});

router.patch('/:id/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateItemSchema.parse(req.body);
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    const orderItem = await prisma.orderItem.findFirst({
      where: { id: req.params.itemId, orderId: req.params.id },
    });
    if (!orderItem) throw new NotFoundError('Order item not found');
    if (order.status !== 'DRAFT') throw new BadRequestError('Can only modify items in draft orders');

    const updateData: any = {};
    if (parsed.specialInstructions !== undefined) updateData.specialInstructions = parsed.specialInstructions;

    if (parsed.quantity) {
      const lineSubtotal = roundMoney(toDecimal(orderItem.unitPrice).mul(parsed.quantity));
      updateData.quantity = parsed.quantity;
      updateData.lineSubtotal = lineSubtotal.toFixed(2);
      updateData.lineTotal = lineSubtotal.toFixed(2);
      updateData.lineTotalBeforeDiscount = lineSubtotal.toFixed(2);
    }

    await prisma.orderItem.update({ where: { id: req.params.itemId }, data: updateData });
    await recalcOrderTotals(req.params.id);

    const updatedOrder = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: updatedOrder, message: 'Item updated' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// REMOVE ITEM FROM ORDER
// ==========================================

router.delete('/:id/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    const orderItem = await prisma.orderItem.findFirst({
      where: { id: req.params.itemId, orderId: req.params.id },
    });
    if (!orderItem) throw new NotFoundError('Order item not found');
    if (order.status !== 'DRAFT') throw new BadRequestError('Can only remove items from draft orders');

    await prisma.orderItem.delete({ where: { id: req.params.itemId } });
    await recalcOrderTotals(req.params.id);

    const updatedOrder = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: updatedOrder, message: 'Item removed' });
  } catch (error) { next(error); }
});

// ==========================================
// SUBMIT ORDER TO KITCHEN
// ==========================================

router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);

    if (order.status !== 'DRAFT') {
      throw new BadRequestError('Only draft orders can be submitted');
    }

    const nonCancelledItems = order.items.filter(i => i.status !== 'CANCELLED');
    if (nonCancelledItems.length === 0) {
      throw new BadRequestError('Order has no items to submit');
    }

    // Update all items to SENT status
    await prisma.orderItem.updateMany({
      where: { orderId: req.params.id, status: 'DRAFT' },
      data: { status: 'SENT', submittedAt: new Date() },
    });

    // Update order status
    const submittedAt = new Date();
    await prisma.order.update({
      where: { id: req.params.id },
      data: { status: 'SUBMITTED', submittedAt },
    });

    // Create kitchen tickets for preparation items
    await createKitchenTickets(req.params.id, req.user!.restaurantId);

    // Deduct stock for tracked inventory items
    await deductStockForOrder(req.params.id, req.user!.restaurantId, req.user!.id);

    // Update table status
    if (order.tableId && order.orderType === 'DINE_IN') {
      await prisma.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'OCCUPIED' },
      });
    }

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'ORDER_SUBMITTED',
      entityType: 'Order',
      entityId: req.params.id,
      description: `Order ${order.orderNumber} submitted to kitchen`,
    });

    // Emit socket event for real-time kitchen updates
    try {
      const io = getSocketIO();
      emitOrderSubmittedToKitchen(io, req.user!.restaurantId, {
        orderId: req.params.id,
        orderNumber: order.orderNumber,
        status: 'SUBMITTED',
      });
    } catch { /* Socket may not be initialized */ }

    // Create notifications for waiters and managers
    try {
      const io = getSocketIO();
      const orderWaiterId = order.waiterId;
      const managerIds = await notificationService.getUsersByRole(req.user!.restaurantId, ['MANAGER']);

      // Notify the assigned waiter
      if (orderWaiterId) {
        const notif = await notificationService.createNotification({
          restaurantId: req.user!.restaurantId,
          userId: orderWaiterId,
          type: 'ORDER_SUBMITTED',
          title: `New Order #${order.orderNumber}`,
          message: `${nonCancelledItems.length} items — ${order.table?.name || order.orderType}`,
          orderId: req.params.id,
          entityType: 'order',
          entityId: req.params.id,
        });
        emitNewNotification(io, req.user!.restaurantId, orderWaiterId, { notification: notif });
      }

      // Notify all managers using bulk notification
      if (managerIds.length > 0) {
        const notifs = await notificationService.createBulkNotification({
          restaurantId: req.user!.restaurantId,
          userIds: managerIds,
          type: 'ORDER_SUBMITTED',
          title: `New Order #${order.orderNumber}`,
          message: `${nonCancelledItems.length} items — ${order.table?.name || order.orderType}`,
          orderId: req.params.id,
          entityType: 'order',
          entityId: req.params.id,
        });
        for (const n of notifs) {
          emitNewNotification(io, req.user!.restaurantId, n.userId, { notification: n });
        }
      }
    } catch (err) { console.error('Failed to create order notification:', err); }

    const updated = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: updated, message: 'Order submitted to kitchen' });
  } catch (error) { next(error); }
});

// ==========================================
// UPDATE ITEM STATUS (chef prepares, waiter serves)
// ==========================================

const itemStatusSchema = z.object({
  status: z.enum(['SENT', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
  cancellationReason: z.string().max(200).optional().nullable(),
});

router.patch('/:id/items/:itemId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = itemStatusSchema.parse(req.body);
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    const orderItem = await prisma.orderItem.findFirst({
      where: { id: req.params.itemId, orderId: req.params.id },
    });
    if (!orderItem) throw new NotFoundError('Order item not found');

    if (order.status === 'CLOSED' || order.status === 'CANCELLED') {
      throw new BadRequestError('Order is closed or cancelled');
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['SENT'],
      SENT: ['ACCEPTED', 'CANCELLED'],
      ACCEPTED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY', 'CANCELLED'],
      READY: ['SERVED', 'CANCELLED'],
      SERVED: [],
      CANCELLED: [],
    };

    const allowed = validTransitions[orderItem.status] || [];
    if (!allowed.includes(parsed.status)) {
      throw new BadRequestError(`Cannot transition from ${orderItem.status} to ${parsed.status}`);
    }

    const updateData: any = { status: parsed.status };
    if (parsed.status === 'SENT') updateData.submittedAt = new Date();
    if (parsed.status === 'ACCEPTED') updateData.acceptedAt = new Date();
    if (parsed.status === 'PREPARING') updateData.preparationStartedAt = new Date();
    if (parsed.status === 'READY') updateData.readyAt = new Date();
    if (parsed.status === 'SERVED') updateData.servedAt = new Date();
    if (parsed.status === 'CANCELLED') {
      updateData.cancelledAt = new Date();
      updateData.cancelledById = req.user!.id;
      updateData.cancellationReason = parsed.cancellationReason || null;
    }

    await prisma.orderItem.update({ where: { id: req.params.itemId }, data: updateData });

    // Recalculate order totals if item cancelled
    if (parsed.status === 'CANCELLED') {
      await recalcOrderTotals(req.params.id);
    }

    // Update order status based on item statuses
    const allItems = await prisma.orderItem.findMany({
      where: { orderId: req.params.id, status: { not: 'CANCELLED' } },
    });

    const allServed = allItems.length > 0 && allItems.every(i => i.status === 'SERVED');
    const anyPreparing = allItems.some(i => i.status === 'PREPARING');
    const anyAccepted = allItems.some(i => i.status === 'ACCEPTED');
    const anyReady = allItems.some(i => i.status === 'READY');
    const anySent = allItems.some(i => i.status === 'SENT');
    const allReady = allItems.length > 0 && allItems.every(i => i.status === 'READY' || i.status === 'SERVED');

    let newOrderStatus = order.status;
    if (allServed) {
      newOrderStatus = 'SERVED';
    } else if (allReady && !anySent && !anyAccepted && !anyPreparing) {
      newOrderStatus = 'READY';
    } else if (anyReady && (anyAccepted || anyPreparing || anySent)) {
      newOrderStatus = 'PARTIALLY_READY';
    } else if (anyAccepted && !anyPreparing && !anyReady) {
      newOrderStatus = 'SUBMITTED';
    }

    if (newOrderStatus !== order.status) {
      const orderUpdateData: any = { status: newOrderStatus };
      if (newOrderStatus === 'IN_PREPARATION') orderUpdateData.preparationStartedAt = new Date();
      if (newOrderStatus === 'SERVED') orderUpdateData.servedAt = new Date();
      await prisma.order.update({ where: { id: req.params.id }, data: orderUpdateData });
    }

    // If item is READY, update kitchen ticket item
    if (parsed.status === 'READY') {
      const ticketItem = await prisma.kitchenTicketItem.findFirst({
        where: { orderItemId: req.params.itemId },
        include: { kitchenTicket: true },
      });
      if (ticketItem) {
        // Check if all items in this ticket are ready
        const allTicketItems = await prisma.kitchenTicketItem.findMany({
          where: { kitchenTicketId: ticketItem.kitchenTicketId },
          include: { orderItem: true },
        });
        const allReady = allTicketItems.every(ti => ti.orderItem.status === 'READY' || ti.orderItem.status === 'SERVED');
        if (allReady) {
          await prisma.kitchenTicket.update({
            where: { id: ticketItem.kitchenTicketId },
            data: { status: 'READY', readyAt: new Date() },
          });
        } else {
          await prisma.kitchenTicket.update({
            where: { id: ticketItem.kitchenTicketId },
            data: { status: 'PARTIALLY_READY' },
          });
        }
      }
    }

    const updatedOrder = await getOrderWithAccess(req.params.id, req.user!.restaurantId);
    res.json({ success: true, data: updatedOrder, message: `Item status updated to ${parsed.status}` });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// CANCEL ORDER
// ==========================================

const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = cancelOrderSchema.parse(req.body);
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);

    if (['CLOSED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestError('Order is already closed or cancelled');
    }

    await prisma.$transaction(async (tx) => {
      await tx.orderItem.updateMany({
        where: { orderId: req.params.id, status: { not: 'CANCELLED' } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: req.user!.id, cancellationReason: parsed.reason },
      });

      await tx.order.update({
        where: { id: req.params.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: req.user!.id, cancellationReason: parsed.reason },
      });

      if (order.tableId) {
        await tx.restaurantTable.update({
          where: { id: order.tableId },
          data: { status: 'AVAILABLE' },
        });
      }
    });

    res.json({ success: true, message: 'Order cancelled' });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// ASSIGN WAITER TO ORDER
// ==========================================

const assignWaiterSchema = z.object({
  waiterId: z.string().uuid('Valid waiter ID required'),
});

router.patch('/:id/assign-waiter', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = assignWaiterSchema.parse(req.body);
    const order = await getOrderWithAccess(req.params.id, req.user!.restaurantId);

    // Prevent assignment on closed/cancelled orders
    if (['CLOSED', 'CANCELLED'].includes(order.status)) {
      throw new BadRequestError('Cannot reassign waiter on a closed or cancelled order.');
    }

    // Validate the user exists, is ACTIVE, and has WAITER role
    const waiter = await prisma.user.findFirst({
      where: {
        id: parsed.waiterId,
        restaurantId: req.user!.restaurantId,
        status: 'ACTIVE',
        roles: {
          some: {
            role: {
              name: { in: ['WAITER', 'ADMIN', 'MANAGER'] },
            },
          },
        },
      },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!waiter) {
      throw new BadRequestError('Invalid waiter. User must be ACTIVE with WAITER/ADMIN/MANAGER role.');
    }

    const previousWaiterId = order.waiterId;

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: { waiterId: waiter.id },
    });

    await createAuditLog({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      action: 'WAITER_ASSIGNED',
      entityType: 'Order',
      entityId: req.params.id,
      description: `Waiter ${waiter.firstName} ${waiter.lastName} assigned to order ${order.orderNumber}`,
      metadata: { previousWaiterId, newWaiterId: waiter.id },
    });

    // Emit socket events
    try {
      const io = getSocketIO();
      emitOrderWaiterAssigned(io, req.user!.restaurantId, {
        orderId: req.params.id,
        orderNumber: order.orderNumber,
        waiterId: waiter.id,
        waiterName: `${waiter.firstName} ${waiter.lastName}`,
      });
      if (previousWaiterId && previousWaiterId !== waiter.id) {
        emitOrderWaiterUnassigned(io, req.user!.restaurantId, {
          orderId: req.params.id,
          orderNumber: order.orderNumber,
          waiterId: previousWaiterId,
        });
      }

      // Create notification for the assigned waiter
      const notif = await notificationService.createNotification({
        restaurantId: req.user!.restaurantId,
        userId: waiter.id,
        type: 'WAITER_ASSIGNED',
        title: `Order #${order.orderNumber} assigned to you`,
        message: `${order.items?.length || 0} items — ${order.table?.name || order.orderType}`,
        orderId: req.params.id,
        entityType: 'order',
        entityId: req.params.id,
      });
      emitNewNotification(io, req.user!.restaurantId, waiter.id, { notification: notif });
    } catch { /* Socket may not be initialized */ }

    res.json({
      success: true,
      data: updated,
      message: `Waiter ${waiter.firstName} ${waiter.lastName} assigned to order`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) next(new BadRequestError(error.errors[0].message));
    else next(error);
  }
});

// ==========================================
// GET AVAILABLE WAITERS
// ==========================================

router.get('/waiters/available', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restaurantId = req.user!.restaurantId;

    const waiters = await prisma.user.findMany({
      where: {
        restaurantId,
        status: 'ACTIVE',
        roles: {
          some: {
            role: { name: 'WAITER' },
          },
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        _count: {
          select: {
            ordersAsWaiter: {
              where: { status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED'] } },
            },
          },
        },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    // Check clocked-in status for each waiter today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const clockedInUsers = await prisma.shiftAssignment.findMany({
      where: {
        restaurantId,
        userId: { in: waiters.map(w => w.id) },
        status: 'CLOCKED_IN',
        clockedInAt: { gte: todayStart, lte: todayEnd },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    const clockedInUserIds = new Set(clockedInUsers.map(c => c.userId));

    res.json({
      success: true,
      data: waiters.map((w) => ({
        id: w.id,
        firstName: w.firstName,
        lastName: w.lastName,
        employeeCode: w.employeeCode,
        activeOrderCount: w._count.ordersAsWaiter,
        isClockedIn: clockedInUserIds.has(w.id),
      })),
    });
  } catch (error) { next(error); }
});

export default router;
