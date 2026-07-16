import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { toDecimal, roundMoney } from './calculation.service';

// ==========================================
// RECORD TIP
// ==========================================

interface RecordTipInput {
  orderId: string;
  amount: string;
  paymentMethod: string;
  paymentId?: string;
  directRecipientUserId?: string | null;
  tipPoolId?: string | null;
  recordedById: string;
  restaurantId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordTip(input: RecordTipInput) {
  const { restaurantId, orderId, recordedById } = input;

  // Validate order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, restaurantId: true, orderNumber: true, waiterId: true },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  // Validate amount
  const amount = toDecimal(input.amount);
  if (amount.isZero() || amount.isNegative()) {
    throw new BadRequestError('Tip amount must be greater than zero');
  }

  // Validate payment if provided
  if (input.paymentId) {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, restaurantId: true, orderId: true, method: true },
    });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.restaurantId !== restaurantId) throw new ForbiddenError('Payment belongs to another restaurant');
    if (payment.orderId !== orderId) throw new BadRequestError('Payment does not belong to this order');
  }

  // Validate recipient if provided
  if (input.directRecipientUserId) {
    const recipient = await prisma.user.findFirst({
      where: { id: input.directRecipientUserId, restaurantId, status: 'ACTIVE' },
    });
    if (!recipient) throw new BadRequestError('Invalid tip recipient');
  }

  // Validate pool if provided
  if (input.tipPoolId) {
    const pool = await prisma.tipPool.findUnique({
      where: { id: input.tipPoolId },
      select: { id: true, restaurantId: true, status: true },
    });
    if (!pool) throw new NotFoundError('Tip pool not found');
    if (pool.restaurantId !== restaurantId) throw new ForbiddenError('Pool belongs to another restaurant');
    if (pool.status !== 'DRAFT') throw new BadRequestError('Tips can only be added to draft pools');
  }

  // Generate tip number
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const tipNumber = await generateSequenceNumber(
    restaurantId,
    'TIP',
    'TIP',
    restaurant?.timezone ?? 'UTC'
  );

  const tip = await prisma.customerTip.create({
    data: {
      restaurantId,
      tipNumber,
      orderId,
      paymentId: input.paymentId || null,
      paymentMethod: input.paymentMethod,
      amount: amount.toFixed(2),
      status: 'RECORDED',
      directRecipientUserId: input.directRecipientUserId || null,
      tipPoolId: input.tipPoolId || null,
      recordedById,
    },
  });

  // Create TIP_RECEIVED notification for the recipient
  try {
    const { createNotification } = await import('./notification.service');
    const { emitNewNotification } = await import('../sockets');
    const { io } = await import('../server');
    const recipientId = input.directRecipientUserId || order.waiterId;
    if (recipientId) {
      const notif = await createNotification({
        restaurantId,
        userId: recipientId,
        type: 'TIP_RECEIVED',
        title: `Tip Received — ${tipNumber}`,
        message: `${amount.toFixed(2)} via ${input.paymentMethod} for order ${order.orderNumber}`,
        entityType: 'tip',
        entityId: tip.id,
      });
      emitNewNotification(io, restaurantId, recipientId, { notification: notif });
    }
  } catch (err) { console.error('Failed to create tip notification:', err); }

  // Audit
  await createAuditLog({
    restaurantId,
    userId: recordedById,
    action: 'TIP_RECORDED',
    entityType: 'CustomerTip',
    entityId: tip.id,
    description: `Tip ${tipNumber} of ${amount.toFixed(2)} recorded for order ${order.orderNumber}`,
    metadata: { orderNumber: order.orderNumber, amount: amount.toFixed(2), paymentMethod: input.paymentMethod },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return tip;
}

// ==========================================
// LIST TIPS
// ==========================================

interface TipFilters {
  restaurantId: string;
  orderId?: string;
  userId?: string;
  poolId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function getTips(filters: TipFilters) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 50, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId: filters.restaurantId };

  if (filters.orderId) where.orderId = filters.orderId;
  if (filters.poolId) where.tipPoolId = filters.poolId;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.recordedAt = {};
    if (filters.dateFrom) where.recordedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.recordedAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }
  if (filters.userId) {
    where.OR = [
      { directRecipientUserId: filters.userId },
      { tipPool: { allocations: { some: { userId: filters.userId } } } },
    ];
  }

  // Use raw query approach to avoid Prisma type generation issues
  const tips = await prisma.customerTip.findMany({
    where,
    include: {
      recordedBy: { select: { id: true, firstName: true, lastName: true } },
      directRecipient: { select: { id: true, firstName: true, lastName: true } } as any,
    } as any,
    orderBy: { recordedAt: 'desc' },
    skip,
    take: limit,
  });

  const total = await prisma.customerTip.count({ where });

  // Enrich with order and pool data via separate queries
  const enriched = await Promise.all(
    tips.map(async (t: any) => {
      const order = t.orderId ? await prisma.order.findUnique({
        where: { id: t.orderId },
        select: { orderNumber: true },
      }) : null;
      const pool = t.tipPoolId ? await prisma.tipPool.findUnique({
        where: { id: t.tipPoolId },
        select: { id: true, name: true, status: true },
      }) : null;
      return {
        id: t.id,
        tipNumber: t.tipNumber,
        orderNumber: order?.orderNumber || '',
        paymentMethod: t.paymentMethod,
        amount: t.amount,
        status: t.status,
        directRecipient: t.directRecipient || null,
        recorderdBy: t.recordedBy || null,
        tipPool: pool || null,
        recordedAt: t.recordedAt,
        reversedAt: t.reversedAt,
        reversalReason: t.reversalReason,
      };
    })
  );

  return {
    tips: enriched,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ==========================================
// REVERSE TIP
// ==========================================

export async function reverseTip(
  tipId: string,
  reason: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const tip = await prisma.customerTip.findUnique({ where: { id: tipId } });
  if (!tip) throw new NotFoundError('Tip not found');
  if (tip.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (tip.status === 'REVERSED') throw new BadRequestError('Tip is already reversed');
  if (tip.status === 'ALLOCATED') throw new BadRequestError('Tip has been allocated and cannot be reversed');

  const order = await prisma.order.findUnique({
    where: { id: tip.orderId },
    select: { orderNumber: true },
  });

  const updated = await prisma.customerTip.update({
    where: { id: tipId },
    data: {
      status: 'REVERSED',
      reversedAt: new Date(),
      reversedById: userId,
      reversalReason: reason,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'TIP_REVERSED',
    entityType: 'CustomerTip',
    entityId: tipId,
    description: `Tip ${tip.tipNumber} reversed: ${reason}`,
    metadata: { tipNumber: tip.tipNumber, amount: tip.amount, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// TIP SUMMARY (for reports)
// ==========================================

interface TipSummaryFilters {
  restaurantId: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  poolId?: string;
}

export async function getTipSummary(filters: TipSummaryFilters) {
  const where: any = {
    restaurantId: filters.restaurantId,
    status: { not: 'REVERSED' },
  };

  if (filters.dateFrom || filters.dateTo) {
    where.recordedAt = {};
    if (filters.dateFrom) where.recordedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.recordedAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }
  if (filters.poolId) where.tipPoolId = filters.poolId;
  if (filters.userId) where.directRecipientUserId = filters.userId;

  const tips = await prisma.customerTip.findMany({
    where,
    select: { amount: true, paymentMethod: true, directRecipientUserId: true, status: true },
  });

  const totalAmount = tips.reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  const byPaymentMethod: Record<string, string> = {};
  tips.forEach((t) => {
    byPaymentMethod[t.paymentMethod] = toDecimal(byPaymentMethod[t.paymentMethod] || '0')
      .plus(toDecimal(t.amount)).toFixed(2);
  });

  const reversed = await prisma.customerTip.count({
    where: { ...where, status: 'REVERSED' },
  });

  const directCount = tips.filter((t) => t.directRecipientUserId).length;
  const poolCount = tips.filter((t) => !t.directRecipientUserId).length;

  return {
    totalAmount: roundMoney(totalAmount).toFixed(2),
    tipCount: tips.length,
    byPaymentMethod,
    reversedCount: reversed,
    directTips: directCount,
    poolTips: poolCount,
    averageTip: tips.length > 0 ? roundMoney(totalAmount.div(tips.length)).toFixed(2) : '0.00',
  };
}

// ==========================================
// TIP POOLING
// ==========================================

interface CreatePoolInput {
  restaurantId: string;
  name: string;
  startDate: string;
  endDate: string;
  allocationMethod: 'DIRECT_EMPLOYEE' | 'EQUAL_SHARE' | 'HOURS_WORKED' | 'ROLE_WEIGHTED' | 'CUSTOM_PERCENTAGE';
  includedPaymentMethods?: string[];
  eligibleRoles?: string[];
  notes?: string;
  createdById: string;
}

export async function createTipPool(input: CreatePoolInput) {
  const { restaurantId, createdById } = input;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const poolNumber = await generateSequenceNumber(
    restaurantId,
    'TIP_POOL',
    'TP',
    restaurant?.timezone ?? 'UTC'
  );

  const pool = await prisma.tipPool.create({
    data: {
      restaurantId,
      tipPoolNumber: poolNumber,
      name: input.name,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      allocationMethod: input.allocationMethod,
      status: 'DRAFT',
      totalTipAmount: 0,
      distributableAmount: 0,
      undistributedAmount: 0,
      includedPaymentMethods: input.includedPaymentMethods ? JSON.parse(JSON.stringify(input.includedPaymentMethods)) : null,
      eligibleRoles: input.eligibleRoles ? JSON.parse(JSON.stringify(input.eligibleRoles)) : null,
      notes: input.notes || null,
      createdById,
    },
  });

  await createAuditLog({
    restaurantId,
    userId: createdById,
    action: 'TIP_POOL_CREATED',
    entityType: 'TipPool',
    entityId: pool.id,
    description: `Tip pool "${pool.name}" created (${pool.tipPoolNumber})`,
    metadata: { poolNumber: pool.tipPoolNumber, name: pool.name, allocationMethod: input.allocationMethod },
  });

  return pool;
}

export async function getTipPools(restaurantId: string, status?: string, page = 1, limit = 20) {
  const where: any = { restaurantId };
  if (status) where.status = status;

  const [pools, total] = await Promise.all([
    prisma.tipPool.findMany({
      where,
      include: {
        _count: { select: { allocations: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      } as any,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tipPool.count({ where }),
  ]);

  return {
    pools: (pools as any[]).map((p: any) => ({
      id: p.id,
      tipPoolNumber: p.tipPoolNumber,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      allocationMethod: p.allocationMethod,
      status: p.status,
      totalTipAmount: p.totalTipAmount,
      distributableAmount: p.distributableAmount,
      undistributedAmount: p.undistributedAmount,
      allocationCount: p._count?.allocations || 0,
      createdBy: p.createdBy,
      calculatedAt: p.calculatedAt,
      approvedAt: p.approvedAt,
      createdAt: p.createdAt,
      notes: p.notes,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTipPool(poolId: string, restaurantId: string) {
  const pool = await prisma.tipPool.findUnique({
    where: { id: poolId },
    include: {
      allocations: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
        orderBy: { allocatedAmount: 'desc' },
      },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      calculatedBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      postedToPayroll: { select: { id: true, name: true } },
    } as any,
  });
  if (!pool) throw new NotFoundError('Tip pool not found');
  if (pool.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  return pool;
}

// ==========================================
// CALCULATE POOL DISTRIBUTIONS
// ==========================================

export async function calculateTipPool(poolId: string, userId: string, restaurantId: string) {
  const pool = await prisma.tipPool.findUnique({ where: { id: poolId } });
  if (!pool) throw new NotFoundError('Tip pool not found');
  if (pool.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (pool.status !== 'DRAFT') throw new BadRequestError('Only draft pools can be calculated');

  // Get all tips in this pool
  const tips = await prisma.customerTip.findMany({
    where: { tipPoolId: poolId, status: { not: 'REVERSED' } },
    select: { amount: true },
  });

  const totalTipAmount = tips.reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
  const distributableAmount = roundMoney(totalTipAmount);

  // Determine eligible employees
  const eligibleRoles = (pool.eligibleRoles as string[]) || ['WAITER', 'ADMIN', 'MANAGER'];

  const eligibleUsers = await prisma.user.findMany({
    where: {
      restaurantId,
      status: 'ACTIVE',
      roles: { some: { role: { name: { in: eligibleRoles } } } },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (eligibleUsers.length === 0) {
    throw new BadRequestError('No eligible employees found for this pool period');
  }

  // Calculate allocations based on method
  const allocations: Array<{
    userId: string;
    allocationBasis: string;
    basisValue?: number;
    allocationPercentage?: number;
    allocatedAmount: string;
  }> = [];

  switch (pool.allocationMethod) {
    case 'EQUAL_SHARE': {
      const perPerson = roundMoney(distributableAmount.div(eligibleUsers.length));
      for (const user of eligibleUsers) {
        allocations.push({
          userId: user.id,
          allocationBasis: 'EQUAL_SHARE',
          basisValue: 1 / eligibleUsers.length,
          allocationPercentage: 100 / eligibleUsers.length,
          allocatedAmount: perPerson.toFixed(2),
        });
      }
      break;
    }

    case 'HOURS_WORKED': {
      // Get hour data per employee
      const shiftData = await Promise.all(
        eligibleUsers.map(async (user) => {
          const assignments = await prisma.shiftAssignment.findMany({
            where: {
              userId: user.id,
              restaurantId,
              status: 'CLOCKED_OUT',
              clockedInAt: { gte: pool.startDate },
              clockedOutAt: { lte: pool.endDate, not: null },
            },
            select: { clockedInAt: true, clockedOutAt: true },
          });

          const totalMinutes = assignments.reduce((sum, a) => {
            if (!a.clockedOutAt || !a.clockedInAt) return sum;
            return sum + (a.clockedOutAt.getTime() - a.clockedInAt.getTime()) / 60000;
          }, 0);

          return { userId: user.id, minutes: totalMinutes };
        })
      );

      const totalMinutes = shiftData.reduce((sum, s) => sum + s.minutes, 0);

      if (totalMinutes === 0 || eligibleUsers.length === 0) {
        // Fall back to equal share
        const perPerson = roundMoney(distributableAmount.div(eligibleUsers.length));
        for (const user of eligibleUsers) {
          allocations.push({
            userId: user.id,
            allocationBasis: 'HOURS_WORKED',
            basisValue: 0,
            allocationPercentage: 100 / eligibleUsers.length,
            allocatedAmount: perPerson.toFixed(2),
          });
        }
      } else {
        for (const sd of shiftData) {
          const pct = (sd.minutes / totalMinutes) * 100;
          const amount = roundMoney(distributableAmount.mul(pct).div(100));
          allocations.push({
            userId: sd.userId,
            allocationBasis: 'HOURS_WORKED',
            basisValue: sd.minutes,
            allocationPercentage: pct,
            allocatedAmount: amount.toFixed(2),
          });
        }
      }
      break;
    }

    case 'ROLE_WEIGHTED': {
      const userRoles = await Promise.all(
        eligibleUsers.map(async (user) => {
          const roles = await prisma.userRole.findMany({
            where: { userId: user.id },
            include: { role: { select: { name: true } } },
          });
          const roleNames = roles.map((r) => r.role.name);
          let weight = 0.3;
          if (roleNames.includes('WAITER')) weight = 1.0;
          else if (roleNames.includes('ADMIN') || roleNames.includes('MANAGER')) weight = 0.5;
          return { userId: user.id, weight };
        })
      );

      const totalWeight = userRoles.reduce((sum, u) => sum + u.weight, 0);

      for (const ur of userRoles) {
        const pct = (ur.weight / totalWeight) * 100;
        const amount = roundMoney(distributableAmount.mul(pct).div(100));
        allocations.push({
          userId: ur.userId,
          allocationBasis: 'ROLE_WEIGHTED',
          basisValue: ur.weight,
          allocationPercentage: pct,
          allocatedAmount: amount.toFixed(2),
        });
      }
      break;
    }

    case 'DIRECT_EMPLOYEE': {
      const directTips = await prisma.customerTip.findMany({
        where: { tipPoolId: poolId, status: { not: 'REVERSED' }, directRecipientUserId: { not: null } },
        select: { amount: true, directRecipientUserId: true },
      });

      const perUser: Record<string, any> = {};
      for (const tip of directTips) {
        if (tip.directRecipientUserId) {
          perUser[tip.directRecipientUserId] = (perUser[tip.directRecipientUserId] || toDecimal(0)).plus(toDecimal(tip.amount));
        }
      }

      const remaining = eligibleUsers.filter(u => !perUser[u.id]);
      if (remaining.length > 0) {
        const tipWithoutRecipient = directTips.filter(t => !t.directRecipientUserId);
        const undistributed = tipWithoutRecipient.reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
        const perRemaining = remaining.length > 0 ? roundMoney(undistributed.div(remaining.length)) : toDecimal(0);
        for (const user of remaining) {
          perUser[user.id] = (perUser[user.id] || toDecimal(0)).plus(perRemaining);
        }
      }

      for (const [uid, amount] of Object.entries(perUser)) {
        const userMatch = eligibleUsers.find((u) => u.id === uid);
        if (userMatch) {
          allocations.push({
            userId: uid,
            allocationBasis: 'DIRECT_EMPLOYEE',
            allocatedAmount: roundMoney(amount).toFixed(2),
          });
        }
      }
      break;
    }

    default:
      throw new BadRequestError('CUSTOM_PERCENTAGE requires manual allocation via pool adjustment');
  }

  // Calculate undistributed amount
  const allocatedTotal = allocations.reduce((sum, a) => sum.plus(toDecimal(a.allocatedAmount)), toDecimal(0));
  const undistributedAmount = roundMoney(distributableAmount.minus(allocatedTotal));

  // Update pool and create allocations in a transaction
  const updatedPool = await prisma.$transaction(async (tx) => {
    await tx.tipPoolAllocation.deleteMany({ where: { tipPoolId: poolId } });

    for (const alloc of allocations) {
      await tx.tipPoolAllocation.create({
        data: {
          restaurantId,
          tipPoolId: poolId,
          userId: alloc.userId,
          allocationBasis: alloc.allocationBasis,
          basisValue: alloc.basisValue ? toDecimal(alloc.basisValue) : null,
          allocationPercentage: alloc.allocationPercentage ? toDecimal(alloc.allocationPercentage) : null,
          allocatedAmount: alloc.allocatedAmount,
          status: 'CALCULATED',
        },
      });
    }

    return tx.tipPool.update({
      where: { id: poolId },
      data: {
        totalTipAmount: distributableAmount.toFixed(2),
        distributableAmount: distributableAmount.toFixed(2),
        undistributedAmount: undistributedAmount.toFixed(2),
        status: 'CALCULATED',
        calculatedAt: new Date(),
        calculatedById: userId,
      },
    });
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'TIP_POOL_CALCULATED',
    entityType: 'TipPool',
    entityId: poolId,
    description: `Tip pool "${pool.name}" calculated — ${allocations.length} allocations totaling ${distributableAmount.toFixed(2)}`,
  });

  return updatedPool;
}

// ==========================================
// APPROVE POOL
// ==========================================

export async function approveTipPool(
  poolId: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const pool = await prisma.tipPool.findUnique({ where: { id: poolId } });
  if (!pool) throw new NotFoundError('Tip pool not found');
  if (pool.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (pool.status !== 'CALCULATED') throw new BadRequestError('Only calculated pools can be approved');

  const updated = await prisma.tipPool.update({
    where: { id: poolId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedById: userId,
    },
  });

  await prisma.customerTip.updateMany({
    where: { tipPoolId: poolId, status: 'RECORDED' },
    data: { status: 'ALLOCATED' },
  });

  await prisma.tipPoolAllocation.updateMany({
    where: { tipPoolId: poolId, status: 'CALCULATED' },
    data: { status: 'APPROVED' },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'TIP_POOL_APPROVED',
    entityType: 'TipPool',
    entityId: poolId,
    description: `Tip pool "${pool.name}" approved`,
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// MANUAL ADJUSTMENT (Manager override)
// ==========================================

interface AdjustmentInput {
  poolId: string;
  userId: string;
  allocatedAmount: string;
  reason: string;
  actorUserId: string;
  restaurantId: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function manualPoolAdjustment(input: AdjustmentInput) {
  const pool = await prisma.tipPool.findUnique({ where: { id: input.poolId } });
  if (!pool) throw new NotFoundError('Tip pool not found');
  if (pool.restaurantId !== input.restaurantId) throw new ForbiddenError('Access denied');

  const amount = toDecimal(input.allocatedAmount);

  const existing = await prisma.tipPoolAllocation.findUnique({
    where: { tipPoolId_userId: { tipPoolId: input.poolId, userId: input.userId } },
  });

  if (existing) {
    await prisma.tipPoolAllocation.update({
      where: { id: existing.id },
      data: {
        allocatedAmount: amount.toFixed(2),
        allocationBasis: 'MANUAL_ADJUSTMENT',
        status: 'CALCULATED',
      },
    });
  } else {
    await prisma.tipPoolAllocation.create({
      data: {
        restaurantId: input.restaurantId,
        tipPoolId: input.poolId,
        userId: input.userId,
        allocationBasis: 'MANUAL_ADJUSTMENT',
        allocatedAmount: amount.toFixed(2),
        status: 'CALCULATED',
      },
    });
  }

  const allAllocations = await prisma.tipPoolAllocation.findMany({
    where: { tipPoolId: input.poolId },
    select: { allocatedAmount: true },
  });

  const totalAllocated = allAllocations.reduce((sum, a) => sum.plus(toDecimal(a.allocatedAmount)), toDecimal(0));
  const distributable = toDecimal(pool.distributableAmount);
  const undistributed = roundMoney(distributable.minus(totalAllocated));

  await prisma.tipPool.update({
    where: { id: input.poolId },
    data: { undistributedAmount: undistributed.toFixed(2) },
  });

  await createAuditLog({
    restaurantId: input.restaurantId,
    userId: input.actorUserId,
    action: 'TIP_POOL_MANUAL_ADJUSTMENT',
    entityType: 'TipPool',
    entityId: input.poolId,
    description: `Manual adjustment for user ${input.userId}: ${input.allocatedAmount}`,
    metadata: { reason: input.reason, amount: input.allocatedAmount },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return getTipPool(input.poolId, input.restaurantId);
}

// ==========================================
// WAITER TIP REPORT
// ==========================================

interface WaiterTipReportFilters {
  restaurantId: string;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  includePoolTips?: boolean;
}

export async function getWaiterTipReport(filters: WaiterTipReportFilters) {
  const { restaurantId } = filters;

  const waiters = await prisma.user.findMany({
    where: {
      restaurantId,
      status: 'ACTIVE',
      roles: { some: { role: { name: { in: ['WAITER', 'ADMIN', 'MANAGER'] } } } },
    },
    select: { id: true, firstName: true, lastName: true, employeeCode: true },
    orderBy: { firstName: 'asc' },
  });

  const dateFilter: any = {};
  if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
  if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo + 'T23:59:59.999Z');

  const waiterData = await Promise.all(
    waiters.map(async (waiter) => {
      const directTipsWhere: any = {
        restaurantId,
        directRecipientUserId: waiter.id,
        status: { not: 'REVERSED' },
      };
      if (filters.dateFrom || filters.dateTo) {
        directTipsWhere.recordedAt = dateFilter;
      }

      const directTips = await prisma.customerTip.findMany({
        where: directTipsWhere,
        select: { amount: true },
      });

      const directTotal = directTips.reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));
      const directCount = directTips.length;

      let poolTotal = toDecimal(0);
      let poolCount = 0;

      if (filters.includePoolTips !== false) {
        const allocations = await prisma.tipPoolAllocation.findMany({
          where: {
            userId: waiter.id,
            restaurantId,
            status: { in: ['APPROVED', 'POSTED_TO_PAYROLL'] },
          },
          select: { allocatedAmount: true },
        });

        poolTotal = allocations.reduce((sum, a) => sum.plus(toDecimal(a.allocatedAmount)), toDecimal(0));
        poolCount = allocations.length;
      }

      return {
        id: waiter.id,
        firstName: waiter.firstName,
        lastName: waiter.lastName,
        employeeCode: waiter.employeeCode,
        directTipCount: directCount,
        directTipTotal: roundMoney(directTotal).toFixed(2),
        poolTipCount: poolCount,
        poolTipTotal: roundMoney(poolTotal).toFixed(2),
        totalTips: roundMoney(directTotal.plus(poolTotal)).toFixed(2),
      };
    })
  );

  const grandTotal = waiterData.reduce((sum, w) => sum.plus(toDecimal(w.totalTips)), toDecimal(0));

  return {
    waiters: waiterData.sort((a, b) => parseFloat(b.totalTips) - parseFloat(a.totalTips)),
    totals: {
      totalTips: roundMoney(grandTotal).toFixed(2),
      totalDirect: roundMoney(waiterData.reduce((s, w) => s.plus(toDecimal(w.directTipTotal)), toDecimal(0))).toFixed(2),
      totalPool: roundMoney(waiterData.reduce((s, w) => s.plus(toDecimal(w.poolTipTotal)), toDecimal(0))).toFixed(2),
      waiterCount: waiterData.length,
    },
  };
}

// ==========================================
// SHIFT TIP REPORT
// ==========================================

interface ShiftTipReportFilters {
  restaurantId: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getShiftTipReport(filters: ShiftTipReportFilters) {
  const { restaurantId } = filters;

  const poolWhere: any = { restaurantId };
  if (filters.dateFrom || filters.dateTo) {
    poolWhere.OR = [
      { startDate: { gte: new Date(filters.dateFrom || '1970-01-01') } },
      { endDate: { lte: new Date(filters.dateTo || '2100-01-01') } },
    ];
  }

  const pools = await prisma.tipPool.findMany({
    where: poolWhere,
    include: {
      _count: { select: { allocations: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      calculatedBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    } as any,
    orderBy: { startDate: 'desc' },
  });

  const poolTotals = (pools as any[]).reduce((sum: any, p: any) => sum.plus(toDecimal(p.distributableAmount)), toDecimal(0));

  const tipWhere: any = {
    restaurantId,
    tipPoolId: null,
    status: { not: 'REVERSED' },
  };
  if (filters.dateFrom || filters.dateTo) {
    tipWhere.recordedAt = {};
    if (filters.dateFrom) tipWhere.recordedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) tipWhere.recordedAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  const directTips = await prisma.customerTip.findMany({
    where: tipWhere,
    select: { amount: true, directRecipientUserId: true, paymentMethod: true },
  });

  const directTotal = directTips.reduce((sum, t) => sum.plus(toDecimal(t.amount)), toDecimal(0));

  return {
    pools: (pools as any[]).map((p: any) => ({
      id: p.id,
      tipPoolNumber: p.tipPoolNumber,
      name: p.name,
      startDate: p.startDate,
      endDate: p.endDate,
      allocationMethod: p.allocationMethod,
      status: p.status,
      totalTipAmount: p.totalTipAmount,
      distributableAmount: p.distributableAmount,
      allocationCount: p._count?.allocations || 0,
      createdBy: p.createdBy,
      calculatedBy: p.calculatedBy,
      approvedBy: p.approvedBy,
      createdAt: p.createdAt,
      calculatedAt: p.calculatedAt,
      approvedAt: p.approvedAt,
    })),
    directTips: {
      count: directTips.length,
      total: roundMoney(directTotal).toFixed(2),
    },
    totals: {
      poolTotal: roundMoney(poolTotals).toFixed(2),
      directTotal: roundMoney(directTotal).toFixed(2),
      grandTotal: roundMoney(poolTotals.plus(directTotal)).toFixed(2),
      poolCount: pools.length,
    },
  };
}
