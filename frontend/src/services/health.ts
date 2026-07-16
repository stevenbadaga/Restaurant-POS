import api from './api';
import type { HealthResponse } from '@/types';

export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await api.get<HealthResponse>('/health');
  return response.data;
};
