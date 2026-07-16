import api from './api';

export interface OrderItem {
  id: string;
  menuItemId: string;
  kitchenStationId: string | null;
  menuItemNameSnapshot: string;
  menuItemCodeSnapshot: string;
  itemTypeSnapshot: string;
  unitPrice: string;
  taxRate: number;
  quantity: number;
  lineSubtotal: string;
  lineTaxAmount: string;
  lineTotal: string;
  lineTotalBeforeDiscount: string;
  lineDiscountAmount: string;
  specialInstructions: string | null;
  requiresPreparation: boolean;
  status: string;
  submittedAt: string | null;
  acceptedAt: string | null;
  preparationStartedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  subtotal: string;
  taxAmount: string;
  serviceCharge: string;
  discountAmount: string;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  tableId: string | null;
  guestCount: number | null;
  customerName: string | null;
  customerPhone: string | null;
  notes: string | null;
  submittedAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  waiterId: string;
  createdById: string;
  table: { id: string; name: string; code: string } | null;
  waiter: { id: string; firstName: string; lastName: string } | null;
  items: OrderItem[];
  _count?: { items: number };
  payments?: any[];
  kitchenTickets?: any[];
}

export interface CreateOrderInput {
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'PICKUP' | 'DELIVERY';
  tableId?: string | null;
  guestCount?: number | null;
  customerName?: string | null;
  customerPhone?: string | null;
  notes?: string | null;
  items: Array<{
    menuItemId: string;
    quantity: number;
    specialInstructions?: string | null;
  }>;
}

export interface MenuItem {
  id: string;
  name: string;
  code: string;
  price: string;
  itemType: string;
  isAvailable: boolean;
  isActive: boolean;
  requiresPreparation: boolean;
  category?: { id: string; name: string } | null;
  kitchenStation?: { id: string; name: string } | null;
  imageUrl?: string | null;
}

export interface MenuCategory {
  id: string;
  name: string;
}

export interface RestaurantTable {
  id: string;
  name: string;
  code: string;
  capacity: number;
  status: string;
  diningArea?: { id: string; name: string } | null;
}

// GET /api/orders - List orders
export async function getOrders(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: Order[]; pagination: any }> {
  const response = await api.get('/orders', { params });
  return response.data;
}

// GET /api/orders/active - Active orders
export async function getActiveOrders(): Promise<{ data: Order[] }> {
  const response = await api.get('/orders/active');
  return response.data;
}

// GET /api/orders/:id - Order detail
export async function getOrder(id: string): Promise<{ data: Order }> {
  const response = await api.get(`/orders/${id}`);
  return response.data;
}

// POST /api/orders - Create order
export async function createOrder(input: CreateOrderInput): Promise<{ data: Order; message: string }> {
  const response = await api.post('/orders', input);
  return response.data;
}

// PATCH /api/orders/:id - Update order
export async function updateOrder(id: string, input: Partial<CreateOrderInput>): Promise<{ data: Order }> {
  const response = await api.patch(`/orders/${id}`, input);
  return response.data;
}

// POST /api/orders/:id/items - Add item
export async function addOrderItem(orderId: string, item: {
  menuItemId: string;
  quantity: number;
  specialInstructions?: string | null;
}): Promise<{ data: Order }> {
  const response = await api.post(`/orders/${orderId}/items`, item);
  return response.data;
}

// PATCH /api/orders/:id/items/:itemId - Update item
export async function updateOrderItem(orderId: string, itemId: string, data: {
  quantity?: number;
  specialInstructions?: string | null;
}): Promise<{ data: Order }> {
  const response = await api.patch(`/orders/${orderId}/items/${itemId}`, data);
  return response.data;
}

// DELETE /api/orders/:id/items/:itemId - Remove item
export async function removeOrderItem(orderId: string, itemId: string): Promise<{ data: Order }> {
  const response = await api.delete(`/orders/${orderId}/items/${itemId}`);
  return response.data;
}

// POST /api/orders/:id/submit - Submit to kitchen
export async function submitOrder(orderId: string): Promise<{ data: Order; message: string }> {
  const response = await api.post(`/orders/${orderId}/submit`);
  return response.data;
}

// PATCH /api/orders/:id/items/:itemId/status - Update item status
export async function updateItemStatus(orderId: string, itemId: string, status: string): Promise<{ data: Order }> {
  const response = await api.patch(`/orders/${orderId}/items/${itemId}/status`, { status });
  return response.data;
}

// POST /api/orders/:id/cancel - Cancel order
export async function cancelOrder(orderId: string, reason: string): Promise<void> {
  await api.post(`/orders/${orderId}/cancel`, { reason });
}

// POST /api/orders/:id/receipt - Generate receipt
export async function generateReceipt(orderId: string): Promise<{ data: any }> {
  const response = await api.post(`/orders/${orderId}/receipt`);
  return response.data;
}

// POST /api/orders/:id/close - Close order
export async function closeOrder(orderId: string): Promise<{ data: any }> {
  const response = await api.post(`/orders/${orderId}/close`);
  return response.data;
}

// GET /api/menu/items - Menu items
export async function getMenuItems(): Promise<MenuItem[]> {
  const response = await api.get('/menu/items');
  return response.data?.data ?? [];
}

// GET /api/menu/categories - Menu categories
export async function getMenuCategories(): Promise<MenuCategory[]> {
  const response = await api.get('/menu/categories?isActive=true');
  return response.data?.data ?? [];
}

// GET /api/tables - Tables
export async function getAvailableTables(): Promise<RestaurantTable[]> {
  const response = await api.get('/tables?limit=100');
  return response.data?.data ?? [];
}

// PATCH /api/orders/:id/assign-waiter - Assign/reassign waiter
export async function assignWaiterToOrder(orderId: string, waiterId: string): Promise<{ data: any; message: string }> {
  const response = await api.patch(`/orders/${orderId}/assign-waiter`, { waiterId });
  return response.data;
}

// GET /api/orders/waiters/available - Get available waiters
export async function getAvailableWaiters(): Promise<Array<{
  id: string; firstName: string; lastName: string;
  employeeCode: string | null; activeOrderCount: number;
}>> {
  const response = await api.get('/orders/waiters/available');
  return response.data?.data ?? [];
}
