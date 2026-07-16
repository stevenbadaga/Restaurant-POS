export interface HealthResponse {
  success: boolean;
  message: string;
  timestamp: string;
  environment: string;
}

export interface ApiError {
  success: false;
  message: string;
  stack?: string;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export type NavItem = {
  label: string;
  path: string;
  icon: string;
  children?: NavItem[];
};
