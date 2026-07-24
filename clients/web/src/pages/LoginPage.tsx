/**
 * LoginPage — Role selector, username, password, login button.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../theme';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [role, setRole] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!role || !username || !password) return;
    setLoading(true);
    setError('');
    try {
      await login(username, password, role.toLowerCase() as UserRole);
      navigate(role === 'Parent' ? '/parent/dashboard' : '/learner/dashboard');
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || 'Login failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: { minHeight: '100vh', background: theme.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: theme.fonts.family },
    card: { width: '100%', maxWidth: 380 },
    header: { textAlign: 'center', marginBottom: 24 },
    logo: { fontSize: 32, color: theme.colors.pink, marginBottom: 8 },
    title: { fontSize: theme.fonts.sizes.xl, fontWeight: theme.fonts.weights.extrabold, color: theme.colors.dark, marginBottom: 4 },
    tagline: { fontSize: theme.fonts.sizes.sm, color: theme.colors.pink, fontStyle: 'italic' },
    roleSection: { marginBottom: 16 },
    roleLabel: { fontSize: theme.fonts.sizes.sm, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 8, display: 'block' },
    roleRow: { display: 'flex', gap: 10 },
    error: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: theme.borderRadius.input, fontSize: theme.fonts.sizes.sm, marginBottom: 12, textAlign: 'center' },
    forgotLink: { textAlign: 'center', marginTop: 12 },
    link: { color: theme.colors.purple, fontSize: theme.fonts.sizes.sm, cursor: 'pointer', textDecoration: 'none', fontWeight: theme.fonts.weights.medium },
    registerSection: { textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: `1px solid ${theme.colors.border}`, fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight },
  };

  const roleOption = (isSelected: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '12px 8px',
    borderRadius: theme.borderRadius.small,
    border: `2px solid ${isSelected ? theme.colors.purple : theme.colors.border}`,
    background: isSelected ? theme.colors.purpleLight : theme.colors.white,
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={styles.container}>
      <Card style={styles.card} padding="24px">
        <div style={styles.header}>
          <i className="fas fa-book-open-reader" style={styles.logo} />
          <div style={styles.title}>ChikuMiku LearnVerse</div>
          <div style={styles.tagline}>Where Curiosity Comes Alive ✨</div>
        </div>

        <div style={styles.roleSection}>
          <span style={styles.roleLabel}>I am a:</span>
          <div style={styles.roleRow}>
            <div style={roleOption(role === 'Parent')} onClick={() => setRole('Parent')}>
              <i className="fas fa-user-shield" style={{ fontSize: 20, color: role === 'Parent' ? theme.colors.purple : theme.colors.textLight, marginBottom: 4 }} />
              <div style={{ fontSize: theme.fonts.sizes.sm, fontWeight: role === 'Parent' ? theme.fonts.weights.semibold : theme.fonts.weights.normal, color: role === 'Parent' ? theme.colors.purple : theme.colors.textLight }}>Parent</div>
            </div>
            <div style={roleOption(role === 'Learner')} onClick={() => setRole('Learner')}>
              <i className="fas fa-user-graduate" style={{ fontSize: 20, color: role === 'Learner' ? theme.colors.purple : theme.colors.textLight, marginBottom: 4 }} />
              <div style={{ fontSize: theme.fonts.sizes.sm, fontWeight: role === 'Learner' ? theme.fonts.weights.semibold : theme.fonts.weights.normal, color: role === 'Learner' ? theme.colors.purple : theme.colors.textLight }}>Learner</div>
            </div>
          </div>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" required />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" showPasswordToggle required />

        <Button variant="primary" label={loading ? 'Logging in...' : 'Login'} icon="sign-in-alt" onPress={handleSubmit} fullWidth disabled={!role || !username || !password || loading} />

        <div style={styles.forgotLink}>
          <span style={styles.link} onClick={() => navigate('/forgot-password')}>Forgot Password?</span>
        </div>

        <div style={styles.registerSection}>
          Don&apos;t have an account?{' '}
          <span style={styles.link} onClick={() => navigate('/register/parent')}>Register here</span>
        </div>
      </Card>
    </div>
  );
}
