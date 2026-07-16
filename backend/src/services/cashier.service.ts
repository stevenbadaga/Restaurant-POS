import { prisma } from '../database';
import { BadRequestError, NotFoundError, ForbiddenError } from '../types';
import { createAuditLog } from './audit.service';
import { generateSequenceNumber } from './sequence.service';
import { toDecimal, roundMoney } from './calculation.service';

// ==========================================
// CASH REGISTERS
// ==========================================

interface CreateRegisterInput {
  name: string;
  code: string;
  locationDescription?: string;
  isDefault?: boolean;
}

export async function createCashRegister(
  restaurantId: string,
  input: CreateRegisterInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  // Check uniqueness
  const existing = await prisma.cashRegister.findFirst({
    where: {
      restaurantId,
      OR: [{ name: input.name }, { code: input.code }],
    },
  });
  if (existing) throw new BadRequestError('Register name or code already exists');

  // If default, unset other defaults
  if (input.isDefault) {
    await prisma.cashRegister.updateMany({
      where: { restaurantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const register = await prisma.cashRegister.create({
    data: {
      restaurantId,
      name: input.name,
      code: input.code,
      locationDescription: input.locationDescription || null,
      isDefault: input.isDefault || false,
      status: 'ACTIVE',
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_REGISTER_CREATED',
    entityType: 'CashRegister',
    entityId: register.id,
    description: `Cash register "${register.name}" created`,
    metadata: { code: register.code },
    ipAddress,
    userAgent,
  });

  return register;
}

export async function updateCashRegister(
  registerId: string,
  restaurantId: string,
  input: Partial<CreateRegisterInput>,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const register = await prisma.cashRegister.findFirst({
    where: { id: registerId, restaurantId },
  });
  if (!register) throw new NotFoundError('Cash register not found');

  if (input.name || input.code) {
    const conflict = await prisma.cashRegister.findFirst({
      where: {
        restaurantId,
        id: { not: registerId },
        OR: [
          ...(input.name ? [{ name: input.name }] : []),
          ...(input.code ? [{ code: input.code }] : []),
        ],
      },
    });
    if (conflict) throw new BadRequestError('Register name or code already in use');
  }

  if (input.isDefault) {
    await prisma.cashRegister.updateMany({
      where: { restaurantId, isDefault: true, id: { not: registerId } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.cashRegister.update({
    where: { id: registerId },
    data: input,
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_REGISTER_UPDATED',
    entityType: 'CashRegister',
    entityId: registerId,
    description: `Register "${register.name}" updated`,
    metadata: { changes: Object.keys(input) },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function setRegisterStatus(
  registerId: string,
  restaurantId: string,
  status: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const register = await prisma.cashRegister.findFirst({
    where: { id: registerId, restaurantId },
  });
  if (!register) throw new NotFoundError('Cash register not found');

  const updated = await prisma.cashRegister.update({
    where: { id: registerId },
    data: { status: status as any },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_REGISTER_STATUS_CHANGED',
    entityType: 'CashRegister',
    entityId: registerId,
    description: `Register "${register.name}" status changed to ${status}`,
    metadata: { previousStatus: register.status, newStatus: status },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function setDefaultRegister(
  registerId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const register = await prisma.cashRegister.findFirst({
    where: { id: registerId, restaurantId },
  });
  if (!register) throw new NotFoundError('Cash register not found');

  await prisma.cashRegister.updateMany({
    where: { restaurantId, isDefault: true },
    data: { isDefault: false },
  });

  const updated = await prisma.cashRegister.update({
    where: { id: registerId },
    data: { isDefault: true },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_REGISTER_DEFAULT_SET',
    entityType: 'CashRegister',
    entityId: registerId,
    description: `Register "${register.name}" set as default`,
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function listCashRegisters(restaurantId: string): Promise<any[]> {
  return prisma.cashRegister.findMany({
    where: { restaurantId },
    include: {
      sessions: {
        where: { status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] } },
        select: {
          id: true,
          sessionNumber: true,
          status: true,
          cashier: { select: { id: true, firstName: true, lastName: true } },
          openedAt: true,
          openingFloat: true,
          expectedCash: true,
        },
        orderBy: { openedAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { name: 'asc' },
  });
}

// ==========================================
// CASHIER SESSION
// ==========================================

interface OpenSessionInput {
  cashRegisterId: string;
  openingFloat: string;
  workShiftId?: string;
  notes?: string;
}

export async function openCashierSession(
  restaurantId: string,
  cashierId: string,
  input: OpenSessionInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const float = toDecimal(input.openingFloat);
  if (float.isNegative()) throw new BadRequestError('Opening float cannot be negative');

  // Verify register
  const register = await prisma.cashRegister.findFirst({
    where: { id: input.cashRegisterId, restaurantId },
  });
  if (!register) throw new NotFoundError('Cash register not found');
  if (register.status !== 'ACTIVE') throw new BadRequestError('Register is not active');

  // Check for conflicting session on same register
  const conflicting = await prisma.cashierSession.findFirst({
    where: {
      cashRegisterId: input.cashRegisterId,
      status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
    },
  });
  if (conflicting) throw new BadRequestError('Register already has an active session');

  // Check for other open sessions for this cashier
  const cashierActive = await prisma.cashierSession.findFirst({
    where: {
      cashierId,
      restaurantId,
      status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
    },
  });
  if (cashierActive) throw new BadRequestError('Cashier already has an active session');

  // Get restaurant timezone
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });

  const session = await prisma.$transaction(async (tx) => {
    const sessionNumber = await generateSequenceNumber(
      restaurantId,
      'CASHIER_SESSION',
      'CSH',
      restaurant?.timezone ?? 'UTC'
    );

    const businessDate = new Date().toISOString().split('T')[0];

    const session = await tx.cashierSession.create({
      data: {
        restaurantId,
        cashRegisterId: input.cashRegisterId,
        cashierId,
        status: 'OPEN',
        businessDate,
        sessionNumber,
        openedAt: new Date(),
        openedById: userId,
        openingFloat: float.toFixed(2),
        expectedCash: float.toFixed(2),
        workShiftId: input.workShiftId || null,
      },
    });

    // Create opening float movement
    await tx.cashDrawerMovement.create({
      data: {
        restaurantId,
        cashierSessionId: session.id,
        movementType: 'OPENING_FLOAT',
        amount: float.toFixed(2),
        reason: 'Session opening float',
        actorUserId: userId,
        occurredAt: new Date(),
      },
    });

    return session;
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASHIER_SESSION_OPENED',
    entityType: 'CashierSession',
    entityId: session.id,
    description: `Cashier session ${session.sessionNumber} opened on ${register.name}`,
    metadata: {
      registerName: register.name,
      registerCode: register.code,
      openingFloat: float.toFixed(2),
      sessionNumber: session.sessionNumber,
    },
    ipAddress,
    userAgent,
  });

  return session;
}

// ==========================================
// EXPECTED CASH CALCULATION
// ==========================================

export async function calculateExpectedCash(
  sessionId: string,
  restaurantId: string
): Promise<{ expectedCash: string; openingFloat: string; cashPayments: string; cashRefunds: string; cashIn: string; cashOut: string; safeDrops: string; adjustmentsIn: string; adjustmentsOut: string }> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');

  const movements = await prisma.cashDrawerMovement.findMany({
    where: { cashierSessionId: sessionId },
  });

  let expected = toDecimal(session.openingFloat);

  const openingFloat = toDecimal(session.openingFloat);
  const cashPayments = movements
    .filter((m) => m.movementType === 'CASH_PAYMENT')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));
  const cashRefunds = movements
    .filter((m) => m.movementType === 'CASH_REFUND')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));
  const cashIn = movements
    .filter((m) => m.movementType === 'CASH_IN')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));
  const cashOut = movements
    .filter((m) => m.movementType === 'CASH_OUT')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));
  const safeDrops = movements
    .filter((m) => m.movementType === 'SAFE_DROP')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));
  const adjustmentsIn = movements
    .filter((m) => m.movementType === 'ADJUSTMENT_IN')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));
  const adjustmentsOut = movements
    .filter((m) => m.movementType === 'ADJUSTMENT_OUT')
    .reduce((sum, m) => sum.plus(toDecimal(m.amount)), toDecimal(0));

  expected = expected
    .plus(cashPayments)
    .minus(cashRefunds)
    .plus(cashIn)
    .minus(cashOut)
    .minus(safeDrops)
    .plus(adjustmentsIn)
    .minus(adjustmentsOut);

  return {
    expectedCash: roundMoney(expected).toFixed(2),
    openingFloat: roundMoney(openingFloat).toFixed(2),
    cashPayments: roundMoney(cashPayments).toFixed(2),
    cashRefunds: roundMoney(cashRefunds).toFixed(2),
    cashIn: roundMoney(cashIn).toFixed(2),
    cashOut: roundMoney(cashOut).toFixed(2),
    safeDrops: roundMoney(safeDrops).toFixed(2),
    adjustmentsIn: roundMoney(adjustmentsIn).toFixed(2),
    adjustmentsOut: roundMoney(adjustmentsOut).toFixed(2),
  };
}

// ==========================================
// DRAWER MOVEMENTS
// ==========================================

interface MovementInput {
  amount: string;
  reason: string;
  referenceNumber?: string;
  paymentId?: string;
  orderId?: string;
  notes?: string;
}

export async function addCashIn(
  sessionId: string,
  restaurantId: string,
  input: MovementInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'OPEN') throw new BadRequestError('Session is not open');

  const amount = toDecimal(input.amount);
  if (amount.isZero() || amount.isNegative()) {
    throw new BadRequestError('Amount must be greater than zero');
  }

  const movement = await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId: sessionId,
      movementType: 'CASH_IN',
      amount: amount.toFixed(2),
      reason: input.reason,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      actorUserId: userId,
      occurredAt: new Date(),
    },
  });

  await recalcSessionExpectedCash(sessionId, restaurantId);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_IN',
    entityType: 'CashDrawerMovement',
    entityId: movement.id,
    description: `Cash-in of ${amount.toFixed(2)}: ${input.reason}`,
    metadata: { sessionNumber: session.sessionNumber, amount: amount.toFixed(2), reason: input.reason },
    ipAddress,
    userAgent,
  });

  return movement;
}

export async function addCashOut(
  sessionId: string,
  restaurantId: string,
  input: MovementInput,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
  if (settings?.requireManagerApprovalForCashOut) {
    throw new BadRequestError('Cash-out requires manager approval. Use the adjustment endpoint with manager authorization.');
  }

  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'OPEN') throw new BadRequestError('Session is not open');

  const amount = toDecimal(input.amount);
  if (amount.isZero() || amount.isNegative()) {
    throw new BadRequestError('Amount must be greater than zero');
  }

  const movement = await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId: sessionId,
      movementType: 'CASH_OUT',
      amount: amount.toFixed(2),
      reason: input.reason,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      actorUserId: userId,
      occurredAt: new Date(),
    },
  });

  await recalcSessionExpectedCash(sessionId, restaurantId);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_OUT',
    entityType: 'CashDrawerMovement',
    entityId: movement.id,
    description: `Cash-out of ${amount.toFixed(2)}: ${input.reason}`,
    metadata: { sessionNumber: session.sessionNumber, amount: amount.toFixed(2), reason: input.reason },
    ipAddress,
    userAgent,
  });

  return movement;
}

export async function addSafeDrop(
  sessionId: string,
  restaurantId: string,
  input: MovementInput,
  userId: string,
  approvedById?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
  if (settings?.requireManagerApprovalForSafeDrop && !approvedById) {
    throw new BadRequestError('Safe drop requires manager approval');
  }

  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'OPEN') throw new BadRequestError('Session is not open');

  const amount = toDecimal(input.amount);
  if (amount.isZero() || amount.isNegative()) {
    throw new BadRequestError('Amount must be greater than zero');
  }

  const movement = await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId: sessionId,
      movementType: 'SAFE_DROP',
      amount: amount.toFixed(2),
      reason: input.reason,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      actorUserId: userId,
      approvedById: approvedById || null,
      occurredAt: new Date(),
    },
  });

  await recalcSessionExpectedCash(sessionId, restaurantId);

  await createAuditLog({
    restaurantId,
    userId,
    action: 'SAFE_DROP',
    entityType: 'CashDrawerMovement',
    entityId: movement.id,
    description: `Safe drop of ${amount.toFixed(2)}: ${input.reason}`,
    metadata: { sessionNumber: session.sessionNumber, amount: amount.toFixed(2) },
    ipAddress,
    userAgent,
  });

  return movement;
}

export async function addAdjustment(
  sessionId: string,
  restaurantId: string,
  input: MovementInput & { movementType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' },
  userId: string,
  approvedById?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'OPEN' && session.status !== 'CLOSING') {
    throw new BadRequestError('Session must be open or closing for adjustments');
  }

  const amount = toDecimal(input.amount);
  if (amount.isZero() || amount.isNegative()) {
    throw new BadRequestError('Amount must be greater than zero');
  }

  const movement = await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId: sessionId,
      movementType: input.movementType,
      amount: amount.toFixed(2),
      reason: input.reason,
      referenceNumber: input.referenceNumber || null,
      notes: input.notes || null,
      actorUserId: userId,
      approvedById: approvedById || null,
      occurredAt: new Date(),
    },
  });

  await recalcSessionExpectedCash(sessionId, restaurantId);

  await createAuditLog({
    restaurantId,
    userId,
    action: input.movementType === 'ADJUSTMENT_IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
    entityType: 'CashDrawerMovement',
    entityId: movement.id,
    description: `Cash adjustment ${input.movementType === 'ADJUSTMENT_IN' ? 'in' : 'out'} of ${amount.toFixed(2)}: ${input.reason}`,
    metadata: { sessionNumber: session.sessionNumber, amount: amount.toFixed(2) },
    ipAddress,
    userAgent,
  });

  return movement;
}

async function recalcSessionExpectedCash(sessionId: string, restaurantId: string): Promise<void> {
  const calc = await calculateExpectedCash(sessionId, restaurantId);
  await prisma.cashierSession.update({
    where: { id: sessionId },
    data: { expectedCash: calc.expectedCash },
  });
}

// ==========================================
// LINK CASH PAYMENT TO SESSION
// ==========================================

export async function linkCashPaymentToSession(
  paymentId: string,
  restaurantId: string,
  cashierSessionId: string
): Promise<void> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: cashierSessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Cashier session not found');
  if (session.status !== 'OPEN') throw new BadRequestError('Session is not open for cash payments');

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new NotFoundError('Payment not found');

  // Update payment with session link
  await prisma.payment.update({
    where: { id: paymentId },
    data: { cashierSessionId },
  });

  // Create cash drawer movement - use applied amount, not tendered
  const appliedAmount = toDecimal(payment.amount);

  await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId,
      movementType: 'CASH_PAYMENT',
      amount: appliedAmount.toFixed(2),
      paymentId,
      orderId: payment.orderId,
      reason: `Cash payment ${payment.paymentNumber}`,
      actorUserId: payment.receivedById,
      occurredAt: payment.completedAt || payment.createdAt,
    },
  });

  // Recalculate expected cash
  await recalcSessionExpectedCash(cashierSessionId, restaurantId);
}

export async function linkCashRefundToSession(
  paymentId: string,
  refundId: string,
  restaurantId: string,
  cashierSessionId: string
): Promise<void> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: cashierSessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Cashier session not found');
  if (session.status !== 'OPEN') throw new BadRequestError('Session must be open for cash refunds');

  const refund = await prisma.payment.findUnique({ where: { id: refundId } });
  if (!refund) throw new NotFoundError('Refund payment not found');

  // Update refund with session link
  await prisma.payment.update({
    where: { id: refundId },
    data: { cashierSessionId },
  });

  const amount = toDecimal(refund.amount);

  await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId,
      movementType: 'CASH_REFUND',
      amount: amount.toFixed(2),
      paymentId: refundId,
      orderId: refund.orderId,
      reason: `Cash refund ${refund.paymentNumber}`,
      actorUserId: refund.receivedById,
      occurredAt: refund.completedAt || refund.createdAt,
    },
  });

  await recalcSessionExpectedCash(cashierSessionId, restaurantId);
}

// ==========================================
// SESSION CLOSING
// ==========================================

export async function beginClosingSession(
  sessionId: string,
  restaurantId: string,
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'OPEN') throw new BadRequestError('Session is not open');

  const expected = await calculateExpectedCash(sessionId, restaurantId);
  await prisma.cashierSession.update({
    where: { id: sessionId },
    data: {
      status: 'CLOSING',
      closingStartedAt: new Date(),
      expectedCash: expected.expectedCash,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASHIER_SESSION_CLOSING_STARTED',
    entityType: 'CashierSession',
    entityId: sessionId,
    description: `Session ${session.sessionNumber} closing started`,
    metadata: { expectedCash: expected.expectedCash },
    ipAddress,
    userAgent,
  });

  return { session, expected };
}

export async function recordClosingCount(
  sessionId: string,
  restaurantId: string,
  input: { countedCash?: string; denominations?: { denomination: string; quantity: number }[] },
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'CLOSING') throw new BadRequestError('Session must be in CLOSING status');

  let countedCash = toDecimal(0);

  if (input.countedCash !== undefined) {
    countedCash = toDecimal(input.countedCash);
  } else if (input.denominations && input.denominations.length > 0) {
    // Calculate from denominations
    countedCash = input.denominations.reduce((sum, d) => {
      return sum.plus(toDecimal(d.denomination).mul(d.quantity));
    }, toDecimal(0));

    // Create denomination count records
    for (const d of input.denominations) {
      await prisma.cashDenominationCount.create({
        data: {
          restaurantId,
          cashierSessionId: sessionId,
          denomination: d.denomination,
          quantity: d.quantity,
          lineTotal: toDecimal(d.denomination).mul(d.quantity).toFixed(2),
        },
      });
    }
  } else {
    throw new BadRequestError('Either countedCash or denominations must be provided');
  }

  if (countedCash.isNegative()) {
    throw new BadRequestError('Counted cash cannot be negative');
  }

  // Create CLOSING_COUNT movement
  await prisma.cashDrawerMovement.create({
    data: {
      restaurantId,
      cashierSessionId: sessionId,
      movementType: 'CLOSING_COUNT',
      amount: countedCash.toFixed(2),
      reason: 'Session closing physical count',
      actorUserId: userId,
      occurredAt: new Date(),
    },
  });

  // Calculate variance
  const expectedDec = toDecimal(session.expectedCash);
  const variance = countedCash.minus(expectedDec);

  let varianceStatus: string;
  if (variance.isZero()) {
    varianceStatus = 'BALANCED';
  } else if (variance.isPositive()) {
    varianceStatus = 'OVER';
  } else {
    varianceStatus = 'SHORT';
  }

  const settings = await prisma.restaurantSettings.findUnique({ where: { restaurantId } });
  const approvalThreshold = toDecimal(settings?.cashVarianceApprovalThreshold || 0);
  const absVariance = variance.abs();

  let newStatus: 'CLOSING' | 'PENDING_APPROVAL' = session.status as 'CLOSING';
  if (absVariance.greaterThan(approvalThreshold) && !variance.isZero()) {
    newStatus = 'PENDING_APPROVAL';
  }

  const updated = await prisma.cashierSession.update({
    where: { id: sessionId },
    data: {
      countedCash: countedCash.toFixed(2),
      varianceAmount: variance.toFixed(2),
      varianceStatus: varianceStatus as any,
      status: newStatus as any,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: variance.isZero() ? 'CLOSING_COUNT_BALANCED' : variance.isPositive() ? 'CLOSING_COUNT_OVER' : 'CLOSING_COUNT_SHORT',
    entityType: 'CashierSession',
    entityId: sessionId,
    description: `Session ${session.sessionNumber}: expected ${expectedDec.toFixed(2)}, counted ${countedCash.toFixed(2)}, variance ${variance.toFixed(2)}`,
    metadata: {
      sessionNumber: session.sessionNumber,
      expectedCash: expectedDec.toFixed(2),
      countedCash: countedCash.toFixed(2),
      variance: variance.toFixed(2),
      varianceStatus,
    },
    ipAddress,
    userAgent,
  });

  return {
    session: updated,
    expectedCash: expectedDec.toFixed(2),
    countedCash: countedCash.toFixed(2),
    variance: variance.toFixed(2),
    varianceStatus,
    requiresApproval: newStatus === 'PENDING_APPROVAL',
  };
}

export async function approveSession(
  sessionId: string,
  restaurantId: string,
  userId: string,
  notes?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'PENDING_APPROVAL') throw new BadRequestError('Session is not pending approval');
  if (session.cashierId === userId) throw new BadRequestError('You cannot approve your own session variance');

  const updated = await prisma.cashierSession.update({
    where: { id: sessionId },
    data: {
      varianceStatus: 'APPROVED',
      varianceReason: notes || 'Approved by manager',
      approvedAt: new Date(),
      approvedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_VARIANCE_APPROVED',
    entityType: 'CashierSession',
    entityId: sessionId,
    description: `Session ${session.sessionNumber} variance approved`,
    metadata: {
      sessionNumber: session.sessionNumber,
      variance: session.varianceAmount,
      notes,
    },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function rejectSession(
  sessionId: string,
  restaurantId: string,
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');
  if (session.status !== 'PENDING_APPROVAL') throw new BadRequestError('Session is not pending approval');

  const updated = await prisma.cashierSession.update({
    where: { id: sessionId },
    data: {
      varianceStatus: 'REJECTED',
      varianceReason: reason,
      rejectedAt: new Date(),
      rejectedById: userId,
      rejectionReason: reason,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASH_VARIANCE_REJECTED',
    entityType: 'CashierSession',
    entityId: sessionId,
    description: `Session ${session.sessionNumber} variance rejected: ${reason}`,
    metadata: { sessionNumber: session.sessionNumber, variance: session.varianceAmount, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function closeSession(
  sessionId: string,
  restaurantId: string,
  userId: string,
  notes?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');

  if (session.status !== 'CLOSING' && session.status !== 'PENDING_APPROVAL') {
    throw new BadRequestError('Session must be in CLOSING or PENDING_APPROVAL status');
  }

  // If pending approval, check variance is balanced or approved
  if (session.status === 'PENDING_APPROVAL') {
    if (session.varianceStatus !== 'APPROVED' && session.varianceStatus !== 'BALANCED') {
      throw new BadRequestError('Session variance must be approved before closing');
    }
  }

  const updated = await prisma.cashierSession.update({
    where: { id: sessionId },
    data: {
      status: 'CLOSED',
      closingNotes: notes || null,
      closedAt: new Date(),
      closedById: userId,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASHIER_SESSION_CLOSED',
    entityType: 'CashierSession',
    entityId: sessionId,
    description: `Session ${session.sessionNumber} closed`,
    metadata: { sessionNumber: session.sessionNumber },
    ipAddress,
    userAgent,
  });

  return updated;
}

export async function suspendSession(
  sessionId: string,
  restaurantId: string,
  userId: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new NotFoundError('Session not found');

  const updated = await prisma.cashierSession.update({
    where: { id: sessionId },
    data: {
      status: 'SUSPENDED',
      closingNotes: reason,
    },
  });

  await createAuditLog({
    restaurantId,
    userId,
    action: 'CASHIER_SESSION_SUSPENDED',
    entityType: 'CashierSession',
    entityId: sessionId,
    description: `Session ${session.sessionNumber} suspended: ${reason}`,
    metadata: { sessionNumber: session.sessionNumber, reason },
    ipAddress,
    userAgent,
  });

  return updated;
}

// ==========================================
// SESSION QUERIES
// ==========================================

export async function getCurrentSession(cashierId: string, restaurantId: string): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: {
      cashierId,
      restaurantId,
      status: { in: ['OPEN', 'CLOSING', 'PENDING_APPROVAL'] },
    },
    include: {
      cashRegister: { select: { name: true, code: true } },
      cashDrawerMovements: {
        orderBy: { occurredAt: 'asc' },
      },
    },
    orderBy: { openedAt: 'desc' },
  });

  if (!session) return null;

  const expected = await calculateExpectedCash(session.id, restaurantId);

  return {
    ...session,
    expectedCashDetails: expected,
    movementCount: session.cashDrawerMovements.length,
  };
}

interface ListSessionFilters {
  businessDate?: string;
  dateFrom?: string;
  dateTo?: string;
  cashRegisterId?: string;
  cashierId?: string;
  status?: string;
  varianceStatus?: string;
  page?: number;
  limit?: number;
}

export async function listSessions(
  restaurantId: string,
  filters: ListSessionFilters = {}
): Promise<any> {
  const page = filters.page || 1;
  const limit = Math.min(filters.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };

  if (filters.businessDate) where.businessDate = filters.businessDate;
  if (filters.cashRegisterId) where.cashRegisterId = filters.cashRegisterId;
  if (filters.cashierId) where.cashierId = filters.cashierId;
  if (filters.status) where.status = filters.status;
  if (filters.varianceStatus) where.varianceStatus = filters.varianceStatus;

  if (filters.dateFrom || filters.dateTo) {
    where.openedAt = {};
    if (filters.dateFrom) where.openedAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.openedAt.lte = new Date(filters.dateTo);
  }

  const [sessions, total] = await Promise.all([
    prisma.cashierSession.findMany({
      where,
      include: {
        cashRegister: { select: { name: true, code: true } },
        cashier: { select: { id: true, firstName: true, lastName: true } },
        openedBy: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { cashDrawerMovements: true } },
      },
      orderBy: { openedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.cashierSession.count({ where }),
  ]);

  return {
    sessions,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getSessionDetail(
  sessionId: string,
  restaurantId: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
    include: {
      cashRegister: true,
      cashier: { select: { id: true, firstName: true, lastName: true } },
      openedBy: { select: { id: true, firstName: true, lastName: true } },
      closedBy: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
      rejectedBy: { select: { id: true, firstName: true, lastName: true } },
      cashDrawerMovements: {
        orderBy: { occurredAt: 'asc' },
        include: {
          actor: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      denominationCounts: true,
    },
  });

  if (!session) throw new NotFoundError('Session not found');

  const expected = await calculateExpectedCash(sessionId, restaurantId);

  return { ...session, expectedCashDetails: expected };
}

export async function getSessionMovements(
  sessionId: string,
  restaurantId: string
): Promise<any> {
  const session = await prisma.cashierSession.findFirst({
    where: { id: sessionId, restaurantId },
    select: { id: true },
  });
  if (!session) throw new NotFoundError('Session not found');

  const movements = await prisma.cashDrawerMovement.findMany({
    where: { cashierSessionId: sessionId },
    include: {
      actor: { select: { id: true, firstName: true, lastName: true } },
      approvedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { occurredAt: 'asc' },
  });

  // Calculate running balance
  let runningBalance = toDecimal(0);
  const movementsWithBalance = movements.map((m: any) => {
    switch (m.movementType) {
      case 'OPENING_FLOAT':
      case 'CASH_PAYMENT':
      case 'CASH_IN':
      case 'ADJUSTMENT_IN':
        runningBalance = runningBalance.plus(toDecimal(m.amount));
        break;
      case 'CASH_REFUND':
      case 'CASH_OUT':
      case 'SAFE_DROP':
      case 'ADJUSTMENT_OUT':
        runningBalance = runningBalance.minus(toDecimal(m.amount));
        break;
      case 'CLOSING_COUNT':
        // Don't change running balance for closing count
        break;
    }
    return {
      ...m,
      runningBalance: runningBalance.toFixed(2),
    };
  });

  return {
    movements: movementsWithBalance,
    finalBalance: runningBalance.toFixed(2),
  };
}
