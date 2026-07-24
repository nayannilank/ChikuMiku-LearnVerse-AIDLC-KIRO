/**
 * ProtectedRoute — Route wrapper that redirects unauthenticated users to /login.
 * Optionally restricts access to specific roles.
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Redirect to appropriate dashboard
    const redirectPath = role === 'parent' ? '/parent/dashboard' : '/learner/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
