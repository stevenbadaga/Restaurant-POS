import { z } from 'zod';
import { prisma } from '../database';
import { Prisma } from '@prisma/client';
import { createAuditLog } from './audit.service';
import { ensureDefaultLocation } from './inventory-location.service';
import { toDecimal, roundQuantity } from './calculation.service';
import type { Decimal } from '@prisma/client/runtime/library';

export const itemSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(50).transform(s => s.toUpperCase()),
  barcode: z.string().max(100).optional().transform(s => s || undefined),
  categoryId: z.string().uuid().optional(),
  description: z.string().optional(),
  baseUnit: z.enum(['PIECE', 'PORTION', 'BOTTLE', 'CAN', 'PACK', 'BOX', 'GRAM', 'KILOGRAM', 'MILLILITRE', 'LITRE', 'OTHER']),
  reorderLevel: z.number().min(0).default(0),
  targetStockLevel: z.number().min(0).optional(),
  trackExpiry: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const itemUpdateSchema = itemSchema.partial();

export async function getItems(
  restaurantId: string,
  filters: {
    search?: string;
    categoryId?: string;
    isActive?: boolean;
    lowStock?: boolean;
    outOfStock?: boolean;
    unit?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const where: Prisma.InventoryItemWhereInput = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
      { barcode: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.unit) where.baseUnit = filters.unit as any;

  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        inventoryBalances: {
          include: { stockLocation: { select: { id: true, name: true, isDefault: true } } },
        },
        _count: { select: { stockReceiptLines: true, stockMovements: true } },
      },
    }),
    prisma.inventoryItem.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getItemById(restaurantId: string, id: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id, restaurantId },
    include: {
      category: true,
      inventoryBalances: {
        include: { stockLocation: { select: { id: true, name: true, code: true, isDefault: true } } },
      },
      stockBatches: {
        where: { remainingQuantity: { gt: 0 } },
        orderBy: { expiryDate: 'asc' },
        include: { stockLocation: { select: { id: true, name: true } } },
      },
      recipeIngredients: { include: { recipe: { select: { id: true, name: true, menuItemId: true } } } },
      menuItemInventoryLinks: { where: { isActive: true } },
      _count: { select: { stockMovements: true } },
    },
  });

  if (!item) return null;

  return {
    ...item,
    totalOnHand: item.inventoryBalances.reduce((sum, b) => sum + Number(b.onHandQuantity), 0),
    totalReserved: item.inventoryBalances.reduce((sum, b) => sum + Number(b.reservedQuantity), 0),
    totalAvailable: item.inventoryBalances.reduce((sum, b) => sum + Number(b.onHandQuantity) - Number(b.reservedQuantity), 0),
  };
}

export async function createItem(restaurantId: string, data: z.infer<typeof itemSchema>, userId: string, ipAddress?: string) {
  const item = await prisma.inventoryItem.create({
    data: {
      restaurantId,
      name: data.name,
      sku: data.sku,
      barcode: data.barcode || null,
      categoryId: data.categoryId || null,
      description: data.description,
      baseUnit: data.baseUnit,
      reorderLevel: data.reorderLevel,
      targetStockLevel: data.targetStockLevel || null,
      trackExpiry: data.trackExpiry,
      isActive: data.isActive,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'INVENTORY_ITEM_CREATED',
    entityType: 'InventoryItem',
    entityId: item.id,
    description: `Inventory item "${item.name}" (${item.sku}) created`,
    ipAddress,
  });

  return item;
}

export async function updateItem(restaurantId: string, id: string, data: z.infer<typeof itemUpdateSchema>, userId: string, ipAddress?: string) {
  const existing = await prisma.inventoryItem.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      categoryId: data.categoryId,
      description: data.description,
      baseUnit: data.baseUnit,
      reorderLevel: data.reorderLevel,
      targetStockLevel: data.targetStockLevel,
      trackExpiry: data.trackExpiry,
      isActive: data.isActive,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'INVENTORY_ITEM_UPDATED',
    entityType: 'InventoryItem',
    entityId: item.id,
    description: `Inventory item "${item.name}" updated`,
    metadata: { previousName: existing.name },
    ipAddress,
  });

  return item;
}

export async function updateItemStatus(restaurantId: string, id: string, isActive: boolean, userId: string, ipAddress?: string) {
  const existing = await prisma.inventoryItem.findFirst({ where: { id, restaurantId } });
  if (!existing) return null;

  const item = await prisma.inventoryItem.update({
    where: { id },
    data: { isActive },
  });

  await createAuditLog({
    restaurantId, userId,
    action: isActive ? 'INVENTORY_ITEM_ACTIVATED' : 'INVENTORY_ITEM_DEACTIVATED',
    entityType: 'InventoryItem',
    entityId: item.id,
    description: `Inventory item "${item.name}" ${isActive ? 'activated' : 'deactivated'}`,
    ipAddress,
  });

  return item;
}

export async function createOpeningBalance(
  restaurantId: string,
  itemId: string,
  locationId: string | undefined,
  quantity: number,
  unitCost: number | undefined,
  reason: string,
  userId: string,
  ipAddress?: string
) {
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, restaurantId } });
  if (!item) return null;

  const location = locationId || (await ensureDefaultLocation(restaurantId)).id;

  return prisma.$transaction(async (tx) => {
    // Upsert inventory balance
    const balance = await tx.inventoryBalance.upsert({
      where: {
        inventoryItemId_stockLocationId: {
          inventoryItemId: itemId,
          stockLocationId: location,
        },
      },
      create: {
        restaurantId,
        inventoryItemId: itemId,
        stockLocationId: location,
        onHandQuantity: quantity,
        reservedQuantity: 0,
      },
      update: {
        onHandQuantity: { increment: quantity },
      },
    });

    // Create stock movement
    const movement = await tx.stockMovement.create({
      data: {
        restaurantId,
        inventoryItemId: itemId,
        stockLocationId: location,
        movementType: 'OPENING_BALANCE',
        quantity,
        quantityBefore: Number(balance.onHandQuantity) - quantity,
        quantityAfter: Number(balance.onHandQuantity),
        reservedBefore: 0,
        reservedAfter: 0,
        unitCost: unitCost || null,
        totalCost: unitCost ? Number(toDecimal(unitCost).mul(quantity)) : null,
        actorUserId: userId,
        reason,
        referenceNumber: `OB-${Date.now()}`,
      },
    });

    // Create stock batch
    await tx.stockBatch.create({
      data: {
        restaurantId,
        inventoryItemId: itemId,
        stockLocationId: location,
        receivedQuantity: quantity,
        remainingQuantity: quantity,
        unitCost: unitCost || 0,
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'OPENING_BALANCE_RECORDED',
      entityType: 'InventoryItem',
      entityId: itemId,
      description: `Opening balance of ${quantity} ${item.baseUnit.toLowerCase()} recorded for "${item.name}"`,
      metadata: { quantity, reason },
      ipAddress,
    });

    return { balance, movement };
  });
}

export async function getItemBalances(restaurantId: string, itemId: string) {
  return prisma.inventoryBalance.findMany({
    where: { inventoryItemId: itemId, restaurantId },
    include: { stockLocation: { select: { id: true, name: true, code: true } } },
  });
}

export async function getItemMovements(restaurantId: string, itemId: string, filters: { page?: number; pageSize?: number } = {}) {
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { inventoryItemId: itemId, restaurantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        stockLocation: { select: { id: true, name: true } },
        actor: { select: { id: true, firstName: true, lastName: true } },
        attributedWaiter: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.stockMovement.count({ where: { inventoryItemId: itemId, restaurantId } }),
  ]);

  return { movements, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
