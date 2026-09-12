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

/**
 * Decodes a Cognito ID token's JWT payload into an AuthUser.
 *
 * Reads the actual Cognito claim names, not plain-English field names:
 * `cognito:username` (not `username`) for the sign-in username, and the
 * namespaced custom attributes `custom:role` / `custom:appUserId`. The latter
 * is the application DB id (parent.id / learner.id) set at registration —
 * Cognito's own `sub` is a different value and only used as a fallback.
 *
 * Returns null if the token is malformed.
 */
function decodeAuthUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload['custom:appUserId'] || payload.sub,
      username: payload['cognito:username'] || payload.sub || '',
      name: payload.name,
      role: payload['custom:role'] as UserRole,
      token,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // On mount: check localStorage for existing token
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const user = decodeAuthUser(token);
      if (user) {
        setState({
          user,
          isLoading: false,
          isAuthenticated: true,
          role: user.role,
          username: user.username,
        });
      } else {
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
    // Tokens are stored by authApi.login already; decode the ID token it just
    // stored to populate the user's real identity (role, username, app id).
    const user = decodeAuthUser(response.token);
    if (!user) {
      throw new Error('Received an invalid session token');
    }
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
