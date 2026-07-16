import api from './api';

// Shift Templates
export const getShiftTemplates = async (params?: Record<string, string>) => {
  const response = await api.get('/shifts/templates', { params });
  return response.data;
};

export const getShiftTemplate = async (id: string) => {
  const response = await api.get(`/shifts/templates/${id}`);
  return response.data;
};

export const createShiftTemplate = async (data: any) => {
  const response = await api.post('/shifts/templates', data);
  return response.data;
};

export const updateShiftTemplate = async (id: string, data: any) => {
  const response = await api.patch(`/shifts/templates/${id}`, data);
  return response.data;
};

export const setTemplateStatus = async (id: string, isActive: boolean) => {
  const response = await api.patch(`/shifts/templates/${id}/status`, { isActive });
  return response.data;
};

// Work Shifts
export const getWorkShifts = async (params?: Record<string, any>) => {
  const response = await api.get('/shifts', { params });
  return response.data;
};

export const getCurrentShift = async () => {
  const response = await api.get('/shifts/current');
  return response.data;
};

export const getWorkShift = async (id: string) => {
  const response = await api.get(`/shifts/${id}`);
  return response.data;
};

export const createWorkShift = async (data: any) => {
  const response = await api.post('/shifts', data);
  return response.data;
};

export const updateWorkShift = async (id: string, data: any) => {
  const response = await api.patch(`/shifts/${id}`, data);
  return response.data;
};

export const publishShift = async (id: string) => {
  const response = await api.post(`/shifts/${id}/publish`);
  return response.data;
};

export const openShift = async (id: string) => {
  const response = await api.post(`/shifts/${id}/open`);
  return response.data;
};

export const beginShiftClosing = async (id: string) => {
  const response = await api.post(`/shifts/${id}/begin-closing`);
  return response.data;
};

export const closeShift = async (id: string, force?: boolean) => {
  const response = await api.post(`/shifts/${id}/close`, { force });
  return response.data;
};

export const cancelShift = async (id: string, reason: string) => {
  const response = await api.post(`/shifts/${id}/cancel`, { reason });
  return response.data;
};

// Assignments
export const getShiftAssignments = async (shiftId: string) => {
  const response = await api.get(`/shifts/${shiftId}/assignments`);
  return response.data;
};

export const addShiftAssignment = async (shiftId: string, data: any) => {
  const response = await api.post(`/shifts/${shiftId}/assignments`, data);
  return response.data;
};

export const updateShiftAssignment = async (shiftId: string, assignmentId: string, data: any) => {
  const response = await api.patch(`/shifts/${shiftId}/assignments/${assignmentId}`, data);
  return response.data;
};

export const removeShiftAssignment = async (shiftId: string, assignmentId: string) => {
  const response = await api.delete(`/shifts/${shiftId}/assignments/${assignmentId}`);
  return response.data;
};

export const markAssignmentAbsent = async (shiftId: string, assignmentId: string, reason: string) => {
  const response = await api.post(`/shifts/${shiftId}/assignments/${assignmentId}/mark-absent`, { reason });
  return response.data;
};

export const excuseAssignment = async (shiftId: string, assignmentId: string, reason: string) => {
  const response = await api.post(`/shifts/${shiftId}/assignments/${assignmentId}/excuse`, { reason });
  return response.data;
};
