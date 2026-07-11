/**
 * AuthContext — Provides authentication state and actions throughout the app.
 *
 * Tracks isAuthenticated, role, and username.
 *
 * Validates: Requirements 3.1, 3.2
 */
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'parent' | 'learner';

interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  username: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthState = {
  isAuthenticated: false,
  role: null,
  username: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  const login = useCallback((username: string, role: UserRole) => {
    setState({ isAuthenticated: true, role, username });
  }, []);

  const logout = useCallback(() => {
    setState(INITIAL_STATE);
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
