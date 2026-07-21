import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { ReportFilterBar } from '@/components/reports/ReportFilterBar';
import { ReportSummaryCard } from '@/components/reports/ReportSummaryCard';
import { ReportDataTable, type Column } from '@/components/reports/ReportDataTable';
import { Loading } from '@/components/ui/Loading';
import {
  getSalesOverview, getSalesByWaiters, getSalesByItems, getSalesByCategories,
  getWaiterAssignmentReport,
  getPaymentSummary, getPaymentMethods, getOutstandingBalances,
  getCashierActivity, getRefundsReport, getReceiptReport,
  getKitchenPerformance, getTablePerformance, getDiningAreaReport,
  getOrderTypeComparison, getOrderStatusDistribution, getCancellationReport,
  getInventoryUsage, getInventoryCostConsumption, getWastageReport,
  getLowStockReport, getTaxServiceChargeSummary, getExportUrl,
  type ReportFilters,
} from '@/services/reports';

const reportConfigs: Record<string, any> = {
  'sales': {
    title: 'Sales Overview',
    description: 'Revenue, collections, and order metrics',
    fetcher: getSalesOverview,
    cards: [
      { key: 'netCollected', label: 'Net Collected', color: 'green' },
      { key: 'grossCompletedPayments', label: 'Gross Payments', color: 'blue' },
      { key: 'closedOrderCount', label: 'Closed Orders', color: 'purple' },
      { key: 'averageOrderValue', label: 'Avg Order Value', color: 'teal' },
      { key: 'refunds', label: 'Refunds', color: 'red' },
      { key: 'outstandingBalance', label: 'Outstanding', color: 'amber' },
    ],
    exportType: 'sales_overview',
  },
  'sales-by-waiter': {
    title: 'Sales by Waiter',
    description: 'Order counts, values, and performance per waiter',
    fetcher: (f: any) => getSalesByWaiters(f).then((r: any) => r.data),
    dataKey: 'waiters',
    exportType: 'sales_waiters',
    columns: [
      { key: 'firstName', label: 'First Name', sortable: true },
      { key: 'lastName', label: 'Last Name', sortable: true },
      { key: 'closedOrders', label: 'Orders', sortable: true, align: 'right' as const },
      { key: 'dineInOrders', label: 'Dine-In', align: 'right' as const },
      { key: 'closedOrderValue', label: 'Order Value', sortable: true, align: 'right' as const },
      { key: 'paidOrderValue', label: 'Paid Value', sortable: true, align: 'right' as const },
      { key: 'averageOrderValue', label: 'Avg Order', sortable: true, align: 'right' as const },
    ],
  },
  'waiter-assignments': {
    title: 'Waiter Assignment Report',
    description: 'Assigned tables, active workload, sales, tips, customers, and shift hours by waiter',
    fetcher: (f: any) => getWaiterAssignmentReport(f).then((r: any) => r.data),
    dataKey: 'waiters',
    totalKey: 'totals',
    exportType: 'waiter_assignments',
    cards: [
      { key: 'assignedTableCount', label: 'Assigned Tables', color: 'blue' },
      { key: 'activeOrderCount', label: 'Active Orders', color: 'purple' },
      { key: 'customersServed', label: 'Customers Served', color: 'teal' },
      { key: 'sales', label: 'Sales', color: 'green' },
      { key: 'tips', label: 'Tips', color: 'amber' },
      { key: 'workedHours', label: 'Worked Hours', color: 'indigo' },
    ],
    columns: [
      { key: 'waiterName', label: 'Waiter', sortable: true },
      { key: 'assignedTables', label: 'Assigned Tables' },
      { key: 'activeOrderCount', label: 'Active Orders', sortable: true, align: 'right' as const },
      { key: 'customersServed', label: 'Customers', sortable: true, align: 'right' as const },
      { key: 'sales', label: 'Sales', sortable: true, align: 'right' as const },
      { key: 'tips', label: 'Tips', sortable: true, align: 'right' as const },
      { key: 'workedHours', label: 'Shift Hours', sortable: true, align: 'right' as const },
      { key: 'workloadScore', label: 'Workload', sortable: true, align: 'right' as const },
    ],
  },
  'sales-by-item': {
    title: 'Sales by Item',
    description: 'Top-selling menu items by quantity and revenue',
    fetcher: (f: any) => getSalesByItems(f).then((r: any) => r.data),
    dataKey: 'items',
    exportType: 'sales_items',
    columns: [
      { key: 'name', label: 'Item', sortable: true },
      { key: 'code', label: 'Code' },
      { key: 'category', label: 'Category' },
      { key: 'quantitySold', label: 'Qty Sold', sortable: true, align: 'right' as const },
      { key: 'grossValue', label: 'Gross Value', sortable: true, align: 'right' as const },
      { key: 'netValue', label: 'Net Value', sortable: true, align: 'right' as const },
      { key: 'averageSellingPrice', label: 'Avg Price', align: 'right' as const },
    ],
  },
  'sales-by-category': {
    title: 'Sales by Category',
    description: 'Revenue distribution across menu categories',
    fetcher: (f: any) => getSalesByCategories(f).then((r: any) => r.data),
    dataIsArray: true,
    exportType: 'sales_categories',
    columns: [
      { key: 'name', label: 'Category', sortable: true },
      { key: 'quantitySold', label: 'Qty Sold', sortable: true, align: 'right' as const },
      { key: 'closedOrderValue', label: 'Revenue', sortable: true, align: 'right' as const },
      { key: 'shareOfSales', label: 'Share', align: 'right' as const },
    ],
  },
  payments: {
    title: 'Payment Summary',
    description: 'Gross payments, refunds, and collection metrics',
    fetcher: getPaymentSummary,
    cards: [
      { key: 'netCollected', label: 'Net Collected', color: 'green' },
      { key: 'grossPayments', label: 'Gross Payments', color: 'blue' },
      { key: 'refunds', label: 'Refunds', color: 'red' },
      { key: 'paymentCount', label: 'Payments', color: 'purple' },
    ],
    exportType: 'payment_summary',
  },
  'payment-methods': {
    title: 'Payment Methods',
    description: 'Cash, card, mobile money and other method breakdowns',
    fetcher: (f: any) => getPaymentMethods(f).then((r: any) => r.data),
    dataIsArray: true,
    exportType: 'payment_methods',
    columns: [
      { key: 'method', label: 'Method', sortable: true },
      { key: 'completedAmount', label: 'Amount', sortable: true, align: 'right' as const },
      { key: 'completedCount', label: 'Count', align: 'right' as const },
      { key: 'netAmount', label: 'Net', sortable: true, align: 'right' as const },
      { key: 'shareOfNetCollected', label: 'Share', align: 'right' as const },
    ],
  },
  outstanding: {
    title: 'Outstanding Balances',
    description: 'Unpaid and partially paid orders',
    fetcher: (f: any) => getOutstandingBalances(f).then((r: any) => r.data),
    dataKey: 'orders',
    exportType: 'outstanding',
    columns: [
      { key: 'orderNumber', label: 'Order', sortable: true },
      { key: 'orderType', label: 'Type' },
      { key: 'paymentStatus', label: 'Status', sortable: true },
      { key: 'totalAmount', label: 'Total', align: 'right' as const },
      { key: 'amountDue', label: 'Due', sortable: true, align: 'right' as const },
    ],
  },
  cashiers: {
    title: 'Cashier Activity',
    description: 'Payment recording activity per cashier',
    fetcher: (f: any) => getCashierActivity(f).then((r: any) => r.data),
    dataKey: 'cashiers',
    exportType: 'cashiers',
    columns: [
      { key: 'firstName', label: 'Name' },
      { key: 'completedPaymentCount', label: 'Payments', sortable: true, align: 'right' as const },
      { key: 'grossRecorded', label: 'Gross', sortable: true, align: 'right' as const },
      { key: 'netRecorded', label: 'Net', sortable: true, align: 'right' as const },
    ],
  },
  refunds: {
    title: 'Refunds & Voids',
    description: 'Returns, refunds, and voided transactions',
    fetcher: (f: any) => getRefundsReport(f).then((r: any) => r.data),
    dataKey: 'refunds',
    exportType: 'refunds',
    columns: [
      { key: 'refundNumber', label: 'Refund #', sortable: true },
      { key: 'orderNumber', label: 'Order' },
      { key: 'amount', label: 'Amount', sortable: true, align: 'right' as const },
      { key: 'method', label: 'Method' },
    ],
  },
  receipts: {
    title: 'Receipt Report',
    description: 'Issued receipts, reprints, and voided receipts',
    fetcher: (f: any) => getReceiptReport(f).then((r: any) => r.data),
    dataKey: 'receipts',
    exportType: 'receipts',
    columns: [
      { key: 'receiptNumber', label: 'Receipt', sortable: true },
      { key: 'orderNumber', label: 'Order' },
      { key: 'total', label: 'Total', align: 'right' as const },
      { key: 'status', label: 'Status' },
    ],
  },
  kitchen: {
    title: 'Kitchen Performance',
    description: 'Ticket volume, preparation times, and delays',
    fetcher: getKitchenPerformance,
    cards: [
      { key: 'ticketsCreated', label: 'Created', color: 'blue' },
      { key: 'ticketsCompleted', label: 'Completed', color: 'green' },
      { key: 'itemsPrepared', label: 'Items', color: 'purple' },
      { key: 'delayedTicketCount', label: 'Delayed', color: 'red' },
    ],
    exportType: 'kitchen_performance',
  },
  tables: {
    title: 'Table Performance',
    description: 'Table turnover, occupancy, and order values',
    fetcher: (f: any) => getTablePerformance(f).then((r: any) => r.data),
    dataKey: 'tables',
    exportType: 'tables',
    columns: [
      { key: 'name', label: 'Table', sortable: true },
      { key: 'diningArea', label: 'Area' },
      { key: 'closedOrderCount', label: 'Orders', sortable: true, align: 'right' as const },
      { key: 'totalClosedOrderValue', label: 'Revenue', sortable: true, align: 'right' as const },
    ],
  },
  'inventory-usage': {
    title: 'Inventory Usage',
    description: 'Stock movements, consumption, and balances',
    fetcher: (f: any) => getInventoryUsage(f).then((r: any) => r.data),
    dataKey: 'items',
    exportType: 'inventory_usage',
    columns: [
      { key: 'name', label: 'Item', sortable: true },
      { key: 'sku', label: 'SKU' },
      { key: 'stockReceived', label: 'Received', align: 'right' as const },
      { key: 'directSaleConsumption', label: 'Consumed', align: 'right' as const },
      { key: 'closingAvailable', label: 'Available', sortable: true, align: 'right' as const },
    ],
  },
  'inventory-cost': {
    title: 'Inventory Cost',
    description: 'Estimated cost of consumed inventory',
    fetcher: (f: any) => getInventoryCostConsumption(f).then((r: any) => r.data),
    dataKey: 'items',
    exportType: 'inventory_cost',
    columns: [
      { key: 'name', label: 'Item', sortable: true },
      { key: 'averageCost', label: 'Avg Cost', sortable: true, align: 'right' as const },
      { key: 'estimatedConsumptionCost', label: 'Est. Cost', sortable: true, align: 'right' as const },
    ],
  },
  wastage: {
    title: 'Wastage Report',
    description: 'Stock wastage, reasons, and estimated costs',
    fetcher: (f: any) => getWastageReport(f).then((r: any) => r.data),
    dataKey: 'items',
    exportType: 'wastage',
    columns: [
      { key: 'inventoryItemName', label: 'Item', sortable: true },
      { key: 'quantity', label: 'Qty', align: 'right' as const },
      { key: 'estimatedCost', label: 'Cost', align: 'right' as const },
    ],
  },
  'low-stock': {
    title: 'Low Stock Report',
    description: 'Items below reorder level or out of stock',
    fetcher: () => getLowStockReport().then((r: any) => r.data),
    dataIsArray: true,
    exportType: 'low_stock',
    columns: [
      { key: 'name', label: 'Item', sortable: true },
      { key: 'sku', label: 'SKU' },
      { key: 'onHand', label: 'On Hand', align: 'right' as const },
      { key: 'available', label: 'Available', sortable: true, align: 'right' as const },
      { key: 'status', label: 'Status' },
    ],
  },
  'tax-service-charge': {
    title: 'Tax & Service Charge',
    description: 'Tax, service charge, and discount summaries',
    fetcher: getTaxServiceChargeSummary,
    exportType: 'tax_service_charge',
    cards: [
      { key: 'taxOnClosedOrders', label: 'Tax', color: 'blue' },
      { key: 'serviceCharge', label: 'Service Charge', color: 'purple' },
      { key: 'discount', label: 'Discounts', color: 'amber' },
      { key: 'closedOrderTotal', label: 'Total Orders', color: 'green' },
    ],
  },
  cancellations: {
    title: 'Cancellations',
    description: 'Cancelled items, reasons, and values',
    fetcher: (f: any) => getCancellationReport(f).then((r: any) => r.data),
    dataKey: 'items',
    exportType: 'cancellations',
    columns: [
      { key: 'orderNumber', label: 'Order', sortable: true },
      { key: 'itemName', label: 'Item' },
      { key: 'quantity', label: 'Qty', align: 'right' as const },
      { key: 'valueRemoved', label: 'Value', sortable: true, align: 'right' as const },
    ],
  },
  'order-types': {
    title: 'Order Type Comparison',
    description: 'Dine-in vs takeaway vs delivery',
    fetcher: (f: any) => getOrderTypeComparison(f).then((r: any) => r.data),
    dataIsArray: true,
    exportType: 'order_types',
    columns: [
      { key: 'orderType', label: 'Type', sortable: true },
      { key: 'orderCount', label: 'Orders', sortable: true, align: 'right' as const },
      { key: 'closedOrderValue', label: 'Value', align: 'right' as const },
    ],
  },
  'order-statuses': {
    title: 'Order Status Distribution',
    description: 'Orders by current status',
    fetcher: () => getOrderStatusDistribution().then((r: any) => r.data),
    dataIsArray: true,
    exportType: 'order_statuses',
    columns: [
      { key: 'status', label: 'Status', sortable: true },
      { key: 'count', label: 'Count', sortable: true, align: 'right' as const },
      { key: 'value', label: 'Total Value', align: 'right' as const },
    ],
  },
  'dining-areas': {
    title: 'Dining Areas',
    description: 'Revenue by dining area',
    fetcher: (f: any) => getDiningAreaReport(f).then((r: any) => r.data),
    dataIsArray: true,
    exportType: 'dining_areas',
    columns: [
      { key: 'name', label: 'Area', sortable: true },
      { key: 'closedDineInOrders', label: 'Orders', sortable: true, align: 'right' as const },
      { key: 'closedOrderValue', label: 'Revenue', sortable: true, align: 'right' as const },
    ],
  },
};

export default function ReportDetail() {
  const { reportType } = useParams<{ reportType: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [filters, setFilters] = useState<ReportFilters>({ preset: 'today' });
  const [page, setPage] = useState(1);

  const configKey = reportType || '';
  const config = reportConfigs[configKey];

  const fetchData = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    setError(null);

    try {
      const queryFilters = { ...filters, page, limit: 25 };
      const result = await config.fetcher(queryFilters);
      setData(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [config, filters, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!config?.exportType) return;
    const url = getExportUrl(config.exportType, format, filters);
    window.open(url, '_blank');
  };

  if (!config) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </button>
        <div className="h-64 flex items-center justify-center">
          <p className="text-[var(--color-text-muted)]">Report not found</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => navigate('/reports')} className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </button>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 font-medium">Failed to load report</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const rawData = config.dataKey ? data?.[config.dataKey] : (config.dataIsArray ? data : null);
  const summaryData = config.totalKey ? data?.[config.totalKey] : data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/reports')} className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors">
          <ArrowLeft className="h-5 w-5 text-[var(--color-text-muted)]" />
        </button>
        <PageHeader title={config.title} description={config.description} />
      </div>

      <ReportFilterBar
        filters={filters}
        onChange={(f) => { setFilters(f); setPage(1); }}
        onExport={handleExport}
      />

      {/* Summary cards */}
      {config.cards && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {config.cards.map((card: any) => (
            <ReportSummaryCard
              key={card.key}
              label={card.label}
              value={summaryData?.[card.key] !== undefined ? String(summaryData[card.key]) : '-'}
              loading={loading}
              color={card.color || 'blue'}
            />
          ))}
        </div>
      )}

      {/* Data table */}
      {config.columns && (
        <ReportDataTable
          columns={config.columns as Column[]}
          data={rawData || []}
          loading={loading}
          emptyMessage="No data available for this period"
          page={page}
          totalPages={data?.pagination?.totalPages || 1}
          total={data?.pagination?.total}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
