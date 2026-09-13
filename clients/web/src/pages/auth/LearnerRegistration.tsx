/**
 * LearnerRegistration — Full learner registration form with subject selection.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme, SUBJECTS, GRADES, GENDERS, RELATIONSHIPS } from '../../theme';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { RadioGroup } from '../../components/common/RadioGroup';
import { SubjectIcon } from '../../components/common/SubjectIcon';
import { Card } from '../../components/common/Card';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../services/authApi';

/**
 * COPPA parental consent copy shown before a parent's first learner
 * registration. Must stay in sync with CONSENT_TEXT in
 * services/auth/src/handlers/parental-consent.ts (the backend is the source
 * of truth and ignores this copy — it always stores its own constant — but
 * the two should read the same to the parent).
 */
const PARENTAL_CONSENT_TEXT =
  "I consent to ChikuMiku LearnVerse collecting and processing my child's " +
  'learning data (including name, grade, and academic progress) solely for ' +
  'educational purposes within this platform. I understand that no data will ' +
  'be shared with third parties, and I can request deletion of all data at any time.';

export function LearnerRegistration() {
  const navigate = useNavigate();
  const { username: parentUsername } = useAuth();
  const [form, setForm] = useState({ username: '', name: '', password: '', gender: '', relationship: '', grade: '', schoolName: '' });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(Object.keys(SUBJECTS));
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  // Parental consent (COPPA) gate — a parent must explicitly consent before
  // any learner (child) data can be stored. `null` while the initial status
  // check is in flight.
  const [hasConsented, setHasConsented] = useState<boolean | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .getConsentStatus()
      .then((status) => {
        if (!cancelled) setHasConsented(status.hasConsented);
      })
      .catch(() => {
        // Fail safe: treat as not-yet-consented so the checkbox is shown
        // rather than silently blocking registration on a 500 later.
        if (!cancelled) setHasConsented(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | string) => {
    const value = typeof e === 'string' ? e : e.target.value;
    setForm({ ...form, [field]: value });
    if (validationErrors[field]) setValidationErrors({ ...validationErrors, [field]: '' });
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (form.username.length < 8 || form.username.length > 15) errors.username = '8-15 characters required';
    if (form.name.length < 5 || form.name.length > 20) errors.name = '5-20 characters required';
    if (form.password.length < 8 || form.password.length > 20) errors.password = '8-20 characters';
    if (!form.gender) errors.gender = 'Select gender';
    if (!form.relationship) errors.relationship = 'Select relationship';
    if (!form.grade) errors.grade = 'Select grade';
    if (form.schoolName.length < 5 || form.schoolName.length > 30) errors.schoolName = '5-30 characters required';
    if (selectedSubjects.length === 0) errors.subjects = 'Select at least 1 subject';
    if (!hasConsented && !consentChecked) errors.consent = 'Parental consent is required to register a learner';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      // Grant COPPA consent first (once) — the backend rejects learner
      // registration with 403 CONSENT_REQUIRED until this is on record.
      if (!hasConsented) {
        await authApi.grantConsent();
        setHasConsented(true);
      }
      await authApi.registerLearner({ ...form, subjects: selectedSubjects } as never);
      navigate('/parent/dashboard');
    } catch (err: unknown) {
      setServerError((err as { message?: string })?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: theme.colors.bg, fontFamily: theme.fonts.family },
    nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#fff', borderBottom: `1px solid ${theme.colors.border}` },
    navLeft: { display: 'flex', alignItems: 'center', gap: 8 },
    navTitle: { fontSize: 13, fontWeight: theme.fonts.weights.extrabold, color: theme.colors.dark },
    navRight: { display: 'flex', alignItems: 'center', gap: 10 },
    avatar: { width: 28, height: 28, borderRadius: '50%', backgroundColor: theme.colors.purple, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    content: { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 20px' },
    card: { width: '100%', maxWidth: 700 },
    backRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
    title: { fontSize: theme.fonts.sizes.xl, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    fullWidth: { gridColumn: '1 / -1' },
    error: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: theme.borderRadius.input, fontSize: theme.fonts.sizes.sm, marginBottom: 12, textAlign: 'center' },
    sectionLabel: { fontSize: theme.fonts.sizes.sm, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 8 },
    subjectGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 },
    subjectError: { color: theme.colors.red, fontSize: theme.fonts.sizes.xs, marginTop: 4 },
  };

  return (
    <div style={styles.page}>
      {/* Nav bar */}
      <div style={styles.nav}>
        <div style={styles.navLeft}>
          <i className="fas fa-book-open-reader" style={{ color: theme.colors.pink, fontSize: 16 }} />
          <span style={styles.navTitle}>ChikuMiku LearnVerse</span>
        </div>
        <div style={styles.navRight}>
          <span style={{ fontSize: 11, color: theme.colors.text }}>Welcome, {parentUsername || 'Parent'}</span>
          <div style={styles.avatar}>
            <i className="fas fa-user" style={{ color: '#fff', fontSize: 11 }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        <Card style={styles.card} padding="24px">
          <div style={styles.backRow}>
            <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
            <span style={styles.title}>Register New Learner</span>
          </div>

          {serverError && <div style={styles.error}>{serverError}</div>}

          <div style={styles.twoCol}>
            <Input label="Parent Username" value={parentUsername || 'parent_user'} readOnly />
            <Input label="Learner Username" value={form.username} onChange={updateField('username')} placeholder="8-15 chars" required error={validationErrors.username} />
            <Input label="Name" value={form.name} onChange={updateField('name')} placeholder="5-20 characters" required error={validationErrors.name} />
            <Input label="Password" type="password" value={form.password} onChange={updateField('password')} placeholder="8-20 characters" showPasswordToggle required error={validationErrors.password} />
          </div>

          <RadioGroup label="Gender" value={form.gender} onChange={updateField('gender') as (v: string) => void} options={GENDERS} required activeColor={theme.colors.pink} />

          <div style={styles.twoCol}>
            <Select label="Relationship" value={form.relationship} onChange={updateField('relationship')} options={RELATIONSHIPS} placeholder="Select..." required error={validationErrors.relationship} />
            <Select label="Grade" value={form.grade} onChange={updateField('grade')} options={GRADES} placeholder="Select grade..." required error={validationErrors.grade} />
          </div>

          <div style={styles.fullWidth}>
            <Input label="School Name" value={form.schoolName} onChange={updateField('schoolName')} placeholder="5-30 characters" required error={validationErrors.schoolName} />
          </div>

          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` }}>
            <div style={styles.sectionLabel}>Select Subjects <span style={{ color: theme.colors.red }}>*</span></div>
            <div style={styles.subjectGrid}>
              {Object.keys(SUBJECTS).map((subj) => (
                <SubjectIcon key={subj} subject={subj} selected={selectedSubjects.includes(subj)} onToggle={toggleSubject} showCheck variant="card" />
              ))}
            </div>
            {validationErrors.subjects && <div style={styles.subjectError}>{validationErrors.subjects}</div>}
          </div>

          {hasConsented === false && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` }}>
              <div style={styles.sectionLabel}>Parental Consent <span style={{ color: theme.colors.red }}>*</span></div>
              <p style={{ fontSize: theme.fonts.sizes.xs, color: theme.colors.text, lineHeight: 1.5, marginBottom: 8 }}>
                {PARENTAL_CONSENT_TEXT}
              </p>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: theme.fonts.sizes.sm, color: theme.colors.dark, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => {
                    setConsentChecked(e.target.checked);
                    if (validationErrors.consent) setValidationErrors({ ...validationErrors, consent: '' });
                  }}
                  style={{ marginTop: 2 }}
                />
                <span>I have read and agree to the above, and consent to my child&apos;s data being collected as described.</span>
              </label>
              {validationErrors.consent && <div style={styles.subjectError}>{validationErrors.consent}</div>}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Button variant="primary" label={loading ? 'Registering...' : 'Register Learner'} icon="user-graduate" onPress={handleSubmit} fullWidth disabled={loading} />
          </div>
        </Card>
      </div>
    </div>
  );
}
