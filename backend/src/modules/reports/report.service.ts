import { Decimal as PrismaDecimal } from '@prisma/client/runtime/library';
import type { Decimal as DecimalType } from '@prisma/client/runtime/library';
import { prisma } from '../../database/prisma';
import { toDecimal, roundMoney } from '../../services/calculation.service';
import { createAuditLog } from '../../services/audit.service';
import { getRestaurantTimezone, getBusinessDayRange as _getBusinessDayRange, buildDateFilters } from './report.timezone';
import type {
  SalesOverviewResult, WaiterSalesResult, MenuItemSalesResult,
  CategorySalesResult, PaymentMethodSummary, CashierActivityResult,
  OutstandingOrderResult, RefundResult, KitchenPerformanceResult,
  KitchenStationResult, TablePerformanceResult, InventoryUsageResult,
  InventoryCostResult, WastageResult, TaxServiceChargeResult,
  PeriodComparison, ChartDataPoint, ReportDateFilter, ReportPagination,
} from './report.types';
import { canViewInventoryCosts } from './report.permissions';

// ==========================================
// HELPERS
// ==========================================

function calcComparison(current: number, previous: number): PeriodComparison {
  const diff = current - previous;
  const pct = previous !== 0 ? Math.round((diff / previous) * 100) : (current !== 0 ? 100 : null);
  return {
    current: Math.round(current * 100) / 100,
    previous: Math.round(previous * 100) / 100,
    absoluteChange: Math.round(diff * 100) / 100,
    percentageChange: pct,
    direction: diff > 0 ? 'up' : (diff < 0 ? 'down' : 'neutral'),
  };
}

/**
 * Build the < field for date range queries.
 */
function dateRange(from?: Date, to?: Date, field: string = 'createdAt'): Record<string, any> {
  const result: Record<string, any> = {};
  if (from) result.gte = from;
  if (to) result.lte = to;
  return result;
}

// ==========================================
// DASHBOARD
// ==========================================

export async function getDashboardData(
  restaurantId: string,
  userRoles: string[],
  userId: string
): Promise<any> {
  const { timezone, businessDayStartTime } = await getRestaurantTimezone(restaurantId);
  const now = new Date();
  const todayStart = new Date(
    now.toLocaleDateString('en-CA', { timeZone: timezone }) + 'T' + businessDayStartTime + ':00.000'
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const todayDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });

  const isAdmin = userRoles.includes('ADMIN');
  const isManager = userRoles.includes('MANAGER');
  const isCashier = userRoles.includes('CASHIER');
  const isWaiter = userRoles.includes('WAITER');
  const isChef = userRoles.includes('CHEF');
  const isStockKeeper = userRoles.includes('STOCK_KEEPER');
  const isFullAccess = isAdmin || isManager;

  // Common date filter for "today"
  const todayFilter = { gte: todayStart, lt: todayEnd };

  if (isWaiter && !isFullAccess) {
    return getWaiterDashboard(restaurantId, userId, todayFilter, todayDateStr);
  }
  if (isCashier && !isFullAccess) {
    return getCashierDashboard(restaurantId, userId, todayFilter, todayDateStr);
  }
  if (isChef && !isFullAccess) {
    return getChefDashboard(restaurantId, userId, todayFilter, todayDateStr);
  }
  if (isStockKeeper && !isFullAccess) {
    return getStockKeeperDashboard(restaurantId, userId, todayFilter, todayDateStr);
  }

  // Full dashboard for ADMIN/MANAGER
  return getFullDashboard(restaurantId, todayFilter, todayStart, todayEnd, todayDateStr);
}

async function getFullDashboard(
  restaurantId: string,
  todayFilter: any,
  todayStart: Date,
  todayEnd: Date,
  todayDateStr: string
): Promise<any> {
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayEnd = new Date(todayStart);

  const [
    todayPayments,
    yesterdayPayments,
    closedOrders,
    yesterdayClosedOrders,
    activeOrders,
    paymentQueue,
    tables,
    kitchen,
    inventory,
    topItems,
    waiterSales,
    cashierCollections,
    exceptions,
    employeesScheduled,
    employeesClockedIn,
    openSessions,
    pendingApprovals,
  ] = await Promise.all([
    // Today's payment data
    prisma.payment.findMany({
      where: { restaurantId, completedAt: todayFilter, status: 'COMPLETED' },
      select: { transactionType: true, amount: true, method: true },
    }),
    // Yesterday's payment data
    prisma.payment.findMany({
      where: {
        restaurantId,
        completedAt: { gte: yesterdayStart, lt: yesterdayEnd },
        status: 'COMPLETED',
      },
      select: { transactionType: true, amount: true },
    }),
    // Today's closed orders
    prisma.order.count({
      where: { restaurantId, status: 'CLOSED', closedAt: todayFilter },
    }),
    // Yesterday's closed orders
    prisma.order.count({
      where: { restaurantId, status: 'CLOSED', closedAt: { gte: yesterdayStart, lt: yesterdayEnd } },
    }),
    // Active orders (not draft, not closed, not cancelled)
    prisma.order.findMany({
      where: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED', 'CLOSED'] } },
      select: { paymentStatus: true, totalAmount: true, amountPaid: true, amountDue: true, status: true },
    }),
    // Payment queue count
    prisma.order.count({
      where: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] }, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
    }),
    // Table stats
    prisma.restaurantTable.findMany({
      where: { restaurantId },
      select: { status: true },
    }),
    // Kitchen stats
    prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ['SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY'] },
      },
      select: { status: true },
    }) as any,
    // Inventory alerts
    prisma.inventoryAlert.findMany({
      where: { restaurantId, isResolved: false },
      take: 10,
      select: { alertType: true },
    }),
    // Top items (from order items)
    prisma.orderItem.findMany({
      where: {
        order: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
        status: { not: 'CANCELLED' },
      },
      select: {
        menuItemNameSnapshot: true,
        quantity: true,
        lineTotal: true,
        menuItemId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    // Waiter sales overview
    prisma.order.groupBy({
      by: ['waiterId'],
      where: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      _count: { id: true },
      _sum: { totalAmount: true },
    }),
    // Cashier collections
    prisma.payment.groupBy({
      by: ['receivedById'],
      where: { restaurantId, completedAt: todayFilter, status: 'COMPLETED', transactionType: 'PAYMENT' },
      _count: { id: true },
      _sum: { amount: true },
    }),
    // Recent exceptions
    prisma.payment.findMany({
      where: {
        restaurantId,
        transactionType: 'REFUND',
        status: 'COMPLETED',
      },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }) as any,
    // Employees scheduled today (distinct assignments)
    prisma.shiftAssignment.count({
      where: {
        restaurantId,
        workShift: { businessDate: todayDateStr, status: { in: ['SCHEDULED', 'OPEN', 'CLOSING'] } },
        status: { notIn: ['CANCELLED', 'ABSENT'] },
      },
    }),
    // Employees clocked in right now
    prisma.shiftAssignment.count({
      where: { restaurantId, status: 'CLOCKED_IN' },
    }),
    // Open cashier sessions
    prisma.cashierSession.count({
      where: { restaurantId, status: 'OPEN' },
    }),
    // Pending approvals (cashier sessions pending approval + shift handovers submitted)
    Promise.all([
      prisma.cashierSession.count({ where: { restaurantId, status: 'PENDING_APPROVAL' } }),
      prisma.shiftHandover.count({ where: { restaurantId, status: 'SUBMITTED' } }),
    ]).then(([sessionApprovals, handoverApprovals]) => sessionApprovals + handoverApprovals),
  ]);

  // Calculate payment totals
  const grossPayments = (todayPayments as any[])
    .filter((p: any) => p.transactionType === 'PAYMENT')
    .reduce((s: DecimalType, p: any) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const refunds = (todayPayments as any[])
    .filter((p: any) => p.transactionType === 'REFUND')
    .reduce((s: DecimalType, p: any) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const netCollected = grossPayments.minus(refunds);

  const yesterdayGross = (yesterdayPayments as any[])
    .filter((p: any) => p.transactionType === 'PAYMENT')
    .reduce((s: DecimalType, p: any) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const yesterdayRefunds = (yesterdayPayments as any[])
    .filter((p: any) => p.transactionType === 'REFUND')
    .reduce((s: DecimalType, p: any) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const yesterdayNet = yesterdayGross.minus(yesterdayRefunds);

  // Payment method breakdown
  const byMethod: Record<string, { amount: DecimalType; count: number }> = {};
  (todayPayments as any[])
    .filter((p: any) => p.transactionType === 'PAYMENT')
    .forEach((p: any) => {
      if (!byMethod[p.method]) byMethod[p.method] = { amount: new PrismaDecimal(0), count: 0 };
      byMethod[p.method].amount = byMethod[p.method].amount.plus(toDecimal(p.amount));
      byMethod[p.method].count++;
    });

  // Outstanding balance
  const outstandingBalance = (activeOrders as any[])
    .reduce((s: DecimalType, o: any) => s.plus(toDecimal(o.amountDue)), new PrismaDecimal(0));

  // Payment queue (served unpaid/partially paid)
  const paymentQueueOrders = (activeOrders as any[])
    .filter((o: any) => o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIALLY_PAID');

  // Kitchen stats
  const kitchenData = (kitchen as any[])?.[0] || { new_tickets: '0', preparing_tickets: '0', ready_tickets: '0' };

  // Inventory alerts
  const lowStockCount = (inventory as any[]).filter((a: any) => a.alertType === 'LOW_STOCK').length;
  const outOfStockCount = (inventory as any[]).filter((a: any) => a.alertType === 'OUT_OF_STOCK').length;

  // Top items aggregation
  const itemMap = new Map<string, { name: string; qty: number; value: DecimalType }>();
  (topItems as any[]).forEach((item: any) => {
    const key = item.menuItemId || item.menuItemNameSnapshot;
    const existing = itemMap.get(key);
    if (existing) {
      existing.qty += item.quantity;
      existing.value = existing.value.plus(toDecimal(item.lineTotal));
    } else {
      itemMap.set(key, { name: item.menuItemNameSnapshot, qty: item.quantity, value: toDecimal(item.lineTotal) });
    }
  });
  const topItemsList = Array.from(itemMap.entries())
    .map(([id, data]) => ({ id, ...data, value: roundMoney(data.value).toFixed(2) }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // Waiter names lookup
  const waiterIds = (waiterSales as any[]).map((w: any) => w.waiterId).filter(Boolean);
  const waiters = waiterIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: waiterIds } },
    select: { id: true, firstName: true, lastName: true },
  }) : [];

  // Cashier names
  const cashierIds = (cashierCollections as any[]).map((c: any) => c.receivedById).filter(Boolean);
  const cashiers = cashierIds.length > 0 ? await prisma.user.findMany({
    where: { id: { in: cashierIds } },
    select: { id: true, firstName: true, lastName: true },
  }) : [];

  const occupiedTables = (tables as any[]).filter((t: any) => t.status === 'OCCUPIED').length;

  return {
    netCollectedToday: roundMoney(netCollected).toFixed(2),
    grossPaymentsToday: roundMoney(grossPayments).toFixed(2),
    refundsToday: roundMoney(refunds).toFixed(2),
    closedOrdersToday: closedOrders,
    averageOrderValue: closedOrders > 0
      ? roundMoney(grossPayments.div(closedOrders)).toFixed(2)
      : '0.00',
    outstandingBalance: roundMoney(outstandingBalance).toFixed(2),
    occupiedTables,
    totalTables: tables.length,
    paymentQueue: paymentQueueOrders.length,
    comparison: calcComparison(
      Number(roundMoney(netCollected).toFixed(2)),
      Number(roundMoney(yesterdayNet).toFixed(2))
    ),
    closedOrdersComparison: calcComparison(closedOrders, yesterdayClosedOrders),
    paymentMethods: Object.entries(byMethod).map(([method, data]) => ({
      method,
      amount: roundMoney(data.amount).toFixed(2),
      count: data.count,
      share: roundMoney(netCollected).isZero() ? 0
        : Math.round(Number(data.amount.div(netCollected).mul(100))),
    })),
    kitchenOverview: {
      newTickets: Number(kitchenData.new_tickets),
      preparingTickets: Number(kitchenData.preparing_tickets),
      readyTickets: Number(kitchenData.ready_tickets),
    },
    inventoryAlerts: {
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
    },
    topItems: topItemsList,
    waiterSales: (waiterSales as any[]).map((ws: any) => {
      const w = waiters.find((u: any) => u.id === ws.waiterId);
      return {
        waiterId: ws.waiterId,
        waiterName: w ? `${w.firstName} ${w.lastName}` : 'Unknown',
        orderCount: ws._count.id,
        totalValue: ws._sum.totalAmount || '0',
      };
    }).slice(0, 10),
    cashierCollections: (cashierCollections as any[]).map((cc: any) => {
      const c = cashiers.find((u: any) => u.id === cc.receivedById);
      return {
        cashierId: cc.receivedById,
        cashierName: c ? `${c.firstName} ${c.lastName}` : 'Unknown',
        paymentCount: cc._count.id,
        totalAmount: cc._sum.amount || '0',
      };
    }).slice(0, 10),
    employeesScheduledToday: employeesScheduled,
    employeesClockedIn,
    openCashierSessions: openSessions,
    pendingApprovals,
  };
}

async function getWaiterDashboard(
  restaurantId: string,
  userId: string,
  todayFilter: any,
  todayDateStr: string
): Promise<any> {
  const [orders, payments, myTipsResult, myAssignment] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, waiterId: userId, status: { notIn: ['DRAFT', 'CANCELLED'] }, createdAt: todayFilter },
      select: { status: true, paymentStatus: true, totalAmount: true, amountPaid: true, amountDue: true },
    }),
    prisma.payment.findMany({
      where: {
        restaurantId,
        completedAt: todayFilter,
        status: 'COMPLETED',
        transactionType: 'PAYMENT',
        order: { waiterId: userId },
      },
      select: { amount: true },
    }),
    // Tips recorded for this waiter today — match by direct recipient OR by order IDs the waiter handled
    prisma.customerTip.findMany({
      where: {
        restaurantId,
        directRecipientUserId: userId,
        recordedAt: todayFilter,
        status: { not: 'REVERSED' },
      },
      select: { amount: true },
    }),
    // My shift status for today
    prisma.shiftAssignment.findFirst({
      where: { userId, restaurantId, workShift: { businessDate: todayDateStr }, status: { in: ['SCHEDULED', 'CLOCKED_IN', 'ON_BREAK'] } },
      orderBy: { scheduledStartAt: 'desc' },
    }),
  ]);

  const closed = orders.filter((o) => o.status === 'CLOSED');
  const paidValue = payments.reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const closedValue = closed.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
  const outstanding = orders.filter((o) => o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PARTIALLY_PAID')
    .reduce((s, o) => s.plus(toDecimal(o.amountDue)), new PrismaDecimal(0));
  const myTipTotal = myTipsResult.reduce((s, t) => s.plus(toDecimal(t.amount)), new PrismaDecimal(0));

  return {
    roleSpecific: true,
    role: 'WAITER',
    myClosedOrders: closed.length,
    myOrderValue: roundMoney(closedValue).toFixed(2),
    myPaidValue: roundMoney(paidValue).toFixed(2),
    myTipTotal: roundMoney(myTipTotal).toFixed(2),
    myTipCount: myTipsResult.length,
    myOutstandingBalance: roundMoney(outstanding).toFixed(2),
    myShiftStatus: myAssignment ? {
      clockedIn: myAssignment.status === 'CLOCKED_IN' || myAssignment.status === 'ON_BREAK',
      onBreak: myAssignment.status === 'ON_BREAK',
      workedMinutes: myAssignment.workedMinutes || 0,
      lateMinutes: myAssignment.lateMinutes || 0,
    } : {
      clockedIn: false,
      onBreak: false,
      workedMinutes: 0,
      lateMinutes: 0,
    },
  };
}

async function getCashierDashboard(
  restaurantId: string,
  userId: string,
  todayFilter: any,
  todayDateStr: string
): Promise<any> {
  const [payments, receipts, queue, myAssignment] = await Promise.all([
    prisma.payment.findMany({
      where: { restaurantId, receivedById: userId, completedAt: todayFilter, status: 'COMPLETED' },
      select: { transactionType: true, amount: true, method: true },
    }),
    prisma.receipt.count({
      where: { restaurantId, issuedById: userId, issuedAt: todayFilter },
    }),
    prisma.order.count({
      where: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] }, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
    }),
    // My shift status for today
    prisma.shiftAssignment.findFirst({
      where: { userId, restaurantId, workShift: { businessDate: todayDateStr }, status: { in: ['SCHEDULED', 'CLOCKED_IN', 'ON_BREAK'] } },
      orderBy: { scheduledStartAt: 'desc' },
    }),
  ]);

  const gross = payments.filter((p) => p.transactionType === 'PAYMENT')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const refunds = payments.filter((p) => p.transactionType === 'REFUND')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const cash = payments.filter((p) => p.method === 'CASH' && p.transactionType === 'PAYMENT')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const mobileMoney = payments.filter((p) => p.method === 'MOBILE_MONEY' && p.transactionType === 'PAYMENT')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const card = payments.filter((p) => p.method === 'CARD' && p.transactionType === 'PAYMENT')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));

  return {
    roleSpecific: true,
    role: 'CASHIER',
    myCompletedPayments: payments.filter((p) => p.transactionType === 'PAYMENT').length,
    myGrossCollected: roundMoney(gross).toFixed(2),
    myRecordedRefunds: roundMoney(refunds).toFixed(2),
    myNetCollected: roundMoney(gross.minus(refunds)).toFixed(2),
    cashCollected: roundMoney(cash).toFixed(2),
    mobileMoneyCollected: roundMoney(mobileMoney).toFixed(2),
    cardCollected: roundMoney(card).toFixed(2),
    receiptsIssued: receipts,
    ordersAwaitingPayment: queue,
    myShiftStatus: myAssignment ? {
      clockedIn: myAssignment.status === 'CLOCKED_IN' || myAssignment.status === 'ON_BREAK',
      onBreak: myAssignment.status === 'ON_BREAK',
      workedMinutes: myAssignment.workedMinutes || 0,
      lateMinutes: myAssignment.lateMinutes || 0,
    } : {
      clockedIn: false,
      onBreak: false,
      workedMinutes: 0,
      lateMinutes: 0,
    },
  };
}

async function getChefDashboard(
  restaurantId: string,
  userId: string,
  todayFilter: any,
  todayDateStr: string
): Promise<any> {
  const [orders, items, myAssignment] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, createdAt: todayFilter, status: { notIn: ['DRAFT', 'CANCELLED'] } },
      select: { status: true, items: { where: { status: { not: 'CANCELLED' } }, select: { status: true } } },
    }),
    prisma.orderItem.findMany({
      where: { order: { restaurantId, createdAt: todayFilter }, status: { not: 'CANCELLED' } },
      select: { status: true },
    }),
    // My shift status for today
    prisma.shiftAssignment.findFirst({
      where: { userId, restaurantId, workShift: { businessDate: todayDateStr }, status: { in: ['SCHEDULED', 'CLOCKED_IN', 'ON_BREAK'] } },
      orderBy: { scheduledStartAt: 'desc' },
    }),
  ]);

  const submitted = orders.filter((o) => o.status === 'SUBMITTED').length;
  const preparing = orders.filter((o) => o.status === 'IN_PREPARATION').length;
  const ready = orders.filter((o) => o.status === 'READY' || o.status === 'PARTIALLY_READY').length;
  const completed = orders.filter((o) => o.status === 'SERVED' || o.status === 'CLOSED').length;
  const itemsPrepared = items.length;

  return {
    roleSpecific: true,
    role: 'CHEF',
    newTickets: submitted,
    preparingTickets: preparing,
    readyTickets: ready,
    completedTickets: completed,
    itemsPrepared,
    totalTickets: orders.length,
    myShiftStatus: myAssignment ? {
      clockedIn: myAssignment.status === 'CLOCKED_IN' || myAssignment.status === 'ON_BREAK',
      onBreak: myAssignment.status === 'ON_BREAK',
      workedMinutes: myAssignment.workedMinutes || 0,
      lateMinutes: myAssignment.lateMinutes || 0,
    } : {
      clockedIn: false,
      onBreak: false,
      workedMinutes: 0,
      lateMinutes: 0,
    },
  };
}

async function getStockKeeperDashboard(
  restaurantId: string,
  userId: string,
  todayFilter: any,
  todayDateStr: string
): Promise<any> {
  const [alerts, movements, balances, myAssignment] = await Promise.all([
    prisma.inventoryAlert.findMany({
      where: { restaurantId, isResolved: false },
      select: { alertType: true },
    }),
    prisma.stockMovement.findMany({
      where: { restaurantId, createdAt: todayFilter },
      select: { movementType: true, quantity: true },
    }),
    prisma.inventoryBalance.findMany({
      where: { restaurantId },
      include: {
        inventoryItem: { select: { name: true, reorderLevel: true, baseUnit: true } },
      },
    }),
    // My shift status for today
    prisma.shiftAssignment.findFirst({
      where: { userId, restaurantId, workShift: { businessDate: todayDateStr }, status: { in: ['SCHEDULED', 'CLOCKED_IN', 'ON_BREAK'] } },
      orderBy: { scheduledStartAt: 'desc' },
    }),
  ]);

  const lowStock = alerts.filter((a) => a.alertType === 'LOW_STOCK').length;
  const outOfStock = alerts.filter((a) => a.alertType === 'OUT_OF_STOCK').length;
  const received = movements.filter((m) => m.movementType === 'STOCK_RECEIPT')
    .reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));
  const consumed = movements.filter((m) =>
    ['DIRECT_SALE_CONSUMPTION', 'RECIPE_CONSUMPTION'].includes(m.movementType)
  ).reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));
  const wastage = movements.filter((m) => m.movementType === 'WASTAGE')
    .reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));
  const negativeStock = balances.filter((b) => b.onHandQuantity.lessThan(0)).length;

  return {
    roleSpecific: true,
    role: 'STOCK_KEEPER',
    lowStockItems: lowStock,
    outOfStockItems: outOfStock,
    negativeStockItems: negativeStock,
    stockReceivedToday: roundMoney(received).toFixed(2),
    stockConsumedToday: roundMoney(consumed).toFixed(2),
    wastageToday: roundMoney(wastage).toFixed(2),
    totalInventoryItems: balances.length,
    myShiftStatus: myAssignment ? {
      clockedIn: myAssignment.status === 'CLOCKED_IN' || myAssignment.status === 'ON_BREAK',
      onBreak: myAssignment.status === 'ON_BREAK',
      workedMinutes: myAssignment.workedMinutes || 0,
      lateMinutes: myAssignment.lateMinutes || 0,
    } : {
      clockedIn: false,
      onBreak: false,
      workedMinutes: 0,
      lateMinutes: 0,
    },
  };
}

// ==========================================
// SALES OVERVIEW
// ==========================================

export async function getSalesOverview(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  groupBy: string = 'day'
): Promise<SalesOverviewResult> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);

  // Previous period of same length
  const rangeMs = dateFrom && dateTo ? dateTo.getTime() - dateFrom.getTime() : 86400000;
  const prevFrom = dateFrom ? new Date(dateFrom.getTime() - rangeMs) : undefined;
  const prevTo = dateFrom;

  const dateRangeFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};
  const prevDateRangeFilter = prevFrom || prevTo ? { createdAt: dateRange(prevFrom, prevTo) } : {};
  const closedDateRangeFilter = dateFrom || dateTo ? { closedAt: dateRange(dateFrom, dateTo) } : {};
  const prevClosedDateRangeFilter = prevFrom || prevTo ? { closedAt: dateRange(prevFrom, prevTo) } : {};

  const [
    closedOrders, prevClosedOrders,
    payments, prevPayments,
    unpaidOrders, dineInOrders, takeawayOrders,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, status: 'CLOSED', ...closedDateRangeFilter },
      select: { totalAmount: true, subtotal: true, taxAmount: true, serviceCharge: true, discountAmount: true, items: { where: { status: { not: 'CANCELLED' } }, select: { id: true } } },
    }),
    prisma.order.findMany({
      where: { restaurantId, status: 'CLOSED', ...prevClosedDateRangeFilter },
      select: { totalAmount: true },
    }),
    prisma.payment.findMany({
      where: { restaurantId, status: 'COMPLETED', completedAt: dateRange(dateFrom, dateTo) },
      select: { transactionType: true, amount: true },
    }),
    prisma.payment.findMany({
      where: { restaurantId, status: 'COMPLETED', completedAt: dateRange(prevFrom, prevTo) },
      select: { transactionType: true, amount: true },
    }),
    prisma.order.findMany({
      where: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] }, paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } },
      select: { totalAmount: true, amountDue: true },
    }),
    prisma.order.findMany({
      where: { restaurantId, orderType: 'DINE_IN', status: 'CLOSED', ...closedDateRangeFilter },
      select: { totalAmount: true },
    }),
    prisma.order.findMany({
      where: { restaurantId, orderType: { in: ['TAKEAWAY', 'DELIVERY'] }, status: 'CLOSED', ...closedDateRangeFilter },
      select: { totalAmount: true },
    }),
  ]);

  const closedCount = closedOrders.length;
  const closedValue = closedOrders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
  const prevClosedValue = prevClosedOrders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
  const grossPayments = payments.filter((p) => p.transactionType === 'PAYMENT').reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const refunds = payments.filter((p) => p.transactionType === 'REFUND').reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const netCollected = grossPayments.minus(refunds);
  const outstanding = unpaidOrders.reduce((s, o) => s.plus(toDecimal(o.amountDue)), new PrismaDecimal(0));
  const avgOrderValue = closedCount > 0 ? closedValue.div(closedCount) : new PrismaDecimal(0);
  const avgItems = closedCount > 0 ? closedOrders.reduce((s, o) => s + o.items.length, 0) / closedCount : 0;
  const taxCollected = closedOrders.reduce((s, o) => s.plus(toDecimal(o.taxAmount)), new PrismaDecimal(0));
  const serviceChargeCollected = closedOrders.reduce((s, o) => s.plus(toDecimal(o.serviceCharge)), new PrismaDecimal(0));
  const discounts = closedOrders.reduce((s, o) => s.plus(toDecimal(o.discountAmount)), new PrismaDecimal(0));
  const dineInValue = dineInOrders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
  const takeawayValue = takeawayOrders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));

  const prevGross = prevPayments.reduce((s, p) => p.transactionType === 'PAYMENT' ? s.plus(toDecimal(p.amount)) : s, new PrismaDecimal(0));

  return {
    closedOrderCount: closedCount,
    closedOrderValue: roundMoney(closedValue).toFixed(2),
    grossCompletedPayments: roundMoney(grossPayments).toFixed(2),
    refunds: roundMoney(refunds).toFixed(2),
    netCollected: roundMoney(netCollected).toFixed(2),
    outstandingBalance: roundMoney(outstanding).toFixed(2),
    averageOrderValue: roundMoney(avgOrderValue).toFixed(2),
    averageItemsPerOrder: avgItems.toFixed(1),
    taxCollected: roundMoney(taxCollected).toFixed(2),
    serviceChargeCollected: roundMoney(serviceChargeCollected).toFixed(2),
    discounts: roundMoney(discounts).toFixed(2),
    dineInValue: roundMoney(dineInValue).toFixed(2),
    takeawayValue: roundMoney(takeawayValue).toFixed(2),
    trend: [],
    comparison: calcComparison(Number(roundMoney(netCollected).toFixed(2)), Number(roundMoney(prevGross).toFixed(2))),
  };
}

// ==========================================
// SALES BY WAITER
// ==========================================

export async function getSalesByWaiters(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ waiters: WaiterSalesResult[]; total: number }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;

  const closedDateFilter = dateFrom || dateTo ? { closedAt: dateRange(dateFrom, dateTo) } : {};
  const createdDateFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        restaurantId,
        roles: { some: { role: { name: 'WAITER' } } },
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      skip,
      take: limit,
    }),
    prisma.user.count({
      where: {
        restaurantId,
        roles: { some: { role: { name: 'WAITER' } } },
      },
    }),
  ]);

  const waiterIds = users.map((u) => u.id);

  const [orders, payments, cancelled, stockMovements] = await Promise.all([
    prisma.order.findMany({
      where: { restaurantId, waiterId: { in: waiterIds }, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...closedDateFilter },
      select: { waiterId: true, orderType: true, status: true, paymentStatus: true, totalAmount: true, amountPaid: true, amountDue: true, tableId: true, createdAt: true, items: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true } } },
    }),
    prisma.payment.findMany({
      where: { restaurantId, status: 'COMPLETED', transactionType: 'REFUND', order: { waiterId: { in: waiterIds } }, ...createdDateFilter },
      select: { amount: true, order: { select: { waiterId: true } } },
    }),
    prisma.orderItem.findMany({
      where: { order: { restaurantId, waiterId: { in: waiterIds }, status: { notIn: ['DRAFT', 'CANCELLED'] } }, status: 'CANCELLED', ...createdDateFilter },
      select: { orderId: true, quantity: true, order: { select: { waiterId: true } } },
    }),
    prisma.stockMovement.findMany({
      where: { restaurantId, attributedWaiterId: { in: waiterIds }, ...createdDateFilter },
      select: { attributedWaiterId: true, id: true },
    }),
  ]);

  const waiterMap = new Map(users.map((u) => [u.id, u]));

  return {
    waiters: waiterIds.map((id) => {
      const user = waiterMap.get(id)!;
      const waiterOrders = orders.filter((o) => o.waiterId === id);
      const closedOrders = waiterOrders.filter((o) => o.status === 'CLOSED');
      const paidOrders = waiterOrders.filter((o) => o.paymentStatus === 'PAID');
      const dineIn = waiterOrders.filter((o) => o.orderType === 'DINE_IN');
      const takeaway = waiterOrders.filter((o) => o.orderType === 'TAKEAWAY' || o.orderType === 'DELIVERY');
      const tablesServed = new Set(waiterOrders.filter((o) => o.tableId).map((o) => o.tableId)).size;
      const itemsServed = waiterOrders.reduce((s, o) => s + o.items.reduce((s2, i) => s2 + i.quantity, 0), 0);
      const closedValue = closedOrders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
      const paidValue = paidOrders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
      const outstanding = waiterOrders.reduce((s, o) => s.plus(toDecimal(o.amountDue)), new PrismaDecimal(0));
      const refundValue = payments.filter((p) => p.order.waiterId === id).reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const cancelledCount = cancelled.filter((c) => c.order.waiterId === id).reduce((s, c) => s + c.quantity, 0);
      const cancelledOrders = new Set(cancelled.filter((c) => c.order.waiterId === id).map((c) => c.orderId)).size;
      const stockCount = stockMovements.filter((m) => m.attributedWaiterId === id).length;
      const times = waiterOrders.filter((o) => o.status === 'CLOSED').map((o) => o.createdAt).filter(Boolean);
      const sorted = times.sort((a: any, b: any) => a.getTime() - b.getTime());

      const avgValue = closedOrders.length > 0 ? closedValue.div(closedOrders.length) : new PrismaDecimal(0);
      return {
        id: user.id, firstName: user.firstName, lastName: user.lastName, employeeCode: user.employeeCode,
        closedOrders: closedOrders.length, dineInOrders: dineIn.length, takeawayOrders: takeaway.length,
        tablesServed, itemsServed,
        closedOrderValue: roundMoney(closedValue).toFixed(2),
        paidOrderValue: roundMoney(paidValue).toFixed(2),
        outstandingBalance: roundMoney(outstanding).toFixed(2),
        averageOrderValue: roundMoney(avgValue).toFixed(2),
        cancelledItemCount: cancelledCount, cancelledOrderCount: cancelledOrders,
        refundValue: roundMoney(refundValue).toFixed(2),
        stockUsageCount: stockCount,
        firstOrderTime: sorted.length > 0 ? sorted[0].toISOString() : null,
        lastOrderTime: sorted.length > 0 ? sorted[sorted.length - 1].toISOString() : null,
      };
    }),
    total,
  };
}

// ==========================================
// WAITER ASSIGNMENT REPORT
// ==========================================

export async function getWaiterAssignmentReport(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  filters: { waiterId?: string } = {},
  pagination: ReportPagination = {}
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;

  const orderDateFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};
  const paymentDateFilter = dateFrom || dateTo ? { completedAt: dateRange(dateFrom, dateTo) } : {};
  const tipDateFilter = dateFrom || dateTo ? { recordedAt: dateRange(dateFrom, dateTo) } : {};
  const shiftDateFilter = dateFrom || dateTo ? { scheduledStartAt: dateRange(dateFrom, dateTo) } : {};

  const waiterWhere: any = {
    restaurantId,
    roles: { some: { role: { name: 'WAITER' } } },
  };
  if (filters.waiterId) waiterWhere.id = filters.waiterId;

  const [waiters, total] = await Promise.all([
    prisma.user.findMany({
      where: waiterWhere,
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      skip,
      take: limit,
    }),
    prisma.user.count({ where: waiterWhere }),
  ]);

  const waiterIds = waiters.map((waiter) => waiter.id);
  if (waiterIds.length === 0) {
    return {
      waiters: [],
      totals: emptyWaiterAssignmentTotals(),
      total,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  const [assignedTables, activeOrders, reportOrders, payments, shifts] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId, assignedWaiterId: { in: waiterIds }, isActive: true },
      select: { id: true, name: true, code: true, capacity: true, status: true, assignedWaiterId: true, diningArea: { select: { name: true } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.order.findMany({
      where: { restaurantId, waiterId: { in: waiterIds }, status: { notIn: ['DRAFT', 'CANCELLED', 'CLOSED'] } },
      select: { id: true, waiterId: true, orderNumber: true, status: true, paymentStatus: true, totalAmount: true, amountDue: true, table: { select: { name: true, code: true } } },
    }),
    prisma.order.findMany({
      where: { restaurantId, waiterId: { in: waiterIds }, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...orderDateFilter },
      select: {
        id: true,
        waiterId: true,
        status: true,
        orderType: true,
        customerId: true,
        customerName: true,
        tableId: true,
        totalAmount: true,
        amountPaid: true,
        amountDue: true,
      },
    }),
    prisma.payment.findMany({
      where: { restaurantId, status: 'COMPLETED', transactionType: 'PAYMENT', order: { waiterId: { in: waiterIds } }, ...paymentDateFilter },
      select: { amount: true, order: { select: { waiterId: true } } },
    }),
    prisma.shiftAssignment.findMany({
      where: { restaurantId, userId: { in: waiterIds }, ...shiftDateFilter },
      select: {
        userId: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        clockedInAt: true,
        clockedOutAt: true,
        workedMinutes: true,
        overtimeMinutes: true,
        lateMinutes: true,
      },
    }),
  ]);

  const orderWaiterById = new Map(reportOrders.map((order) => [order.id, order.waiterId]));
  const reportOrderIds = reportOrders.map((order) => order.id);
  const tips = await prisma.customerTip.findMany({
    where: {
      restaurantId,
      status: { not: 'REVERSED' },
      OR: [
        { directRecipientUserId: { in: waiterIds } },
        ...(reportOrderIds.length > 0 ? [{ directRecipientUserId: null, orderId: { in: reportOrderIds } }] : []),
      ],
      ...tipDateFilter,
    },
    select: { amount: true, directRecipientUserId: true, orderId: true },
  });

  const rows = waiters.map((waiter) => {
    const waiterTables = assignedTables.filter((table) => table.assignedWaiterId === waiter.id);
    const waiterActiveOrders = activeOrders.filter((order) => order.waiterId === waiter.id);
    const waiterOrders = reportOrders.filter((order) => order.waiterId === waiter.id);
    const waiterClosedOrders = waiterOrders.filter((order) => order.status === 'CLOSED');
    const waiterPayments = payments.filter((payment) => payment.order.waiterId === waiter.id);
    const waiterTips = tips.filter((tip) => (tip.directRecipientUserId || orderWaiterById.get(tip.orderId)) === waiter.id);
    const waiterShifts = shifts.filter((shift) => shift.userId === waiter.id);

    const customerKeys = new Set(
      waiterClosedOrders.map((order) => order.customerId || order.customerName || order.id)
    );
    const sales = waiterClosedOrders.reduce((sum, order) => sum.plus(toDecimal(order.totalAmount)), new PrismaDecimal(0));
    const collected = waiterPayments.reduce((sum, payment) => sum.plus(toDecimal(payment.amount)), new PrismaDecimal(0));
    const outstanding = waiterOrders.reduce((sum, order) => sum.plus(toDecimal(order.amountDue)), new PrismaDecimal(0));
    const tipTotal = waiterTips.reduce((sum: PrismaDecimal, tip: any) => sum.plus(toDecimal(tip.amount)), new PrismaDecimal(0));
    const scheduledMinutes = waiterShifts.reduce((sum, shift) => sum + Math.max(0, shift.scheduledEndAt.getTime() - shift.scheduledStartAt.getTime()) / 60000, 0);
    const workedMinutes = waiterShifts.reduce((sum, shift) => {
      if (shift.workedMinutes !== null && shift.workedMinutes !== undefined) return sum + shift.workedMinutes;
      if (shift.clockedInAt && shift.clockedOutAt) return sum + Math.max(0, shift.clockedOutAt.getTime() - shift.clockedInAt.getTime()) / 60000;
      return sum;
    }, 0);
    const workloadScore = waiterTables.length * 2 + waiterActiveOrders.length * 3 + waiterOrders.length + Math.round(workedMinutes / 120);

    return {
      id: waiter.id,
      firstName: waiter.firstName,
      lastName: waiter.lastName,
      waiterName: `${waiter.firstName} ${waiter.lastName}`,
      employeeCode: waiter.employeeCode,
      assignedTableCount: waiterTables.length,
      assignedTables: waiterTables.map((table) => `${table.name}${table.code ? ` (${table.code})` : ''}`).join(', '),
      activeOrderCount: waiterActiveOrders.length,
      activeOrderNumbers: waiterActiveOrders.map((order) => order.orderNumber).join(', '),
      customersServed: customerKeys.size,
      closedOrders: waiterClosedOrders.length,
      totalOrders: waiterOrders.length,
      sales: roundMoney(sales).toFixed(2),
      collected: roundMoney(collected).toFixed(2),
      outstanding: roundMoney(outstanding).toFixed(2),
      tips: roundMoney(tipTotal).toFixed(2),
      scheduledHours: roundMoney(new PrismaDecimal(scheduledMinutes).div(60)).toFixed(2),
      workedHours: roundMoney(new PrismaDecimal(workedMinutes).div(60)).toFixed(2),
      overtimeHours: roundMoney(new PrismaDecimal(waiterShifts.reduce((sum, shift) => sum + (shift.overtimeMinutes || 0), 0)).div(60)).toFixed(2),
      lateMinutes: waiterShifts.reduce((sum, shift) => sum + (shift.lateMinutes || 0), 0),
      workloadScore,
    };
  });

  const totals = rows.reduce((acc, row) => ({
    assignedTableCount: acc.assignedTableCount + row.assignedTableCount,
    activeOrderCount: acc.activeOrderCount + row.activeOrderCount,
    customersServed: acc.customersServed + row.customersServed,
    closedOrders: acc.closedOrders + row.closedOrders,
    totalOrders: acc.totalOrders + row.totalOrders,
    sales: acc.sales.plus(toDecimal(row.sales)),
    collected: acc.collected.plus(toDecimal(row.collected)),
    outstanding: acc.outstanding.plus(toDecimal(row.outstanding)),
    tips: acc.tips.plus(toDecimal(row.tips)),
    scheduledHours: acc.scheduledHours.plus(toDecimal(row.scheduledHours)),
    workedHours: acc.workedHours.plus(toDecimal(row.workedHours)),
    overtimeHours: acc.overtimeHours.plus(toDecimal(row.overtimeHours)),
    lateMinutes: acc.lateMinutes + row.lateMinutes,
  }), {
    assignedTableCount: 0,
    activeOrderCount: 0,
    customersServed: 0,
    closedOrders: 0,
    totalOrders: 0,
    sales: new PrismaDecimal(0),
    collected: new PrismaDecimal(0),
    outstanding: new PrismaDecimal(0),
    tips: new PrismaDecimal(0),
    scheduledHours: new PrismaDecimal(0),
    workedHours: new PrismaDecimal(0),
    overtimeHours: new PrismaDecimal(0),
    lateMinutes: 0,
  });

  return {
    waiters: rows.sort((a, b) => b.workloadScore - a.workloadScore),
    totals: {
      assignedTableCount: totals.assignedTableCount,
      activeOrderCount: totals.activeOrderCount,
      customersServed: totals.customersServed,
      closedOrders: totals.closedOrders,
      totalOrders: totals.totalOrders,
      sales: roundMoney(totals.sales).toFixed(2),
      collected: roundMoney(totals.collected).toFixed(2),
      outstanding: roundMoney(totals.outstanding).toFixed(2),
      tips: roundMoney(totals.tips).toFixed(2),
      scheduledHours: roundMoney(totals.scheduledHours).toFixed(2),
      workedHours: roundMoney(totals.workedHours).toFixed(2),
      overtimeHours: roundMoney(totals.overtimeHours).toFixed(2),
      lateMinutes: totals.lateMinutes,
    },
    total,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

function emptyWaiterAssignmentTotals() {
  return {
    assignedTableCount: 0,
    activeOrderCount: 0,
    customersServed: 0,
    closedOrders: 0,
    totalOrders: 0,
    sales: '0.00',
    collected: '0.00',
    outstanding: '0.00',
    tips: '0.00',
    scheduledHours: '0.00',
    workedHours: '0.00',
    overtimeHours: '0.00',
    lateMinutes: 0,
  };
}

// ==========================================
// SALES BY ITEMS & CATEGORIES
// ==========================================

export async function getSalesByItems(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ items: MenuItemSalesResult[]; total: number }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;

  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const where = {
    order: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] } },
    status: { not: 'CANCELLED' },
    ...createdAtFilter,
  } as any;

  const [aggregated, total] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where,
      _sum: { quantity: true, lineSubtotal: true, lineTaxAmount: true, lineTotal: true },
      _count: { id: true },
      skip,
      take: limit,
      orderBy: { _sum: { lineTotal: 'desc' } },
    }),
    prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where,
      _count: { id: true },
    }),
  ]);

  const menuItemIds = aggregated.map((a) => a.menuItemId);
  const menuItems = menuItemIds.length > 0 ? await prisma.menuItem.findMany({
    where: { id: { in: menuItemIds } },
    select: { id: true, name: true, code: true, itemType: true, isActive: true, trackInventory: true, category: { select: { name: true } } },
  }) : [];
  const menuItemMap = new Map(menuItems.map((m: any) => [m.id, m]));

  return {
    items: aggregated.map((a) => {
      const menuItem = menuItemMap.get(a.menuItemId) || { name: 'Unknown', code: '', itemType: 'OTHER', isActive: false, trackInventory: false, category: null };
      const qty = a._sum.quantity || 0;
      const gross = toDecimal(a._sum.lineSubtotal || 0);
      const net = toDecimal(a._sum.lineTotal || 0);
      const tax = toDecimal(a._sum.lineTaxAmount || 0);
      return {
        id: a.menuItemId, name: menuItem.name, code: menuItem.code,
        category: menuItem.category?.name || null, itemType: menuItem.itemType,
        quantitySold: qty, grossValue: roundMoney(gross).toFixed(2),
        discounts: roundMoney(gross.minus(net)).toFixed(2),
        netValue: roundMoney(net).toFixed(2), tax: roundMoney(tax).toFixed(2),
        cancelledQuantity: 0, refundedQuantity: 0,
        averageSellingPrice: qty > 0 ? roundMoney(net.div(qty)).toFixed(2) : '0.00',
        trackInventory: menuItem.trackInventory, isActive: menuItem.isActive,
      };
    }),
    total: total.length,
  };
}

export async function getSalesByCategories(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<CategorySalesResult[]> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const items = await prisma.orderItem.findMany({
    where: { order: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] } }, status: { not: 'CANCELLED' }, ...createdAtFilter },
    select: { quantity: true, lineTotal: true, menuItem: { select: { category: { select: { id: true, name: true } } } } },
  });

  const categoryMap = new Map<string, { id: string; name: string; qty: number; value: DecimalType }>();
  items.forEach((item: any) => {
    const cat = item.menuItem?.category;
    const catId = cat?.id || '__none__';
    const catName = cat?.name || 'Uncategorised';
    const existing = categoryMap.get(catId);
    if (existing) {
      existing.qty += item.quantity;
      existing.value = existing.value.plus(toDecimal(item.lineTotal));
    } else {
      categoryMap.set(catId, { id: catId, name: catName, qty: item.quantity, value: toDecimal(item.lineTotal) });
    }
  });

  const totalValue = Array.from(categoryMap.values()).reduce((s, c) => s.plus(c.value), new PrismaDecimal(0));
  const activeItemCounts = await prisma.menuItem.groupBy({
    by: ['categoryId'],
    where: { restaurantId, isActive: true },
    _count: { id: true },
  });
  const activeCountMap = new Map(activeItemCounts.map((a) => [a.categoryId, a._count.id]));

  return Array.from(categoryMap.entries())
    .map(([id, data]) => ({
      id: data.id, name: data.name, quantitySold: data.qty,
      closedOrderValue: roundMoney(data.value).toFixed(2),
      shareOfSales: totalValue.isZero() ? '0' : roundMoney(data.value.div(totalValue).mul(100)).toFixed(1) + '%',
      averageItemValue: data.qty > 0 ? roundMoney(data.value.div(data.qty)).toFixed(2) : '0.00',
      cancelledQuantity: 0, activeItemCount: activeCountMap.get(id === '__none__' ? null : id) || 0,
    }))
    .sort((a, b) => Number(b.closedOrderValue) - Number(a.closedOrderValue));
}

// ==========================================
// PAYMENT SUMMARY
// ==========================================

export async function getPaymentSummary(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const completedFilter = dateFrom || dateTo ? { completedAt: dateRange(dateFrom, dateTo) } : {};

  const payments = await prisma.payment.findMany({
    where: { restaurantId, status: 'COMPLETED', ...completedFilter },
    select: { transactionType: true, amount: true, method: true },
  });

  const grossPayments = payments.filter((p) => p.transactionType === 'PAYMENT')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const refunds = payments.filter((p) => p.transactionType === 'REFUND')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const reversals = payments.filter((p) => p.transactionType === 'REVERSAL')
    .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
  const netCollected = grossPayments.minus(refunds).minus(reversals);

  const paymentCount = payments.filter((p) => p.transactionType === 'PAYMENT').length;
  const refundCount = payments.filter((p) => p.transactionType === 'REFUND').length;

  const [fullyPaid, partiallyPaid, unpaidServed, receiptCount] = await Promise.all([
    prisma.order.count({ where: { restaurantId, paymentStatus: 'PAID' } }),
    prisma.order.count({ where: { restaurantId, paymentStatus: 'PARTIALLY_PAID' } }),
    prisma.order.count({ where: { restaurantId, status: 'SERVED', paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] } } }),
    prisma.receipt.count({ where: { restaurantId, ...completedFilter } }),
  ]);

  const reprintCount = await prisma.receipt.aggregate({
    where: { restaurantId, ...completedFilter },
    _sum: { reprintCount: true },
  });

  return {
    grossPayments: roundMoney(grossPayments).toFixed(2),
    refunds: roundMoney(refunds).toFixed(2),
    reversals: roundMoney(reversals).toFixed(2),
    netCollected: roundMoney(netCollected).toFixed(2),
    paymentCount, refundCount,
    averagePayment: paymentCount > 0 ? roundMoney(grossPayments.div(paymentCount)).toFixed(2) : '0.00',
    fullyPaidOrders: fullyPaid, partiallyPaidOrders: partiallyPaid,
    unpaidServedOrders: unpaidServed,
    receiptCount, reprintCount: reprintCount._sum.reprintCount || 0,
  };
}

// ==========================================
// PAYMENT METHODS
// ==========================================

export async function getPaymentMethodSummary(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<PaymentMethodSummary[]> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const completedFilter = dateFrom || dateTo ? { completedAt: dateRange(dateFrom, dateTo) } : {};

  const payments = await prisma.payment.findMany({
    where: { restaurantId, status: 'COMPLETED', ...completedFilter },
    select: { transactionType: true, amount: true, method: true, receivedById: true, referenceNumber: true },
  });

  const paymentMethods = payments.filter((p) => p.transactionType === 'PAYMENT');
  const refundMethods = payments.filter((p) => p.transactionType === 'REFUND');
  const netCollected = new PrismaDecimal(paymentMethods.reduce((s, p) => s + Number(p.amount), 0))
    .minus(new PrismaDecimal(refundMethods.reduce((s, p) => s + Number(p.amount), 0)));

  const methodMap = new Map<string, { completedAmount: DecimalType; completedCount: number; refundAmount: DecimalType; cashiers: Set<string>; missingRefs: number }>();

  paymentMethods.forEach((p) => {
    const m = methodMap.get(p.method) || { completedAmount: new PrismaDecimal(0), completedCount: 0, refundAmount: new PrismaDecimal(0), cashiers: new Set<string>(), missingRefs: 0 };
    m.completedAmount = m.completedAmount.plus(toDecimal(p.amount));
    m.completedCount++;
    m.cashiers.add(p.receivedById);
    if (!p.referenceNumber) m.missingRefs++;
    methodMap.set(p.method, m);
  });

  refundMethods.forEach((p) => {
    const m = methodMap.get(p.method);
    if (m) {
      m.refundAmount = m.refundAmount.plus(toDecimal(p.amount));
    } else {
      methodMap.set(p.method, {
        completedAmount: new PrismaDecimal(0), completedCount: 0,
        refundAmount: toDecimal(p.amount),
        cashiers: new Set(), missingRefs: 0,
      });
    }
  });

  return Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    completedAmount: roundMoney(data.completedAmount).toFixed(2),
    completedCount: data.completedCount,
    refundAmount: roundMoney(data.refundAmount).toFixed(2),
    netAmount: roundMoney(data.completedAmount.minus(data.refundAmount)).toFixed(2),
    shareOfNetCollected: netCollected.isZero() ? '0.0' : roundMoney(data.completedAmount.div(netCollected).mul(100)).toFixed(1),
    averageTransactionValue: data.completedCount > 0 ? roundMoney(data.completedAmount.div(data.completedCount)).toFixed(2) : '0.00',
    cashierCount: data.cashiers.size,
    referenceMissingCount: data.missingRefs,
  }));
}

// ==========================================
// OUTSTANDING BALANCES
// ==========================================

export async function getOutstandingBalances(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ orders: OutstandingOrderResult[]; total: number; summary: any }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;

  const where: any = {
    restaurantId,
    status: { notIn: ['DRAFT', 'CANCELLED'] },
    paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
  };
  if (dateFrom || dateTo) where.createdAt = dateRange(dateFrom, dateTo);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        table: { select: { name: true, code: true } },
        waiter: { select: { firstName: true, lastName: true } },
        payments: { where: { status: 'COMPLETED', transactionType: 'PAYMENT' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  const outstandingTotal = orders.reduce((s, o) => s.plus(toDecimal(o.amountDue)), new PrismaDecimal(0));
  const unpaidCount = orders.filter((o) => o.paymentStatus === 'UNPAID').length;
  const partiallyPaidCount = orders.filter((o) => o.paymentStatus === 'PARTIALLY_PAID').length;

  return {
    orders: orders.map((o) => ({
      id: o.id, orderNumber: o.orderNumber, orderType: o.orderType,
      table: o.table, waiter: o.waiter, customerName: o.customerName,
      orderStatus: o.status, paymentStatus: o.paymentStatus,
      totalAmount: o.totalAmount.toString(), amountPaid: o.amountPaid.toString(),
      amountDue: o.amountDue.toString(),
      paymentRequestedAt: o.paymentRequestedAt?.toISOString() || null,
      age: Math.floor((Date.now() - o.createdAt.getTime()) / 60000),
      lastPaymentTime: o.payments[0]?.createdAt?.toISOString() || null,
    })),
    total,
    summary: {
      totalOutstanding: roundMoney(outstandingTotal).toFixed(2),
      unpaidOrderCount: unpaidCount,
      partiallyPaidOrderCount: partiallyPaidCount,
    },
  };
}

// ==========================================
// CASHIER ACTIVITY
// ==========================================

export async function getCashierActivity(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ cashiers: CashierActivityResult[]; total: number }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;
  const completedFilter = dateFrom || dateTo ? { completedAt: dateRange(dateFrom, dateTo) } : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: {
        restaurantId,
        roles: { some: { role: { name: { in: ['CASHIER', 'ADMIN', 'MANAGER'] } } } },
      },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      skip, take: limit,
    }),
    prisma.user.count({
      where: { restaurantId, roles: { some: { role: { name: { in: ['CASHIER', 'ADMIN', 'MANAGER'] } } } } },
    }),
  ]);

  const userIds = users.map((u) => u.id);
  const userMap = new Map(users.map((u: any) => [u.id, u]));

  const [payments, receipts, voids] = await Promise.all([
    prisma.payment.findMany({
      where: { restaurantId, receivedById: { in: userIds }, status: 'COMPLETED', ...completedFilter },
      select: { receivedById: true, transactionType: true, method: true, amount: true },
    }),
    prisma.receipt.findMany({
      where: { restaurantId, issuedById: { in: userIds }, ...completedFilter },
      select: { issuedById: true },
    }),
    prisma.payment.findMany({
      where: { restaurantId, voidedById: { in: userIds }, ...completedFilter },
      select: { voidedById: true },
    }),
  ]);

  return {
    cashiers: userIds.map((id) => {
      const user = userMap.get(id)!;
      const userPayments = payments.filter((p) => p.receivedById === id);
      const grossPayments = userPayments.filter((p) => p.transactionType === 'PAYMENT')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const refundsTotal = userPayments.filter((p) => p.transactionType === 'REFUND')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const cash = userPayments.filter((p) => p.method === 'CASH' && p.transactionType === 'PAYMENT')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const card = userPayments.filter((p) => p.method === 'CARD' && p.transactionType === 'PAYMENT')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const mobile = userPayments.filter((p) => p.method === 'MOBILE_MONEY' && p.transactionType === 'PAYMENT')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const bank = userPayments.filter((p) => p.method === 'BANK_TRANSFER' && p.transactionType === 'PAYMENT')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));
      const voucher = userPayments.filter((p) => p.method === 'VOUCHER' && p.transactionType === 'PAYMENT')
        .reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));

      return {
        id: user.id, firstName: user.firstName, lastName: user.lastName,
        employeeCode: user.employeeCode,
        completedPaymentCount: userPayments.filter((p) => p.transactionType === 'PAYMENT').length,
        grossRecorded: roundMoney(grossPayments).toFixed(2),
        refundsRecorded: roundMoney(refundsTotal).toFixed(2),
        netRecorded: roundMoney(grossPayments.minus(refundsTotal)).toFixed(2),
        cashAmount: roundMoney(cash).toFixed(2),
        cardAmount: roundMoney(card).toFixed(2),
        mobileMoneyAmount: roundMoney(mobile).toFixed(2),
        bankTransferAmount: roundMoney(bank).toFixed(2),
        voucherAmount: roundMoney(voucher).toFixed(2),
        receiptsIssued: receipts.filter((r) => r.issuedById === id).length,
        reprints: 0,
        voidsInitiated: voids.filter((v) => v.voidedById === id).length,
        firstPaymentTime: null,
        lastPaymentTime: null,
      };
    }),
    total,
  };
}

// ==========================================
// REFUNDS AND VOIDS
// ==========================================

export async function getRefundsReport(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;

  const where: any = {
    restaurantId,
    transactionType: { in: ['REFUND', 'REVERSAL'] },
    status: 'COMPLETED',
  };
  if (dateFrom || dateTo) where.completedAt = dateRange(dateFrom, dateTo);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        order: { select: { orderNumber: true, waiter: { select: { firstName: true, lastName: true } } } },
        receivedBy: { select: { firstName: true, lastName: true } },
        parentPayment: { select: { paymentNumber: true, completedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  const totalRefundAmount = payments.reduce((s, p) => s.plus(toDecimal(p.amount)), new PrismaDecimal(0));

  return {
    refunds: payments.map((p) => ({
      id: p.id, refundNumber: p.paymentNumber,
      originalPaymentNumber: p.parentPayment?.paymentNumber || '',
      orderNumber: p.order.orderNumber,
      receiptNumber: null,
      amount: p.amount.toString(), method: p.method,
      reason: p.notes || '', type: p.transactionType,
      processedBy: p.receivedBy, approvedBy: null,
      waiterName: p.order.waiter ? `${p.order.waiter.firstName} ${p.order.waiter.lastName}` : '',
      createdAt: p.createdAt.toISOString(),
      originalPaymentDate: p.parentPayment?.completedAt?.toISOString() || null,
    })),
    total,
    summary: {
      refundCount: payments.length,
      refundTotal: roundMoney(totalRefundAmount).toFixed(2),
    },
  };
}

// ==========================================
// KITCHEN PERFORMANCE
// ==========================================

export async function getKitchenPerformance(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<KitchenPerformanceResult> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const orders = await prisma.order.findMany({
    where: { restaurantId, status: { notIn: ['DRAFT', 'CANCELLED'] }, ...createdAtFilter },
    select: { id: true, status: true, createdAt: true, items: { where: { status: { not: 'CANCELLED' } }, select: { status: true } } },
  });

  const cancelledCount = await prisma.orderItem.count({
    where: { order: { restaurantId, ...createdAtFilter }, status: 'CANCELLED' },
  });

  const submitted = orders.filter((o) => o.status === 'SUBMITTED').length;
  const preparing = orders.filter((o) => ['IN_PREPARATION', 'PARTIALLY_READY'].includes(o.status)).length;
  const ready = orders.filter((o) => o.status === 'READY').length;
  const completed = orders.filter((o) => ['SERVED', 'CLOSED'].includes(o.status)).length;
  const itemsPrepared = orders.reduce((s, o) => s + o.items.filter((i) => i.status !== 'CANCELLED').length, 0);

  return {
    ticketsCreated: orders.length,
    ticketsCompleted: completed,
    averageAcceptanceTime: null,
    averagePreparationTime: null,
    averageTotalKitchenTime: null,
    medianPreparationTime: null,
    delayedTicketCount: 0,
    partiallyReadyCount: preparing,
    cancelledTicketCount: cancelledCount,
    itemsPrepared,
    itemsCancelledAfterPreparation: 0,
    sampleCount: completed,
    chartData: [
      { label: 'Submitted', value: submitted },
      { label: 'Preparing', value: preparing },
      { label: 'Ready', value: ready },
      { label: 'Completed', value: completed },
    ],
  };
}

// ==========================================
// TABLE PERFORMANCE
// ==========================================

export async function getTablePerformance(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ tables: TablePerformanceResult[]; total: number }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);

  const closedDateFilter = dateFrom || dateTo ? { closedAt: dateRange(dateFrom, dateTo) } : {};

  const [tables, total] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId, isActive: true },
      include: {
        diningArea: { select: { name: true } },
        orders: {
          where: { status: 'CLOSED', orderType: 'DINE_IN', ...closedDateFilter },
          select: { totalAmount: true, createdAt: true, closedAt: true, items: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true } } },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.restaurantTable.count({ where: { restaurantId, isActive: true } }),
  ]);

  return {
    tables: tables.map((t: any) => {
      const closedOrders = t.orders || [];
      const totalValue = closedOrders.reduce((s: DecimalType, o: any) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
      const avgValue = closedOrders.length > 0 ? totalValue.div(closedOrders.length) : new PrismaDecimal(0);
      const items = closedOrders.reduce((s: number, o: any) => s + o.items.reduce((s2: number, i: any) => s2 + i.quantity, 0), 0);
      return {
        id: t.id, name: t.name, code: t.code,
        diningArea: t.diningArea?.name || null,
        closedOrderCount: closedOrders.length,
        totalClosedOrderValue: roundMoney(totalValue).toFixed(2),
        averageOrderValue: roundMoney(avgValue).toFixed(2),
        averageOccupancyDuration: null,
        averageGuestCount: 0, itemsPerOrder: closedOrders.length > 0 ? Math.round(items / closedOrders.length) : 0,
        cancellationCount: 0, currentStatus: t.status,
      };
    }),
    total,
  };
}

// ==========================================
// DINING AREA REPORT
// ==========================================

export async function getDiningAreaReport(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const closedDateFilter = dateFrom || dateTo ? { closedAt: dateRange(dateFrom, dateTo) } : {};

  const areas = await prisma.diningArea.findMany({
    where: { restaurantId },
    include: {
      tables: {
        include: {
          orders: {
            where: { status: 'CLOSED', orderType: 'DINE_IN', ...closedDateFilter },
            select: { totalAmount: true, createdAt: true, closedAt: true, items: { where: { status: { not: 'CANCELLED' } }, select: { quantity: true } } },
          },
        },
      },
    },
  });

  return areas.map((area: any) => {
    const allOrders = area.tables.flatMap((t: any) => t.orders || []);
    const totalValue = allOrders.reduce((s: DecimalType, o: any) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0));
    const itemsServed = allOrders.reduce((s: number, o: any) => s + o.items.reduce((s2: number, i: any) => s2 + i.quantity, 0), 0);
    const avgValue = allOrders.length > 0 ? totalValue.div(allOrders.length) : new PrismaDecimal(0);
    return {
      id: area.id, name: area.name,
      activeTables: area.tables.length,
      closedDineInOrders: allOrders.length,
      guestsServed: 0,
      closedOrderValue: roundMoney(totalValue).toFixed(2),
      averageOrderValue: roundMoney(avgValue).toFixed(2),
      tableTurnover: area.tables.length > 0 ? Math.round(allOrders.length / area.tables.length) : 0,
      cancellationCount: 0,
    };
  });
}

// ==========================================
// ORDER TYPES & STATUSES
// ==========================================

export async function getOrderTypeComparison(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const closedDateFilter = dateFrom || dateTo ? { closedAt: dateRange(dateFrom, dateTo) } : {};

  const groups = await prisma.order.groupBy({
    by: ['orderType'],
    where: { restaurantId, status: 'CLOSED', ...closedDateFilter },
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  return groups.map((g: any) => ({
    orderType: g.orderType,
    orderCount: g._count.id,
    closedOrderValue: g._sum.totalAmount?.toString() || '0',
  }));
}

export async function getOrderStatusDistribution(
  restaurantId: string
): Promise<any> {
  const groups = await prisma.order.groupBy({
    by: ['status'],
    where: { restaurantId },
    _count: { id: true },
    _sum: { totalAmount: true },
  });

  const statusOrder = ['DRAFT', 'SUBMITTED', 'IN_PREPARATION', 'PARTIALLY_READY', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'];
  return statusOrder.map((status) => {
    const g = groups.find((g: any) => g.status === status);
    return {
      status,
      count: g?._count.id || 0,
      value: g?._sum.totalAmount?.toString() || '0',
    };
  });
}

// ==========================================
// CANCELLATION REPORT
// ==========================================

export async function getCancellationReport(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;
  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const [items, total] = await Promise.all([
    prisma.orderItem.findMany({
      where: { order: { restaurantId }, status: 'CANCELLED', ...createdAtFilter },
      include: {
        order: {
          select: { orderNumber: true, waiter: { select: { firstName: true, lastName: true } }, table: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
    prisma.orderItem.count({
      where: { order: { restaurantId }, status: 'CANCELLED', ...createdAtFilter },
    }),
  ]);

  const totalCancelledValue = items.reduce((s, i) => s.plus(toDecimal(i.lineTotal)), new PrismaDecimal(0));

  return {
    items: items.map((i) => ({
      orderNumber: i.order.orderNumber,
      itemName: i.menuItemNameSnapshot,
      quantity: i.quantity,
      valueRemoved: i.lineTotal.toString(),
      reason: i.specialInstructions || '',
      waiterName: i.order.waiter ? `${i.order.waiter.firstName} ${i.order.waiter.lastName}` : '',
      tableName: i.order.table?.name || '',
      dateTime: i.createdAt.toISOString(),
    })),
    total,
    summary: {
      cancelledItemCount: items.length,
      cancelledValue: roundMoney(totalCancelledValue).toFixed(2),
    },
  };
}

// ==========================================
// INVENTORY USAGE
// ==========================================

export async function getInventoryUsage(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ items: InventoryUsageResult[]; total: number }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;
  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const [inventoryItems, total, movements, balances] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true, sku: true, baseUnit: true },
      skip, take: limit,
    }),
    prisma.inventoryItem.count({ where: { restaurantId, isActive: true } }),
    prisma.stockMovement.findMany({
      where: { restaurantId, ...createdAtFilter },
      select: { inventoryItemId: true, movementType: true, quantity: true },
    }),
    prisma.inventoryBalance.findMany({
      where: { restaurantId },
      select: { inventoryItemId: true, onHandQuantity: true, reservedQuantity: true },
    }),
  ]);

  const itemIds = inventoryItems.map((i) => i.id);
  const balanceMap = new Map(balances.map((b: any) => [b.inventoryItemId, b]));

  return {
    items: itemIds.map((id) => {
      const item = inventoryItems.find((i) => i.id === id)!;
      const itemMovements = movements.filter((m) => m.inventoryItemId === id);
      const balance = balanceMap.get(id) || { onHandQuantity: new PrismaDecimal(0), reservedQuantity: new PrismaDecimal(0) };
      const aggregate = (type: string) => itemMovements.filter((m) => m.movementType === type).reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));

      return {
        id: item.id, name: item.name, sku: item.sku, unit: item.baseUnit,
        openingQuantity: '0',
        stockReceived: roundMoney(aggregate('STOCK_RECEIPT')).toFixed(3),
        reservationQuantity: roundMoney(aggregate('RESERVATION_CREATED')).toFixed(3),
        directSaleConsumption: roundMoney(aggregate('DIRECT_SALE_CONSUMPTION')).toFixed(3),
        recipeConsumption: roundMoney(aggregate('RECIPE_CONSUMPTION')).toFixed(3),
        wastage: roundMoney(aggregate('WASTAGE')).toFixed(3),
        returns: roundMoney(aggregate('RETURN_TO_STOCK')).toFixed(3),
        adjustmentIn: roundMoney(aggregate('MANUAL_ADJUSTMENT_IN')).toFixed(3),
        adjustmentOut: roundMoney(aggregate('MANUAL_ADJUSTMENT_OUT')).toFixed(3),
        transferIn: roundMoney(aggregate('TRANSFER_IN')).toFixed(3),
        transferOut: roundMoney(aggregate('TRANSFER_OUT')).toFixed(3),
        closingOnHand: roundMoney(balance.onHandQuantity).toFixed(3),
        closingReserved: roundMoney(balance.reservedQuantity).toFixed(3),
        closingAvailable: roundMoney(toDecimal(balance.onHandQuantity).minus(toDecimal(balance.reservedQuantity))).toFixed(3),
      };
    }),
    total,
  };
}

// ==========================================
// INVENTORY COST CONSUMPTION
// ==========================================

export async function getInventoryCostConsumption(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<{ items: InventoryCostResult[]; total: number }> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;
  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const [inventoryItems, total, movements] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { restaurantId, isActive: true },
      select: { id: true, name: true, sku: true, baseUnit: true, averageCost: true },
      skip, take: limit,
    }),
    prisma.inventoryItem.count({ where: { restaurantId, isActive: true } }),
    prisma.stockMovement.findMany({
      where: { restaurantId, ...createdAtFilter },
      select: { inventoryItemId: true, movementType: true, quantity: true, unitCost: true, totalCost: true },
    }),
  ]);

  return {
    items: inventoryItems.map((item: any) => {
      const itemMovements = movements.filter((m) => m.inventoryItemId === item.id);
      const avgCost = toDecimal(item.averageCost || 0);
      const consumed = itemMovements.filter((m) => ['DIRECT_SALE_CONSUMPTION', 'RECIPE_CONSUMPTION'].includes(m.movementType));
      const consumedQty = consumed.reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));
      const wastageTotal = itemMovements.filter((m) => m.movementType === 'WASTAGE').reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));
      const returnsTotal = itemMovements.filter((m) => m.movementType === 'RETURN_TO_STOCK').reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));

      return {
        id: item.id, name: item.name, sku: item.sku,
        quantityConsumed: roundMoney(consumedQty).toFixed(3),
        unit: item.baseUnit,
        averageCost: roundMoney(avgCost).toFixed(2),
        estimatedConsumptionCost: roundMoney(consumedQty.mul(avgCost)).toFixed(2),
        directSaleCost: '0', recipeCost: '0',
        wastageCost: roundMoney(wastageTotal.mul(avgCost)).toFixed(2),
        returnValue: roundMoney(returnsTotal.mul(avgCost)).toFixed(2),
      };
    }),
    total,
  };
}

// ==========================================
// WASTAGE REPORT
// ==========================================

export async function getWastageReport(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;
  const createdAtFilter = dateFrom || dateTo ? { createdAt: dateRange(dateFrom, dateTo) } : {};

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { restaurantId, movementType: 'WASTAGE', ...createdAtFilter },
      include: {
        inventoryItem: { select: { name: true, baseUnit: true, averageCost: true } },
        actor: { select: { firstName: true, lastName: true } },
        attributedWaiter: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip, take: limit,
    }),
    prisma.stockMovement.count({
      where: { restaurantId, movementType: 'WASTAGE', ...createdAtFilter },
    }),
  ]);

  const totalQty = movements.reduce((s, m) => s.plus(toDecimal(m.quantity)), new PrismaDecimal(0));
  const totalCost = movements.reduce((s, m) => s.plus(toDecimal(m.totalCost || 0)), new PrismaDecimal(0));

  return {
    items: movements.map((m: any) => ({
      inventoryItemName: m.inventoryItem.name,
      quantity: m.quantity.toString(),
      unit: m.inventoryItem.baseUnit,
      estimatedCost: m.totalCost?.toString() || roundMoney(toDecimal(m.quantity).mul(toDecimal(m.inventoryItem.averageCost || 0))).toFixed(2),
      reason: m.reason || '',
      recordedBy: m.actor,
      approvedBy: null,
      relatedOrderNumber: null,
      relatedWaiter: m.attributedWaiter ? `${m.attributedWaiter.firstName} ${m.attributedWaiter.lastName}` : null,
      kitchenStation: null,
      createdAt: m.createdAt.toISOString(),
    })),
    total,
    summary: {
      movementCount: movements.length,
      totalQuantity: roundMoney(totalQty).toFixed(3),
      estimatedCost: roundMoney(totalCost).toFixed(2),
    },
  };
}

// ==========================================
// LOW STOCK REPORT
// ==========================================

export async function getLowStockReport(
  restaurantId: string
): Promise<any> {
  const items = await prisma.inventoryItem.findMany({
    where: { restaurantId, isActive: true },
    include: {
      category: { select: { name: true } },
      inventoryBalances: { where: { restaurantId } },
    },
  });

  return items
    .filter((item: any) => {
      const onHand = item.inventoryBalances.reduce((s: DecimalType, b: any) => s.plus(toDecimal(b.onHandQuantity)), new PrismaDecimal(0));
      return onHand.lessThan(toDecimal(item.reorderLevel || 0));
    })
    .map((item: any) => {
      const onHand = item.inventoryBalances.reduce((s: DecimalType, b: any) => s.plus(toDecimal(b.onHandQuantity)), new PrismaDecimal(0));
      const reserved = item.inventoryBalances.reduce((s: DecimalType, b: any) => s.plus(toDecimal(b.reservedQuantity)), new PrismaDecimal(0));
      return {
        id: item.id, name: item.name, sku: item.sku,
        category: item.category?.name || null, unit: item.baseUnit,
        onHand: roundMoney(onHand).toFixed(3),
        reserved: roundMoney(reserved).toFixed(3),
        available: roundMoney(onHand.minus(reserved)).toFixed(3),
        reorderLevel: item.reorderLevel.toString(),
        targetStock: item.targetStockLevel?.toString() || null,
        averageCost: item.averageCost?.toString() || null,
        status: onHand.isZero() ? 'OUT_OF_STOCK' : (onHand.isNegative() ? 'NEGATIVE' : 'LOW_STOCK'),
      };
    })
    .sort((a, b) => Number(a.available) - Number(b.available));
}

// ==========================================
// TAX & SERVICE CHARGE SUMMARY
// ==========================================

export async function getTaxServiceChargeSummary(
  restaurantId: string,
  dateFilter: ReportDateFilter
): Promise<TaxServiceChargeResult> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const closedDateFilter = dateFrom || dateTo ? { closedAt: dateRange(dateFrom, dateTo) } : {};

  const orders = await prisma.order.findMany({
    where: { restaurantId, status: 'CLOSED', ...closedDateFilter },
    select: { subtotal: true, taxAmount: true, serviceCharge: true, discountAmount: true, totalAmount: true, orderType: true, closedAt: true },
  });

  const totals = {
    subtotal: orders.reduce((s, o) => s.plus(toDecimal(o.subtotal)), new PrismaDecimal(0)),
    tax: orders.reduce((s, o) => s.plus(toDecimal(o.taxAmount)), new PrismaDecimal(0)),
    serviceCharge: orders.reduce((s, o) => s.plus(toDecimal(o.serviceCharge)), new PrismaDecimal(0)),
    discount: orders.reduce((s, o) => s.plus(toDecimal(o.discountAmount)), new PrismaDecimal(0)),
    total: orders.reduce((s, o) => s.plus(toDecimal(o.totalAmount)), new PrismaDecimal(0)),
  };

  const receiptCount = await prisma.receipt.count({
    where: { restaurantId, ...closedDateFilter },
  });

  // By order type
  const byTypeMap = new Map<string, { tax: DecimalType; serviceCharge: DecimalType }>();
  orders.forEach((o) => {
    const t = byTypeMap.get(o.orderType) || { tax: new PrismaDecimal(0), serviceCharge: new PrismaDecimal(0) };
    t.tax = t.tax.plus(toDecimal(o.taxAmount));
    t.serviceCharge = t.serviceCharge.plus(toDecimal(o.serviceCharge));
    byTypeMap.set(o.orderType, t);
  });

  return {
    taxOnClosedOrders: roundMoney(totals.tax).toFixed(2),
    taxIncluded: '0',
    taxAdded: roundMoney(totals.tax).toFixed(2),
    serviceCharge: roundMoney(totals.serviceCharge).toFixed(2),
    discount: roundMoney(totals.discount).toFixed(2),
    closedOrderSubtotal: roundMoney(totals.subtotal).toFixed(2),
    closedOrderTotal: roundMoney(totals.total).toFixed(2),
    receiptCount,
    byDay: [],
    byOrderType: Array.from(byTypeMap.entries()).map(([orderType, data]) => ({
      orderType,
      tax: roundMoney(data.tax).toFixed(2),
      serviceCharge: roundMoney(data.serviceCharge).toFixed(2),
    })),
  };
}

// ==========================================
// RECEIPT REPORT
// ==========================================

export async function getReceiptReport(
  restaurantId: string,
  dateFilter: ReportDateFilter,
  pagination: ReportPagination = {}
): Promise<any> {
  const { dateFrom, dateTo } = await buildDateFilters(restaurantId, dateFilter.dateFrom, dateFilter.dateTo, dateFilter.preset);
  const page = pagination.page || 1;
  const limit = Math.min(pagination.limit || 25, 100);
  const skip = (page - 1) * limit;

  const where: any = { restaurantId };
  if (dateFrom || dateTo) where.issuedAt = dateRange(dateFrom, dateTo);

  const [receipts, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      include: {
        issuedBy: { select: { firstName: true, lastName: true } },
        order: { select: { orderNumber: true, waiter: { select: { firstName: true, lastName: true } }, table: { select: { name: true } } } },
        payments: { select: { method: true, amount: true } },
      },
      orderBy: { issuedAt: 'desc' },
      skip, take: limit,
    }),
    prisma.receipt.count({ where }),
  ]);

  return {
    receipts: receipts.map((r) => ({
      receiptNumber: r.receiptNumber, orderNumber: r.order.orderNumber,
      issuedAt: r.issuedAt.toISOString(),
      waiterName: r.order.waiter ? `${r.order.waiter.firstName} ${r.order.waiter.lastName}` : '',
      cashierName: r.issuedBy ? `${r.issuedBy.firstName} ${r.issuedBy.lastName}` : '',
      tableName: r.order.table?.name || '',
      total: r.totalAmount.toString(),
      paymentMethods: r.payments.map((p) => p.method),
      status: r.status, reprintCount: r.reprintCount,
      hasPdf: true,
    })),
    total,
  };
}

// ==========================================
// AUDIT
// ==========================================

export async function logReportView(
  restaurantId: string,
  userId: string,
  reportType: string,
  filters?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    restaurantId,
    userId,
    action: 'Report viewed',
    entityType: 'Report',
    description: `Viewed report: ${reportType}`,
    metadata: { reportType, filters } as any,
  });
}

export async function logReportExport(
  restaurantId: string,
  userId: string,
  reportType: string,
  format: string,
  filters?: Record<string, any>
): Promise<void> {
  await createAuditLog({
    restaurantId,
    userId,
    action: 'Report exported',
    entityType: 'Report',
    description: `Exported ${reportType} as ${format}`,
    metadata: { reportType, format, filters } as any,
  });
}
