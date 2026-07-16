import api from './api';

export const getCashierSessions = async (params?: Record<string, any>) => {
  const response = await api.get('/cashier-sessions', { params });
  return response.data;
};

export const getCurrentSession = async () => {
  const response = await api.get('/cashier-sessions/current');
  return response.data;
};

export const getSessionDetail = async (id: string) => {
  const response = await api.get(`/cashier-sessions/${id}`);
  return response.data;
};

export const openSession = async (data: {
  cashRegisterId: string;
  openingFloat: string;
  workShiftId?: string;
  notes?: string;
}) => {
  const response = await api.post('/cashier-sessions/open', data);
  return response.data;
};

export const beginClosingSession = async (id: string) => {
  const response = await api.post(`/cashier-sessions/${id}/begin-closing`);
  return response.data;
};

export const recordClosingCount = async (id: string, data: {
  countedCash?: string;
  denominations?: { denomination: string; quantity: number }[];
}) => {
  const response = await api.post(`/cashier-sessions/${id}/count`, data);
  return response.data;
};

export const submitSession = async (id: string, closingNotes?: string) => {
  const response = await api.post(`/cashier-sessions/${id}/submit`, { closingNotes });
  return response.data;
};

export const approveSession = async (id: string, notes?: string) => {
  const response = await api.post(`/cashier-sessions/${id}/approve`, { notes });
  return response.data;
};

export const rejectSession = async (id: string, reason: string) => {
  const response = await api.post(`/cashier-sessions/${id}/reject`, { reason });
  return response.data;
};

export const closeSession = async (id: string) => {
  const response = await api.post(`/cashier-sessions/${id}/close`);
  return response.data;
};

export const suspendSession = async (id: string, reason: string) => {
  const response = await api.post(`/cashier-sessions/${id}/suspend`, { reason });
  return response.data;
};

// Movements
export const getSessionMovements = async (id: string) => {
  const response = await api.get(`/cashier-sessions/${id}/movements`);
  return response.data;
};

export const addCashIn = async (sessionId: string, data: { amount: string; reason: string; notes?: string }) => {
  const response = await api.post(`/cashier-sessions/${sessionId}/cash-in`, data);
  return response.data;
};

export const addCashOut = async (sessionId: string, data: { amount: string; reason: string; notes?: string }) => {
  const response = await api.post(`/cashier-sessions/${sessionId}/cash-out`, data);
  return response.data;
};

export const addSafeDrop = async (sessionId: string, data: { amount: string; reason: string; notes?: string }) => {
  const response = await api.post(`/cashier-sessions/${sessionId}/safe-drop`, data);
  return response.data;
};

export const addAdjustment = async (sessionId: string, data: { movementType: string; amount: string; reason: string; notes?: string }) => {
  const response = await api.post(`/cashier-sessions/${sessionId}/adjustment`, data);
  return response.data;
};
