import api from './api';

export interface WaitingListEntry {
  id: string;
  queueNumber: string;
  customerName: string;
  phone: string | null;
  partySize: number;
  priority: number;
  preferredDiningAreaId: string | null;
  estimatedWaitMinutes: number | null;
  waitingDurationMinutes?: number | null;
  status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'LEFT' | 'CANCELLED';
  joinedAt: string;
  notifiedAt: string | null;
  seatedAt: string | null;
  cancelledAt: string | null;
  tableId: string | null;
  orderId: string | null;
  notes: string | null;
  diningArea?: { id: string; name: string } | null;
  table?: { id: string; name: string; code: string } | null;
}

export const getWaitingList = async (params?: Record<string, string>) => {
  const res = await api.get('/waiting-list', { params });
  return res.data;
};

export const createWaitingListEntry = async (data: Record<string, unknown>) => {
  const res = await api.post('/waiting-list', data);
  return res.data;
};

export const updateWaitingListEntry = async (id: string, data: Record<string, unknown>) => {
  const res = await api.patch(`/waiting-list/${id}`, data);
  return res.data;
};

export const notifyWaitingListEntry = async (id: string) => {
  const res = await api.post(`/waiting-list/${id}/notify`);
  return res.data;
};

export const seatWaitingListEntry = async (id: string, data: Record<string, unknown>) => {
  const res = await api.post(`/waiting-list/${id}/seat`, data);
  return res.data;
};

export const cancelWaitingListEntry = async (id: string) => {
  const res = await api.post(`/waiting-list/${id}/cancel`);
  return res.data;
};
