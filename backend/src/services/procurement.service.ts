import { z } from 'zod';
import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';

// ==========================================
// SCHEMAS
// ==========================================

export const requisitionSchema = z.object({
  supplierId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    inventoryItemId: z.string().min(1),
    stockLocationId: z.string().optional(),
    quantityRequested: z.number().positive(),
    unitCost: z.number().min(0).optional(),
    notes: z.string().optional(),
  })).min(1),
});

export const purchaseOrderSchema = z.object({
  supplierId: z.string().optional(),
  requisitionId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  orderDate: z.string().optional(),
  expectedDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    inventoryItemId: z.string().min(1),
    stockLocationId: z.string().optional(),
    quantityOrdered: z.number().positive(),
    unitCost: z.number().min(0),
    notes: z.string().optional(),
  })).min(1),
});

export const invoiceSchema = z.object({
  supplierId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    inventoryItemId: z.string().min(1),
    purchaseOrderLineId: z.string().optional(),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
  })).min(1),
});

export const supplierReturnSchema = z.object({
  supplierId: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  returnDate: z.string().optional(),
  reason: z.string().min(1),
  notes: z.string().optional(),
  lines: z.array(z.object({
    inventoryItemId: z.string().min(1),
    quantity: z.number().positive(),
    unitCost: z.number().min(0),
    reason: z.string().optional(),
  })).min(1),
});

export const stockCountSchema = z.object({
  stockLocationId: z.string().optional(),
  countType: z.enum(['FULL', 'CYCLE', 'SPOT']).optional(),
  notes: z.string().optional(),
});

// ==========================================
// HELPERS
// ==========================================

async function generateRequisitionNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  return generateSequenceNumber(restaurantId, 'REQUISITION', 'REQ', restaurant?.timezone ?? 'UTC');
}

async function generatePONumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  return generateSequenceNumber(restaurantId, 'PURCHASE_ORDER', 'PO', restaurant?.timezone ?? 'UTC');
}

async function generateInvoiceNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  return generateSequenceNumber(restaurantId, 'SUPPLIER_INVOICE', 'INV', restaurant?.timezone ?? 'UTC');
}

async function generateReturnNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  return generateSequenceNumber(restaurantId, 'SUPPLIER_RETURN', 'RET', restaurant?.timezone ?? 'UTC');
}

async function generateCountNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { timezone: true } });
  return generateSequenceNumber(restaurantId, 'STOCK_COUNT', 'CT', restaurant?.timezone ?? 'UTC');
}

// ==========================================
// PURCHASE REQUISITIONS
// ==========================================

export async function getRequisitions(restaurantId: string, filters: { status?: string; page?: number; pageSize?: number } = {}) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.purchaseRequisition.findMany({
      where,
      include: {
        lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } } } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseRequisition.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getRequisitionById(restaurantId: string, id: string) {
  const item = await prisma.purchaseRequisition.findFirst({
    where: { id, restaurantId },
    include: {
      lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true, averageCost: true } } } },
      supplier: { select: { id: true, name: true, contactPerson: true, phone: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      convertedOrders: { select: { id: true, orderNumber: true, status: true } },
    },
  });
  if (!item) throw new NotFoundError('Requisition not found');
  return item;
}

export async function createRequisition(restaurantId: string, userId: string, data: z.infer<typeof requisitionSchema>, ipAddress?: string) {
  const requisitionNumber = await generateRequisitionNumber(restaurantId);
  let subtotal = 0;

  for (const line of data.lines) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: line.inventoryItemId, restaurantId } });
    if (!item) throw new NotFoundError(`Inventory item ${line.inventoryItemId} not found`);
    const cost = line.unitCost || Number(item.averageCost) || 0;
    subtotal += cost * line.quantityRequested;
  }

  const requisition = await prisma.purchaseRequisition.create({
    data: {
      restaurantId,
      requisitionNumber,
      supplierId: data.supplierId || null,
      priority: (data.priority as any) || 'NORMAL',
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      notes: data.notes,
      subtotal,
      totalAmount: subtotal,
      createdById: userId,
      submittedAt: new Date(),
      status: 'SUBMITTED',
      lines: {
        create: data.lines.map(line => ({
          inventoryItemId: line.inventoryItemId,
          stockLocationId: line.stockLocationId || null,
          quantityRequested: line.quantityRequested,
          quantityApproved: null,
          unitCost: line.unitCost || 0,
          lineTotal: (line.unitCost || 0) * line.quantityRequested,
          notes: line.notes,
        })),
      },
    },
    include: {
      lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } },
      supplier: { select: { id: true, name: true } },
    },
  });

  await createAuditLog({
    restaurantId, userId, action: 'REQUISITION_CREATED', entityType: 'PurchaseRequisition',
    entityId: requisition.id, description: `Requisition ${requisitionNumber} created`, ipAddress,
  });

  return requisition;
}

export async function approveRequisition(restaurantId: string, userId: string, id: string, lines?: Array<{ lineId: string; quantityApproved: number }>, ipAddress?: string) {
  const req = await prisma.purchaseRequisition.findFirst({ where: { id, restaurantId }, include: { lines: true } });
  if (!req) throw new NotFoundError('Requisition not found');
  if (req.status !== 'SUBMITTED') throw new BadRequestError('Requisition must be SUBMITTED to approve');

  let totalAmount = 0;

  await prisma.$transaction(async (tx) => {
    for (const line of req.lines) {
      const approved = lines?.find(l => l.lineId === line.id);
      const qty = Number(approved?.quantityApproved ?? line.quantityRequested);
      totalAmount += Number(line.unitCost) * qty;

      await tx.purchaseRequisitionLine.update({
        where: { id: line.id },
        data: { quantityApproved: qty },
      });
    }

    await tx.purchaseRequisition.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date(), totalAmount, rejectionReason: null },
    });
  });

  await createAuditLog({
    restaurantId, userId, action: 'REQUISITION_APPROVED', entityType: 'PurchaseRequisition',
    entityId: id, description: `Requisition ${req.requisitionNumber} approved`, ipAddress,
  });

  return getRequisitionById(restaurantId, id);
}

export async function rejectRequisition(restaurantId: string, userId: string, id: string, reason: string, ipAddress?: string) {
  const req = await prisma.purchaseRequisition.findFirst({ where: { id, restaurantId } });
  if (!req) throw new NotFoundError('Requisition not found');
  if (req.status !== 'SUBMITTED') throw new BadRequestError('Requisition must be SUBMITTED to reject');

  await prisma.purchaseRequisition.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  await createAuditLog({
    restaurantId, userId, action: 'REQUISITION_REJECTED', entityType: 'PurchaseRequisition',
    entityId: id, description: `Requisition ${req.requisitionNumber} rejected: ${reason}`, ipAddress,
  });

  return getRequisitionById(restaurantId, id);
}

export async function cancelRequisition(restaurantId: string, userId: string, id: string, reason: string, ipAddress?: string) {
  const req = await prisma.purchaseRequisition.findFirst({ where: { id, restaurantId } });
  if (!req) throw new NotFoundError('Requisition not found');
  if (['APPROVED', 'CONVERTED', 'CANCELLED'].includes(req.status)) throw new BadRequestError('Cannot cancel in current status');

  await prisma.purchaseRequisition.update({
    where: { id },
    data: { status: 'CANCELLED', rejectionReason: reason },
  });

  await createAuditLog({
    restaurantId, userId, action: 'REQUISITION_CANCELLED', entityType: 'PurchaseRequisition',
    entityId: id, description: `Requisition ${req.requisitionNumber} cancelled`, ipAddress,
  });

  return getRequisitionById(restaurantId, id);
}

// ==========================================
// PURCHASE ORDERS
// ==========================================

export async function getPurchaseOrders(restaurantId: string, filters: { status?: string; page?: number; pageSize?: number } = {}) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      include: {
        lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } } } },
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        approvals: { include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { lines: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getPurchaseOrderById(restaurantId: string, id: string) {
  const item = await prisma.purchaseOrder.findFirst({
    where: { id, restaurantId },
    include: {
      lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true, averageCost: true } }, stockLocation: { select: { id: true, name: true } } } },
      supplier: { select: { id: true, name: true, contactPerson: true, phone: true, email: true } },
      requisition: { select: { id: true, requisitionNumber: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      receivedBy: { select: { id: true, firstName: true, lastName: true } },
      approvals: { include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } },
      invoices: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
    },
  });
  if (!item) throw new NotFoundError('Purchase order not found');
  return item;
}

export async function createPurchaseOrder(restaurantId: string, userId: string, data: z.infer<typeof purchaseOrderSchema>, ipAddress?: string) {
  const orderNumber = await generatePONumber(restaurantId);

  if (data.requisitionId) {
    const req = await prisma.purchaseRequisition.findFirst({ where: { id: data.requisitionId, restaurantId } });
    if (!req) throw new NotFoundError('Requisition not found');
    if (req.status !== 'APPROVED') throw new BadRequestError('Requisition must be APPROVED to convert to PO');
  }

  for (const line of data.lines) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: line.inventoryItemId, restaurantId } });
    if (!item) throw new NotFoundError(`Inventory item ${line.inventoryItemId} not found`);
  }

  let subtotal = 0;
  for (const line of data.lines) {
    subtotal += line.unitCost * line.quantityOrdered;
  }

  const order = await prisma.purchaseOrder.create({
    data: {
      restaurantId,
      orderNumber,
      supplierId: data.supplierId || null,
      requisitionId: data.requisitionId || null,
      priority: (data.priority as any) || 'NORMAL',
      orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      notes: data.notes,
      subtotal,
      totalAmount: subtotal,
      createdById: userId,
      status: 'PENDING_APPROVAL',
      lines: {
        create: data.lines.map(line => ({
          inventoryItemId: line.inventoryItemId,
          stockLocationId: line.stockLocationId || null,
          quantityOrdered: line.quantityOrdered,
          unitCost: line.unitCost,
          lineTotal: line.unitCost * line.quantityOrdered,
          notes: line.notes,
        })),
      },
    },
    include: { lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } } },
  });

  // Mark requisition as converted if applicable
  if (data.requisitionId) {
    await prisma.purchaseRequisition.update({
      where: { id: data.requisitionId },
      data: { status: 'CONVERTED', convertedToPOId: order.id },
    });
  }

  await createAuditLog({
    restaurantId, userId, action: 'PURCHASE_ORDER_CREATED', entityType: 'PurchaseOrder',
    entityId: order.id, description: `Purchase order ${orderNumber} created`, ipAddress,
  });

  return order;
}

export async function approvePurchaseOrder(restaurantId: string, userId: string, id: string, ipAddress?: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, restaurantId } });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (po.status !== 'PENDING_APPROVAL') throw new BadRequestError('PO must be PENDING_APPROVAL to approve');

  await prisma.$transaction(async (tx) => {
    await tx.purchaseApproval.create({
      data: { restaurantId, purchaseOrderId: id, status: 'APPROVED', createdById: userId },
    });
    await tx.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() },
    });
  });

  await createAuditLog({
    restaurantId, userId, action: 'PURCHASE_ORDER_APPROVED', entityType: 'PurchaseOrder',
    entityId: id, description: `Purchase order ${po.orderNumber} approved`, ipAddress,
  });

  return getPurchaseOrderById(restaurantId, id);
}

export async function receivePurchaseOrder(restaurantId: string, userId: string, id: string, lines?: Array<{ lineId: string; quantityReceived: number }>, ipAddress?: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, restaurantId }, include: { lines: true } });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw new BadRequestError('PO must be APPROVED or PARTIALLY_RECEIVED to receive');

  let allFullyReceived = true;

  await prisma.$transaction(async (tx) => {
    for (const line of po.lines) {
      const received = lines?.find(l => l.lineId === line.id);
      const qty = received?.quantityReceived ?? 0;
      if (qty > 0) {
        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { quantityReceived: { increment: qty } },
        });
      }
      const updatedLine = await tx.purchaseOrderLine.findUnique({ where: { id: line.id } });
      if (updatedLine && Number(updatedLine.quantityReceived) < Number(updatedLine.quantityOrdered)) {
        allFullyReceived = false;
      }
    }

    await tx.purchaseOrder.update({
      where: { id },
      data: {
        status: allFullyReceived ? 'FULLY_RECEIVED' : 'PARTIALLY_RECEIVED',
        receivedById: userId,
        deliveredDate: new Date(),
      },
    });
  });

  await createAuditLog({
    restaurantId, userId, action: 'PURCHASE_ORDER_RECEIVED', entityType: 'PurchaseOrder',
    entityId: id, description: `PO ${po.orderNumber} ${allFullyReceived ? 'fully' : 'partially'} received`, ipAddress,
  });

  return getPurchaseOrderById(restaurantId, id);
}

export async function closePurchaseOrder(restaurantId: string, userId: string, id: string, ipAddress?: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, restaurantId } });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (!['APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status)) throw new BadRequestError('Invalid PO status for closing');

  await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CLOSED' } });

  await createAuditLog({
    restaurantId, userId, action: 'PURCHASE_ORDER_CLOSED', entityType: 'PurchaseOrder',
    entityId: id, description: `Purchase order ${po.orderNumber} closed`, ipAddress,
  });

  return getPurchaseOrderById(restaurantId, id);
}

export async function cancelPurchaseOrder(restaurantId: string, userId: string, id: string, reason: string, ipAddress?: string) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, restaurantId } });
  if (!po) throw new NotFoundError('Purchase order not found');
  if (['CLOSED', 'CANCELLED', 'FULLY_RECEIVED'].includes(po.status)) throw new BadRequestError('Cannot cancel in current status');

  await prisma.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', rejectionReason: reason } });

  await createAuditLog({
    restaurantId, userId, action: 'PURCHASE_ORDER_CANCELLED', entityType: 'PurchaseOrder',
    entityId: id, description: `Purchase order ${po.orderNumber} cancelled`, ipAddress,
  });

  return getPurchaseOrderById(restaurantId, id);
}

export async function getReorderSuggestions(restaurantId: string) {
  // Find items below reorder level
  const balances = await prisma.inventoryBalance.findMany({
    where: { restaurantId },
    include: {
      inventoryItem: { select: { id: true, name: true, sku: true, reorderLevel: true, targetStockLevel: true, averageCost: true, baseUnit: true } },
      stockLocation: { select: { id: true, name: true } },
    },
    orderBy: { inventoryItem: { name: 'asc' } },
  });

  const suggestions = balances
    .filter(b => {
      const available = Number(b.onHandQuantity) - Number(b.reservedQuantity);
      const rl = Number(b.inventoryItem.reorderLevel);
      return rl > 0 && available <= rl;
    })
    .map(b => {
      const available = Number(b.onHandQuantity) - Number(b.reservedQuantity);
      const reorderQty = Math.max(
        (Number(b.inventoryItem.targetStockLevel) || Number(b.inventoryItem.reorderLevel) * 2) - available,
        1
      );
      return {
        inventoryItemId: b.inventoryItemId,
        itemName: b.inventoryItem.name,
        sku: b.inventoryItem.sku,
        location: b.stockLocation.name,
        onHand: Number(b.onHandQuantity),
        reserved: Number(b.reservedQuantity),
        available,
        reorderLevel: Number(b.inventoryItem.reorderLevel),
        targetStockLevel: Number(b.inventoryItem.targetStockLevel),
        suggestedOrderQty: reorderQty,
        estimatedCost: reorderQty * Number(b.inventoryItem.averageCost || 0),
        averageCost: Number(b.inventoryItem.averageCost || 0),
        unit: b.inventoryItem.baseUnit,
      };
    })
    .sort((a, b) => {
      // Sort by urgency: negative stock first, then by ratio of available/reorderLevel
      const aRatio = a.reorderLevel > 0 ? a.available / a.reorderLevel : 0;
      const bRatio = b.reorderLevel > 0 ? b.available / b.reorderLevel : 0;
      return aRatio - bRatio;
    });

  return suggestions;
}

// ==========================================
// SUPPLIER INVOICES
// ==========================================

export async function getInvoices(restaurantId: string, filters: { status?: string; page?: number; pageSize?: number } = {}) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        purchaseOrder: { select: { id: true, orderNumber: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplierInvoice.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getInvoiceById(restaurantId: string, id: string) {
  const item = await prisma.supplierInvoice.findFirst({
    where: { id, restaurantId },
    include: {
      lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } }, purchaseOrderLine: { select: { id: true } } } },
      supplier: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!item) throw new NotFoundError('Invoice not found');
  return item;
}

export async function createInvoice(restaurantId: string, userId: string, data: z.infer<typeof invoiceSchema>, ipAddress?: string) {
  const invoiceNumber = await generateInvoiceNumber(restaurantId);
  let subtotal = 0;

  for (const line of data.lines) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: line.inventoryItemId, restaurantId } });
    if (!item) throw new NotFoundError(`Inventory item ${line.inventoryItemId} not found`);
    subtotal += line.unitCost * line.quantity;
  }

  const invoice = await prisma.supplierInvoice.create({
    data: {
      restaurantId,
      invoiceNumber,
      supplierId: data.supplierId || null,
      purchaseOrderId: data.purchaseOrderId || null,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      referenceNumber: data.referenceNumber || null,
      notes: data.notes,
      subtotal,
      totalAmount: subtotal,
      createdById: userId,
      status: 'VERIFIED',
      lines: {
        create: data.lines.map(line => ({
          inventoryItemId: line.inventoryItemId,
          purchaseOrderLineId: line.purchaseOrderLineId || null,
          quantity: line.quantity,
          unitCost: line.unitCost,
          lineTotal: line.unitCost * line.quantity,
          matchStatus: 'MATCHED',
        })),
      },
    },
    include: { lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } } },
  });

  await createAuditLog({
    restaurantId, userId, action: 'SUPPLIER_INVOICE_CREATED', entityType: 'SupplierInvoice',
    entityId: invoice.id, description: `Invoice ${invoiceNumber} created`, ipAddress,
  });

  return invoice;
}

export async function payInvoice(restaurantId: string, userId: string, id: string, paidDate?: string, ipAddress?: string) {
  const inv = await prisma.supplierInvoice.findFirst({ where: { id, restaurantId } });
  if (!inv) throw new NotFoundError('Invoice not found');
  if (!['VERIFIED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(inv.status)) throw new BadRequestError('Invoice must be verified to pay');

  await prisma.supplierInvoice.update({
    where: { id },
    data: { status: 'MATCHED', amountPaid: inv.totalAmount, paidById: userId, paidDate: paidDate ? new Date(paidDate) : new Date() },
  });

  await createAuditLog({
    restaurantId, userId, action: 'SUPPLIER_INVOICE_PAID', entityType: 'SupplierInvoice',
    entityId: id, description: `Invoice ${inv.invoiceNumber} marked as paid`, ipAddress,
  });

  return getInvoiceById(restaurantId, id);
}

export async function cancelInvoice(restaurantId: string, userId: string, id: string, reason: string, ipAddress?: string) {
  const inv = await prisma.supplierInvoice.findFirst({ where: { id, restaurantId } });
  if (!inv) throw new NotFoundError('Invoice not found');
  if (['CANCELLED', 'DISPUTED'].includes(inv.status)) throw new BadRequestError('Invoice already cancelled or disputed');

  await prisma.supplierInvoice.update({
    where: { id },
    data: { status: 'CANCELLED', notes: inv.notes ? `${inv.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}` },
  });

  await createAuditLog({
    restaurantId, userId, action: 'SUPPLIER_INVOICE_CANCELLED', entityType: 'SupplierInvoice',
    entityId: id, description: `Invoice ${inv.invoiceNumber} cancelled: ${reason}`, ipAddress,
  });

  return getInvoiceById(restaurantId, id);
}

// ==========================================
// SUPPLIER RETURNS
// ==========================================

export async function getSupplierReturns(restaurantId: string, filters: { status?: string; page?: number; pageSize?: number } = {}) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.supplierReturn.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.supplierReturn.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getSupplierReturnById(restaurantId: string, id: string) {
  const item = await prisma.supplierReturn.findFirst({
    where: { id, restaurantId },
    include: {
      lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } } } },
      supplier: { select: { id: true, name: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!item) throw new NotFoundError('Return not found');
  return item;
}

export async function createSupplierReturn(restaurantId: string, userId: string, data: z.infer<typeof supplierReturnSchema>, ipAddress?: string) {
  const returnNumber = await generateReturnNumber(restaurantId);

  for (const line of data.lines) {
    const item = await prisma.inventoryItem.findFirst({ where: { id: line.inventoryItemId, restaurantId } });
    if (!item) throw new NotFoundError(`Inventory item ${line.inventoryItemId} not found`);
  }

  const result = await prisma.supplierReturn.create({
    data: {
      restaurantId,
      returnNumber,
      supplierId: data.supplierId || null,
      purchaseOrderId: data.purchaseOrderId || null,
      returnDate: data.returnDate ? new Date(data.returnDate) : new Date(),
      reason: data.reason,
      notes: data.notes,
      createdById: userId,
      status: 'APPROVED',
      lines: {
        create: data.lines.map(line => ({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          lineTotal: line.unitCost * line.quantity,
          reason: line.reason,
        })),
      },
    },
    include: { lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } } },
  });

  await createAuditLog({
    restaurantId, userId, action: 'SUPPLIER_RETURN_CREATED', entityType: 'SupplierReturn',
    entityId: result.id, description: `Return ${returnNumber} created: ${data.reason}`, ipAddress,
  });

  return result;
}

// ==========================================
// STOCK COUNTS
// ==========================================

export async function getStockCounts(restaurantId: string, filters: { status?: string; page?: number; pageSize?: number } = {}) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  if (filters.status) where.status = filters.status;

  const [data, total] = await Promise.all([
    prisma.stockCount.findMany({
      where,
      include: {
        stockLocation: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockCount.count({ where }),
  ]);

  return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export async function getStockCountById(restaurantId: string, id: string) {
  const item = await prisma.stockCount.findFirst({
    where: { id, restaurantId },
    include: {
      lines: {
        include: {
          inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true, averageCost: true } },
          stockLocation: { select: { id: true, name: true } },
          countedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      stockLocation: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!item) throw new NotFoundError('Stock count not found');
  return item;
}

export async function createStockCount(restaurantId: string, userId: string, data: z.infer<typeof stockCountSchema>, ipAddress?: string) {
  const countNumber = await generateCountNumber(restaurantId);

  // Get all items with balances for the location (or all locations)
  const balances = await prisma.inventoryBalance.findMany({
    where: {
      restaurantId,
      ...(data.stockLocationId ? { stockLocationId: data.stockLocationId } : {}),
    },
    include: {
      inventoryItem: { select: { id: true, name: true, averageCost: true } },
      stockLocation: { select: { id: true, name: true } },
    },
    orderBy: { inventoryItem: { name: 'asc' } },
  });

  if (balances.length === 0) throw new BadRequestError('No inventory balances found to count');

  const count = await prisma.stockCount.create({
    data: {
      restaurantId,
      countNumber,
      countType: (data.countType as any) || 'FULL',
      stockLocationId: data.stockLocationId || null,
      notes: data.notes,
      createdById: userId,
      status: 'DRAFT',
      lines: {
        create: balances.map(b => ({
          inventoryItemId: b.inventoryItemId,
          stockLocationId: b.stockLocationId,
          expectedQty: Number(b.onHandQuantity),
          countedQty: null,
          variance: 0,
          unitCost: Number(b.inventoryItem.averageCost || 0),
          varianceValue: 0,
          status: 'NOT_COUNTED',
        })),
      },
    },
    include: { lines: { include: { inventoryItem: { select: { id: true, name: true, sku: true } } } } },
  });

  await createAuditLog({
    restaurantId, userId, action: 'STOCK_COUNT_CREATED', entityType: 'StockCount',
    entityId: count.id, description: `Stock count ${countNumber} created with ${balances.length} items`, ipAddress,
  });

  return count;
}

export async function recordStockCountLine(restaurantId: string, countId: string, lineId: string, userId: string, countedQty: number, notes?: string, ipAddress?: string) {
  const count = await prisma.stockCount.findFirst({ where: { id: countId, restaurantId } });
  if (!count) throw new NotFoundError('Stock count not found');
  if (!['DRAFT', 'IN_PROGRESS'].includes(count.status)) throw new BadRequestError('Stock count is not in progress');

  const line = await prisma.stockCountLine.findFirst({ where: { id: lineId, stockCountId: countId } });
  if (!line) throw new NotFoundError('Count line not found');

  const variance = countedQty - Number(line.expectedQty);
  const varianceValue = variance * Number(line.unitCost);

  await prisma.stockCountLine.update({
    where: { id: lineId },
    data: {
      countedQty,
      variance,
      varianceValue,
      status: 'COUNTED',
      countedById: userId,
      firstCountedAt: line.firstCountedAt || new Date(),
      lastCountedAt: new Date(),
      notes: notes || undefined,
    },
  });

  // Update count status to IN_PROGRESS
  if (count.status === 'DRAFT') {
    await prisma.stockCount.update({ where: { id: countId }, data: { status: 'IN_PROGRESS' } });
  }

  return getStockCountById(restaurantId, countId);
}

export async function submitStockCount(restaurantId: string, userId: string, countId: string, ipAddress?: string) {
  const count = await prisma.stockCount.findFirst({ where: { id: countId, restaurantId } });
  if (!count) throw new NotFoundError('Stock count not found');
  if (!['DRAFT', 'IN_PROGRESS'].includes(count.status)) throw new BadRequestError('Stock count is not in progress');

  const uncounted = await prisma.stockCountLine.count({
    where: { stockCountId: countId, status: 'NOT_COUNTED' },
  });

  if (uncounted > 0) throw new BadRequestError(`${uncounted} items have not been counted yet`);

  await prisma.stockCount.update({ where: { id: countId }, data: { status: 'PENDING_APPROVAL', submittedAt: new Date() } });

  return getStockCountById(restaurantId, countId);
}

export async function approveStockCount(restaurantId: string, userId: string, countId: string, ipAddress?: string) {
  const count = await prisma.stockCount.findFirst({ where: { id: countId, restaurantId } });
  if (!count) throw new NotFoundError('Stock count not found');
  if (count.status !== 'PENDING_APPROVAL') throw new BadRequestError('Stock count must be submitted for approval');

  // Post adjustments for variance
  await prisma.$transaction(async (tx) => {
    const lines = await tx.stockCountLine.findMany({ where: { stockCountId: countId } });

    for (const line of lines) {
      if (Number(line.variance) !== 0) {
        // Create stock movement for the adjustment
        const movementType = Number(line.variance) > 0 ? 'MANUAL_ADJUSTMENT_IN' : 'MANUAL_ADJUSTMENT_OUT';
        const absQty = Math.abs(Number(line.variance));

        await tx.stockMovement.create({
          data: {
            restaurantId,
            inventoryItemId: line.inventoryItemId,
            stockLocationId: line.stockLocationId || 'unknown',
            movementType: movementType as any,
            quantity: absQty,
            quantityBefore: Number(line.expectedQty),
            quantityAfter: Number(line.countedQty),
            reservedBefore: 0,
            reservedAfter: 0,
            referenceNumber: count.countNumber,
            reason: `Stock count adjustment: ${count.countNumber}`,
            actorUserId: userId,
          },
        });

        // Update inventory balance
        await tx.inventoryBalance.updateMany({
          where: { inventoryItemId: line.inventoryItemId, ...(line.stockLocationId ? { stockLocationId: line.stockLocationId } : {}) },
          data: { onHandQuantity: Number(line.countedQty) },
        });
      }

      await tx.stockCountLine.update({
        where: { id: line.id },
        data: { status: 'POSTED' },
      });
    }

    await tx.stockCount.update({
      where: { id: countId },
      data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date(), postedAt: new Date() },
    });
  });

  await createAuditLog({
    restaurantId, userId, action: 'STOCK_COUNT_APPROVED', entityType: 'StockCount',
    entityId: countId, description: `Stock count ${count.countNumber} approved and posted`, ipAddress,
  });

  return getStockCountById(restaurantId, countId);
}

export async function rejectStockCount(restaurantId: string, userId: string, countId: string, reason: string, ipAddress?: string) {
  const count = await prisma.stockCount.findFirst({ where: { id: countId, restaurantId } });
  if (!count) throw new NotFoundError('Stock count not found');
  if (count.status !== 'PENDING_APPROVAL') throw new BadRequestError('Stock count is not pending approval');

  await prisma.stockCount.update({
    where: { id: countId },
    data: { status: 'REJECTED', rejectionReason: reason },
  });

  await createAuditLog({
    restaurantId, userId, action: 'STOCK_COUNT_REJECTED', entityType: 'StockCount',
    entityId: countId, description: `Stock count ${count.countNumber} rejected: ${reason}`, ipAddress,
  });

  return getStockCountById(restaurantId, countId);
}

// ==========================================
// PURCHASING HISTORY
// ==========================================

export async function getPurchaseHistory(restaurantId: string, filters: { inventoryItemId?: string; supplierId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {}) {
  const where: any = { restaurantId };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;

  if (filters.inventoryItemId) where.inventoryItemId = filters.inventoryItemId;
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.dateFrom) where.receiptDate = { ...where.receiptDate, gte: new Date(filters.dateFrom) };
  if (filters.dateTo) where.receiptDate = { ...where.receiptDate, lte: new Date(filters.dateTo + 'T23:59:59.999Z') };

  const [receipts, total] = await Promise.all([
    prisma.stockReceipt.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
        lines: {
          include: { inventoryItem: { select: { id: true, name: true, sku: true, baseUnit: true } } },
          ...(filters.inventoryItemId ? { where: { inventoryItemId: filters.inventoryItemId } } : {}),
        },
      },
      orderBy: { receiptDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockReceipt.count({ where }),
  ]);

  return { data: receipts, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}
