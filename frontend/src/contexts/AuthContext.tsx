import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import api, { refreshCsrfToken } from '@/services/api';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employeeCode: string | null;
  status: string;
  mustChangePassword: boolean;
  roles: string[];
  lastLoginAt: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SetupInput {
  restaurantName: string;
  restaurantEmail?: string;
  restaurantPhone?: string;
  address?: string;
  currency: string;
  timezone: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  passwordConfirmation: string;
}

interface AuthContextType {
  user: User | null;
  restaurant: Restaurant | null;
  loading: boolean;
  error: string | null;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  initializeSetup: (input: SetupInput) => Promise<void>;
  checkSetupStatus: () => Promise<boolean>;
  refreshCurrentUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  restaurant: null,
  loading: true,
  error: null,
  login: async () => undefined,
  logout: async () => undefined,
  initializeSetup: async () => undefined,
  checkSetupStatus: async () => true,
  refreshCurrentUser: async () => undefined,
});

const SESSION_HINT_KEY = 'restaurant_pos_has_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyAuthPayload = useCallback((payload: { user: User; restaurant?: Restaurant | null }) => {
    setUser(payload.user);
    setRestaurant(payload.restaurant ?? null);
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const result = await api.get('/auth/me');
      const data = result.data.data || result.data;
      setUser(data);
      if (data.restaurant) setRestaurant(data.restaurant);
      setError(null);
    } catch {
      setUser(null);
      setRestaurant(null);
      window.localStorage.removeItem(SESSION_HINT_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const result = await api.get('/auth/me');
    const data = result.data.data || result.data;
    setUser(data);
    setRestaurant(data.restaurant ?? null);
    setError(null);
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post('/auth/login', input);
      applyAuthPayload(result.data.data || result.data);
      window.localStorage.setItem(SESSION_HINT_KEY, 'true');
    } catch (err) {
      const message = getErrorMessage(err, 'Login failed');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [applyAuthPayload]);

  const initializeSetup = useCallback(async (input: SetupInput) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post('/setup/initialize', input);
      applyAuthPayload(result.data.data || result.data);
      window.localStorage.setItem(SESSION_HINT_KEY, 'true');
    } catch (err) {
      const message = getErrorMessage(err, 'Setup failed');
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, [applyAuthPayload]);

  const checkSetupStatus = useCallback(async () => {
    const result = await api.get('/setup/status');
    const data = result.data.data || result.data;
    return Boolean(data.setupRequired);
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    window.localStorage.removeItem(SESSION_HINT_KEY);
    try {
      await refreshCsrfToken();
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setRestaurant(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem(SESSION_HINT_KEY) !== 'true') {
      setLoading(false);
      return;
    }

    fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurant,
        loading,
        error,
        login,
        logout,
        initializeSetup,
        checkSetupStatus,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    return response?.data?.message ?? response?.data?.error ?? fallback;
  }

  if (error instanceof Error) return error.message;
  return fallback;
}
