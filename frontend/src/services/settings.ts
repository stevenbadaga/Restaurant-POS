import api from './api';

export const getAllSettings = async () => {
  const response = await api.get('/settings/all');
  return response.data;
};

export const getSettings = async () => {
  const response = await api.get('/settings/operations');
  return response.data;
};

export const updateSettings = async (data: Record<string, any>) => {
  const response = await api.patch('/settings/operations', data);
  return response.data;
};

export const getRestaurantProfile = async () => {
  const response = await api.get('/settings/profile');
  return response.data;
};

export const updateRestaurantProfile = async (data: Record<string, any>) => {
  const response = await api.patch('/settings/profile', data);
  return response.data;
};

export const getBusinessHours = async () => {
  const response = await api.get('/settings/business-hours');
  return response.data;
};

export const updateBusinessHours = async (periods: Array<{
  dayOfWeek: string;
  isClosed: boolean;
  periods?: { openTime: string; closeTime: string }[];
}>) => {
  const response = await api.put('/settings/business-hours', periods);
  return response.data;
};
