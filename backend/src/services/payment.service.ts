import { Decimal, type Decimal as DecimalType } from '@prisma/client/runtime/library';
import { prisma } from '../database';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { toDecimal, roundMoney } from './calculation.service';
import { linkCashPaymentToSession, linkCashRefundToSession } from './cashier.service';

// ==========================================
// PAYMENT CALCULATION
// ==========================================

interface PaymentSummary {
  orderTotal: DecimalType;
  completedPayments: DecimalType;
  totalRefunds: DecimalType;
  netPaid: DecimalType;
  amountDue: DecimalType;
  paymentStatus: string;
}

export async function calculatePaymentSummary(orderId: string): Promise<PaymentSummary> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: {
          status: { in: ['COMPLETED'] },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const orderTotal = toDecimal(order.totalAmount);

  const completedPayments = order.payments
    .filter((p) => p.transactionType === 'PAYMENT')
    .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));

  const totalRefunds = order.payments
    .filter((p) => p.transactionType === 'REFUND')
    .reduce((sum, p) => sum.plus(toDecimal(p.amount)), new Decimal(0));

  const netPaid = completedPayments.minus(totalRefunds);
  const amountDue = Decimal.max(0, orderTotal.minus(netPaid));

  let paymentStatus: string;
  if (amountDue.isZero() && netPaid.isZero()) {
    paymentStatus = 'UNPAID';
  } else if (amountDue.isZero() && netPaid.greaterThan(0)) {
    paymentStatus = 'PAID';
  } else if (netPaid.greaterThan(0) && amountDue.greaterThan(0)) {
    paymentStatus = 'PARTIALLY_PAID';
  } else if (totalRefunds.greaterThan(0) && completedPayments.isZero()) {
    paymentStatus = 'REFUNDED';
  } else if (totalRefunds.greaterThan(0) && completedPayments.greaterThan(0)) {
    paymentStatus = 'PARTIALLY_REFUNDED';
  } else {
    paymentStatus = 'UNPAID';
  }

  return {
    orderTotal: roundMoney(orderTotal),
    completedPayments: roundMoney(completedPayments),
    totalRefunds: roundMoney(totalRefunds),
    netPaid: roundMoney(netPaid),
    amountDue: roundMoney(amountDue),
    paymentStatus,
  };
}

export async function recalcAndUpdatePaymentStatus(orderId: string): Promise<void> {
  const summary = await calculatePaymentSummary(orderId);
  const dbStatus = mapPaymentStatusToEnum(summary.paymentStatus);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      amountPaid: summary.netPaid.toFixed(2),
      amountDue: summary.amountDue.toFixed(2),
      paymentStatus: dbStatus as any,
    },
  });
}

function mapPaymentStatusToEnum(status: string): string {
  const map: Record<string, string> = {
    UNPAID: 'UNPAID',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    REFUNDED: 'REFUNDED',
  };
  return map[status] || 'UNPAID';
}

// ==========================================
// ELIGIBILITY CHECKING
// ==========================================

async function validateOrderEligibility(orderId: string, restaurantId: string, allowPaymentBeforeServing: boolean): Promise<{
  order: any;
  settings: any;
}> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { where: { status: { not: 'CANCELLED' } } },
      restaurant: { include: { settings: true } },
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  if (order.restaurantId !== restaurantId) {
    throw new ForbiddenError('Order belongs to another restaurant');
  }

  if (order.status === 'DRAFT') {
    throw new BadRequestError('Cannot process payment for a draft order');
  }

  if (order.status === 'CANCELLED') {
    throw new BadRequestError('Cannot process payment for a cancelled order');
  }

  if (order.status === 'CLOSED') {
    throw new BadRequestError('Order is already closed');
  }

  // Check serving status
  if (!allowPaymentBeforeServing) {
    if (order.status !== 'SERVED') {
      throw new BadRequestError('Order must be fully served before payment');
    }
  }

  const summary = await calculatePaymentSummary(orderId);

  if (summary.amountDue.isZero() && summary.netPaid.greaterThan(0)) {
    throw new BadRequestError('Order is already fully paid');
  }

  return { order, settings: order.restaurant.settings };
}

// ==========================================
// RECORD PAYMENT
// ==========================================

interface RecordPaymentInput {
  method: string;
  amount: string;
  amountTendered?: string;
  referenceNumber?: string;
  providerName?: string;
  notes?: string;
  idempotencyKey?: string;
  userId: string;
  restaurantId: string;
  ipAddress?: string;
  userAgent?: string;
  // Optional tip that will be auto-recorded after payment
  tipAmount?: string;
  tipMethod?: string;
  tipRecipientId?: string;
}

export async function recordPayment(
  orderId: string,
  input: RecordPaymentInput
): Promise<any> {
  // Check idempotency
  if (input.idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return await getOrderPaymentSummary(orderId);
    }
  }

  // Validate order eligibility
  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: input.restaurantId },
  });

  const { order } = await validateOrderEligibility(
    orderId,
    input.restaurantId,
    settings?.allowPaymentBeforeServing ?? false
  );

  const summary = await calculatePaymentSummary(orderId);
  const amount = toDecimal(input.amount);

  // Validate amount
  if (amount.isZero() || amount.isNegative()) {
    throw new BadRequestError('Payment amount must be greater than zero');
  }

  if (amount.greaterThan(summary.amountDue)) {
    throw new BadRequestError('Payment amount cannot exceed amount due');
  }

  // Check partial payments setting
  if (amount.lessThan(summary.amountDue) && !settings?.allowPartialPayments) {
    throw new BadRequestError('Partial payments are not enabled');
  }

  // Validate cash
  let changeAmount = new Decimal(0);
  if (input.method === 'CASH') {
    const tendered = input.amountTendered ? toDecimal(input.amountTendered) : amount;
    if (tendered.lessThan(amount)) {
      throw new BadRequestError('Amount tendered must be at least the payment amount');
    }
    changeAmount = tendered.minus(amount);
  } else {
    // Non-cash overpayment prevention
    if (amount.greaterThan(summary.amountDue)) {
      throw new BadRequestError('Non-cash payment cannot exceed amount due');
    }
  }

  // Validate references based on settings
  if (input.method === 'CARD' && settings?.requireReferenceForCard && !input.referenceNumber) {
    throw new BadRequestError('Reference number is required for card payments');
  }
  if (input.method === 'MOBILE_MONEY' && settings?.requireReferenceForMobileMoney && !input.referenceNumber) {
    throw new BadRequestError('Reference number is required for mobile money payments');
  }
  if (input.method === 'BANK_TRANSFER' && settings?.requireReferenceForBankTransfer && !input.referenceNumber) {
    throw new BadRequestError('Reference number is required for bank transfers');
  }

  // Cash payment session integration
  let cashierSessionId: string | undefined;
  if (input.method === 'CASH' && settings?.requireOpenCashierSessionForCashPayments) {
    const activeSession = await prisma.cashierSession.findFirst({
      where: {
        cashierId: input.userId,
        restaurantId: input.restaurantId,
        status: 'OPEN',
      },
      orderBy: { openedAt: 'desc' },
    });
    if (!activeSession) {
      throw new BadRequestError('An active cashier session is required to record cash payments');
    }
    cashierSessionId = activeSession.id;
  }

  const payment = await prisma.$transaction(async (tx) => {
    // Get restaurant timezone
    const restaurant = await tx.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { timezone: true },
    });

    const paymentNumber = await generateSequenceNumber(
      input.restaurantId,
      'PAYMENT',
      'PAY',
      restaurant?.timezone ?? 'UTC'
    );

    const payment = await tx.payment.create({
      data: {
        restaurantId: input.restaurantId,
        orderId,
        paymentNumber,
        transactionType: 'PAYMENT',
        method: input.method as any,
        status: 'COMPLETED',
        amount: amount.toFixed(2),
        amountTendered: input.amountTendered || null,
        changeAmount: changeAmount.toFixed(2),
        cashierSessionId: cashierSessionId || null,
        referenceNumber: input.referenceNumber || null,
        providerName: input.providerName || null,
        notes: input.notes || null,
        receivedById: input.userId,
        idempotencyKey: input.idempotencyKey || null,
        completedAt: new Date(),
      },
    });

    return payment;
  });

  // Create cash drawer movement after transaction
  if (cashierSessionId && input.method === 'CASH') {
    try {
      await linkCashPaymentToSession(payment.id, input.restaurantId, cashierSessionId);
    } catch (err) {
      console.error('Failed to link cash payment to session:', err);
    }
  }

  // Recalculate order payment status
  await recalcAndUpdatePaymentStatus(orderId);

  // Handle order closing if fully paid
  const updatedSummary = await calculatePaymentSummary(orderId);
  if (updatedSummary.amountDue.isZero() && updatedSummary.paymentStatus === 'PAID') {
    const allServed = await allItemsServed(orderId);
    if (allServed) {
      await closeOrder(orderId, input.userId, input.restaurantId, undefined, input.ipAddress, input.userAgent);
      // Generate receipt on closure
      try {
        const { generateReceipt } = await import('./receipt.service');
        await generateReceipt(orderId, input.userId, input.restaurantId, input.ipAddress, input.userAgent);
      } catch { /* Receipt may already exist */ }
    }
  }

  // Auto-record tip if tip amount provided
  let recordedTip = null;
  if (input.tipAmount && parseFloat(input.tipAmount) > 0) {
    try {
      const { recordTip } = await import('./tip.service');
      const { emitTipRecorded } = await import('../sockets');
      const { io } = await import('../server');
      recordedTip = await recordTip({
        orderId,
        amount: input.tipAmount,
        paymentMethod: input.tipMethod || input.method,
        paymentId: payment.id,
        directRecipientUserId: input.tipRecipientId || order.waiterId,
        recordedById: input.userId,
        restaurantId: input.restaurantId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      emitTipRecorded(io, input.restaurantId, input.userId, { tip: recordedTip, orderNumber: order.orderNumber });
    } catch (err) {
      console.error('Failed to auto-record tip:', err);
    }
  }

  // Create notification for order's waiter about payment received
  try {
    const { createNotification, emitNotification } = await import('./notification.service');

    if (order.waiterId) {
      const notif = await createNotification({
        restaurantId: input.restaurantId,
        userId: order.waiterId,
        type: 'PAYMENT_RECEIVED',
        title: `Payment Received — Order #${order.orderNumber}`,
        message: `${input.method} payment of ${amount.toFixed(2)} received`,
        orderId,
        entityType: 'order',
        entityId: orderId,
      });
      if (notif) await emitNotification(notif);
    }
  } catch (err) { console.error('Failed to create payment notification:', err); }

  // Audit
  await createAuditLog({
    restaurantId: input.restaurantId,
    userId: input.userId,
    action: 'Payment created',
    entityType: 'Payment',
    entityId: payment.id,
    description: `${input.method} payment of ${amount.toFixed(2)} recorded for order ${order.orderNumber}${recordedTip ? ` with tip ${recordedTip.tipNumber}` : ''}`,
    metadata: {
      paymentNumber: payment.paymentNumber,
      orderNumber: order.orderNumber,
      method: input.method,
      amount: amount.toFixed(2),
      changeAmount: changeAmount.toFixed(2),
      paymentStatus: updatedSummary.paymentStatus,
      tipAmount: input.tipAmount || null,
      tipNumber: recordedTip?.tipNumber || null,
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return await getOrderPaymentSummary(orderId);
}

// ==========================================
// SPLIT PAYMENT
// ==========================================

interface SplitPaymentEntry {
  method: string;
  amount: string;
  amountTendered?: string;
  referenceNumber?: string;
  providerName?: string;
  notes?: string;
}

export async function recordSplitPayment(
  orderId: string,
  payments: SplitPaymentEntry[],
  input: {
    userId: string;
    restaurantId: string;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<any> {
  if (!payments || payments.length < 2) {
    throw new BadRequestError('Split payment requires at least 2 payment entries');
  }

  const settings = await prisma.restaurantSettings.findUnique({
    where: { restaurantId: input.restaurantId },
  });

  if (!settings?.allowSplitPayments) {
    throw new BadRequestError('Split payments are not enabled');
  }

  // Validate order eligibility once
  const { order } = await validateOrderEligibility(
    orderId,
    input.restaurantId,
    settings?.allowPaymentBeforeServing ?? false
  );

  const summary = await calculatePaymentSummary(orderId);

  // Validate combined total
  const combinedAmount = payments.reduce(
    (sum, p) => sum.plus(toDecimal(p.amount)),
    new Decimal(0)
  );

  if (combinedAmount.greaterThan(summary.amountDue)) {
    throw new BadRequestError('Combined payment amount exceeds amount due');
  }

  if (combinedAmount.lessThan(summary.amountDue)) {
    // Partial split - allowed only if partial payments enabled
    if (!settings?.allowPartialPayments) {
      throw new BadRequestError('Partial payments are not enabled');
    }
  }
  // Check for cash session requirement
  let cashierSessionId: string | undefined;
  if (settings?.requireOpenCashierSessionForCashPayments) {
    const hasCashPayment = payments.some((p) => p.method === 'CASH');
    if (hasCashPayment) {
      const activeSession = await prisma.cashierSession.findFirst({
        where: {
          cashierId: input.userId,
          restaurantId: input.restaurantId,
          status: 'OPEN',
        },
        orderBy: { openedAt: 'desc' },
      });
      if (!activeSession) {
        throw new BadRequestError('An active cashier session is required to record cash payments');
      }
      cashierSessionId = activeSession.id;
    }
  }

  const createdPayments = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { timezone: true },
    });

    const paymentRecords: any[] = [];

    for (const entry of payments) {
      const amount = toDecimal(entry.amount);

      if (amount.isZero() || amount.isNegative()) {
        throw new BadRequestError('Each payment amount must be greater than zero');
      }

      let changeAmount = new Decimal(0);
      if (entry.method === 'CASH') {
        const tendered = entry.amountTendered ? toDecimal(entry.amountTendered) : amount;
        if (tendered.lessThan(amount)) {
          throw new BadRequestError('Cash amount tendered must be at least the payment amount');
        }
        changeAmount = tendered.minus(amount);
      }

      const paymentNumber = await generateSequenceNumber(
        input.restaurantId,
        'PAYMENT',
        'PAY',
        restaurant?.timezone ?? 'UTC'
      );

      const payment = await tx.payment.create({
        data: {
          restaurantId: input.restaurantId,
          orderId,
          paymentNumber,
          transactionType: 'PAYMENT',
          method: entry.method as any,
          status: 'COMPLETED',
          amount: entry.amount,
          amountTendered: entry.amountTendered || null,
          changeAmount: changeAmount.toFixed(2),
          cashierSessionId: cashierSessionId || null,
          referenceNumber: entry.referenceNumber || null,
          providerName: entry.providerName || null,
          notes: entry.notes || null,
          receivedById: input.userId,
          completedAt: new Date(),
        },
      });

      paymentRecords.push(payment);
    }

    return paymentRecords;
  });

  // Create cash drawer movements for cash payments
  if (cashierSessionId) {
    for (const p of createdPayments) {
      if (p.method === 'CASH') {
        try {
          await linkCashPaymentToSession(p.id, input.restaurantId, cashierSessionId);
        } catch (err) {
          console.error('Failed to link cash payment to session:', err);
        }
      }
    }
  }

  // Recalculate
  await recalcAndUpdatePaymentStatus(orderId);

  const updatedSummary = await calculatePaymentSummary(orderId);
  if (updatedSummary.amountDue.isZero() && updatedSummary.paymentStatus === 'PAID') {
    const allServed = await allItemsServed(orderId);
    if (allServed) {
      await closeOrder(orderId, input.userId, input.restaurantId);
    }
  }

  // Audit
  await createAuditLog({
    restaurantId: input.restaurantId,
    userId: input.userId,
    action: 'Split payment completed',
    entityType: 'Order',
    entityId: orderId,
    description: `Split payment of ${combinedAmount.toFixed(2)} recorded (${payments.length} methods)`,
    metadata: {
      orderNumber: order.orderNumber,
      paymentCount: payments.length,
      combinedAmount: combinedAmount.toFixed(2),
      methods: payments.map((p) => p.method),
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return await getOrderPaymentSummary(orderId);
}

// ==========================================
// PAYMENT REQUESTS
// ==========================================

export async function requestPayment(
  orderId: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (order.status === 'DRAFT' || order.status === 'CANCELLED' || order.status === 'CLOSED') {
    throw new BadRequestError('Order is not eligible for payment request');
  }

  const existing = await prisma.paymentRequest.findUnique({ where: { orderId } });
  if (existing) {
    return existing;
  }

  const request = await prisma.paymentRequest.create({
    data: {
      restaurantId,
      orderId,
      requestedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Payment requested',
    entityType: 'Order',
    entityId: orderId,
    description: `Payment requested for order ${order.orderNumber}`,
    metadata: { orderNumber: order.orderNumber },
    ipAddress,
    userAgent,
  });

  return request;
}

export async function cancelPaymentRequest(
  orderId: string,
  userId: string,
  restaurantId: string
): Promise<void> {
  const request = await prisma.paymentRequest.findUnique({ where: { orderId } });
  if (!request) return;

  await prisma.paymentRequest.update({
    where: { orderId },
    data: {
      cancelledAt: new Date(),
      cancelledById: userId,
    },
  });
}

// ==========================================
// VOID PAYMENT
// ==========================================

export async function voidPayment(
  paymentId: string,
  reason: string,
  userId: string,
  restaurantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (payment.status === 'VOIDED') throw new BadRequestError('Payment is already voided');
  if (payment.status === 'FAILED') throw new BadRequestError('Cannot void a failed payment');

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'VOIDED',
        voidedAt: new Date(),
        voidedById: userId,
        voidReason: reason,
      },
    });

    // Create reversal record
    await tx.payment.create({
      data: {
        restaurantId,
        orderId: payment.orderId,
        paymentNumber: `VOID-${payment.paymentNumber}`,
        transactionType: 'REVERSAL',
        method: payment.method,
        status: 'COMPLETED',
        amount: payment.amount,
        notes: `Void of payment ${payment.paymentNumber}: ${reason}`,
        receivedById: userId,
        parentPaymentId: paymentId,
        completedAt: new Date(),
      },
    });
  });

  await recalcAndUpdatePaymentStatus(payment.orderId);

  // Check if order needs to be reopened
  const order = await prisma.order.findUnique({ where: { id: payment.orderId } });
  if (order?.status === 'CLOSED') {
    await prisma.order.update({
      where: { id: payment.orderId },
      data: {
        status: 'SERVED',
        closedAt: null,
        closedById: null,
      },
    });
  }

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Payment voided',
    entityType: 'Payment',
    entityId: paymentId,
    description: `Payment ${payment.paymentNumber} voided: ${reason}`,
    metadata: {
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      reason,
    },
    ipAddress,
    userAgent,
  });

  return await getOrderPaymentSummary(payment.orderId);
}

// ==========================================
// REFUND
// ==========================================

export async function issueRefund(
  paymentId: string,
  refundAmount: string,
  method: string,
  reason: string,
  userId: string,
  restaurantId: string,
  referenceNumber?: string,
  notes?: string,
  idempotencyKey?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  if (idempotencyKey) {
    const existing = await prisma.payment.findFirst({
      where: { idempotencyKey },
    });
    if (existing) {
      return await getOrderPaymentSummary((await prisma.payment.findUnique({ where: { id: paymentId }, select: { orderId: true } }))!.orderId);
    }
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (payment.status === 'FAILED' || payment.status === 'VOIDED') {
    throw new BadRequestError('Cannot refund a failed or voided payment');
  }

  // Calculate refundable amount
  const refunds = await prisma.payment.findMany({
    where: {
      parentPaymentId: paymentId,
      transactionType: 'REFUND',
      status: 'COMPLETED',
    },
  });

  const totalRefunded = refunds.reduce(
    (sum, r) => sum.plus(toDecimal(r.amount)),
    new Decimal(0)
  );

  const refundableAmount = toDecimal(payment.amount).minus(totalRefunded);
  const refundAmountDec = toDecimal(refundAmount);

  if (refundAmountDec.isZero() || refundAmountDec.isNegative()) {
    throw new BadRequestError('Refund amount must be greater than zero');
  }

  if (refundAmountDec.greaterThan(refundableAmount)) {
    throw new BadRequestError('Refund amount exceeds refundable balance');
  }

  const refund = await prisma.$transaction(async (tx) => {
    const restaurant = await tx.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true },
    });

    const refundNumber = await generateSequenceNumber(
      restaurantId,
      'CREDIT_NOTE',
      'CRN',
      restaurant?.timezone ?? 'UTC'
    );

    const refund = await tx.payment.create({
      data: {
        restaurantId,
        orderId: payment.orderId,
        paymentNumber: refundNumber,
        transactionType: 'REFUND',
        method: method as any,
        status: 'COMPLETED',
        amount: refundAmount,
        referenceNumber: referenceNumber || null,
        notes: notes || reason,
        receivedById: userId,
        parentPaymentId: payment.id,
        idempotencyKey: idempotencyKey || null,
        completedAt: new Date(),
      },
    });

    return refund;
  });

  await recalcAndUpdatePaymentStatus(payment.orderId);

  // Link cash refund to active session
  if (method === 'CASH') {
    const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
    if (settings?.requireOpenCashierSessionForCashPayments) {
      const activeSession = await prisma.cashierSession.findFirst({
        where: { cashierId: userId, restaurantId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' },
      });
      if (activeSession) {
        try {
          await linkCashRefundToSession(paymentId, refund.id, restaurantId, activeSession.id);
        } catch (err) {
          console.error('Failed to link cash refund to session:', err);
        }
      }
    }
  }

  await createAuditLog({
    restaurantId,
    userId,
    action: 'Refund issued',
    entityType: 'Payment',
    entityId: paymentId,
    description: `Refund of ${refundAmount} for payment ${payment.paymentNumber}: ${reason}`,
    metadata: {
      originalPaymentNumber: payment.paymentNumber,
      refundAmount,
      reason,
      method,
      refundNumber: refund.paymentNumber,
    },
    ipAddress,
    userAgent,
  });

  return await getOrderPaymentSummary(payment.orderId);
}

// ==========================================
// ORDER CLOSURE
// ==========================================

async function allItemsServed(orderId: string): Promise<boolean> {
  const activeItems = await prisma.orderItem.findMany({
    where: {
      orderId,
      status: { not: 'CANCELLED' },
    },
  });

  return activeItems.every((item) => item.status === 'SERVED');
}

export async function closeOrder(
  orderId: string,
  userId: string,
  restaurantId: string,
  exceptionReason?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { restaurant: { include: { settings: true } } },
  });

  if (!order) throw new NotFoundError('Order not found');
  if (order.restaurantId !== restaurantId) throw new ForbiddenError('Access denied');
  if (order.status === 'CLOSED') throw new BadRequestError('Order is already closed');

  // Check payment
  const summary = await calculatePaymentSummary(orderId);
  if (summary.paymentStatus !== 'PAID') {
    throw new BadRequestError('Order must be fully paid before closing');
  }

  // Check serving status
  const allServed = await allItemsServed(orderId);
  if (!allServed && !exceptionReason) {
    throw new BadRequestError('Not all items have been served. Provide an exception reason to close.');
  }

  const tableReleaseStatus = order.restaurant.settings?.tableStatusAfterOrderClosure || 'CLEANING';

  const updated = await prisma.$transaction(async (tx) => {
    const closed = await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById: userId,
      },
    });

    // Release table for dine-in
    if (order.tableId && order.orderType === 'DINE_IN') {
      await tx.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: tableReleaseStatus as any },
      });
    }

    return closed;
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: exceptionReason ? 'Manager exception closure' : 'Order closed',
    entityType: 'Order',
    entityId: orderId,
    description: exceptionReason
      ? `Order ${order.orderNumber} closed with exception: ${exceptionReason}`
      : `Order ${order.orderNumber} closed`,
    metadata: {
      orderNumber: order.orderNumber,
      exceptionReason,
      tableReleased: order.tableId ? true : false,
      tableStatus: order.tableId ? tableReleaseStatus : null,
    },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// PAYMENT SUMMARY
// ==========================================

export async function getOrderPaymentSummary(orderId: string): Promise<any> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      payments: {
        where: { status: { not: 'FAILED' } },
        orderBy: { createdAt: 'asc' },
        include: {
          receivedBy: { select: { id: true, firstName: true, lastName: true } },
          voidedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      table: { select: { name: true, code: true } },
      waiter: { select: { id: true, firstName: true, lastName: true } },
      items: {
        where: { status: { not: 'CANCELLED' } },
      },
      paymentRequestedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!order) throw new NotFoundError('Order not found');

  const summary = await calculatePaymentSummary(orderId);
  const paymentRequest = await prisma.paymentRequest.findUnique({
    where: { orderId },
    include: {
      requestedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return {
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      paymentStatus: order.paymentStatus,
      table: order.table,
      waiter: order.waiter,
      customerName: order.customerName,
      notes: order.notes,
    },
    totals: {
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      discountAmount: order.discountAmount,
      totalAmount: order.totalAmount,
    },
    paymentSummary: {
      orderTotal: summary.orderTotal.toFixed(2),
      completedPayments: summary.completedPayments.toFixed(2),
      totalRefunds: summary.totalRefunds.toFixed(2),
      netPaid: summary.netPaid.toFixed(2),
      amountDue: summary.amountDue.toFixed(2),
      paymentStatus: summary.paymentStatus,
    },
    payments: order.payments.map((p: any) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      transactionType: p.transactionType,
      method: p.method,
      status: p.status,
      amount: p.amount,
      amountTendered: p.amountTendered,
      changeAmount: p.changeAmount,
      referenceNumber: p.referenceNumber,
      providerName: p.providerName,
      notes: p.notes,
      receivedBy: p.receivedBy,
      voidedBy: p.voidedBy,
      voidReason: p.voidReason,
      completedAt: p.completedAt,
      voidedAt: p.voidedAt,
      createdAt: p.createdAt,
    })),
    paymentRequest: paymentRequest && !paymentRequest.cancelledAt
      ? {
          id: paymentRequest.id,
          requestedBy: paymentRequest.requestedBy,
          createdAt: paymentRequest.createdAt,
        }
      : null,
    activeItemCount: order.items.length,
  };
}

// ==========================================
// PAYMENT QUEUE
// ==========================================

interface PaymentQueueFilters {
  search?: string;
  orderType?: string;
  paymentStatus?: string;
  requested?: string;
  waiterId?: string;
  diningAreaId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}

export async function getPaymentQueue(
  restaurantId: string,
  filters: PaymentQueueFilters = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = {
    restaurantId,
    status: { notIn: ['DRAFT', 'CANCELLED'] },
  };

  if (filters.paymentStatus) {
    where.paymentStatus = filters.paymentStatus;
  } else {
    where.paymentStatus = { notIn: ['REFUNDED'] };
  }

  if (filters.orderType) {
    where.orderType = filters.orderType;
  }

  if (filters.waiterId) {
    where.waiterId = filters.waiterId;
  }

  if (filters.diningAreaId) {
    const tables = await prisma.restaurantTable.findMany({
      where: { diningAreaId: filters.diningAreaId },
      select: { id: true },
    });
    where.tableId = { in: tables.map((t) => t.id) };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  if (filters.search) {
    where.OR = [
      { orderNumber: { contains: filters.search, mode: 'insensitive' } },
      { customerName: { contains: filters.search, mode: 'insensitive' } },
      { waiter: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      { waiter: { lastName: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  // Payment request filter
  if (filters.requested === 'true') {
    where.paymentRequests = {
      some: { cancelledAt: null },
    };
  } else if (filters.requested === 'false') {
    where.paymentRequests = { none: { cancelledAt: null } };
  }

  // Sort
  let orderBy: any = { createdAt: 'desc' };
  if (filters.sortBy === 'amountDue') {
    orderBy = { amountDue: filters.sortOrder === 'asc' ? 'asc' : 'desc' };
  } else if (filters.sortBy === 'totalAmount') {
    orderBy = { totalAmount: filters.sortOrder === 'asc' ? 'asc' : 'desc' };
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        table: { select: { name: true, code: true, diningAreaId: true } },
        waiter: { select: { id: true, firstName: true, lastName: true } },
        paymentRequests: {
          where: { cancelledAt: null },
          select: { id: true, createdAt: true, requestedBy: { select: { firstName: true, lastName: true } } },
          take: 1,
        },
        _count: { select: { payments: { where: { status: 'COMPLETED', transactionType: 'PAYMENT' } } } },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderType: o.orderType,
      status: o.status,
      paymentStatus: o.paymentStatus,
      table: o.table,
      waiter: o.waiter,
      customerName: o.customerName,
      totalAmount: o.totalAmount,
      amountPaid: o.amountPaid,
      amountDue: o.amountDue,
      paymentRequest: o.paymentRequests[0] || null,
      paymentCount: o._count.payments,
      createdAt: o.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ==========================================
// PAYMENT LIST
// ==========================================

interface PaymentListFilters {
  search?: string;
  method?: string;
  status?: string;
  transactionType?: string;
  receivedById?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export async function getPaymentList(
  restaurantId: string,
  filters: PaymentListFilters = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.method) where.method = filters.method;
  if (filters.status) where.status = filters.status;
  if (filters.transactionType) where.transactionType = filters.transactionType;
  if (filters.receivedById) where.receivedById = filters.receivedById;

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z');
  }

  if (filters.search) {
    where.OR = [
      { paymentNumber: { contains: filters.search, mode: 'insensitive' } },
      { order: { orderNumber: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        receivedBy: { select: { id: true, firstName: true, lastName: true } },
        order: { select: { orderNumber: true } },
        parentPayment: { select: { paymentNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map((p: any) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      transactionType: p.transactionType,
      method: p.method,
      status: p.status,
      amount: p.amount,
      amountTendered: p.amountTendered,
      changeAmount: p.changeAmount,
      referenceNumber: p.referenceNumber,
      providerName: p.providerName,
      notes: p.notes,
      orderNumber: p.order.orderNumber,
      receivedBy: p.receivedBy,
      parentPaymentNumber: p.parentPayment?.paymentNumber,
      completedAt: p.completedAt,
      voidedAt: p.voidedAt,
      voidReason: p.voidReason,
      createdAt: p.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ==========================================
// PAYMENT SUMMARY (Reports)
// ==========================================

interface PaymentSummaryFilters {
  dateFrom?: string;
  dateTo?: string;
  receivedById?: string;
  waiterId?: string;
  method?: string;
  diningAreaId?: string;
  orderType?: string;
}

export async function getPaymentReportsSummary(
  restaurantId: string,
  filters: PaymentSummaryFilters = {}
): Promise<any> {
  const paymentWhere: any = {
    restaurantId,
    status: { in: ['COMPLETED'] },
  };

  const orderWhere: any = {
    restaurantId,
    status: { notIn: ['DRAFT', 'CANCELLED'] },
  };

  if (filters.dateFrom || filters.dateTo) {
    const dateFilter: any = {};
    if (filters.dateFrom) dateFilter.gte = new Date(filters.dateFrom);
    if (filters.dateTo) dateFilter.lte = new Date(filters.dateTo + 'T23:59:59.999Z');

    paymentWhere.completedAt = dateFilter;
    orderWhere.createdAt = dateFilter;
  }

  if (filters.receivedById) paymentWhere.receivedById = filters.receivedById;
  if (filters.method) paymentWhere.method = filters.method;
  if (filters.waiterId) orderWhere.waiterId = filters.waiterId;
  if (filters.orderType) orderWhere.orderType = filters.orderType;

  if (filters.diningAreaId) {
    const tables = await prisma.restaurantTable.findMany({
      where: { diningAreaId: filters.diningAreaId },
      select: { id: true },
    });
    orderWhere.tableId = { in: tables.map((t) => t.id) };
  }

  const [payments, activeOrders] = await Promise.all([
    prisma.payment.findMany({
      where: { ...paymentWhere, transactionType: { in: ['PAYMENT', 'REFUND'] } },
      select: {
        transactionType: true,
        method: true,
        amount: true,
        completedAt: true,
      },
    }),
    prisma.order.findMany({
      where: {
        ...orderWhere,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
      },
      select: {
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
      },
    }),
  ]);

  const grossPayments = payments
    .filter((p: any) => p.transactionType === 'PAYMENT')
    .reduce((sum: Decimal, p: any) => sum.plus(toDecimal(p.amount)), new Decimal(0));

  const refunds = payments
    .filter((p: any) => p.transactionType === 'REFUND')
    .reduce((sum: Decimal, p: any) => sum.plus(toDecimal(p.amount)), new Decimal(0));

  const netCollected = grossPayments.minus(refunds);

  const byMethod: Record<string, DecimalType> = {};
  payments
    .filter((p: any) => p.transactionType === 'PAYMENT')
    .forEach((p: any) => {
      byMethod[p.method] = (byMethod[p.method] || new Decimal(0)).plus(toDecimal(p.amount));
    });

  const unpaidTotal = activeOrders
    .filter((o: any) => o.paymentStatus === 'UNPAID')
    .reduce((sum: Decimal, o: any) => sum.plus(toDecimal(o.totalAmount)), new Decimal(0));

  const partialBalance = activeOrders
    .filter((o: any) => o.paymentStatus === 'PARTIALLY_PAID')
    .reduce((sum: Decimal, o: any) => sum.plus(toDecimal(o.amountDue)), new Decimal(0));

  const receiptCount = await prisma.receipt.count({
    where: {
      restaurantId,
      ...(filters.dateFrom || filters.dateTo
        ? { issuedAt: paymentWhere.completedAt }
        : {}),
    },
  });

  const methodTotals: Record<string, string> = {};
  Object.entries(byMethod).forEach(([key, val]) => {
    methodTotals[key] = (val as DecimalType).toFixed(2);
  });

  return {
    grossPayments: roundMoney(grossPayments).toFixed(2),
    refunds: roundMoney(refunds).toFixed(2),
    netCollected: roundMoney(netCollected).toFixed(2),
    paymentCount: payments.filter((p: any) => p.transactionType === 'PAYMENT').length,
    refundCount: payments.filter((p: any) => p.transactionType === 'REFUND').length,
    averagePaymentValue: payments.filter((p: any) => p.transactionType === 'PAYMENT').length > 0
      ? roundMoney(grossPayments.div(payments.filter((p: any) => p.transactionType === 'PAYMENT').length)).toFixed(2)
      : '0.00',
    byMethod: methodTotals,
    unpaidServedTotal: roundMoney(unpaidTotal).toFixed(2),
    partiallyPaidBalance: roundMoney(partialBalance).toFixed(2),
    receiptCount,
  };
}

