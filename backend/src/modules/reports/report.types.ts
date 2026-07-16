export interface ReportDateFilter {
  preset?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface ReportPagination {
  page?: number;
  limit?: number;
}

export interface ReportSort {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SalesOverviewResult {
  closedOrderCount: number;
  closedOrderValue: string;
  grossCompletedPayments: string;
  refunds: string;
  netCollected: string;
  outstandingBalance: string;
  averageOrderValue: string;
  averageItemsPerOrder: string;
  taxCollected: string;
  serviceChargeCollected: string;
  discounts: string;
  dineInValue: string;
  takeawayValue: string;
  trend: ChartDataPoint[];
  comparison: PeriodComparison;
}

export interface WaiterSalesResult {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  closedOrders: number;
  dineInOrders: number;
  takeawayOrders: number;
  tablesServed: number;
  itemsServed: number;
  closedOrderValue: string;
  paidOrderValue: string;
  outstandingBalance: string;
  averageOrderValue: string;
  cancelledItemCount: number;
  cancelledOrderCount: number;
  refundValue: string;
  stockUsageCount: number;
  firstOrderTime: string | null;
  lastOrderTime: string | null;
}

export interface MenuItemSalesResult {
  id: string;
  name: string;
  code: string;
  category: string | null;
  itemType: string;
  quantitySold: number;
  grossValue: string;
  discounts: string;
  netValue: string;
  tax: string;
  cancelledQuantity: number;
  refundedQuantity: number;
  averageSellingPrice: string;
  trackInventory: boolean;
  isActive: boolean;
}

export interface CategorySalesResult {
  id: string;
  name: string;
  quantitySold: number;
  closedOrderValue: string;
  shareOfSales: string;
  averageItemValue: string;
  cancelledQuantity: number;
  activeItemCount: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  previousValue?: number;
}

export interface PeriodComparison {
  current: number;
  previous: number;
  absoluteChange: number;
  percentageChange: number | null;
  direction: 'up' | 'down' | 'neutral';
}

export interface PaymentMethodSummary {
  method: string;
  completedAmount: string;
  completedCount: number;
  refundAmount: string;
  netAmount: string;
  shareOfNetCollected: string;
  averageTransactionValue: string;
  cashierCount: number;
  referenceMissingCount: number;
}

export interface CashierActivityResult {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  completedPaymentCount: number;
  grossRecorded: string;
  refundsRecorded: string;
  netRecorded: string;
  cashAmount: string;
  cardAmount: string;
  mobileMoneyAmount: string;
  bankTransferAmount: string;
  voucherAmount: string;
  receiptsIssued: number;
  reprints: number;
  voidsInitiated: number;
  firstPaymentTime: string | null;
  lastPaymentTime: string | null;
}

export interface OutstandingOrderResult {
  id: string;
  orderNumber: string;
  orderType: string;
  table: { name: string; code: string } | null;
  waiter: { firstName: string; lastName: string } | null;
  customerName: string | null;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  paymentRequestedAt: string | null;
  age: number; // in minutes
  lastPaymentTime: string | null;
}

export interface RefundResult {
  id: string;
  refundNumber: string;
  originalPaymentNumber: string;
  orderNumber: string;
  receiptNumber: string | null;
  amount: string;
  method: string;
  reason: string;
  processedBy: { firstName: string; lastName: string } | null;
  approvedBy: { firstName: string; lastName: string } | null;
  waiterName: string;
  createdAt: string;
  originalPaymentDate: string | null;
}

export interface KitchenPerformanceResult {
  ticketsCreated: number;
  ticketsCompleted: number;
  averageAcceptanceTime: number | null; // minutes
  averagePreparationTime: number | null;
  averageTotalKitchenTime: number | null;
  medianPreparationTime: number | null;
  delayedTicketCount: number;
  partiallyReadyCount: number;
  cancelledTicketCount: number;
  itemsPrepared: number;
  itemsCancelledAfterPreparation: number;
  sampleCount: number;
  chartData: ChartDataPoint[];
}

export interface KitchenStationResult {
  id: string;
  name: string;
  ticketsReceived: number;
  ticketsCompleted: number;
  itemsPrepared: number;
  averageAcceptanceTime: number | null;
  averagePreparationTime: number | null;
  delayedTickets: number;
  cancelledItems: number;
  peakHour: string | null;
  activeMenuItemCount: number;
}

export interface TablePerformanceResult {
  id: string;
  name: string;
  code: string;
  diningArea: string | null;
  closedOrderCount: number;
  totalClosedOrderValue: string;
  averageOrderValue: string;
  averageOccupancyDuration: number | null;
  averageGuestCount: number;
  itemsPerOrder: number;
  cancellationCount: number;
  currentStatus: string;
}

export interface InventoryUsageResult {
  id: string;
  name: string;
  sku: string;
  unit: string;
  openingQuantity: string;
  stockReceived: string;
  reservationQuantity: string;
  directSaleConsumption: string;
  recipeConsumption: string;
  wastage: string;
  returns: string;
  adjustmentIn: string;
  adjustmentOut: string;
  transferIn: string;
  transferOut: string;
  closingOnHand: string;
  closingReserved: string;
  closingAvailable: string;
}

export interface InventoryCostResult {
  id: string;
  name: string;
  sku: string;
  quantityConsumed: string;
  unit: string;
  averageCost: string;
  estimatedConsumptionCost: string;
  directSaleCost: string;
  recipeCost: string;
  wastageCost: string;
  returnValue: string;
}

export interface WastageResult {
  id: string;
  inventoryItemName: string;
  quantity: string;
  unit: string;
  estimatedCost: string;
  reason: string;
  recordedBy: { firstName: string; lastName: string } | null;
  approvedBy: { firstName: string; lastName: string } | null;
  relatedOrderNumber: string | null;
  relatedWaiter: string | null;
  kitchenStation: string | null;
  createdAt: string;
}

export interface TaxServiceChargeResult {
  taxOnClosedOrders: string;
  taxIncluded: string;
  taxAdded: string;
  serviceCharge: string;
  discount: string;
  closedOrderSubtotal: string;
  closedOrderTotal: string;
  receiptCount: number;
  byDay: ChartDataPoint[];
  byOrderType: { orderType: string; tax: string; serviceCharge: string }[];
}
