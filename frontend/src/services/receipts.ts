import api from './api';

// Get receipt list
export const getReceipts = async (params?: Record<string, string>) => {
  const response = await api.get('/receipts', { params });
  return response.data;
};

// Get receipt detail
export const getReceiptDetail = async (id: string) => {
  const response = await api.get(`/receipts/${id}`);
  return response.data;
};

// Get receipt by order
export const getReceiptByOrder = async (orderId: string) => {
  const response = await api.get(`/receipts/order/${orderId}`);
  return response.data;
};

// Generate receipt
export const generateReceipt = async (orderId: string) => {
  const response = await api.post(`/orders/${orderId}/receipt`);
  return response.data;
};

// Download receipt PDF
export const getReceiptPdfUrl = (id: string, paperSize: string = 'THERMAL_80MM'): string => {
  return `${api.defaults.baseURL}/receipts/${id}/pdf?paperSize=${paperSize}`;
};

// Reprint receipt
export const reprintReceipt = async (id: string) => {
  const response = await api.post(`/receipts/${id}/reprint`);
  return response.data;
};

// Void receipt
export const voidReceipt = async (id: string, reason: string) => {
  const response = await api.post(`/receipts/${id}/void`, { reason });
  return response.data;
};
