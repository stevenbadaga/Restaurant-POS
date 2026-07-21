import api from './api';

export const getApprovalRequests = async (params?: Record<string, string>) => {
  const response = await api.get('/approval-requests', { params });
  return response.data;
};

export const approveApprovalRequest = async (id: string, note?: string) => {
  const response = await api.post(`/approval-requests/${id}/approve`, { note });
  return response.data;
};

export const rejectApprovalRequest = async (id: string, reason: string) => {
  const response = await api.post(`/approval-requests/${id}/reject`, { reason });
  return response.data;
};
