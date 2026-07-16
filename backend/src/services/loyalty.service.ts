import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { toDecimal, roundMoney } from './calculation.service';
import { Decimal, type Decimal as DecimalType } from '@prisma/client/runtime/library';

// ==========================================
// GENERATE REFERENCE NUMBER
// ==========================================

async function generateRefNumber(restaurantId: string): Promise<string> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const seq = await generateSequenceNumber(
    restaurantId,
    'LOYALTY_TRANSACTION',
    'LOY',
    restaurant?.timezone ?? 'UTC'
  );
  return seq;
}

// ==========================================
// ENROLL
// ==========================================

export async function enrollCustomer(
  customerId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const existing = await prisma.loyaltyAccount.findUnique({ where: { customerId } });
  if (existing) {
    if (existing.isActive) throw new BadRequestError('Customer is already enrolled in loyalty');
    // Reactivate
    const updated = await prisma.loyaltyAccount.update({
      where: { id: existing.id },
      data: { isActive: true, enrolledAt: new Date() },
    });
    await createAuditLog({
      restaurantId, userId,
      action: 'Loyalty enrolment reactivated',
      entityType: 'LoyaltyAccount',
      entityId: existing.id,
      description: `Customer ${customer.customerNumber} re-enrolled in loyalty`,
      metadata: { customerNumber: customer.customerNumber },
      ipAddress, userAgent,
    });
    return updated;
  }

  const account = await prisma.loyaltyAccount.create({
    data: {
      restaurantId,
      customerId,
      pointsBalance: 0,
      lifetimePointsEarned: 0,
      lifetimePointsRedeemed: 0,
      enrolledAt: new Date(),
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'Loyalty enrolment',
    entityType: 'LoyaltyAccount',
    entityId: account.id,
    description: `Customer ${customer.customerNumber} enrolled in loyalty`,
    metadata: { customerNumber: customer.customerNumber },
    ipAddress, userAgent,
  });

  return account;
}

// ==========================================
// EARN POINTS
// ==========================================

export async function earnPoints(
  orderId: string,
  restaurantId: string,
  settings: any,
  ipAddress?: string,
  userAgent?: string
) {
  if (!settings?.loyaltyEnabled) return null;
  if (!settings?.pointsPerCurrencyUnit || Number(settings.pointsPerCurrencyUnit) <= 0) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: { where: { status: 'COMPLETED', transactionType: 'PAYMENT' } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (order.status !== 'CLOSED') throw new BadRequestError('Order must be closed to earn points');
  if (!order.customerId) return null; // No customer attached
  if (order.loyaltyPointsEarned > 0) return order; // Already earned

  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({ where: { customerId: order.customerId } });
  if (!loyaltyAccount || !loyaltyAccount.isActive) return null;

  // Calculate eligible amount
  let eligibleAmount = toDecimal(order.subtotal);
  if (!settings.loyaltyPointsEarnOnDiscountedAmount) {
    eligibleAmount = toDecimal(order.totalBeforeDiscount);
  }
  if (!settings.loyaltyPointsEarnOnTax) {
    eligibleAmount = eligibleAmount.minus(toDecimal(order.taxAmount));
  }
  if (!settings.loyaltyPointsEarnOnServiceCharge) {
    eligibleAmount = eligibleAmount.minus(toDecimal(order.serviceCharge));
  }

  // Check minimum spend
  const minSpend = toDecimal(settings.minimumSpendToEarnPoints || 0);
  if (eligibleAmount.lessThan(minSpend)) return null;

  // Calculate points
  const pointsPerUnit = toDecimal(settings.pointsPerCurrencyUnit);
  const rawPoints = eligibleAmount.mul(pointsPerUnit);
  const points = Math.floor(rawPoints.toNumber()); // Round down

  if (points <= 0) return null;

  const refNumber = await generateRefNumber(restaurantId);

  return await prisma.$transaction(async (tx) => {
    const balanceBefore = loyaltyAccount.pointsBalance;
    const balanceAfter = balanceBefore + points;

    const txn = await tx.loyaltyTransaction.create({
      data: {
        restaurantId,
        loyaltyAccountId: loyaltyAccount.id,
        customerId: order.customerId!,
        transactionType: 'EARN',
        points,
        balanceBefore,
        balanceAfter,
        orderId,
        reason: `Order ${order.orderNumber}`,
        referenceNumber: refNumber,
        actorUserId: order.closedById || order.waiterId,
      },
    });

    await tx.loyaltyAccount.update({
      where: { id: loyaltyAccount.id },
      data: {
        pointsBalance: balanceAfter,
        lifetimePointsEarned: loyaltyAccount.lifetimePointsEarned + points,
        lastActivityAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: { loyaltyPointsEarned: points },
    });

    await createAuditLog({
      restaurantId,
      userId: order.closedById || order.waiterId,
      action: 'Loyalty points earned',
      entityType: 'LoyaltyTransaction',
      entityId: txn.id,
      description: `${points} points earned for order ${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber, points, eligibleAmount: eligibleAmount.toFixed(2) },
      ipAddress, userAgent,
    });

    return txn;
  });
}

// ==========================================
// REDEEM POINTS
// ==========================================

export async function redeemPoints(
  orderId: string,
  restaurantId: string,
  userId: string,
  points: number,
  ipAddress?: string,
  userAgent?: string
) {
  if (points <= 0) throw new BadRequestError('Points must be greater than zero');

  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
  if (!settings?.loyaltyEnabled || !settings?.loyaltyRedemptionEnabled) {
    throw new BadRequestError('Loyalty redemption is not enabled');
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (!order.customerId) throw new BadRequestError('Order has no customer attached');
  if (['CLOSED', 'CANCELLED'].includes(order.status)) {
    throw new BadRequestError('Cannot redeem points on a closed or cancelled order');
  }

  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({ where: { customerId: order.customerId } });
  if (!loyaltyAccount || !loyaltyAccount.isActive) throw new BadRequestError('Customer is not enrolled in loyalty');

  // Check minimum points
  const minPoints = settings.minimumPointsToRedeem || 0;
  if (points < minPoints) throw new BadRequestError(`Minimum ${minPoints} points required to redeem`);

  // Check balance
  if (points > loyaltyAccount.pointsBalance) throw new BadRequestError('Insufficient points balance');

  // Calculate value
  const currencyPerPoint = toDecimal(settings.currencyValuePerPoint || 0);
  const redemptionValue = roundMoney(toDecimal(points).mul(currencyPerPoint));

  // Check max redemption percentage
  const maxPct = toDecimal(settings.maximumRedemptionPercentage || 100).div(100);
  const maxRedemptionValue = roundMoney(toDecimal(order.subtotal).mul(maxPct));
  const finalValue = Decimal.min(redemptionValue, maxRedemptionValue);

  if (finalValue.isZero()) throw new BadRequestError('Redemption value is zero');

  // Check existing redemptions
  const existingRedemptions = await prisma.orderDiscount.count({
    where: { orderId, source: 'LOYALTY_REDEMPTION', status: 'ACTIVE' },
  });
  if (existingRedemptions > 0) throw new BadRequestError('Order already has a loyalty redemption');

  const refNumber = await generateRefNumber(restaurantId);

  return await prisma.$transaction(async (tx) => {
    const balanceBefore = loyaltyAccount.pointsBalance;
    const balanceAfter = balanceBefore - points;

    if (balanceAfter < 0) throw new BadRequestError('Points balance would become negative');

    // Create redemption transaction
    const txn = await tx.loyaltyTransaction.create({
      data: {
        restaurantId,
        loyaltyAccountId: loyaltyAccount.id,
        customerId: order.customerId!,
        transactionType: 'REDEEM',
        points,
        balanceBefore,
        balanceAfter,
        orderId,
        reason: `Redemption for order ${order.orderNumber}`,
        referenceNumber: refNumber,
        actorUserId: userId,
      },
    });

    // Update account
    await tx.loyaltyAccount.update({
      where: { id: loyaltyAccount.id },
      data: {
        pointsBalance: balanceAfter,
        lifetimePointsRedeemed: loyaltyAccount.lifetimePointsRedeemed + points,
        lastActivityAt: new Date(),
      },
    });

    // Create OrderDiscount
    const discount = await tx.orderDiscount.create({
      data: {
        restaurantId,
        orderId,
        source: 'LOYALTY_REDEMPTION',
        status: 'ACTIVE',
        nameSnapshot: 'Loyalty Points Redemption',
        codeSnapshot: null,
        scopeSnapshot: 'ORDER',
        calculationTypeSnapshot: 'FIXED_AMOUNT_DISCOUNT',
        fixedValueSnapshot: finalValue.toFixed(2),
        discountAmount: finalValue.toFixed(2),
        reason: `${points} points redeemed`,
        appliedById: userId,
        customerId: order.customerId,
      },
    });

    // Update order
    const newDiscountAmount = toDecimal(order.discountAmount).plus(finalValue);
    const newTotalBeforeDiscount = toDecimal(order.totalBeforeDiscount || order.subtotal);
    const newTotalAmount = Decimal.max(0, newTotalBeforeDiscount.minus(newDiscountAmount));

    await tx.order.update({
      where: { id: orderId },
      data: {
        discountAmount: newDiscountAmount.toFixed(2),
        totalAmount: newTotalAmount.toFixed(2),
        loyaltyPointsRedeemed: points,
        loyaltyRedemptionValue: finalValue.toFixed(2),
      },
    });

    const updatedOrder = await tx.order.findUnique({ where: { id: orderId } });

    await createAuditLog({
      restaurantId, userId,
      action: 'Loyalty points redeemed',
      entityType: 'LoyaltyTransaction',
      entityId: txn.id,
      description: `${points} points redeemed for ${finalValue.toFixed(2)} on order ${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber, points, value: finalValue.toFixed(2) },
      ipAddress, userAgent,
    });

    return { transaction: txn, discount, order: updatedOrder };
  });
}

// ==========================================
// REMOVE REDEMPTION / REVERSE
// ==========================================

export async function removeRedemption(
  orderId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (order.status === 'CLOSED') throw new BadRequestError('Cannot change redemption on a closed order');

  const redemptionDiscount = await prisma.orderDiscount.findFirst({
    where: { orderId, source: 'LOYALTY_REDEMPTION', status: 'ACTIVE' },
  });
  if (!redemptionDiscount) throw new NotFoundError('No active redemption found');

  const loyaltyTransaction = await prisma.loyaltyTransaction.findFirst({
    where: { orderId, transactionType: 'REDEEM' },
    orderBy: { createdAt: 'desc' },
  });
  if (!loyaltyTransaction) throw new NotFoundError('No redemption transaction found');

  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({ where: { customerId: order.customerId! } });
  if (!loyaltyAccount) throw new NotFoundError('Loyalty account not found');

  const refNumber = await generateRefNumber(restaurantId);

  return await prisma.$transaction(async (tx) => {
    // Mark discount as removed
    await tx.orderDiscount.update({
      where: { id: redemptionDiscount.id },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
        removedById: userId,
        removalReason: 'Redemption reversed',
      },
    });

    // Create reversal transaction
    const balanceBefore = loyaltyAccount.pointsBalance;
    const balanceAfter = balanceBefore + loyaltyTransaction.points;

    const reversal = await tx.loyaltyTransaction.create({
      data: {
        restaurantId,
        loyaltyAccountId: loyaltyAccount.id,
        customerId: order.customerId!,
        transactionType: 'REVERSAL',
        points: loyaltyTransaction.points,
        balanceBefore,
        balanceAfter,
        orderId,
        reason: 'Redemption reversed',
        referenceNumber: refNumber,
        actorUserId: userId,
        parentTransactionId: loyaltyTransaction.id,
      },
    });

    // Restore points
    await tx.loyaltyAccount.update({
      where: { id: loyaltyAccount.id },
      data: {
        pointsBalance: balanceAfter,
        lastActivityAt: new Date(),
      },
    });

    // Recalculate order totals
    const newDiscountAmount = toDecimal(order.discountAmount).minus(toDecimal(redemptionDiscount.discountAmount));
    const newTotal = Decimal.max(0, toDecimal(order.totalBeforeDiscount || order.subtotal).minus(newDiscountAmount));

    await tx.order.update({
      where: { id: orderId },
      data: {
        discountAmount: newDiscountAmount.toFixed(2),
        totalAmount: newTotal.toFixed(2),
        loyaltyPointsRedeemed: 0,
        loyaltyRedemptionValue: 0,
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'Loyalty redemption reversed',
      entityType: 'LoyaltyTransaction',
      entityId: reversal.id,
      description: `${loyaltyTransaction.points} points restored for order ${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber, points: loyaltyTransaction.points },
      ipAddress, userAgent,
    });

    return { reversal, order: await tx.order.findUnique({ where: { id: orderId } }) };
  });
}

// ==========================================
// MANUAL ADJUSTMENT
// ==========================================

export async function manualAdjustment(
  customerId: string,
  restaurantId: string,
  userId: string,
  points: number,
  reason: string,
  type: 'MANUAL_ADJUSTMENT_IN' | 'MANUAL_ADJUSTMENT_OUT',
  ipAddress?: string,
  userAgent?: string
) {
  if (points <= 0) throw new BadRequestError('Points must be greater than zero');
  if (!reason) throw new BadRequestError('Reason is required');

  const customer = await prisma.customer.findFirst({ where: { id: customerId, restaurantId } });
  if (!customer) throw new NotFoundError('Customer not found');

  const loyaltyAccount = await prisma.loyaltyAccount.findUnique({ where: { customerId } });
  if (!loyaltyAccount || !loyaltyAccount.isActive) {
    throw new BadRequestError('Customer is not enrolled in loyalty');
  }

  const signedPoints = type === 'MANUAL_ADJUSTMENT_IN' ? points : -points;
  const balanceAfter = loyaltyAccount.pointsBalance + signedPoints;

  if (balanceAfter < 0) throw new BadRequestError('Points balance cannot become negative');

  const refNumber = await generateRefNumber(restaurantId);

  return await prisma.$transaction(async (tx) => {
    const txn = await tx.loyaltyTransaction.create({
      data: {
        restaurantId,
        loyaltyAccountId: loyaltyAccount.id,
        customerId,
        transactionType: type,
        points,
        balanceBefore: loyaltyAccount.pointsBalance,
        balanceAfter,
        reason,
        referenceNumber: refNumber,
        actorUserId: userId,
      },
    });

    await tx.loyaltyAccount.update({
      where: { id: loyaltyAccount.id },
      data: {
        pointsBalance: balanceAfter,
        lastActivityAt: new Date(),
        lifetimePointsEarned: type === 'MANUAL_ADJUSTMENT_IN'
          ? loyaltyAccount.lifetimePointsEarned + points
          : loyaltyAccount.lifetimePointsEarned,
        lifetimePointsRedeemed: type === 'MANUAL_ADJUSTMENT_OUT'
          ? loyaltyAccount.lifetimePointsRedeemed + points
          : loyaltyAccount.lifetimePointsRedeemed,
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: type === 'MANUAL_ADJUSTMENT_IN' ? 'Loyalty points added manually' : 'Loyalty points deducted manually',
      entityType: 'LoyaltyTransaction',
      entityId: txn.id,
      description: `${type === 'MANUAL_ADJUSTMENT_IN' ? '+' : '-'}${points} points: ${reason}`,
      metadata: { customerNumber: customer.customerNumber, points, reason },
      ipAddress, userAgent,
    });

    return txn;
  });
}

// ==========================================
// HANDLE POINTS AFTER REFUND
// ==========================================

export async function handleRefundPoints(
  orderId: string,
  refundAmount: DecimalType,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return;

  // Reverse earned points proportionally
  if (order.loyaltyPointsEarned > 0 && order.customerId) {
    const loyaltyAccount = await prisma.loyaltyAccount.findUnique({ where: { customerId: order.customerId } });
    if (loyaltyAccount && loyaltyAccount.isActive) {
      const orderTotal = toDecimal(order.totalAmount);
      if (orderTotal.isPositive()) {
        const proportion = roundMoney(refundAmount.div(orderTotal));
        const pointsToReverse = Math.floor(toDecimal(order.loyaltyPointsEarned).mul(proportion).toNumber());

        if (pointsToReverse > 0) {
          const refNumber = await generateRefNumber(restaurantId);
          const balanceAfter = loyaltyAccount.pointsBalance - pointsToReverse;

          if (balanceAfter >= 0) {
            await prisma.loyaltyTransaction.create({
              data: {
                restaurantId,
                loyaltyAccountId: loyaltyAccount.id,
                customerId: order.customerId,
                transactionType: 'REVERSAL',
                points: pointsToReverse,
                balanceBefore: loyaltyAccount.pointsBalance,
                balanceAfter,
                orderId,
                reason: `Points reversal for refund on order ${order.orderNumber}`,
                referenceNumber: refNumber,
                actorUserId: userId,
              },
            });

            await prisma.loyaltyAccount.update({
              where: { id: loyaltyAccount.id },
              data: { pointsBalance: balanceAfter, lastActivityAt: new Date() },
            });
          }
        }
      }
    }
  }

  // Restore redeemed points proportionally
  if (order.loyaltyPointsRedeemed > 0 && order.customerId && toDecimal(order.loyaltyRedemptionValue).greaterThan(0)) {
    const redemptionValue = toDecimal(order.loyaltyRedemptionValue);
    if (refundAmount.greaterThanOrEqualTo(redemptionValue)) {
      // Full restore
      const redemptionTxn = await prisma.loyaltyTransaction.findFirst({
        where: { orderId, transactionType: 'REDEEM' },
        orderBy: { createdAt: 'desc' },
      });
      if (redemptionTxn) {
        const loyaltyAccount = await prisma.loyaltyAccount.findUnique({ where: { customerId: order.customerId } });
        if (loyaltyAccount) {
          const refNumber = await generateRefNumber(restaurantId);
          await prisma.loyaltyTransaction.create({
            data: {
              restaurantId,
              loyaltyAccountId: loyaltyAccount.id,
              customerId: order.customerId,
              transactionType: 'REVERSAL',
              points: redemptionTxn.points,
              balanceBefore: loyaltyAccount.pointsBalance,
              balanceAfter: loyaltyAccount.pointsBalance + redemptionTxn.points,
              orderId,
              reason: `Points restored after refund on order ${order.orderNumber}`,
              referenceNumber: refNumber,
              actorUserId: userId,
              parentTransactionId: redemptionTxn.id,
            },
          });
          await prisma.loyaltyAccount.update({
            where: { id: loyaltyAccount.id },
            data: { pointsBalance: loyaltyAccount.pointsBalance + redemptionTxn.points, lastActivityAt: new Date() },
          });
        }
      }
    }
  }
}

// ==========================================
// GET ACCOUNT
// ==========================================

export async function getLoyaltyAccount(customerId: string, restaurantId: string) {
  const account = await prisma.loyaltyAccount.findFirst({
    where: { customerId, restaurantId },
    include: {
      transactions: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!account) throw new NotFoundError('Loyalty account not found');
  return account;
}

// ==========================================
// GET TRANSACTIONS
// ==========================================

export async function getLoyaltyTransactions(
  customerId: string,
  restaurantId: string,
  page = 1,
  limit = 20
) {
  const skip = (page - 1) * limit;
  const [transactions, total] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: { customerId, restaurantId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.loyaltyTransaction.count({ where: { customerId, restaurantId } }),
  ]);
  return { transactions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ==========================================
// ACCOUNT STATUS
// ==========================================

export async function updateLoyaltyStatus(
  customerId: string,
  restaurantId: string,
  userId: string,
  isActive: boolean,
  ipAddress?: string,
  userAgent?: string
) {
  const account = await prisma.loyaltyAccount.findFirst({ where: { customerId, restaurantId } });
  if (!account) throw new NotFoundError('Loyalty account not found');

  const updated = await prisma.loyaltyAccount.update({
    where: { id: account.id },
    data: { isActive },
  });

  await createAuditLog({
    restaurantId, userId,
    action: isActive ? 'Loyalty account activated' : 'Loyalty account deactivated',
    entityType: 'LoyaltyAccount',
    entityId: account.id,
    description: `Loyalty account ${isActive ? 'activated' : 'deactivated'}`,
    metadata: { isActive },
    ipAddress, userAgent,
  });

  return updated;
}

