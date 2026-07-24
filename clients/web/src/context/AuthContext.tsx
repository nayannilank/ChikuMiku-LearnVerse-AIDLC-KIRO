/**
 * AuthContext — Provides authentication state and actions throughout the app.
 *
 * Tracks user info, JWT token, and provides login/register/logout methods.
 * Persists JWT in localStorage and validates on mount.
 *
 * Validates: Requirements 3.1, 3.2
 */
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../services/authApi';
import { getAccessToken, clearTokens, setTokens } from '../services/apiClient';

export type UserRole = 'parent' | 'learner';

export interface AuthUser {
  id?: string;
  username: string;
  name?: string;
  role: UserRole;
  token: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  role: UserRole | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string, role: UserRole) => Promise<void>;
  register: (data: Record<string, unknown>, role: UserRole) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
  role: null,
  username: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // On mount: check localStorage for existing token
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      // Decode token payload to get user info (JWT base64)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const user: AuthUser = {
          id: payload.sub || payload.id,
          username: payload.username || payload.sub || '',
          name: payload.name,
          role: payload.role as UserRole,
          token,
        };
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          role: user.role,
          username: user.username,
        });
      } catch {
        // Token is invalid — clear it
        clearTokens();
        setState({ ...INITIAL_STATE, isLoading: false });
      }
    } else {
      setState({ ...INITIAL_STATE, isLoading: false });
    }
  }, []);

  const login = useCallback(async (username: string, password: string, role: UserRole) => {
    const response = await authApi.login({ username, password, role });
    const token = response.accessToken;
    const user: AuthUser = {
      id: undefined,
      username: response.username || username,
      name: undefined,
      role: response.role as UserRole,
      token,
    };
    // Tokens are stored by authApi.login already
    setState({
      user,
      isLoading: false,
      isAuthenticated: true,
      role: user.role,
      username: user.username,
    });
  }, []);

  const register = useCallback(async (data: Record<string, unknown>, role: UserRole) => {
    if (role === 'parent') {
      await authApi.registerParent(data as unknown as Parameters<typeof authApi.registerParent>[0]);
    } else {
      await authApi.registerLearner(data as unknown as Parameters<typeof authApi.registerLearner>[0]);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setState({ ...INITIAL_STATE, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
