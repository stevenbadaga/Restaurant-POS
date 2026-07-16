import { z } from 'zod';
import { prisma } from '../database';
import { Prisma } from '@prisma/client';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { calculateLineCost, calculateNewAverageCost, toDecimal } from './calculation.service';

export const receiptSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  stockLocationId: z.string().uuid(),
  supplierReference: z.string().optional().nullable(),
  receiptDate: z.string().transform(s => new Date(s)),
  notes: z.string().optional().nullable(),
});

export const receiptLineSchema = z.object({
  inventoryItemId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  batchNumber: z.string().optional().nullable(),
  manufactureDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function getReceipts(
  restaurantId: string,
  filters: {
    status?: string;
    supplierId?: string;
    locationId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const where: Prisma.StockReceiptWhereInput = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;

  if (filters.status) where.status = filters.status as any;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.locationId) where.stockLocationId = filters.locationId;
  if (filters.dateFrom || filters.dateTo) {
    where.receiptDate = {};
    if (filters.dateFrom) where.receiptDate.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.receiptDate.lte = new Date(filters.dateTo);
  }

  const [receipts, total] = await Promise.all([
    prisma.stockReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        supplier: { select: { id: true, name: true } },
        stockLocation: { select: { id: true, name: true } },
        lines: { select: { id: true, quantity: true, unitCost: true, lineCost: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.stockReceipt.count({ where }),
  ]);

  return { receipts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getReceiptById(restaurantId: string, id: string) {
  return prisma.stockReceipt.findFirst({
    where: { id, restaurantId },
    include: {
      supplier: { select: { id: true, name: true, supplierCode: true } },
      stockLocation: { select: { id: true, name: true, code: true } },
      lines: {
        include: {
          inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } },
        },
      },
    },
  });
}

export async function createReceipt(restaurantId: string, data: z.infer<typeof receiptSchema>, userId: string, timezone: string = 'UTC') {
  const receiptNumber = await generateSequenceNumber(restaurantId, 'STOCK_RECEIPT', 'STK', timezone);

  const receipt = await prisma.stockReceipt.create({
    data: {
      restaurantId,
      receiptNumber,
      supplierId: data.supplierId || null,
      stockLocationId: data.stockLocationId,
      supplierReference: data.supplierReference || null,
      receiptDate: data.receiptDate,
      notes: data.notes || null,
      createdById: userId,
      subtotalCost: 0,
      totalCost: 0,
    },
    include: {
      supplier: { select: { id: true, name: true } },
      stockLocation: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'STOCK_RECEIPT_CREATED',
    entityType: 'StockReceipt',
    entityId: receipt.id,
    description: `Stock receipt ${receipt.receiptNumber} created`,
    ipAddress: undefined,
  });

  return receipt;
}

export async function addReceiptLine(receiptId: string, restaurantId: string, data: z.infer<typeof receiptLineSchema>, _userId: string) {
  const receipt = await prisma.stockReceipt.findFirst({
    where: { id: receiptId, restaurantId, status: 'DRAFT' },
  });
  if (!receipt) return null;

  const lineCost = calculateLineCost(data.quantity, data.unitCost);

  return prisma.stockReceiptLine.create({
    data: {
      stockReceiptId: receiptId,
      inventoryItemId: data.inventoryItemId,
      quantity: data.quantity,
      unitCost: data.unitCost,
      lineCost: Number(lineCost),
      batchNumber: data.batchNumber || null,
      manufactureDate: data.manufactureDate ? new Date(data.manufactureDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      notes: data.notes || null,
    },
    include: {
      inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } },
    },
  });
}

export async function updateReceiptLine(receiptId: string, lineId: string, restaurantId: string, data: Partial<z.infer<typeof receiptLineSchema>>) {
  const receipt = await prisma.stockReceipt.findFirst({
    where: { id: receiptId, restaurantId, status: 'DRAFT' },
  });
  if (!receipt) return null;

  const existing = await prisma.stockReceiptLine.findFirst({
    where: { id: lineId, stockReceiptId: receiptId },
  });
  if (!existing) return null;

  const quantity = data.quantity ?? Number(existing.quantity);
  const unitCost = data.unitCost ?? Number(existing.unitCost);
  const lineCost = calculateLineCost(quantity, unitCost);

  return prisma.stockReceiptLine.update({
    where: { id: lineId },
    data: {
      quantity: data.quantity,
      unitCost: data.unitCost,
      lineCost: Number(lineCost),
      batchNumber: data.batchNumber,
      notes: data.notes,
    },
  });
}

export async function removeReceiptLine(receiptId: string, lineId: string, restaurantId: string) {
  const receipt = await prisma.stockReceipt.findFirst({
    where: { id: receiptId, restaurantId, status: 'DRAFT' },
  });
  if (!receipt) return false;

  await prisma.stockReceiptLine.delete({
    where: { id: lineId },
  });
  return true;
}

export async function postReceipt(receiptId: string, restaurantId: string, userId: string, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const receipt = await tx.stockReceipt.findFirst({
      where: { id: receiptId, restaurantId, status: 'DRAFT' },
      include: {
        lines: {
          include: {
            inventoryItem: true,
          },
        },
        stockLocation: true,
      },
    });

    if (!receipt) return null;
    if (receipt.lines.length === 0) throw new Error('Cannot post a receipt with no lines');

    // Calculate totals
    let subtotalCost = toDecimal(0);
    for (const line of receipt.lines) {
      subtotalCost = subtotalCost.plus(Number(line.lineCost));
    }

    // Update receipt
    const updated = await tx.stockReceipt.update({
      where: { id: receiptId },
      data: {
        status: 'POSTED',
        subtotalCost: Number(subtotalCost),
        totalCost: Number(subtotalCost),
        postedById: userId,
        postedAt: new Date(),
      },
    });

    // Process each line
    for (const line of receipt.lines) {
      // Upsert inventory balance
      const balance = await tx.inventoryBalance.upsert({
        where: {
          inventoryItemId_stockLocationId: {
            inventoryItemId: line.inventoryItemId,
            stockLocationId: receipt.stockLocationId,
          },
        },
        create: {
          restaurantId,
          inventoryItemId: line.inventoryItemId,
          stockLocationId: receipt.stockLocationId,
          onHandQuantity: Number(line.quantity),
          reservedQuantity: 0,
        },
        update: {
          onHandQuantity: { increment: Number(line.quantity) },
        },
      });

      const quantityBefore = Number(balance.onHandQuantity) - Number(line.quantity);

      // Create stock movement
      await tx.stockMovement.create({
        data: {
          restaurantId,
          inventoryItemId: line.inventoryItemId,
          stockLocationId: receipt.stockLocationId,
          movementType: 'STOCK_RECEIPT',
          quantity: Number(line.quantity),
          quantityBefore,
          quantityAfter: Number(balance.onHandQuantity),
          reservedBefore: Number(balance.reservedQuantity),
          reservedAfter: Number(balance.reservedQuantity),
          unitCost: Number(line.unitCost),
          totalCost: Number(line.lineCost),
          stockReceiptId: receipt.id,
          stockReceiptLineId: line.id,
          actorUserId: userId,
          reason: `Stock receipt ${receipt.receiptNumber}`,
        },
      });

      // Create stock batch
      await tx.stockBatch.create({
        data: {
          restaurantId,
          inventoryItemId: line.inventoryItemId,
          stockLocationId: receipt.stockLocationId,
          stockReceiptLineId: line.id,
          batchNumber: line.batchNumber || null,
          expiryDate: line.expiryDate || null,
          receivedQuantity: Number(line.quantity),
          remainingQuantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
        },
      });

      // Update average cost
      const prevAvgCost = line.inventoryItem.averageCost || 0;
      const prevOnHand = quantityBefore;
      const newAvgCost = calculateNewAverageCost(
        prevOnHand,
        Number(prevAvgCost),
        Number(line.quantity),
        Number(line.unitCost)
      );

      await tx.inventoryItem.update({
        where: { id: line.inventoryItemId },
        data: {
          averageCost: Number(newAvgCost),
          lastPurchaseCost: Number(line.unitCost),
        },
      });
    }

    await createAuditLog({
      restaurantId, userId,
      action: 'STOCK_RECEIPT_POSTED',
      entityType: 'StockReceipt',
      entityId: receipt.id,
      description: `Stock receipt ${receipt.receiptNumber} posted with ${receipt.lines.length} lines`,
      metadata: { totalCost: Number(subtotalCost) },
      ipAddress,
    });

    return updated;
  });
}

export async function cancelReceipt(receiptId: string, restaurantId: string, userId: string, reason: string, ipAddress?: string) {
  const receipt = await prisma.stockReceipt.findFirst({
    where: { id: receiptId, restaurantId, status: 'DRAFT' },
  });
  if (!receipt) return null;

  const cancelled = await prisma.stockReceipt.update({
    where: { id: receiptId },
    data: {
      status: 'CANCELLED',
      cancelledById: userId,
      cancelledAt: new Date(),
      cancellationReason: reason,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'STOCK_RECEIPT_CANCELLED',
    entityType: 'StockReceipt',
    entityId: receipt.id,
    description: `Stock receipt ${receipt.receiptNumber} cancelled`,
    metadata: { reason },
    ipAddress,
  });

  return cancelled;
}
