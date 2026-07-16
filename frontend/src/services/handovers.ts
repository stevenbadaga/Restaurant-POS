import api from './api';

export const getHandovers = async (params?: Record<string, any>) => {
  const response = await api.get('/handovers', { params });
  return response.data;
};

export const getHandover = async (id: string) => {
  const response = await api.get(`/handovers/${id}`);
  return response.data;
};

export const getHandoverSuggestions = async (shiftId: string, assignedRoleName?: string) => {
  const response = await api.get(`/handovers/suggestions/${shiftId}`, {
    params: { assignedRoleName },
  });
  return response.data;
};

export const createHandover = async (data: {
  workShiftId: string;
  toUserId?: string;
  assignedRoleName?: string;
  title: string;
  notes: string;
  unresolvedOrders?: any;
  stockConcerns?: any;
  cashConcerns?: any;
  maintenanceConcerns?: any;
}) => {
  const response = await api.post('/handovers', data);
  return response.data;
};

export const updateHandover = async (id: string, data: any) => {
  const response = await api.patch(`/handovers/${id}`, data);
  return response.data;
};

export const submitHandover = async (id: string) => {
  const response = await api.post(`/handovers/${id}/submit`);
  return response.data;
};

export const acknowledgeHandover = async (id: string) => {
  const response = await api.post(`/handovers/${id}/acknowledge`);
  return response.data;
};
