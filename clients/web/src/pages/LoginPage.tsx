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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Left gradient panel */}
      <div
        style={{
          flex: 1,
          background: 'linear-gradient(135deg, #2C2341, #9B59B6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          color: 'white',
        }}
      >
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            fontSize: '2.5rem',
          }}
          aria-hidden="true"
        >
          📖
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>
          ChikuMiku LearnVerse
        </div>
        <div style={{ fontSize: '0.875rem', opacity: 0.8, fontStyle: 'italic' }}>
          Where Curiosity Comes Alive ✨
        </div>
      </div>

      {/* Right form panel */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          background: 'var(--color-background)',
        }}
      >
        <div
          className="card"
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: 'var(--space-xl)',
          }}
        >
          {/* Logo area */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                margin: '0 auto 8px',
                borderRadius: '12px',
                background: '#FDE8F4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
              }}
              aria-hidden="true"
            >
              📖
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-dark)' }}>
              ChikuMiku LearnVerse
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontStyle: 'italic' }}>
              Where Curiosity Comes Alive
            </div>
          </div>

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
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 'var(--space-sm)',
                }}
              >
                I am a...
              </legend>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button
                  type="button"
                  onClick={() => {
                    setRole('parent');
                    setErrors((prev) => ({ ...prev, role: undefined }));
                  }}
                  aria-pressed={role === 'parent'}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: role === 'parent'
                      ? '2px solid var(--color-secondary)'
                      : '2px solid var(--color-border)',
                    background: role === 'parent' ? '#F3E8F9' : 'var(--color-white)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minHeight: 'auto',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }} aria-hidden="true">🛡️</div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: role === 'parent' ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                    }}
                  >
                    Parent
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRole('learner');
                    setErrors((prev) => ({ ...prev, role: undefined }));
                  }}
                  aria-pressed={role === 'learner'}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    borderRadius: '10px',
                    border: role === 'learner'
                      ? '2px solid var(--color-secondary)'
                      : '2px solid var(--color-border)',
                    background: role === 'learner' ? '#F3E8F9' : 'var(--color-white)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    minHeight: 'auto',
                  }}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '4px' }} aria-hidden="true">🧒</div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: role === 'learner' ? 'var(--color-secondary)' : 'var(--color-text-muted)',
                    }}
                  >
                    Learner
                  </div>
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
                  fontWeight: 600,
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
                style={{
                  borderColor: errors.username ? 'var(--color-error)' : undefined,
                }}
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
                  fontWeight: 600,
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
                style={{
                  borderColor: errors.password ? 'var(--color-error)' : undefined,
                }}
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
              disabled={isSubmitting}
              style={{
                width: '100%',
                marginBottom: 'var(--space-md)',
                padding: '12px',
                border: 'none',
                borderRadius: '22px',
                background: 'linear-gradient(135deg, #E94F9B, #9B59B6)',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                minHeight: '48px',
              }}
            >
              {isSubmitting ? 'Logging in…' : 'Login'}
            </button>

            {/* Forgot Password link — Requirement 3.1 */}
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                }}
              >
                Forgot Password?
              </Link>
            </div>

            {/* Create Account */}
            <Link
              to="/register"
              style={{
                display: 'block',
                width: '100%',
                padding: '12px',
                border: '2px solid var(--color-secondary)',
                borderRadius: '22px',
                background: 'var(--color-white)',
                color: 'var(--color-secondary)',
                fontSize: '0.875rem',
                fontWeight: 600,
                textAlign: 'center',
                textDecoration: 'none',
                minHeight: '48px',
              }}
            >
              Create Account
            </Link>
          </form>
        </div>
      </div>
    </div>
  );
}
