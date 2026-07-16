import api from './api';

export const getCashRegisters = async () => {
  const response = await api.get('/cash-registers');
  return response.data;
};

export const getCashRegister = async (id: string) => {
  const response = await api.get(`/cash-registers/${id}`);
  return response.data;
};

export const createCashRegister = async (data: any) => {
  const response = await api.post('/cash-registers', data);
  return response.data;
};

export const updateCashRegister = async (id: string, data: any) => {
  const response = await api.patch(`/cash-registers/${id}`, data);
  return response.data;
};

export const setRegisterStatus = async (id: string, status: string) => {
  const response = await api.patch(`/cash-registers/${id}/status`, { status });
  return response.data;
};

export const setDefaultRegister = async (id: string) => {
  const response = await api.post(`/cash-registers/${id}/set-default`);
  return response.data;
};
