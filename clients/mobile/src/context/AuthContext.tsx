/**
 * AuthContext — Provides authentication state and actions for the mobile app.
 *
 * Manages JWT token lifecycle via platform-secure storage.
 * Tracks isAuthenticated, role, username, and grade.
 *
 * Validates: Requirements 3.1, 3.2, 20.3
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

import {
  storeAccessToken,
  storeRefreshToken,
  storeUserSession,
  getUserSession,
  clearAuthStorage,
  type UserSession,
} from '../services/secureStorage';

export type UserRole = 'parent' | 'learner';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  username: string | null;
  grade: string | null;
}

interface AuthContextValue extends AuthState {
  login: (params: {
    username: string;
    role: UserRole;
    grade?: string;
    accessToken: string;
    refreshToken: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  role: null,
  username: null,
  grade: null,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  // Restore session from secure storage on app launch
  useEffect(() => {
    async function restoreSession() {
      try {
        const session = await getUserSession();
        if (session) {
          setState({
            isAuthenticated: true,
            isLoading: false,
            role: session.role,
            username: session.username,
            grade: session.grade ?? null,
          });
        } else {
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    }
    void restoreSession();
  }, []);

  const login = useCallback(
    async (params: {
      username: string;
      role: UserRole;
      grade?: string;
      accessToken: string;
      refreshToken: string;
    }) => {
      // Store tokens securely
      await storeAccessToken(params.accessToken);
      await storeRefreshToken(params.refreshToken);

      const session: UserSession = {
        username: params.username,
        role: params.role,
        grade: params.grade,
      };
      await storeUserSession(session);

      setState({
        isAuthenticated: true,
        isLoading: false,
        role: params.role,
        username: params.username,
        grade: params.grade ?? null,
      });
    },
    []
  );

  const logout = useCallback(async () => {
    await clearAuthStorage();
    setState({
      isAuthenticated: false,
      isLoading: false,
      role: null,
      username: null,
      grade: null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
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
