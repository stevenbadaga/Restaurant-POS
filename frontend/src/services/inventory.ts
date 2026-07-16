import api from './api';

// Inventory Items
export async function getInventoryItems(params?: Record<string, string | number | boolean | undefined>) {
  const response = await api.get('/inventory/items', { params });
  return response.data;
}

export async function getInventoryItem(id: string) {
  const response = await api.get(`/inventory/items/${id}`);
  return response.data;
}

export async function createInventoryItem(data: any) {
  const response = await api.post('/inventory/items', data);
  return response.data;
}

export async function updateInventoryItem(id: string, data: any) {
  const response = await api.patch(`/inventory/items/${id}`, data);
  return response.data;
}

export async function updateItemStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/inventory/items/${id}/status`, { isActive });
  return response.data;
}

export async function getItemBalances(id: string) {
  const response = await api.get(`/inventory/items/${id}/balances`);
  return response.data;
}

export async function getItemMovements(id: string, params?: Record<string, string | number | undefined>) {
  const response = await api.get(`/inventory/items/${id}/movements`, { params });
  return response.data;
}

export async function createOpeningBalance(id: string, data: any) {
  const response = await api.post(`/inventory/items/${id}/opening-balance`, data);
  return response.data;
}

// Inventory Locations
export async function getLocations(params?: Record<string, string | boolean | undefined>) {
  const response = await api.get('/inventory/locations', { params });
  return response.data;
}

export async function createLocation(data: any) {
  const response = await api.post('/inventory/locations', data);
  return response.data;
}

export async function updateLocation(id: string, data: any) {
  const response = await api.patch(`/inventory/locations/${id}`, data);
  return response.data;
}

export async function updateLocationStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/inventory/locations/${id}/status`, { isActive });
  return response.data;
}

export async function setDefaultLocation(id: string) {
  const response = await api.post(`/inventory/locations/${id}/set-default`);
  return response.data;
}

// Inventory Categories
export async function getCategories(params?: Record<string, string | boolean | undefined>) {
  const response = await api.get('/inventory/categories', { params });
  return response.data;
}

export async function createCategory(data: any) {
  const response = await api.post('/inventory/categories', data);
  return response.data;
}

export async function updateCategory(id: string, data: any) {
  const response = await api.patch(`/inventory/categories/${id}`, data);
  return response.data;
}

export async function updateCategoryStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/inventory/categories/${id}/status`, { isActive });
  return response.data;
}

// Suppliers
export async function getSuppliers(params?: Record<string, string | number | boolean | undefined>) {
  const response = await api.get('/suppliers', { params });
  return response.data;
}

export async function getSupplier(id: string) {
  const response = await api.get(`/suppliers/${id}`);
  return response.data;
}

export async function createSupplier(data: any) {
  const response = await api.post('/suppliers', data);
  return response.data;
}

export async function updateSupplier(id: string, data: any) {
  const response = await api.patch(`/suppliers/${id}`, data);
  return response.data;
}

export async function updateSupplierStatus(id: string, isActive: boolean) {
  const response = await api.patch(`/suppliers/${id}/status`, { isActive });
  return response.data;
}

// Stock Receipts
export async function getReceipts(params?: Record<string, string | number | undefined>) {
  const response = await api.get('/inventory/receipts', { params });
  return response.data;
}

export async function getReceipt(id: string) {
  const response = await api.get(`/inventory/receipts/${id}`);
  return response.data;
}

export async function createReceipt(data: any) {
  const response = await api.post('/inventory/receipts', data);
  return response.data;
}

export async function addReceiptLine(receiptId: string, data: any) {
  const response = await api.post(`/inventory/receipts/${receiptId}/lines`, data);
  return response.data;
}

export async function updateReceiptLine(receiptId: string, lineId: string, data: any) {
  const response = await api.patch(`/inventory/receipts/${receiptId}/lines/${lineId}`, data);
  return response.data;
}

export async function removeReceiptLine(receiptId: string, lineId: string) {
  const response = await api.delete(`/inventory/receipts/${receiptId}/lines/${lineId}`);
  return response.data;
}

export async function postReceipt(receiptId: string) {
  const response = await api.post(`/inventory/receipts/${receiptId}/post`);
  return response.data;
}

export async function cancelReceipt(receiptId: string, reason: string) {
  const response = await api.post(`/inventory/receipts/${receiptId}/cancel`, { reason });
  return response.data;
}

// Stock Movements
export async function getMovements(params?: Record<string, string | number | undefined>) {
  const response = await api.get('/inventory/movements', { params });
  return response.data;
}

export async function getInventorySummary() {
  const response = await api.get('/inventory/movements/summary');
  return response.data;
}

export async function getInventoryAlerts() {
  const response = await api.get('/inventory/movements/alerts');
  return response.data;
}

export async function createAdjustment(data: any) {
  const response = await api.post('/inventory/movements/adjustments', data);
  return response.data;
}

// Waiter Usage
export async function getWaiterUsage(params?: Record<string, string | number | undefined>) {
  const response = await api.get('/inventory/movements/usage/waiters', { params });
  return response.data;
}

export async function getWaiterUsageDetail(waiterId: string, params?: Record<string, string | number | undefined>) {
  const response = await api.get(`/inventory/movements/usage/waiters/${waiterId}`, { params });
  return response.data;
}
