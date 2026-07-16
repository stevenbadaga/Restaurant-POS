import api from './api';

// Self-service
export const getMyAttendance = async (params?: Record<string, string>) => {
  const response = await api.get('/attendance/me', { params });
  return response.data;
};

export const getMyCurrentStatus = async () => {
  const response = await api.get('/attendance/current');
  return response.data;
};

export const clockIn = async () => {
  const response = await api.post('/attendance/clock-in');
  return response.data;
};

export const startBreak = async (note?: string) => {
  const response = await api.post('/attendance/break/start', { note });
  return response.data;
};

export const endBreak = async () => {
  const response = await api.post('/attendance/break/end');
  return response.data;
};

export const clockOut = async () => {
  const response = await api.post('/attendance/clock-out');
  return response.data;
};

// Manager endpoints
export const getAttendanceList = async (params?: Record<string, any>) => {
  const response = await api.get('/attendance', { params });
  return response.data;
};

export const getAttendanceRecord = async (assignmentId: string) => {
  const response = await api.get(`/attendance/${assignmentId}`);
  return response.data;
};

export const managerClockIn = async (assignmentId: string, data?: any) => {
  const response = await api.post(`/attendance/${assignmentId}/clock-in`, data);
  return response.data;
};

export const managerClockOut = async (assignmentId: string, data?: any) => {
  const response = await api.post(`/attendance/${assignmentId}/clock-out`, data);
  return response.data;
};

export const correctAttendance = async (assignmentId: string, data: {
  clockedInAt?: string;
  clockedOutAt?: string;
  totalBreakMinutes?: number;
  reason: string;
}) => {
  const response = await api.post(`/attendance/${assignmentId}/correct`, data);
  return response.data;
};

export const markAbsent = async (assignmentId: string, reason: string) => {
  const response = await api.post(`/attendance/${assignmentId}/mark-absent`, { reason });
  return response.data;
};

export const excuseAbsence = async (assignmentId: string, reason: string) => {
  const response = await api.post(`/attendance/${assignmentId}/excuse`, { reason });
  return response.data;
};
