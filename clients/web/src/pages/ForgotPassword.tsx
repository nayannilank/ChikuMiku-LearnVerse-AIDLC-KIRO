/**
 * ForgotPassword — Multi-step password reset flow.
 *
 * Stage 1: Username entry with generic error on failure (no info leakage).
 * Stage 2: OTP verification (6 digits, 5-min timer, max 3 attempts).
 * Stage 3: New password entry with validation, success redirect to /login.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { validatePassword } from '@chikumiku/validation';
import { authApi } from '../services/api';

type Stage = 'username' | 'otp' | 'newPassword' | 'success';

const OTP_TIMER_SECONDS = 5 * 60; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;
const REDIRECT_DELAY_MS = 3000;

export function ForgotPassword() {
  const navigate = useNavigate();

  const [stage, setStage] = useState<Stage>('username');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(OTP_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Password validation errors
  const [passwordError, setPasswordError] = useState('');

  // Start countdown timer when entering OTP stage
  useEffect(() => {
    if (stage === 'otp') {
      setTimerSeconds(OTP_TIMER_SECONDS);
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  // Redirect to login after success
  useEffect(() => {
    if (stage === 'success') {
      const timeout = setTimeout(() => {
        navigate('/login');
      }, REDIRECT_DELAY_MS);
      return () => clearTimeout(timeout);
    }
  }, [stage, navigate]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUsernameSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      try {
        const result = await authApi.forgotPassword(username);
        if (result.success) {
          setStage('otp');
        } else {
          setError('Unable to process request');
        }
      } catch {
        setError('Unable to process request');
      } finally {
        setLoading(false);
      }
    },
    [username]
  );

  const handleOtpSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (timerSeconds <= 0) {
        setError('OTP has expired. Please try again.');
        return;
      }

      if (otpAttempts >= MAX_OTP_ATTEMPTS) {
        setError('Maximum attempts reached. Please restart the process.');
        return;
      }

      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        setError('Please enter a valid 6-digit OTP');
        return;
      }

      setLoading(true);

      try {
        const result = await authApi.verifyOtp(username, otp);
        if (result.success) {
          if (timerRef.current) clearInterval(timerRef.current);
          setStage('newPassword');
        } else {
          const newAttempts = otpAttempts + 1;
          setOtpAttempts(newAttempts);
          if (newAttempts >= MAX_OTP_ATTEMPTS) {
            setError('Maximum attempts reached. Please restart the process.');
          } else {
            setError(`Invalid OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempt(s) remaining.`);
          }
        }
      } catch {
        setError('Unable to process request');
      } finally {
        setLoading(false);
      }
    },
    [username, otp, otpAttempts, timerSeconds]
  );

  const handlePasswordSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setPasswordError('');

      // Validate password
      const validation = validatePassword(newPassword);
      if (!validation.valid) {
        setPasswordError(validation.errors.password || 'Invalid password');
        return;
      }

      if (newPassword !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }

      setLoading(true);

      try {
        const result = await authApi.resetPassword(username, newPassword);
        if (result.success) {
          setStage('success');
        } else {
          setError(result.message || 'Unable to process request');
        }
      } catch {
        setError('Unable to process request');
      } finally {
        setLoading(false);
      }
    },
    [username, newPassword, confirmPassword]
  );

  const handleRestart = () => {
    setStage('username');
    setUsername('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setPasswordError('');
    setOtpAttempts(0);
    setTimerSeconds(OTP_TIMER_SECONDS);
  };

  const timerExpired = timerSeconds <= 0;
  const maxAttemptsReached = otpAttempts >= MAX_OTP_ATTEMPTS;

  return (
    <div className="card" style={{ maxWidth: '400px', margin: '2rem auto' }}>
      <h2>Reset Password</h2>

      {/* Stage 1: Username Entry */}
      {stage === 'username' && (
        <form onSubmit={handleUsernameSubmit} aria-label="Forgot password form">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            Enter your username to receive a verification code.
          </p>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label htmlFor="forgot-username" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              Username
            </label>
            <input
              id="forgot-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
            />
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-md)' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        </form>
      )}

      {/* Stage 2: OTP Verification */}
      {stage === 'otp' && (
        <form onSubmit={handleOtpSubmit} aria-label="OTP verification form">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Enter the 6-digit verification code sent to your registered contact.
          </p>

          <div
            style={{
              textAlign: 'center',
              marginBottom: 'var(--space-md)',
              fontSize: '1.25rem',
              fontWeight: 600,
              color: timerExpired ? 'var(--color-error)' : 'var(--color-text-primary)',
            }}
            aria-live="polite"
            aria-label={`Time remaining: ${formatTime(timerSeconds)}`}
          >
            {timerExpired ? 'Expired' : formatTime(timerSeconds)}
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label htmlFor="otp-input" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              Verification Code
            </label>
            <input
              id="otp-input"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
              disabled={timerExpired || maxAttemptsReached}
              style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
              autoComplete="one-time-code"
            />
          </div>

          {error && (
            <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-md)' }}>
              {error}
            </p>
          )}

          {(timerExpired || maxAttemptsReached) ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleRestart}
              style={{ width: '100%' }}
            >
              Start Over
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
          )}
        </form>
      )}

      {/* Stage 3: New Password */}
      {stage === 'newPassword' && (
        <form onSubmit={handlePasswordSubmit} aria-label="New password form">
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
            Enter your new password.
          </p>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label htmlFor="new-password" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label htmlFor="confirm-password" style={{ display: 'block', marginBottom: 'var(--space-xs)' }}>
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
            />
          </div>

          {passwordError && (
            <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-md)' }}>
              {passwordError}
            </p>
          )}

          {error && (
            <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-md)' }}>
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>

          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)' }}>
            Password must be 8-20 characters with at least one uppercase letter, one lowercase letter,
            one digit, and one special character (!@#$%^&*).
          </p>
        </form>
      )}

      {/* Success Stage */}
      {stage === 'success' && (
        <div role="status" aria-live="polite" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--color-success)', fontSize: '1.125rem', fontWeight: 600, marginBottom: 'var(--space-md)' }}>
            Password reset successful
          </p>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            Redirecting to login in 3 seconds...
          </p>
        </div>
      )}
    </div>
  );
}
