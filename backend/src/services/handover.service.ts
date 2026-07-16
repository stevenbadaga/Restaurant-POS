import { prisma } from '../database';
import { BadRequestError, NotFoundError } from '../types';
import { createAuditLog } from './audit.service';
import { toDecimal } from './calculation.service';

// ==========================================
// HANDOVER MANAGEMENT
// ==========================================

interface CreateHandoverInput {
  workShiftId: string;
  toUserId?: string;
  assignedRoleName?: string;
  title: string;
  notes: string;
  unresolvedOrders?: any;
  stockConcerns?: any;
  cashConcerns?: any;
  maintenanceConcerns?: any;
}

export async function createHandover(
  restaurantId: string,
  fromUserId: string,
  input: CreateHandoverInput,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  // Verify shift exists
  const shift = await prisma.workShift.findFirst({
    where: { id: input.workShiftId, restaurantId },
  });
  if (!shift) throw new NotFoundError('Shift not found');

  // Verify user is assigned to this shift or has manager/admin role
  const userRole = await prisma.userRole.findFirst({
    where: {
      userId: fromUserId,
      role: { name: { in: ['ADMIN', 'MANAGER'] } },
    },
  });
  const isAssigned = await prisma.shiftAssignment.findFirst({
    where: { workShiftId: input.workShiftId, userId: fromUserId },
  });
  if (!isAssigned && !userRole) {
    throw new BadRequestError('You must be assigned to this shift or be a manager to create a handover');
  }

  const handover = await prisma.shiftHandover.create({
    data: {
      restaurantId,
      workShiftId: input.workShiftId,
      fromUserId,
      toUserId: input.toUserId || null,
      assignedRoleName: input.assignedRoleName || null,
      status: 'DRAFT',
      title: input.title,
      notes: input.notes,
      unresolvedOrders: input.unresolvedOrders || undefined,
      stockConcerns: input.stockConcerns || undefined,
      cashConcerns: input.cashConcerns || undefined,
      maintenanceConcerns: input.maintenanceConcerns || undefined,
    },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true } },
      toUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return handover;
}

export async function updateHandover(
  handoverId: string,
  restaurantId: string,
  userId: string,
  input: Partial<CreateHandoverInput>,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const handover = await prisma.shiftHandover.findFirst({
    where: { id: handoverId, restaurantId },
  });
  if (!handover) throw new NotFoundError('Handover not found');
  if (handover.status !== 'DRAFT') throw new BadRequestError('Only draft handovers can be edited');
  if (handover.fromUserId !== userId && handover.toUserId !== userId) {
    throw new BadRequestError('You can only edit your own handovers');
  }

  const updateData: any = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.toUserId !== undefined) updateData.toUserId = input.toUserId;
  if (input.assignedRoleName !== undefined) updateData.assignedRoleName = input.assignedRoleName;
  if (input.unresolvedOrders !== undefined) updateData.unresolvedOrders = input.unresolvedOrders;
  if (input.stockConcerns !== undefined) updateData.stockConcerns = input.stockConcerns;
  if (input.cashConcerns !== undefined) updateData.cashConcerns = input.cashConcerns;
  if (input.maintenanceConcerns !== undefined) updateData.maintenanceConcerns = input.maintenanceConcerns;

  const updated = await prisma.shiftHandover.update({
    where: { id: handoverId },
    data: updateData,
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true } },
      toUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return updated;
}

export async function submitHandover(
  handoverId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const handover = await prisma.shiftHandover.findFirst({
    where: { id: handoverId, restaurantId },
    include: { workShift: { select: { nameSnapshot: true, codeSnapshot: true } } },
  });
  if (!handover) throw new NotFoundError('Handover not found');
  if (handover.status !== 'DRAFT') throw new BadRequestError('Handover is already submitted');
  if (handover.fromUserId !== userId) throw new BadRequestError('Only the author can submit this handover');

  const updated = await prisma.shiftHandover.update({
    where: { id: handoverId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true } },
      toUser: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'HANDOVER_SUBMITTED',
    entityType: 'ShiftHandover',
    entityId: handoverId,
    description: `Handover "${handover.title}" submitted for ${handover.workShift.nameSnapshot}`,
    metadata: { shiftName: handover.workShift.nameSnapshot },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function acknowledgeHandover(
  handoverId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const handover = await prisma.shiftHandover.findFirst({
    where: { id: handoverId, restaurantId },
    include: { workShift: { select: { nameSnapshot: true, codeSnapshot: true } } },
  });
  if (!handover) throw new NotFoundError('Handover not found');
  if (handover.status !== 'SUBMITTED') throw new BadRequestError('Only submitted handovers can be acknowledged');

  const updated = await prisma.shiftHandover.update({
    where: { id: handoverId },
    data: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date(),
      acknowledgedById: userId,
    },
    include: {
      fromUser: { select: { id: true, firstName: true, lastName: true } },
      toUser: { select: { id: true, firstName: true, lastName: true } },
      acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'HANDOVER_ACKNOWLEDGED',
    entityType: 'ShiftHandover',
    entityId: handoverId,
    description: `Handover "${handover.title}" acknowledged`,
    metadata: { shiftName: handover.workShift.nameSnapshot },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// SUGGEST HANDOVER CONTENT
// ==========================================

export async function getSuggestedHandoverContent(
  shiftId: string,
  restaurantId: string,
  assignedRoleName?: string
): Promise<any> {
  const shift = await prisma.workShift.findFirst({
    where: { id: shiftId, restaurantId },
  });
  if (!shift) throw new NotFoundError('Shift not found');

  const suggestions: any = {};

  // Get unpaid or partially paid orders
  const activeOrders = await prisma.order.findMany({
    where: {
      restaurantId,
      paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      status: { notIn: ['DRAFT', 'CANCELLED', 'CLOSED'] },
    },
    select: {
      orderNumber: true,
      paymentStatus: true,
      amountDue: true,
      table: { select: { name: true } },
      waiter: { select: { firstName: true, lastName: true } },
    },
  });

  if (activeOrders.length > 0) {
    suggestions.unresolvedOrders = activeOrders.map((o) => ({
      orderNumber: o.orderNumber,
      table: o.table?.name,
      waiter: o.waiter ? `${o.waiter.firstName} ${o.waiter.lastName}` : null,
      paymentStatus: o.paymentStatus,
      amountDue: o.amountDue,
    }));
  }
  // Get low stock balances (available quantity <= item reorder level)
  try {
    const lowStockBalances = await prisma.inventoryBalance.findMany({
      where: {
        restaurantId,
        inventoryItem: { isActive: true },
      },
      select: {
        onHandQuantity: true,
        reservedQuantity: true,
        inventoryItem: {
          select: {
            name: true,
            sku: true,
            baseUnit: true,
            reorderLevel: true,
          },
        },
      },
      take: 20,
    });

    const lowStockItems = lowStockBalances
      .filter((balance) =>
        toDecimal(balance.onHandQuantity)
          .minus(balance.reservedQuantity)
          .lessThanOrEqualTo(balance.inventoryItem.reorderLevel)
      )
      .map((balance) => ({
        name: balance.inventoryItem.name,
        sku: balance.inventoryItem.sku,
        stockLevel: toDecimal(balance.onHandQuantity).minus(balance.reservedQuantity).toString(),
        unit: balance.inventoryItem.baseUnit,
      }));

    if (lowStockItems.length > 0) {
      suggestions.stockConcerns = lowStockItems;
    }
  } catch {
    // Inventory balance data is optional for handover suggestions.
  }

  if (assignedRoleName === 'CASHIER' || !assignedRoleName) {
    // Get open cashier sessions
    const openSessions = await prisma.cashierSession.findMany({
      where: {
        restaurantId,
        workShiftId: shiftId,
        status: { in: ['OPEN', 'CLOSING'] },
      },
      select: {
        sessionNumber: true,
        cashier: { select: { firstName: true, lastName: true } },
        cashRegister: { select: { name: true } },
        expectedCash: true,
      },
    });

    if (openSessions.length > 0) {
      suggestions.cashConcerns = openSessions.map((s) => ({
        sessionNumber: s.sessionNumber,
        cashier: `${s.cashier.firstName} ${s.cashier.lastName}`,
        register: s.cashRegister.name,
        expectedCash: s.expectedCash,
      }));
    }
  }

  return suggestions;
}

// ==========================================
// HANDOVER QUERIES
// ==========================================

interface ListHandoverFilters {
  workShiftId?: string;
  fromUserId?: string;
  toUserId?: string;
  assignedRoleName?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function listHandovers(
  restaurantId: string,
  filters: ListHandoverFilters = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.workShiftId) where.workShiftId = filters.workShiftId;
  if (filters.fromUserId) where.fromUserId = filters.fromUserId;
  if (filters.toUserId) where.toUserId = filters.toUserId;
  if (filters.assignedRoleName) where.assignedRoleName = filters.assignedRoleName;
  if (filters.status) where.status = filters.status;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  const [handovers, total] = await Promise.all([
    prisma.shiftHandover.findMany({
      where,
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true } },
        toUser: { select: { id: true, firstName: true, lastName: true } },
        acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
        workShift: { select: { nameSnapshot: true, businessDate: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.shiftHandover.count({ where }),
  ]);

  return {
    handovers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
