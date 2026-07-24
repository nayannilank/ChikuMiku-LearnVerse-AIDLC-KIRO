/**
 * ForgotPassword — 4-step forgot password flow with OTP verification.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { authApi } from '../../services/authApi';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (step === 4 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (step === 4 && countdown === 0) navigate('/login');
  }, [step, countdown, navigate]);

  const handleStep1 = async () => {
    if (username.length < 8) { setError('Enter a valid username (8+ characters)'); return; }
    setLoading(true); setError('');
    try {
      await authApi.forgotPassword(username);
      setStep(2);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const handleStep2 = async () => {
    if (otp.length !== 6 || !/^\d+$/.test(otp)) { setError('Enter a valid 6-digit OTP'); return; }
    setLoading(true); setError('');
    try {
      const res = await authApi.verifyOtp(username, otp);
      setResetToken(res.resetToken || '');
      setStep(3);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const handleStep3 = async () => {
    if (newPassword.length < 8 || newPassword.length > 20) { setError('Password must be 8-20 characters'); return; }
    if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/.test(newPassword)) { setError('Need 1 uppercase, 1 lowercase, 1 number, 1 symbol'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await authApi.resetPassword(username, newPassword, resetToken);
      setStep(4);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: { minHeight: '100vh', background: theme.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: theme.fonts.family },
    card: { width: '100%', maxWidth: 400 },
    header: { textAlign: 'center', marginBottom: 20 },
    stepIndicator: { display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 16 },
    title: { fontSize: theme.fonts.sizes.lg, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark },
    subtitle: { fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight, marginTop: 4 },
    error: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: theme.borderRadius.input, fontSize: theme.fonts.sizes.sm, marginBottom: 12, textAlign: 'center' },
    backLink: { textAlign: 'center', marginTop: 12, fontSize: theme.fonts.sizes.sm, color: theme.colors.purple, cursor: 'pointer' },
    successIcon: { fontSize: 48, color: theme.colors.green, marginBottom: 12, textAlign: 'center', display: 'block' },
    countdown: { fontSize: theme.fonts.sizes.xxl, fontWeight: theme.fonts.weights.extrabold, color: theme.colors.purple, textAlign: 'center' },
    countdownLabel: { fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight, textAlign: 'center', marginTop: 4 },
  };

  const dot = (active: boolean): React.CSSProperties => ({
    width: 10, height: 10, borderRadius: '50%',
    background: active ? theme.colors.purple : theme.colors.border,
  });

  return (
    <div style={styles.container}>
      <Card style={styles.card} padding="24px">
        <div style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => <div key={s} style={dot(step >= s)} />)}
        </div>

        {step === 1 && (
          <>
            <div style={styles.header}>
              <div style={styles.title}>Forgot Password</div>
              <div style={styles.subtitle}>Enter your username to receive an OTP</div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" required />
            <Button variant="primary" label={loading ? 'Sending...' : 'Send OTP'} icon="paper-plane" onPress={handleStep1} fullWidth disabled={loading} />
            <div style={styles.backLink} onClick={() => navigate('/login')}>← Back to Login</div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={styles.header}>
              <div style={styles.title}>Enter OTP</div>
              <div style={styles.subtitle}>We sent a 6-digit code to your registered email/phone</div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <Input label="OTP Code" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" required />
            <Button variant="primary" label={loading ? 'Verifying...' : 'Verify OTP'} icon="check" onPress={handleStep2} fullWidth disabled={loading} />
          </>
        )}

        {step === 3 && (
          <>
            <div style={styles.header}>
              <div style={styles.title}>Set New Password</div>
              <div style={styles.subtitle}>Create a strong new password</div>
            </div>
            {error && <div style={styles.error}>{error}</div>}
            <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8-20 characters" showPasswordToggle required hint="1 uppercase, 1 lowercase, 1 number, 1 symbol" />
            <Input label="Confirm Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required />
            <Button variant="primary" label={loading ? 'Resetting...' : 'Reset Password'} icon="lock" onPress={handleStep3} fullWidth disabled={loading} />
          </>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <i className="fas fa-check-circle" style={styles.successIcon} />
            <div style={styles.title}>Password Reset!</div>
            <div style={{ ...styles.subtitle, marginBottom: 16 }}>Your password has been updated successfully.</div>
            <div style={styles.countdown}>{countdown}</div>
            <div style={styles.countdownLabel}>Redirecting to Login...</div>
          </div>
        )}
      </Card>
    </div>
  );
}
