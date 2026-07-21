import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../../middleware/auth';
import * as reportService from './report.service';
import { exportReport } from './report-export.service';
import { canViewInventoryCosts, getReportScope } from './report.permissions';

const router = Router();

// All report routes require authentication
router.use(requireAuth);

// ==========================================
// GET /api/reports/dashboard
// ==========================================
router.get('/dashboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getDashboardData(
      req.user!.restaurantId,
      req.user!.roles,
      req.user!.id
    );
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/sales/overview
// ==========================================
router.get('/sales/overview', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getSalesOverview(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, req.query.groupBy as string || 'day');
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/sales/waiters
// ==========================================
router.get('/sales/waiters', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getSalesByWaiters(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/sales/waiters/:waiterId
// ==========================================
router.get('/sales/waiters/:waiterId', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getSalesByWaiters(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, { page: 1, limit: 1 });
    const waiter = data.waiters.find((w: any) => w.id === req.params.waiterId);
    if (!waiter) {
      return res.status(404).json({ success: false, message: 'Waiter not found' });
    }
    return res.json({ success: true, data: waiter });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/waiter-assignments
// ==========================================
router.get('/waiter-assignments', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getWaiterAssignmentReport(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      waiterId: req.query.waiterId as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/sales/items
// ==========================================
router.get('/sales/items', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getSalesByItems(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/sales/categories
// ==========================================
router.get('/sales/categories', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getSalesByCategories(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/payments/summary
// ==========================================
router.get('/payments/summary', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getPaymentSummary(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/payments/methods
// ==========================================
router.get('/payments/methods', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getPaymentMethodSummary(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/payments/outstanding
// ==========================================
router.get('/payments/outstanding', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getOutstandingBalances(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/payments/cashiers
// ==========================================
router.get('/payments/cashiers', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getCashierActivity(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/payments/cashiers/:cashierId
// ==========================================
router.get('/payments/cashiers/:cashierId', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getCashierActivity(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, { page: 1, limit: 1 });
    const cashier = data.cashiers.find((c: any) => c.id === req.params.cashierId);
    if (!cashier) {
      return res.status(404).json({ success: false, message: 'Cashier not found' });
    }
    return res.json({ success: true, data: cashier });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/payments/refunds
// ==========================================
router.get('/payments/refunds', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getRefundsReport(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/receipts
// ==========================================
router.get('/receipts', requireRole('ADMIN', 'MANAGER', 'CASHIER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getReceiptReport(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/kitchen/performance
// ==========================================
router.get('/kitchen/performance', requireRole('ADMIN', 'MANAGER', 'CHEF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getKitchenPerformance(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/kitchen/stations
// ==========================================
router.get('/kitchen/stations', requireRole('ADMIN', 'MANAGER', 'CHEF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getKitchenPerformance(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/kitchen/items
// ==========================================
router.get('/kitchen/items', requireRole('ADMIN', 'MANAGER', 'CHEF'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getKitchenPerformance(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/tables
// ==========================================
router.get('/tables', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getTablePerformance(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/dining-areas
// ==========================================
router.get('/dining-areas', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getDiningAreaReport(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/orders/types
// ==========================================
router.get('/orders/types', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getOrderTypeComparison(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/orders/statuses
// ==========================================
router.get('/orders/statuses', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getOrderStatusDistribution(req.user!.restaurantId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/orders/cancellations
// ==========================================
router.get('/orders/cancellations', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getCancellationReport(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/inventory/usage
// ==========================================
router.get('/inventory/usage', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getInventoryUsage(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/inventory/cost-consumption
// ==========================================
router.get('/inventory/cost-consumption', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getInventoryCostConsumption(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/inventory/wastage
// ==========================================
router.get('/inventory/wastage', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getWastageReport(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    }, {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/inventory/low-stock
// ==========================================
router.get('/inventory/low-stock', requireRole('ADMIN', 'MANAGER', 'STOCK_KEEPER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getLowStockReport(req.user!.restaurantId);
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/financial/tax-service-charge
// ==========================================
router.get('/financial/tax-service-charge', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await reportService.getTaxServiceChargeSummary(req.user!.restaurantId, {
      preset: req.query.preset as string,
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// GET /api/reports/export - Export any report
// ==========================================
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      reportType: z.string().min(1),
      format: z.enum(['csv', 'xlsx', 'pdf']),
      preset: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    });

    const params = schema.parse(req.query);

    // Fetch report data based on type
    let rows: Record<string, any>[] = [];
    let columns: string[] = [];
    let title = '';

    switch (params.reportType) {
      case 'sales_overview': {
        const data = await reportService.getSalesOverview(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        });
        rows = [data as any];
        columns = ['closedOrderCount', 'closedOrderValue', 'grossCompletedPayments', 'refunds',
          'netCollected', 'outstandingBalance', 'averageOrderValue', 'taxCollected', 'serviceChargeCollected'];
        title = 'Sales Overview';
        break;
      }
      case 'sales_waiters': {
        const data = await reportService.getSalesByWaiters(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.waiters.map((w) => ({
          Waiter: `${w.firstName} ${w.lastName}`, Orders: w.closedOrders,
          'Dine-In': w.dineInOrders, 'Takeaway': w.takeawayOrders,
          'Order Value': w.closedOrderValue, 'Paid Value': w.paidOrderValue,
          'Outstanding': w.outstandingBalance, 'Avg Order': w.averageOrderValue,
          'Items Served': w.itemsServed, Cancellations: w.cancelledItemCount,
        }));
        columns = ['Waiter', 'Orders', 'Dine-In', 'Takeaway', 'Order Value', 'Paid Value',
          'Outstanding', 'Avg Order', 'Items Served', 'Cancellations'];
        title = 'Sales by Waiter';
        break;
      }
      case 'waiter_assignments': {
        if (!req.user!.roles.includes('ADMIN') && !req.user!.roles.includes('MANAGER')) {
          return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }
        const data = await reportService.getWaiterAssignmentReport(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, {}, { page: 1, limit: 1000 });
        rows = data.waiters.map((w: any) => ({
          Waiter: w.waiterName,
          Employee: w.employeeCode || '',
          'Assigned Tables': w.assignedTables,
          'Assigned Table Count': w.assignedTableCount,
          'Active Orders': w.activeOrderCount,
          'Active Order Numbers': w.activeOrderNumbers,
          'Customers Served': w.customersServed,
          'Total Orders': w.totalOrders,
          'Closed Orders': w.closedOrders,
          Sales: w.sales,
          Collected: w.collected,
          Outstanding: w.outstanding,
          Tips: w.tips,
          'Scheduled Hours': w.scheduledHours,
          'Worked Hours': w.workedHours,
          'Overtime Hours': w.overtimeHours,
          'Late Minutes': w.lateMinutes,
          'Workload Score': w.workloadScore,
        }));
        columns = ['Waiter', 'Employee', 'Assigned Tables', 'Assigned Table Count', 'Active Orders',
          'Active Order Numbers', 'Customers Served', 'Total Orders', 'Closed Orders', 'Sales',
          'Collected', 'Outstanding', 'Tips', 'Scheduled Hours', 'Worked Hours', 'Overtime Hours',
          'Late Minutes', 'Workload Score'];
        title = 'Waiter Assignment Report';
        break;
      }
      case 'sales_items': {
        const data = await reportService.getSalesByItems(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.items.map((i) => ({
          Item: i.name, Code: i.code, Category: i.category || '',
          'Qty Sold': i.quantitySold, 'Gross Value': i.grossValue,
          'Net Value': i.netValue, Tax: i.tax, 'Avg Price': i.averageSellingPrice,
        }));
        columns = ['Item', 'Code', 'Category', 'Qty Sold', 'Gross Value', 'Net Value', 'Tax', 'Avg Price'];
        title = 'Sales by Item';
        break;
      }
      case 'payment_methods': {
        const data = await reportService.getPaymentMethodSummary(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        });
        rows = data.map((m) => ({
          Method: m.method, Amount: m.completedAmount, Count: m.completedCount,
          Refunds: m.refundAmount, Net: m.netAmount, Share: m.shareOfNetCollected + '%',
        }));
        columns = ['Method', 'Amount', 'Count', 'Refunds', 'Net', 'Share'];
        title = 'Payment Methods';
        break;
      }
      case 'cashiers': {
        const data = await reportService.getCashierActivity(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 100 });
        rows = data.cashiers.map((c) => ({
          Cashier: `${c.firstName} ${c.lastName}`,
          Payments: c.completedPaymentCount,
          Gross: c.grossRecorded,
          Refunds: c.refundsRecorded,
          Net: c.netRecorded,
          Cash: c.cashAmount,
          'Mobile Money': c.mobileMoneyAmount,
          Card: c.cardAmount,
        }));
        columns = ['Cashier', 'Payments', 'Gross', 'Refunds', 'Net', 'Cash', 'Mobile Money', 'Card'];
        title = 'Cashier Activity';
        break;
      }
      case 'refunds': {
        const data = await reportService.getRefundsReport(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.refunds.map((r: any) => ({
          'Refund #': r.refundNumber, 'Order': r.orderNumber,
          Amount: r.amount, Method: r.method, Reason: r.reason,
          ProcessedBy: r.processedBy ? `${r.processedBy.firstName} ${r.processedBy.lastName}` : '',
          Waiter: r.waiterName, Date: r.createdAt,
        }));
        columns = ['Refund #', 'Order', 'Amount', 'Method', 'Reason', 'ProcessedBy', 'Waiter', 'Date'];
        title = 'Refunds & Voids';
        break;
      }
      case 'outstanding': {
        const data = await reportService.getOutstandingBalances(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.orders.map((o) => ({
          'Order #': o.orderNumber, Type: o.orderType,
          Total: o.totalAmount, Paid: o.amountPaid, Due: o.amountDue,
          Status: o.paymentStatus, Waiter: o.waiter ? `${o.waiter.firstName} ${o.waiter.lastName}` : '',
          Age: `${Math.floor(o.age / 60)}h ${o.age % 60}m`,
        }));
        columns = ['Order #', 'Type', 'Total', 'Paid', 'Due', 'Status', 'Waiter', 'Age'];
        title = 'Outstanding Balances';
        break;
      }
      case 'kitchen_performance': {
        const data = await reportService.getKitchenPerformance(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        });
        rows = [{
          'Tickets Created': data.ticketsCreated,
          'Tickets Completed': data.ticketsCompleted,
          'Items Prepared': data.itemsPrepared,
          'Avg Prep Time': data.averagePreparationTime ? `${data.averagePreparationTime} min` : 'N/A',
          Delayed: data.delayedTicketCount,
          Cancelled: data.cancelledTicketCount,
        }];
        columns = ['Tickets Created', 'Tickets Completed', 'Items Prepared', 'Avg Prep Time', 'Delayed', 'Cancelled'];
        title = 'Kitchen Performance';
        break;
      }
      case 'inventory_usage': {
        const data = await reportService.getInventoryUsage(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.items.map((i) => ({
          Item: i.name, SKU: i.sku, Unit: i.unit,
          Received: i.stockReceived, Consumed: i.directSaleConsumption,
          Wastage: i.wastage, 'On Hand': i.closingOnHand,
          Available: i.closingAvailable,
        }));
        columns = ['Item', 'SKU', 'Unit', 'Received', 'Consumed', 'Wastage', 'On Hand', 'Available'];
        title = 'Inventory Usage';
        break;
      }
      case 'inventory_cost': {
        const data = await reportService.getInventoryCostConsumption(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.items.map((i) => ({
          Item: i.name, SKU: i.sku, Consumed: i.quantityConsumed,
          'Avg Cost': i.averageCost, 'Est. Cost': i.estimatedConsumptionCost,
          'Wastage Cost': i.wastageCost,
        }));
        columns = ['Item', 'SKU', 'Consumed', 'Avg Cost', 'Est. Cost', 'Wastage Cost'];
        title = 'Inventory Cost Consumption';
        break;
      }
      case 'wastage': {
        const data = await reportService.getWastageReport(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.items.map((i: any) => ({
          Item: i.inventoryItemName, Qty: i.quantity, Unit: i.unit,
          Cost: i.estimatedCost, Reason: i.reason,
          RecordedBy: i.recordedBy ? `${i.recordedBy.firstName} ${i.recordedBy.lastName}` : '',
          Date: i.createdAt,
        }));
        columns = ['Item', 'Qty', 'Unit', 'Cost', 'Reason', 'RecordedBy', 'Date'];
        title = 'Wastage Report';
        break;
      }
      case 'tax_service_charge': {
        const data = await reportService.getTaxServiceChargeSummary(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        });
        rows = [{
          Tax: data.taxOnClosedOrders,
          'Service Charge': data.serviceCharge,
          Discount: data.discount,
          Subtotal: data.closedOrderSubtotal,
          Total: data.closedOrderTotal,
          Receipts: data.receiptCount,
        }];
        columns = ['Tax', 'Service Charge', 'Discount', 'Subtotal', 'Total', 'Receipts'];
        title = 'Tax & Service Charge Summary';
        break;
      }
      case 'low_stock': {
        const data = await reportService.getLowStockReport(req.user!.restaurantId);
        rows = data.map((i: any) => ({
          Item: i.name, SKU: i.sku, Unit: i.unit,
          'On Hand': i.onHand, Reserved: i.reserved,
          Available: i.available, Status: i.status,
        }));
        columns = ['Item', 'SKU', 'Unit', 'On Hand', 'Reserved', 'Available', 'Status'];
        title = 'Low Stock Report';
        break;
      }
      case 'tables': {
        const data = await reportService.getTablePerformance(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.tables.map((t) => ({
          Table: t.name, Area: t.diningArea || '',
          Orders: t.closedOrderCount, Value: t.totalClosedOrderValue,
          'Avg Order': t.averageOrderValue, 'Items/Order': t.itemsPerOrder,
          Status: t.currentStatus,
        }));
        columns = ['Table', 'Area', 'Orders', 'Value', 'Avg Order', 'Items/Order', 'Status'];
        title = 'Table Performance';
        break;
      }
      case 'cancellations': {
        const data = await reportService.getCancellationReport(req.user!.restaurantId, {
          preset: params.preset, dateFrom: params.dateFrom, dateTo: params.dateTo,
        }, { page: 1, limit: 1000 });
        rows = data.items.map((i: any) => ({
          Order: i.orderNumber, Item: i.itemName,
          Qty: i.quantity, Value: i.valueRemoved,
          Waiter: i.waiterName, Reason: i.reason,
        }));
        columns = ['Order', 'Item', 'Qty', 'Value', 'Waiter', 'Reason'];
        title = 'Cancellation Report';
        break;
      }
      default:
        return res.status(400).json({ success: false, message: `Unknown report type: ${params.reportType}` });
    }

    const buffer = await exportReport({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      reportType: params.reportType,
      format: params.format as any,
      columns,
      rows,
      title,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const filename = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.${params.format}`;

    if (params.format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (params.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
