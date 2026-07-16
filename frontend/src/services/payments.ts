import api from './api';
import type { ApiResponse } from '@/types';

export interface PaymentSummary {
  orderTotal: string;
  completedPayments: string;
  totalRefunds: string;
  netPaid: string;
  amountDue: string;
  paymentStatus: string;
}

export interface PaymentQueueOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  paymentStatus: string;
  table: { name: string; code: string; diningAreaId: string } | null;
  waiter: { id: string; firstName: string; lastName: string } | null;
  customerName: string | null;
  totalAmount: string;
  amountPaid: string;
  amountDue: string;
  paymentRequest: any;
  paymentCount: number;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  paymentNumber: string;
  transactionType: string;
  method: string;
  status: string;
  amount: string;
  amountTendered: string | null;
  changeAmount: string;
  referenceNumber: string | null;
  providerName: string | null;
  notes: string | null;
  orderNumber: string;
  receivedBy: { id: string; firstName: string; lastName: string };
  completedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

// Payment queue
export const getPaymentQueue = async (params?: Record<string, string>) => {
  const response = await api.get('/payments/queue', { params });
  return response.data;
};

// Payment list
export const getPayments = async (params?: Record<string, string>) => {
  const response = await api.get('/payments', { params });
  return response.data;
};

// Payment summary (reports)
export const getPaymentSummary = async (params?: Record<string, string>) => {
  const response = await api.get('/payments/summary', { params });
  return response.data;
};

// Void payment
export const voidPayment = async (id: string, reason: string) => {
  const response = await api.post(`/payments/${id}/void`, { reason });
  return response.data;
};

// Issue refund
export const issueRefund = async (paymentId: string, data: {
  amount: string;
  method: string;
  reason: string;
  referenceNumber?: string;
  notes?: string;
  idempotencyKey?: string;
}) => {
  const response = await api.post(`/payments/${paymentId}/refund`, data);
  return response.data;
};

// Order payment summary
export const getOrderPaymentSummary = async (orderId: string) => {
  const response = await api.get(`/orders/${orderId}/payment-summary`);
  return response.data;
};

// Request payment
export const requestPayment = async (orderId: string) => {
  const response = await api.post(`/orders/${orderId}/request-payment`);
  return response.data;
};

// Cancel payment request
export const cancelPaymentRequest = async (orderId: string) => {
  const response = await api.post(`/orders/${orderId}/cancel-payment-request`);
  return response.data;
};

// Record payment
export const recordPayment = async (orderId: string, data: {
  method: string;
  amount: string;
  amountTendered?: string;
  referenceNumber?: string;
  providerName?: string;
  notes?: string;
  idempotencyKey?: string;
  tipAmount?: string;
  tipMethod?: string;
}) => {
  const response = await api.post(`/orders/${orderId}/payments`, data);
  return response.data;
};

// Split payment
export const recordSplitPayment = async (orderId: string, payments: Array<{
  method: string;
  amount: string;
  amountTendered?: string;
  referenceNumber?: string;
  providerName?: string;
  notes?: string;
}>) => {
  const response = await api.post(`/orders/${orderId}/payments/split`, { payments });
  return response.data;
};

// Close order
export const closeOrder = async (orderId: string, exceptionReason?: string) => {
  const response = await api.post(`/orders/${orderId}/close`, { exceptionReason });
  return response.data;
};
