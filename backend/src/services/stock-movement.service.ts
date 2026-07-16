import { z } from 'zod';
import { prisma } from '../database';
import { createAuditLog } from './audit.service';
import { ensureDefaultLocation } from './inventory-location.service';
import { toDecimal, roundQuantity } from './calculation.service';
import { getUsersByRole } from './notification.service';

export const adjustmentSchema = z.object({
  inventoryItemId: z.string().uuid(),
  stockLocationId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  movementType: z.enum(['MANUAL_ADJUSTMENT_IN', 'MANUAL_ADJUSTMENT_OUT', 'WASTAGE', 'RETURN_TO_STOCK']),
  reason: z.string().min(1).max(500),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const transferSchema = z.object({
  inventoryItemId: z.string().uuid(),
  fromLocationId: z.string().uuid(),
  toLocationId: z.string().uuid(),
  quantity: z.number().positive(),
  reason: z.string().min(1).max(500),
  referenceNumber: z.string().optional(),
});

export async function createAdjustment(
  restaurantId: string,
  data: z.infer<typeof adjustmentSchema>,
  userId: string,
  userRoles: string[],
  ipAddress?: string
) {
  const isAdminOrManager = userRoles.includes('ADMIN') || userRoles.includes('MANAGER');
  const isStockKeeper = userRoles.includes('STOCK_KEEPER');
  const decreaseTypes = ['MANUAL_ADJUSTMENT_OUT', 'WASTAGE'];
  const isDecrease = decreaseTypes.includes(data.movementType);

  // Stock keeper decreases create a pending notification for managers instead of executing
  if (isDecrease && isStockKeeper && !isAdminOrManager) {
    // Check for existing pending approval notification to prevent duplicates
    const existing = await prisma.appNotification.findFirst({
      where: {
        restaurantId,
        type: 'APPROVAL_NEEDED',
        entityId: data.inventoryItemId,
        isRead: false,
      },
    });
    if (!existing) {
      const managerIds = await getUsersByRole(restaurantId, ['MANAGER']);
      const itemPreview = await prisma.inventoryItem.findUnique({
        where: { id: data.inventoryItemId },
        select: { name: true, baseUnit: true },
      });
      for (const mgrId of managerIds) {
        await prisma.appNotification.create({
          data: {
            restaurantId,
            userId: mgrId,
            type: 'APPROVAL_NEEDED',
            title: `Stock Adjustment Requested — ${data.movementType}`,
            message: `${data.quantity} ${itemPreview?.baseUnit?.toLowerCase() || 'units'} of "${itemPreview?.name || ''}" — ${data.reason}. Needs manager approval.`,
            entityType: 'stock_adjustment',
            entityId: data.inventoryItemId,
          },
        });
      }
    }
    throw new Error('Stock decrease adjustments require ADMIN or MANAGER approval');
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: data.inventoryItemId, restaurantId },
  });
  if (!item) throw new Error('Inventory item not found');

  const locationId = data.stockLocationId || (await ensureDefaultLocation(restaurantId)).id;

  return prisma.$transaction(async (tx) => {
    const balance = await tx.inventoryBalance.upsert({
      where: {
        inventoryItemId_stockLocationId: {
          inventoryItemId: data.inventoryItemId,
          stockLocationId: locationId,
        },
      },
      create: {
        restaurantId,
        inventoryItemId: data.inventoryItemId,
        stockLocationId: locationId,
        onHandQuantity: 0,
        reservedQuantity: 0,
      },
      update: {},
    });

    const isIncrease = ['MANUAL_ADJUSTMENT_IN', 'RETURN_TO_STOCK'].includes(data.movementType);
    const operator = isIncrease ? 1 : -1;
    const quantityChange = toDecimal(data.quantity).mul(operator);

    const newOnHand = roundQuantity(Number(balance.onHandQuantity) + Number(quantityChange));

    await tx.inventoryBalance.update({
      where: {
        inventoryItemId_stockLocationId: {
          inventoryItemId: data.inventoryItemId,
          stockLocationId: locationId,
        },
      },
      data: { onHandQuantity: newOnHand },
    });

    const movement = await tx.stockMovement.create({
      data: {
        restaurantId,
        inventoryItemId: data.inventoryItemId,
        stockLocationId: locationId,
        movementType: data.movementType,
        quantity: data.quantity,
        quantityBefore: Number(balance.onHandQuantity),
        quantityAfter: Number(newOnHand),
        reservedBefore: Number(balance.reservedQuantity),
        reservedAfter: Number(balance.reservedQuantity),
        unitCost: Number(item.averageCost || 0),
        totalCost: Number(toDecimal(data.quantity).mul(Number(item.averageCost || 0))),
        actorUserId: userId,
        reason: data.reason,
        referenceNumber: data.referenceNumber || null,
        metadata: { notes: data.notes },
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'MANUAL_STOCK_ADJUSTMENT',
      entityType: 'InventoryItem',
      entityId: data.inventoryItemId,
      description: `${data.movementType}: ${data.quantity} ${item.baseUnit.toLowerCase()} of "${item.name}"`,
      metadata: {
        movementType: data.movementType,
        quantity: data.quantity,
        reason: data.reason,
        previousBalance: Number(balance.onHandQuantity),
        newBalance: Number(newOnHand),
      },
      ipAddress,
    });

    return movement;
  });
}

export async function createTransfer(
  restaurantId: string,
  data: z.infer<typeof transferSchema>,
  userId: string,
  ipAddress?: string
) {
  if (data.fromLocationId === data.toLocationId) {
    throw new Error('Source and destination locations must be different');
  }

  const item = await prisma.inventoryItem.findFirst({
    where: { id: data.inventoryItemId, restaurantId },
  });
  if (!item) throw new Error('Inventory item not found');

  return prisma.$transaction(async (tx) => {
    // Decrement source balance
    const sourceBalance = await tx.inventoryBalance.upsert({
      where: {
        inventoryItemId_stockLocationId: {
          inventoryItemId: data.inventoryItemId,
          stockLocationId: data.fromLocationId,
        },
      },
      create: {
        restaurantId,
        inventoryItemId: data.inventoryItemId,
        stockLocationId: data.fromLocationId,
        onHandQuantity: 0,
        reservedQuantity: 0,
      },
      update: {},
    });

    if (Number(sourceBalance.onHandQuantity) < data.quantity) {
      throw new Error(`Insufficient stock at source location. Available: ${Number(sourceBalance.onHandQuantity)}, Requested: ${data.quantity}`);
    }

    const sourceNewOnHand = roundQuantity(Number(sourceBalance.onHandQuantity) - data.quantity);

    await tx.inventoryBalance.update({
      where: {
        inventoryItemId_stockLocationId: {
          inventoryItemId: data.inventoryItemId,
          stockLocationId: data.fromLocationId,
        },
      },
      data: { onHandQuantity: sourceNewOnHand },
    });

    // Increment destination balance
    const destBalance = await tx.inventoryBalance.upsert({
      where: {
        inventoryItemId_stockLocationId: {
          inventoryItemId: data.inventoryItemId,
          stockLocationId: data.toLocationId,
        },
      },
      create: {
        restaurantId,
        inventoryItemId: data.inventoryItemId,
        stockLocationId: data.toLocationId,
        onHandQuantity: data.quantity,
        reservedQuantity: 0,
      },
      update: {
        onHandQuantity: { increment: data.quantity },
      },
    });

    const destNewOnHand = Number(destBalance.onHandQuantity) + data.quantity;

    // Create out movement
    const outMovement = await tx.stockMovement.create({
      data: {
        restaurantId,
        inventoryItemId: data.inventoryItemId,
        stockLocationId: data.fromLocationId,
        movementType: 'TRANSFER_OUT',
        quantity: data.quantity,
        quantityBefore: Number(sourceBalance.onHandQuantity),
        quantityAfter: sourceNewOnHand,
        reservedBefore: Number(sourceBalance.reservedQuantity),
        reservedAfter: Number(sourceBalance.reservedQuantity),
        unitCost: Number(item.averageCost || 0),
        totalCost: Number(toDecimal(data.quantity).mul(Number(item.averageCost || 0))),
        actorUserId: userId,
        reason: `Transfer to ${data.toLocationId}: ${data.reason}`,
        referenceNumber: data.referenceNumber || null,
        metadata: { transferTo: data.toLocationId },
      },
    });

    // Create in movement
    await tx.stockMovement.create({
      data: {
        restaurantId,
        inventoryItemId: data.inventoryItemId,
        stockLocationId: data.toLocationId,
        movementType: 'TRANSFER_IN',
        quantity: data.quantity,
        quantityBefore: Number(destBalance.onHandQuantity),
        quantityAfter: destNewOnHand,
        reservedBefore: Number(destBalance.reservedQuantity),
        reservedAfter: Number(destBalance.reservedQuantity),
        unitCost: Number(item.averageCost || 0),
        totalCost: Number(toDecimal(data.quantity).mul(Number(item.averageCost || 0))),
        actorUserId: userId,
        reason: `Transfer from ${data.fromLocationId}: ${data.reason}`,
        referenceNumber: data.referenceNumber || null,
        metadata: { transferFrom: data.fromLocationId },
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'STOCK_TRANSFER',
      entityType: 'InventoryItem',
      entityId: data.inventoryItemId,
      description: `${data.quantity} ${item.baseUnit.toLowerCase()} of "${item.name}" transferred`,
      metadata: {
        fromLocation: data.fromLocationId,
        toLocation: data.toLocationId,
        quantity: data.quantity,
        reason: data.reason,
      },
      ipAddress,
    });

    return outMovement;
  });
}

export async function getMovements(
  restaurantId: string,
  filters: {
    inventoryItemId?: string;
    stockLocationId?: string;
    movementType?: string;
    actorUserId?: string;
    attributedWaiterId?: string;
    orderId?: string;
    receiptId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;

  if (filters.inventoryItemId) where.inventoryItemId = filters.inventoryItemId;
  if (filters.stockLocationId) where.stockLocationId = filters.stockLocationId;
  if (filters.movementType) where.movementType = filters.movementType;
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.attributedWaiterId) where.attributedWaiterId = filters.attributedWaiterId;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.receiptId) where.stockReceiptId = filters.receiptId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } },
        stockLocation: { select: { id: true, name: true } },
        actor: { select: { id: true, firstName: true, lastName: true } },
        attributedWaiter: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { movements, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getInventorySummary(restaurantId: string) {
  const [items, locations, lowStockItems, outOfStockItems, negativeStockItems] = await Promise.all([
    prisma.inventoryItem.count({ where: { restaurantId, isActive: true } }),
    prisma.stockLocation.count({ where: { restaurantId, isActive: true } }),
    prisma.inventoryBalance.count({
      where: {
        restaurantId,
        inventoryItem: { isActive: true },
        onHandQuantity: { lte: 0 },
      },
    }),
    prisma.inventoryItem.count({
      where: {
        restaurantId,
        isActive: true,
        inventoryBalances: {
          some: { onHandQuantity: { equals: 0 } },
        },
      },
    }),
    prisma.inventoryItem.count({
      where: {
        restaurantId,
        isActive: true,
        inventoryBalances: {
          some: { onHandQuantity: { lt: 0 } },
        },
      },
    }),
  ]);

  return {
    totalItems: items,
    totalLocations: locations,
    lowStockItems,
    outOfStockItems,
    negativeStockItems,
  };
}

export async function getWaiterUsage(
  restaurantId: string,
  filters: {
    waiterId?: string;
    dateFrom?: string;
    dateTo?: string;
    inventoryItemId?: string;
    orderId?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const where: any = { restaurantId, attributedWaiterId: { not: null } };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;

  if (filters.waiterId) where.attributedWaiterId = filters.waiterId;
  if (filters.inventoryItemId) where.inventoryItemId = filters.inventoryItemId;
  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const consumptionTypes = ['DIRECT_SALE_CONSUMPTION', 'RECIPE_CONSUMPTION'];

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { ...where, movementType: { in: consumptionTypes } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } },
        stockLocation: { select: { id: true, name: true } },
        actor: { select: { id: true, firstName: true, lastName: true } },
        attributedWaiter: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      },
    }),
    prisma.stockMovement.count({ where: { ...where, movementType: { in: consumptionTypes } } }),
  ]);

  // Group by waiter for summary
  const waiterSummary = await getWaiterSummary(restaurantId, filters);

  return { movements, total, page, pageSize, totalPages: Math.ceil(total / pageSize), waiterSummary };
}

async function getWaiterSummary(restaurantId: string, filters: { waiterId?: string; dateFrom?: string; dateTo?: string }) {
  const where: any = { restaurantId, attributedWaiterId: { not: null }, movementType: { in: ['DIRECT_SALE_CONSUMPTION', 'RECIPE_CONSUMPTION'] } };
  if (filters.waiterId) where.attributedWaiterId = filters.waiterId;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const movements = await prisma.stockMovement.groupBy({
    by: ['attributedWaiterId'],
    where,
    _count: { id: true },
    _sum: { quantity: true },
  });

  const waiters = await prisma.user.findMany({
    where: {
      restaurantId,
      id: { in: movements.map(m => m.attributedWaiterId!).filter(Boolean) },
    },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
  });

  return movements.map(m => {
    const waiter = waiters.find(w => w.id === m.attributedWaiterId);
    return {
      waiterId: m.attributedWaiterId,
      waiterName: waiter ? `${waiter.firstName} ${waiter.lastName}` : 'Unknown',
      employeeCode: waiter?.employeeCode,
      movementCount: m._count.id,
      totalQuantity: Number(m._sum.quantity || 0),
    };
  });
}

export async function getInventoryAlerts(restaurantId: string) {
  const items = await prisma.inventoryItem.findMany({
    where: { restaurantId, isActive: true },
    include: {
      inventoryBalances: {
        include: { stockLocation: { select: { id: true, name: true } } },
      },
    },
  });

  const alerts: Array<{ itemId: string; itemName: string; sku: string; location: string; alertType: string; message: string; onHand: number; reserved: number; reorderLevel: number }> = [];

  for (const item of items) {
    for (const balance of item.inventoryBalances) {
      const onHand = Number(balance.onHandQuantity);
      const reserved = Number(balance.reservedQuantity);
      const available = onHand - reserved;
      const reorderLevel = Number(item.reorderLevel);

      if (onHand < 0) {
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          location: balance.stockLocation.name,
          alertType: 'NEGATIVE_STOCK',
          message: `${item.name} has negative stock (${onHand} ${item.baseUnit.toLowerCase()})`,
          onHand, reserved, reorderLevel,
        });
      } else if (available <= 0) {
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          location: balance.stockLocation.name,
          alertType: 'OUT_OF_STOCK',
          message: `${item.name} is out of stock`,
          onHand, reserved, reorderLevel,
        });
      } else if (reorderLevel > 0 && available <= reorderLevel) {
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          sku: item.sku,
          location: balance.stockLocation.name,
          alertType: 'LOW_STOCK',
          message: `${item.name} is low on stock (${available} ${item.baseUnit.toLowerCase()} available, reorder at ${reorderLevel})`,
          onHand, reserved, reorderLevel,
        });
      }
    }
  }

  return alerts;
}
