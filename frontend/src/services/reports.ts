import api from './api';

export interface ReportFilters {
  preset?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  [key: string]: any;
}

function buildParams(filters: ReportFilters): Record<string, string> {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params[key] = String(value);
  });
  return params;
}

// Dashboard
export const getDashboardData = async () => {
  const res = await api.get('/reports/dashboard');
  return res.data;
};

// Sales
export const getSalesOverview = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/sales/overview', { params: buildParams(filters) });
  return res.data;
};

export const getSalesByWaiters = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/sales/waiters', { params: buildParams(filters) });
  return res.data;
};

export const getSalesByWaiterDetail = async (waiterId: string, filters: ReportFilters = {}) => {
  const res = await api.get(`/reports/sales/waiters/${waiterId}`, { params: buildParams(filters) });
  return res.data;
};

export const getWaiterAssignmentReport = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/waiter-assignments', { params: buildParams(filters) });
  return res.data;
};

export const getSalesByItems = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/sales/items', { params: buildParams(filters) });
  return res.data;
};

export const getSalesByCategories = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/sales/categories', { params: buildParams(filters) });
  return res.data;
};

// Payments
export const getPaymentSummary = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/payments/summary', { params: buildParams(filters) });
  return res.data;
};

export const getPaymentMethods = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/payments/methods', { params: buildParams(filters) });
  return res.data;
};

export const getOutstandingBalances = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/payments/outstanding', { params: buildParams(filters) });
  return res.data;
};

export const getCashierActivity = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/payments/cashiers', { params: buildParams(filters) });
  return res.data;
};

export const getCashierDetail = async (cashierId: string, filters: ReportFilters = {}) => {
  const res = await api.get(`/reports/payments/cashiers/${cashierId}`, { params: buildParams(filters) });
  return res.data;
};

export const getRefundsReport = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/payments/refunds', { params: buildParams(filters) });
  return res.data;
};

// Receipts
export const getReceiptReport = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/receipts', { params: buildParams(filters) });
  return res.data;
};

// Kitchen
export const getKitchenPerformance = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/kitchen/performance', { params: buildParams(filters) });
  return res.data;
};

export const getKitchenStations = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/kitchen/stations', { params: buildParams(filters) });
  return res.data;
};

export const getKitchenItemPreparation = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/kitchen/items', { params: buildParams(filters) });
  return res.data;
};

// Tables
export const getTablePerformance = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/tables', { params: buildParams(filters) });
  return res.data;
};

export const getDiningAreaReport = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/dining-areas', { params: buildParams(filters) });
  return res.data;
};

// Orders
export const getOrderTypeComparison = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/orders/types', { params: buildParams(filters) });
  return res.data;
};

export const getOrderStatusDistribution = async () => {
  const res = await api.get('/reports/orders/statuses');
  return res.data;
};

export const getCancellationReport = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/orders/cancellations', { params: buildParams(filters) });
  return res.data;
};

// Inventory
export const getInventoryUsage = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/inventory/usage', { params: buildParams(filters) });
  return res.data;
};

export const getInventoryCostConsumption = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/inventory/cost-consumption', { params: buildParams(filters) });
  return res.data;
};

export const getWastageReport = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/inventory/wastage', { params: buildParams(filters) });
  return res.data;
};

export const getLowStockReport = async () => {
  const res = await api.get('/reports/inventory/low-stock');
  return res.data;
};

// Financial
export const getTaxServiceChargeSummary = async (filters: ReportFilters = {}) => {
  const res = await api.get('/reports/financial/tax-service-charge', { params: buildParams(filters) });
  return res.data;
};

// Export
export const getExportUrl = (reportType: string, format: string, filters: ReportFilters = {}): string => {
  const params = new URLSearchParams();
  params.set('reportType', reportType);
  params.set('format', format);
  if (filters.preset) params.set('preset', filters.preset);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.waiterId) params.set('waiterId', filters.waiterId);
  return `/api/reports/export?${params.toString()}`;
};
