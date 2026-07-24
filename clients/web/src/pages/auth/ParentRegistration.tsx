/**
 * ParentRegistration — Parent registration form with validation and auto-redirect.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, PARENT_RELATIONSHIPS } from '../../theme';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Card } from '../../components/common/Card';
import { authApi } from '../../services/authApi';

export function ParentRegistration() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', name: '', phone: '', email: '', password: '', relationship: '' });
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (success && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (success && countdown === 0) {
      navigate('/login');
    }
  }, [success, countdown, navigate]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (form.username.length < 8 || form.username.length > 15) errors.username = '8-15 characters required';
    else if (!/^[a-z0-9_-]+$/.test(form.username)) errors.username = 'Only a-z, 0-9, hyphen, underscore';
    if (form.name.length < 5 || form.name.length > 20) errors.name = '5-20 characters required';
    if (!/^\d{10}$/.test(form.phone)) errors.phone = 'Exactly 10 digits required';
    if (form.email.length > 30 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Valid email (≤30 chars)';
    if (form.password.length < 8 || form.password.length > 20) errors.password = '8-20 characters required';
    else if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/.test(form.password)) errors.password = 'Need: 1 upper, 1 lower, 1 number, 1 symbol';
    if (!form.relationship) errors.relationship = 'Please select relationship';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      await authApi.registerParent(form as never);
      setSuccess(true);
    } catch (err: unknown) {
      setServerError((err as { message?: string })?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [field]: e.target.value });
    if (validationErrors[field]) setValidationErrors({ ...validationErrors, [field]: '' });
  };

  const styles: Record<string, React.CSSProperties> = {
    container: { minHeight: '100vh', background: theme.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: theme.fonts.family },
    card: { width: '100%', maxWidth: 500 },
    header: { textAlign: 'center', marginBottom: 20 },
    title: { fontSize: theme.fonts.sizes.xl, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark },
    subtitle: { fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight, marginTop: 4 },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    error: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: theme.borderRadius.input, fontSize: theme.fonts.sizes.sm, marginBottom: 12, textAlign: 'center' },
    successContainer: { textAlign: 'center', padding: 24 },
    successIcon: { fontSize: 48, color: theme.colors.green, marginBottom: 12 },
    successTitle: { fontSize: theme.fonts.sizes.lg, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 8 },
    successMsg: { fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight, marginBottom: 16 },
    countdown: { fontSize: theme.fonts.sizes.xxl, fontWeight: theme.fonts.weights.extrabold, color: theme.colors.purple },
    countdownLabel: { fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight, marginTop: 4 },
  };

  if (success) {
    return (
      <div style={styles.container}>
        <Card style={styles.card} padding="32px">
          <div style={styles.successContainer}>
            <i className="fas fa-check-circle" style={styles.successIcon} />
            <div style={styles.successTitle}>Registration Successful!</div>
            <div style={styles.successMsg}>Your parent account has been created.</div>
            <div style={styles.countdown}>{countdown}</div>
            <div style={styles.countdownLabel}>Redirecting to Login...</div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Card style={styles.card} padding="24px">
        <div style={styles.header}>
          <div style={styles.title}>Create Parent Account</div>
          <div style={styles.subtitle}>Register first, then add your children</div>
        </div>
        {serverError && <div style={styles.error}>{serverError}</div>}
        <div style={styles.twoCol}>
          <Input label="Parent Username" value={form.username} onChange={updateField('username')} placeholder="8-15 chars (a-z, 0-9, -, _)" required hint="Letters, numbers, hyphens, underscores only" error={validationErrors.username} />
          <Input label="Name" value={form.name} onChange={updateField('name')} placeholder="5-20 characters" required error={validationErrors.name} />
          <Input label="Phone" type="tel" value={form.phone} onChange={updateField('phone')} placeholder="10 digit phone number" required error={validationErrors.phone} />
          <Input label="Email" type="email" value={form.email} onChange={updateField('email')} placeholder="your@email.com" required error={validationErrors.email} />
        </div>
        <Input label="Password" type="password" value={form.password} onChange={updateField('password')} placeholder="8-20 characters" showPasswordToggle required hint="1 uppercase, 1 lowercase, 1 number, 1 special symbol" error={validationErrors.password} />
        <Select label="Relationship" value={form.relationship} onChange={updateField('relationship')} options={PARENT_RELATIONSHIPS} placeholder="Select relationship" required error={validationErrors.relationship} />
        <Button variant="primary" label={loading ? 'Registering...' : 'Register Parent'} icon="user-plus" onPress={handleSubmit} fullWidth disabled={loading} />
      </Card>
    </div>
  );
}
