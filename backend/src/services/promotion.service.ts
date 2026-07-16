import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { toDecimal, roundMoney } from './calculation.service';
import { Decimal, type Decimal as DecimalType } from '@prisma/client/runtime/library';

// ==========================================
// LIST PROMOTIONS
// ==========================================

interface PromotionFilters {
  search?: string;
  status?: string;
  type?: string;
  scope?: string;
  dateFrom?: string;
  dateTo?: string;
  autoApply?: string;
  page?: number;
  limit?: number;
}

export async function listPromotions(restaurantId: string, filters: PromotionFilters = {}) {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };
  if (filters.status) where.status = filters.status;
  if (filters.type) where.promotionType = filters.type;
  if (filters.scope) where.promotionScope = filters.scope;
  if (filters.autoApply === 'true') where.automaticallyApply = true;
  if (filters.autoApply === 'false') where.automaticallyApply = false;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.dateFrom) where.startAt = { ...where.startAt, gte: new Date(filters.dateFrom) };
  if (filters.dateTo) where.endAt = { ...where.endAt, lte: new Date(filters.dateTo + 'T23:59:59.999Z') };

  const [promotions, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      include: {
        _count: { select: { usages: true } },
        schedules: { where: { isActive: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.promotion.count({ where }),
  ]);

  return { promotions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

// ==========================================
// GET ACTIVE PROMOTIONS
// ==========================================

export async function getActivePromotions(restaurantId: string, customerId?: string, orderSubtotal?: string) {
  const now = new Date();
  const where: any = {
    restaurantId,
    status: 'ACTIVE',
    isActive: true,
    startAt: { lte: now },
    endAt: { gte: now },
  };

  const promotions = await prisma.promotion.findMany({
    where,
    include: {
      schedules: { where: { isActive: true } },
      menuItems: { include: { menuItem: { select: { id: true, name: true, code: true, price: true } } } },
      menuCategories: { include: { menuCategory: { select: { id: true, name: true } } } },
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });

  // Filter by schedule (day of week)
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const currentDay = dayNames[now.getDay()] as string;

  const filtered = promotions.filter((p) => {
    if (p.schedules.length === 0) return true;
    const matchingSchedule = p.schedules.find((s) => s.dayOfWeek === currentDay);
    if (!matchingSchedule) return false;
    // Check time window
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (matchingSchedule.startTime && nowStr < matchingSchedule.startTime) return false;
    if (matchingSchedule.endTime && nowStr > matchingSchedule.endTime) return false;
    return true;
  });

  // Check customer requirement
  const eligible = filtered.filter((p) => {
    if (p.customerRequired && !customerId) return false;
    if (p.loyaltyMembersOnly && !customerId) return false;
    if (p.minimumOrderSubtotal && orderSubtotal) {
      if (toDecimal(orderSubtotal).lessThan(toDecimal(p.minimumOrderSubtotal))) return false;
    }
    return true;
  });

  return eligible;
}

// ==========================================
// VALIDATE PROMOTION CODE
// ==========================================

export async function validateCode(restaurantId: string, code: string, customerId?: string) {
  const normalizedCode = code.trim().toUpperCase();
  const promotion = await prisma.promotion.findFirst({
    where: { restaurantId, code: normalizedCode },
    include: {
      schedules: { where: { isActive: true } },
      menuItems: { include: { menuItem: { select: { id: true, name: true, code: true, price: true } } } },
      menuCategories: { include: { menuCategory: { select: { id: true, name: true } } } },
      _count: { select: { usages: true } },
    },
  });

  if (!promotion) throw new NotFoundError('Promotion code not found');
  if (promotion.status !== 'ACTIVE' || !promotion.isActive) throw new BadRequestError('Promotion is not active');
  if (promotion.startAt > new Date()) throw new BadRequestError('Promotion has not started yet');
  if (promotion.endAt < new Date()) throw new BadRequestError('Promotion has expired');

  // Check schedules
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const now = new Date();
  const currentDay = dayNames[now.getDay()] as string;

  if (promotion.schedules.length > 0) {
    const matchingSchedule = promotion.schedules.find((s) => s.dayOfWeek === currentDay);
    if (!matchingSchedule) throw new BadRequestError('Promotion not available today');
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (matchingSchedule.startTime && nowStr < matchingSchedule.startTime) throw new BadRequestError('Promotion not active yet today');
    if (matchingSchedule.endTime && nowStr > matchingSchedule.endTime) throw new BadRequestError('Promotion has ended for today');
  }

  // Check usage limit
  if (promotion.usageLimitTotal && promotion._count.usages >= promotion.usageLimitTotal) {
    throw new BadRequestError('Promotion usage limit has been reached');
  }

  // Check customer requirement
  if (promotion.customerRequired && !customerId) throw new BadRequestError('Customer profile required for this promotion');
  if (promotion.loyaltyMembersOnly && !customerId) throw new BadRequestError('Loyalty membership required for this promotion');

  return promotion;
}

// ==========================================
// CALCULATE DISCOUNT
// ==========================================

interface DiscountCalculationInput {
  promotion: any;
  orderSubtotal: DecimalType;
  orderItems: any[];
}

export function calculatePromotionDiscount(input: DiscountCalculationInput): {
  discountAmount: DecimalType;
  eligibleItemIds: string[];
  description: string;
} {
  const { promotion, orderSubtotal, orderItems } = input;
  let discountAmount = new Decimal(0);
  let eligibleItemIds: string[] = [];

  switch (promotion.promotionType) {
    case 'PERCENTAGE_DISCOUNT': {
      const pct = toDecimal(promotion.percentageValue || 0);
      if (promotion.promotionScope === 'ORDER') {
        discountAmount = roundMoney(orderSubtotal.mul(pct).div(100));
      } else if (promotion.promotionScope === 'MENU_ITEM') {
        // Filter by eligible items
        const eligibleItems = getEligibleItems(promotion, orderItems);
        const eligibleSubtotal = eligibleItems.reduce(
          (sum: DecimalType, item: any) => sum.plus(toDecimal(item.lineSubtotal || 0)),
          new Decimal(0)
        );
        discountAmount = roundMoney(eligibleSubtotal.mul(pct).div(100));
        eligibleItemIds = eligibleItems.map((i: any) => i.id);
      } else if (promotion.promotionScope === 'MENU_CATEGORY') {
        const eligibleItems = getEligibleItemsByCategory(promotion, orderItems);
        const eligibleSubtotal = eligibleItems.reduce(
          (sum: DecimalType, item: any) => sum.plus(toDecimal(item.lineSubtotal || 0)),
          new Decimal(0)
        );
        discountAmount = roundMoney(eligibleSubtotal.mul(pct).div(100));
        eligibleItemIds = eligibleItems.map((i: any) => i.id);
      }
      break;
    }

    case 'FIXED_AMOUNT_DISCOUNT': {
      const fixed = toDecimal(promotion.fixedAmountValue || 0);
      if (promotion.promotionScope === 'ORDER') {
        discountAmount = Decimal.min(fixed, orderSubtotal);
      } else {
        const eligibleItems = getEligibleItems(promotion, orderItems);
        const subtotal = eligibleItems.reduce(
          (sum: DecimalType, item: any) => sum.plus(toDecimal(item.lineSubtotal || 0)),
          new Decimal(0)
        );
        discountAmount = Decimal.min(fixed, subtotal);
        eligibleItemIds = eligibleItems.map((i: any) => i.id);
      }
      break;
    }

    case 'FIXED_ITEM_PRICE': {
      const fixedPrice = toDecimal(promotion.fixedItemPrice || 0);
      const eligibleItems = getEligibleItems(promotion, orderItems);
      for (const item of eligibleItems) {
        const originalPrice = toDecimal(item.unitPrice || 0);
        if (fixedPrice.lessThan(originalPrice)) {
          const itemDiscount = toDecimal(item.quantity || 1).mul(originalPrice.minus(fixedPrice));
          discountAmount = discountAmount.plus(itemDiscount);
          eligibleItemIds.push(item.id);
        }
      }
      discountAmount = roundMoney(discountAmount);
      break;
    }

    case 'FREE_ITEM': {
      // Find the eligible items with the lowest price
      const eligibleItems = getEligibleItems(promotion, orderItems);
      if (eligibleItems.length > 0) {
        const freeItem = eligibleItems.reduce((min: any, item: any) =>
          toDecimal(item.unitPrice || 0).lessThan(toDecimal(min.unitPrice || 0)) ? item : min
        );
        const qty = promotion.getQuantity || 1;
        discountAmount = roundMoney(toDecimal(freeItem.unitPrice || 0).mul(Math.min(qty, freeItem.quantity)));
        eligibleItemIds = [freeItem.id];
      }
      break;
    }

    case 'BUY_X_GET_Y': {
      const buyQty = promotion.buyQuantity || 1;
      const getQty = promotion.getQuantity || 1;
      const eligibleItems = getEligibleItems(promotion, orderItems);

      for (const item of eligibleItems) {
        const itemQty = item.quantity || 0;
        const freeSets = Math.floor(itemQty / (buyQty + getQty));
        if (freeSets > 0) {
          const freeQty = Math.min(freeSets * getQty, itemQty - buyQty);
          const itemDiscount = toDecimal(item.unitPrice || 0).mul(freeQty);
          discountAmount = discountAmount.plus(itemDiscount);
          eligibleItemIds.push(item.id);
        }
      }
      discountAmount = roundMoney(discountAmount);
      break;
    }
  }

  // Apply max discount cap
  if (promotion.maximumDiscountAmount) {
    const maxDisc = toDecimal(promotion.maximumDiscountAmount);
    discountAmount = Decimal.min(discountAmount, maxDisc);
  }

  return { discountAmount, eligibleItemIds, description: `${promotion.name}${promotion.code ? ` (${promotion.code})` : ''}` };
}

function getEligibleItems(promotion: any, orderItems: any[]): any[] {
  if (promotion.promotionScope === 'ORDER') return orderItems;
  if (promotion.menuItems?.length > 0) {
    const itemIds = new Set(promotion.menuItems.map((mi: any) => mi.menuItemId));
    return orderItems.filter((item: any) => itemIds.has(item.menuItemId));
  }
  return orderItems;
}

function getEligibleItemsByCategory(promotion: any, orderItems: any[]): any[] {
  if (promotion.menuCategories?.length > 0) {
    const categoryIds = new Set(promotion.menuCategories.map((mc: any) => mc.menuCategoryId));
    return orderItems.filter((item: any) => categoryIds.has(item.menuCategoryId));
  }
  return orderItems;
}

// ==========================================
// APPLY PROMOTION TO ORDER
// ==========================================

export async function applyPromotion(
  promotionId: string,
  orderId: string,
  restaurantId: string,
  userId: string,
  code?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: {
      menuItems: true,
      menuCategories: true,
    },
  });
  if (!promotion) throw new NotFoundError('Promotion not found');
  if (promotion.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { status: { not: 'CANCELLED' } } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (['CLOSED', 'CANCELLED'].includes(order.status)) throw new BadRequestError('Cannot apply promotion to a closed or cancelled order');

  // Check stacking
  const existingDiscounts = await prisma.orderDiscount.findMany({
    where: { orderId, status: 'ACTIVE' },
  });
  if (existingDiscounts.length > 0) {
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
    if (!settings?.allowPromotionStacking && !promotion.allowStacking) {
      throw new BadRequestError('Promotion stacking is not allowed. Remove existing discounts first.');
    }
  }

  // Calculate discount
  const orderSubtotal = order.items.reduce(
    (sum: DecimalType, item: any) => sum.plus(toDecimal(item.lineSubtotal || 0)),
    new Decimal(0)
  );

  const calc = calculatePromotionDiscount({
    promotion,
    orderSubtotal,
    orderItems: order.items,
  });

  if (calc.discountAmount.isZero()) {
    throw new BadRequestError('Promotion does not apply to any items in this order');
  }

  // Check minimum subtotal
  if (promotion.minimumOrderSubtotal && orderSubtotal.lessThan(toDecimal(promotion.minimumOrderSubtotal))) {
    throw new BadRequestError(`Minimum order subtotal of ${promotion.minimumOrderSubtotal} required`);
  }

  return await prisma.$transaction(async (tx) => {
    // Create order discount
    const orderDiscount = await tx.orderDiscount.create({
      data: {
        restaurantId,
        orderId,
        source: code ? 'PROMOTION_CODE' : 'PROMOTION',
        status: 'ACTIVE',
        nameSnapshot: promotion.name,
        codeSnapshot: code || promotion.code,
        scopeSnapshot: promotion.promotionScope,
        calculationTypeSnapshot: promotion.promotionType,
        percentageValueSnapshot: promotion.percentageValue,
        fixedValueSnapshot: promotion.fixedAmountValue || promotion.fixedItemPrice,
        discountAmount: calc.discountAmount.toFixed(2),
        appliedById: userId,
        promotionId: promotion.id,
        customerId: order.customerId || null,
      },
    });

    // Create usage record
    await tx.promotionUsage.create({
      data: {
        restaurantId,
        promotionId: promotion.id,
        customerId: order.customerId || null,
        orderId,
        orderDiscountId: orderDiscount.id,
        discountAmount: calc.discountAmount.toFixed(2),
        usedAt: new Date(),
        createdById: userId,
      },
    });

    // Update promotion usage count
    await tx.promotion.update({
      where: { id: promotion.id },
      data: { currentUsageCount: promotion.currentUsageCount + 1 },
    });

    // Recalculate order totals
    const totalDiscount = existingDiscounts.reduce(
      (sum: DecimalType, d: any) => sum.plus(toDecimal(d.discountAmount)),
      new Decimal(0)
    ).plus(calc.discountAmount);

    const totalBeforeDiscount = toDecimal(order.totalBeforeDiscount || order.subtotal);
    const newTotalAmount = Decimal.max(0, totalBeforeDiscount.minus(totalDiscount));

    await tx.order.update({
      where: { id: orderId },
      data: {
        discountAmount: totalDiscount.toFixed(2),
        totalAmount: newTotalAmount.toFixed(2),
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'Promotion applied',
      entityType: 'OrderDiscount',
      entityId: orderDiscount.id,
      description: `${promotion.name} applied to order ${order.orderNumber}: ${calc.discountAmount.toFixed(2)}`,
      metadata: {
        orderNumber: order.orderNumber,
        promotionName: promotion.name,
        discountAmount: calc.discountAmount.toFixed(2),
        code: code || promotion.code,
      },
      ipAddress, userAgent,
    });

    return {
      orderDiscount,
      discountAmount: calc.discountAmount,
      newTotal: newTotalAmount,
      totalDiscount,
    };
  });
}

// ==========================================
// AUTO-APPLY ELIGIBLE PROMOTIONS
// ==========================================

export async function autoApplyPromotions(
  orderId: string,
  restaurantId: string,
  userId: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { where: { status: { not: 'CANCELLED' } } } },
  });
  if (!order) return [];

  const orderSubtotal = order.items.reduce(
    (sum: DecimalType, item: any) => sum.plus(toDecimal(item.lineSubtotal || 0)),
    new Decimal(0)
  );

  const autoPromotions = await getActivePromotions(restaurantId, order.customerId || undefined, orderSubtotal.toFixed(2));
  const autoApplyPromotions = autoPromotions.filter((p) => p.automaticallyApply);

  const results = [];
  for (const promotion of autoApplyPromotions) {
    try {
      const result = await applyPromotion(promotion.id, orderId, restaurantId, userId);
      results.push(result);
    } catch (err) {
      console.error(`Failed to auto-apply promotion ${promotion.name}:`, err);
    }
  }

  return results;
}

// ==========================================
// REMOVE DISCOUNT
// ==========================================

export async function removeDiscount(
  discountId: string,
  restaurantId: string,
  userId: string,
  reason?: string,
  ipAddress?: string,
  userAgent?: string
) {
  const discount = await prisma.orderDiscount.findFirst({
    where: { id: discountId, restaurantId },
  });
  if (!discount) throw new NotFoundError('Discount not found');
  if (discount.status !== 'ACTIVE') throw new BadRequestError('Discount is not active');

  const order = await prisma.order.findUnique({ where: { id: discount.orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.status === 'CLOSED') throw new BadRequestError('Cannot remove discount from a closed order');

  return await prisma.$transaction(async (tx) => {
    await tx.orderDiscount.update({
      where: { id: discountId },
      data: {
        status: 'REMOVED',
        removedAt: new Date(),
        removedById: userId,
        removalReason: reason || null,
      },
    });

    // Recalculate totals
    const activeDiscounts = await tx.orderDiscount.findMany({
      where: { orderId: discount.orderId, status: 'ACTIVE' },
    });
    const remainingDiscount = activeDiscounts.reduce(
      (sum: DecimalType, d: any) => sum.plus(toDecimal(d.discountAmount)),
      new Decimal(0)
    );

    const totalBeforeDiscount = toDecimal(order.totalBeforeDiscount || order.subtotal);
    const newTotalAmount = Decimal.max(0, totalBeforeDiscount.minus(remainingDiscount));

    await tx.order.update({
      where: { id: discount.orderId },
      data: {
        discountAmount: remainingDiscount.toFixed(2),
        totalAmount: newTotalAmount.toFixed(2),
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'Discount removed',
      entityType: 'OrderDiscount',
      entityId: discountId,
      description: `Discount ${discount.nameSnapshot} removed from order ${order.orderNumber}`,
      metadata: { orderNumber: order.orderNumber, discountName: discount.nameSnapshot, reason },
      ipAddress, userAgent,
    });

    return await tx.order.findUnique({ where: { id: discount.orderId } });
  });
}

// ==========================================
// MANUAL DISCOUNT
// ==========================================

interface ManualDiscountInput {
  orderId: string;
  orderItemId?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  reason: string;
  source: string;
  requiresApproval?: boolean;
}

export async function applyManualDiscount(
  restaurantId: string,
  userId: string,
  input: ManualDiscountInput,
  userRoles: string[],
  ipAddress?: string,
  userAgent?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { items: { where: { status: { not: 'CANCELLED' } } } },
  });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (['CLOSED', 'CANCELLED'].includes(order.status)) throw new BadRequestError('Cannot discount a closed or cancelled order');

  const isAdmin = userRoles.includes('ADMIN');
  const isManager = userRoles.includes('MANAGER');
  const isWaiter = userRoles.includes('WAITER');
  const isCashier = userRoles.includes('CASHIER');

  // Check permissions
  if (isWaiter || isCashier) {
    // Need approval
    if (!input.requiresApproval && input.requiresApproval !== false) {
      // Create discount request
      return await createDiscountRequest(restaurantId, userId, input);
    }
  }

  if (!isAdmin && !isManager && !isWaiter && !isCashier) {
    throw new ForbiddenError('No discount permission');
  }

  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });

  // Check stacking with promotions
  if (!settings?.allowManualDiscountWithPromotions) {
    const activePromotions = await prisma.orderDiscount.findFirst({
      where: { orderId: input.orderId, source: 'PROMOTION', status: 'ACTIVE' },
    });
    if (activePromotions) {
      throw new BadRequestError('Cannot apply manual discount when promotion is active');
    }
  }

  // Calculate discount amount
  let discountAmount: DecimalType;
  const orderSubtotal = order.items.reduce(
    (sum: DecimalType, item: any) => sum.plus(toDecimal(item.lineSubtotal || 0)),
    new Decimal(0)
  );

  if (input.discountType === 'PERCENTAGE') {
    const pct = toDecimal(Math.min(input.value, 100));
    const eligibleTotal = input.orderItemId
      ? order.items
          .filter((i: any) => i.id === input.orderItemId)
          .reduce((sum: Decimal, i: any) => sum.plus(toDecimal(i.lineSubtotal || 0)), new Decimal(0))
      : orderSubtotal;
    discountAmount = roundMoney(eligibleTotal.mul(pct).div(100));
  } else {
    discountAmount = roundMoney(toDecimal(input.value));
    const eligibleTotal = input.orderItemId
      ? order.items.filter((i: any) => i.id === input.orderItemId)
          .reduce((sum: Decimal, i: any) => sum.plus(toDecimal(i.lineSubtotal || 0)), new Decimal(0))
      : orderSubtotal;
    discountAmount = Decimal.min(discountAmount, eligibleTotal);
  }

  // Check max total discount
  const existingDiscounts = await prisma.orderDiscount.findMany({
    where: { orderId: input.orderId, status: 'ACTIVE' },
  });
  const existingTotal = existingDiscounts.reduce(
    (sum: DecimalType, d: any) => sum.plus(toDecimal(d.discountAmount)),
    new Decimal(0)
  );
  const totalDiscount = existingTotal.plus(discountAmount);

  if (settings?.maximumTotalDiscountPercentage) {
    const maxDiscPct = toDecimal(settings.maximumTotalDiscountPercentage).div(100);
    const maxDiscount = roundMoney(orderSubtotal.mul(maxDiscPct));
    if (totalDiscount.greaterThan(maxDiscount)) {
      throw new BadRequestError(`Total discount would exceed maximum of ${maxDiscount.toFixed(2)}`);
    }
  }

  return await prisma.$transaction(async (tx) => {
    const discount = await tx.orderDiscount.create({
      data: {
        restaurantId,
        orderId: input.orderId,
        orderItemId: input.orderItemId || null,
        source: input.source as any,
        status: 'ACTIVE',
        nameSnapshot: 'Manual Discount',
        scopeSnapshot: input.orderItemId ? 'MENU_ITEM' : 'ORDER',
        calculationTypeSnapshot: input.discountType,
        percentageValueSnapshot: input.discountType === 'PERCENTAGE' ? input.value : null,
        fixedValueSnapshot: input.discountType === 'FIXED_AMOUNT' ? input.value : null,
        discountAmount: discountAmount.toFixed(2),
        reason: input.reason,
        appliedById: userId,
        approvedById: isAdmin || isManager ? userId : null,
      },
    });

    const newTotalAmount = Decimal.max(0, toDecimal(order.totalBeforeDiscount || order.subtotal).minus(totalDiscount));

    await tx.order.update({
      where: { id: input.orderId },
      data: {
        discountAmount: totalDiscount.toFixed(2),
        totalAmount: newTotalAmount.toFixed(2),
      },
    });

    await createAuditLog({
      restaurantId, userId,
      action: 'Manual discount applied',
      entityType: 'OrderDiscount',
      entityId: discount.id,
      description: `Discount of ${discountAmount.toFixed(2)} applied to order ${order.orderNumber}: ${input.reason}`,
      metadata: {
        orderNumber: order.orderNumber,
        discountAmount: discountAmount.toFixed(2),
        discountType: input.discountType,
        reason: input.reason,
        requiresApproval: isWaiter || isCashier,
      },
      ipAddress, userAgent,
    });

    return discount;
  });
}

// ==========================================
// DISCOUNT REQUESTS
// ==========================================

export async function createDiscountRequest(
  restaurantId: string,
  userId: string,
  input: ManualDiscountInput
) {
  const request = await prisma.discountRequest.create({
    data: {
      restaurantId,
      orderId: input.orderId,
      orderItemId: input.orderItemId || null,
      requestedById: userId,
      discountType: input.discountType,
      percentageValue: input.discountType === 'PERCENTAGE' ? input.value : null,
      fixedAmountValue: input.discountType === 'FIXED_AMOUNT' ? input.value : null,
      reason: input.reason,
    },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'Manual discount requested',
    entityType: 'DiscountRequest',
    entityId: request.id,
    description: `Discount of ${input.value}${input.discountType === 'PERCENTAGE' ? '%' : ''} requested for order`,
    metadata: {
      orderId: input.orderId,
      discountType: input.discountType,
      value: input.value,
      reason: input.reason,
    },
  });

  return request;
}

export async function approveDiscountRequest(
  requestId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const request = await prisma.discountRequest.findFirst({
    where: { id: requestId, restaurantId },
  });
  if (!request) throw new NotFoundError('Discount request not found');
  if (request.status !== 'PENDING') throw new BadRequestError('Request is not pending');
  if (request.requestedById === userId) throw new BadRequestError('Cannot approve your own request');

  const updated = await prisma.discountRequest.update({
    where: { id: requestId },
    data: { status: 'APPROVED', reviewedById: userId, reviewedAt: new Date() },
  });

  // Apply the discount
  const result = await applyManualDiscount(restaurantId, userId, {
    orderId: request.orderId,
    orderItemId: request.orderItemId || undefined,
    discountType: request.discountType as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: Number(request.percentageValue || request.fixedAmountValue || 0),
    reason: request.reason,
    source: 'MANUAL_MANAGER_DISCOUNT',
    requiresApproval: false,
  }, ['ADMIN', 'MANAGER'], ipAddress, userAgent);

  await createAuditLog({
    restaurantId, userId,
    action: 'Discount request approved',
    entityType: 'DiscountRequest',
    entityId: requestId,
    description: 'Manual discount request approved',
    metadata: { requestId },
    ipAddress, userAgent,
  });

  return { request: updated, discount: result };
}

export async function rejectDiscountRequest(
  requestId: string,
  restaurantId: string,
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
) {
  const request = await prisma.discountRequest.findFirst({
    where: { id: requestId, restaurantId },
  });
  if (!request) throw new NotFoundError('Discount request not found');
  if (request.status !== 'PENDING') throw new BadRequestError('Request is not pending');
  if (request.requestedById === userId) throw new BadRequestError('Cannot reject your own request');

  const updated = await prisma.discountRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', reviewedById: userId, reviewedAt: new Date(), reviewReason: reason },
  });

  await createAuditLog({
    restaurantId, userId,
    action: 'Discount request rejected',
    entityType: 'DiscountRequest',
    entityId: requestId,
    description: `Discount request rejected: ${reason}`,
    metadata: { requestId, reason },
    ipAddress, userAgent,
  });

  return updated;
}

export async function listDiscountRequests(restaurantId: string, status?: string) {
  const where: any = { restaurantId };
  if (status) where.status = status;

  return await prisma.discountRequest.findMany({
    where,
    include: {
      order: { select: { orderNumber: true, status: true, totalAmount: true } },
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// ==========================================
// PROMOTION CRUD
// ==========================================

interface CreatePromotionInput {
  name: string;
  code?: string;
  description?: string;
  promotionType: string;
  promotionScope: string;
  percentageValue?: number;
  fixedAmountValue?: number;
  fixedItemPrice?: number;
  buyQuantity?: number;
  getQuantity?: number;
  minimumOrderSubtotal?: number;
  maximumDiscountAmount?: number;
  startAt: string;
  endAt: string;
  usageLimitTotal?: number;
  usageLimitPerCustomer?: number;
  customerRequired?: boolean;
  loyaltyMembersOnly?: boolean;
  automaticallyApply?: boolean;
  allowStacking?: boolean;
  priority?: number;
  schedules?: { dayOfWeek: string; startTime?: string; endTime?: string }[];
  menuItemIds?: string[];
  menuCategoryIds?: string[];
}

export async function createPromotion(
  restaurantId: string,
  userId: string,
  input: CreatePromotionInput,
  ipAddress?: string,
  userAgent?: string
) {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (endAt <= startAt) throw new BadRequestError('End time must be after start time');

  // Validate type-specific requirements
  switch (input.promotionType) {
    case 'PERCENTAGE_DISCOUNT':
      if (!input.percentageValue || input.percentageValue <= 0 || input.percentageValue > 100) {
        throw new BadRequestError('Percentage must be between 1 and 100');
      }
      break;
    case 'FIXED_AMOUNT_DISCOUNT':
      if (!input.fixedAmountValue || input.fixedAmountValue <= 0) {
        throw new BadRequestError('Fixed amount must be greater than 0');
      }
      break;
    case 'FIXED_ITEM_PRICE':
      if (!input.fixedItemPrice || input.fixedItemPrice < 0) {
        throw new BadRequestError('Fixed item price must be non-negative');
      }
      break;
    case 'BUY_X_GET_Y':
      if (!input.buyQuantity || !input.getQuantity || input.buyQuantity < 1 || input.getQuantity < 1) {
        throw new BadRequestError('Buy and get quantities must be at least 1');
      }
      break;
    case 'FREE_ITEM':
      if (!input.getQuantity) input.getQuantity = 1;
      break;
  }

  const promotion = await prisma.promotion.create({
    data: {
      restaurantId,
      name: input.name,
      code: input.code?.toUpperCase() || null,
      description: input.description,
      promotionType: input.promotionType as any,
      promotionScope: input.promotionScope as any,
      percentageValue: input.percentageValue || null,
      fixedAmountValue: input.fixedAmountValue || null,
      fixedItemPrice: input.fixedItemPrice || null,
      buyQuantity: input.buyQuantity || null,
      getQuantity: input.getQuantity || null,
      minimumOrderSubtotal: input.minimumOrderSubtotal || null,
      maximumDiscountAmount: input.maximumDiscountAmount || null,
      startAt,
      endAt,
      usageLimitTotal: input.usageLimitTotal || null,
      usageLimitPerCustomer: input.usageLimitPerCustomer || null,
      customerRequired: input.customerRequired || false,
      loyaltyMembersOnly: input.loyaltyMembersOnly || false,
      automaticallyApply: input.automaticallyApply || false,
      allowStacking: input.allowStacking || false,
      priority: input.priority || 0,
      createdById: userId,
    },
  });

  // Create schedules
  if (input.schedules?.length) {
    await prisma.promotionSchedule.createMany({
      data: input.schedules.map((s) => ({
        promotionId: promotion.id,
        dayOfWeek: s.dayOfWeek as any,
        startTime: s.startTime || null,
        endTime: s.endTime || null,
      })),
    });
  }

  // Create menu item links
  if (input.menuItemIds?.length) {
    await prisma.promotionMenuItem.createMany({
      data: input.menuItemIds.map((menuItemId) => ({
        promotionId: promotion.id,
        menuItemId,
      })),
    });
  }

  // Create menu category links
  if (input.menuCategoryIds?.length) {
    await prisma.promotionMenuCategory.createMany({
      data: input.menuCategoryIds.map((menuCategoryId) => ({
        promotionId: promotion.id,
        menuCategoryId,
      })),
    });
  }

  await createAuditLog({
    restaurantId, userId,
    action: 'Promotion created',
    entityType: 'Promotion',
    entityId: promotion.id,
    description: `Promotion ${input.name} created`,
    metadata: { name: input.name, type: input.promotionType },
    ipAddress, userAgent,
  });

  return await prisma.promotion.findUnique({
    where: { id: promotion.id },
    include: { schedules: true, menuItems: true, menuCategories: true },
  });
}

export async function updatePromotionStatus(
  promotionId: string,
  restaurantId: string,
  userId: string,
  status: string,
  ipAddress?: string,
  userAgent?: string
) {
  const promotion = await prisma.promotion.findFirst({ where: { id: promotionId, restaurantId } });
  if (!promotion) throw new NotFoundError('Promotion not found');

  const updated = await prisma.promotion.update({
    where: { id: promotionId },
    data: { status: status as any },
  });

  await createAuditLog({
    restaurantId, userId,
    action: `Promotion ${status.toLowerCase()}`,
    entityType: 'Promotion',
    entityId: promotionId,
    description: `Promotion ${promotion.name} ${status.toLowerCase()}`,
    metadata: { name: promotion.name, previousStatus: promotion.status, newStatus: status },
    ipAddress, userAgent,
  });

  return updated;
}

export async function duplicatePromotion(
  promotionId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const original = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: { schedules: true, menuItems: true, menuCategories: true },
  });
  if (!original) throw new NotFoundError('Promotion not found');

  const data = {
    ...original,
    id: undefined,
    name: `${original.name} (Copy)`,
    status: 'DRAFT' as const,
    currentUsageCount: 0,
    createdById: userId,
    schedules: undefined,
    menuItems: undefined,
    menuCategories: undefined,
  };

  const match = await prisma.promotion.create({ data: data as any });
  return match;
}

