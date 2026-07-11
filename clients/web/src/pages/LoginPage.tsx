/**
 * LoginPage — Authentication screen with role selector, credentials, and validation.
 *
 * Features:
 * - Role selector (Parent/Learner) via tab-style buttons
 * - Username and masked password fields
 * - Client-side validation: requires role, username, password
 * - Generic error on auth failure (no info leakage)
 * - Account lockout display (15 min after 5 failures)
 * - Redirect to role-appropriate dashboard on success
 * - Forgot Password link
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */
import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginApi } from '../services/api';
import type { UserRole } from '../context/AuthContext';

interface FormErrors {
  role?: string;
  username?: string;
  password?: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): FormErrors => {
    const fieldErrors: FormErrors = {};
    if (!role) {
      fieldErrors.role = 'Please select a role.';
    }
    if (!username.trim()) {
      fieldErrors.username = 'Username is required.';
    }
    if (!password) {
      fieldErrors.password = 'Password is required.';
    }
    return fieldErrors;
  }, [role, username, password]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setApiError(null);

      const fieldErrors = validate();
      setErrors(fieldErrors);

      // Don't submit if validation fails (Requirement 3.3)
      if (Object.keys(fieldErrors).length > 0) {
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await loginApi({
          role: role!,
          username: username.trim(),
          password,
        });

        if (response.success) {
          login(username.trim(), role!);
          // Redirect to role-appropriate dashboard (Requirement 3.2)
          const dashboardPath =
            role === 'parent' ? '/parent/dashboard' : '/learner/dashboard';
          navigate(dashboardPath, { replace: true });
        } else {
          // Show generic error or lockout message (Requirements 3.4, 3.5)
          setApiError(response.error ?? 'Invalid credentials. Please try again.');
        }
      } catch {
        setApiError('Something went wrong. Please try again later.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [role, username, password, validate, login, navigate]
  );

  return (
    <div
      className="card"
      style={{
        maxWidth: '420px',
        margin: 'var(--space-xxl) auto',
        padding: 'var(--space-xl)',
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
          color: 'var(--color-primary)',
        }}
      >
        Login
      </h2>

      <form onSubmit={handleSubmit} noValidate>
        {/* Role Selector — Requirement 3.1 */}
        <fieldset
          style={{
            border: 'none',
            padding: 0,
            marginBottom: 'var(--space-lg)',
          }}
        >
          <legend
            style={{
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-sm)',
            }}
          >
            I am a
          </legend>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              type="button"
              className={role === 'parent' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                setRole('parent');
                setErrors((prev) => ({ ...prev, role: undefined }));
              }}
              aria-pressed={role === 'parent'}
              style={{ flex: 1 }}
            >
              Parent
            </button>
            <button
              type="button"
              className={role === 'learner' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                setRole('learner');
                setErrors((prev) => ({ ...prev, role: undefined }));
              }}
              aria-pressed={role === 'learner'}
              style={{ flex: 1 }}
            >
              Learner
            </button>
          </div>
          {errors.role && (
            <p
              role="alert"
              style={{
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
                marginTop: 'var(--space-xs)',
              }}
            >
              {errors.role}
            </p>
          )}
        </fieldset>

        {/* Username — Requirement 3.1 */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label
            htmlFor="login-username"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            Username
          </label>
          <input
            id="login-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrors((prev) => ({ ...prev, username: undefined }));
            }}
            autoComplete="username"
            aria-invalid={!!errors.username}
            aria-describedby={errors.username ? 'username-error' : undefined}
          />
          {errors.username && (
            <p
              id="username-error"
              role="alert"
              style={{
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
                marginTop: 'var(--space-xs)',
              }}
            >
              {errors.username}
            </p>
          )}
        </div>

        {/* Password (masked) — Requirement 3.1 */}
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label
            htmlFor="login-password"
            style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            Password
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          {errors.password && (
            <p
              id="password-error"
              role="alert"
              style={{
                color: 'var(--color-error)',
                fontSize: '0.8125rem',
                marginTop: 'var(--space-xs)',
              }}
            >
              {errors.password}
            </p>
          )}
        </div>

        {/* API error / lockout message — Requirements 3.4, 3.5 */}
        {apiError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              backgroundColor: 'rgba(231, 76, 60, 0.08)',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-input)',
              padding: 'var(--space-sm) var(--space-md)',
              marginBottom: 'var(--space-md)',
              color: 'var(--color-error)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            {apiError}
          </div>
        )}

        {/* Login button */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%', marginBottom: 'var(--space-md)' }}
        >
          {isSubmitting ? 'Logging in…' : 'Login'}
        </button>

        {/* Forgot Password link — Requirement 3.1 */}
        <div style={{ textAlign: 'center' }}>
          <Link
            to="/forgot-password"
            style={{ fontSize: '0.875rem' }}
          >
            Forgot Password?
          </Link>
        </div>
      </form>
    </div>
  );
}
