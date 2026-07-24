/**
 * LearnerRegistration — Full learner registration form with subject selection.
 */
import React, { useState } from 'react';
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

export function LearnerRegistration() {
  const navigate = useNavigate();
  const { username: parentUsername } = useAuth();
  const [form, setForm] = useState({ username: '', name: '', password: '', gender: '', relationship: '', grade: '', schoolName: '' });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(Object.keys(SUBJECTS));
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

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
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      await authApi.registerLearner({ ...form, subjects: selectedSubjects } as never);
      navigate('/parent/dashboard');
    } catch (err: unknown) {
      setServerError((err as { message?: string })?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    container: { minHeight: '100vh', background: theme.colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: theme.fonts.family },
    card: { width: '100%', maxWidth: 520 },
    header: { textAlign: 'center', marginBottom: 20 },
    title: { fontSize: theme.fonts.sizes.xl, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark },
    subtitle: { fontSize: theme.fonts.sizes.sm, color: theme.colors.textLight, marginTop: 4 },
    twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
    error: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: theme.borderRadius.input, fontSize: theme.fonts.sizes.sm, marginBottom: 12, textAlign: 'center' },
    sectionLabel: { fontSize: theme.fonts.sizes.sm, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 8 },
    subjectGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 },
    subjectError: { color: theme.colors.red, fontSize: theme.fonts.sizes.xs, marginTop: 4 },
  };

  return (
    <div style={styles.container}>
      <Card style={styles.card} padding="24px">
        <div style={styles.header}>
          <div style={styles.title}>Register Learner</div>
          <div style={styles.subtitle}>Add a new learner to your account</div>
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
        <Input label="School Name" value={form.schoolName} onChange={updateField('schoolName')} placeholder="5-30 characters" required error={validationErrors.schoolName} />
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` }}>
          <div style={styles.sectionLabel}>Select Subjects <span style={{ color: theme.colors.red }}>*</span></div>
          <div style={styles.subjectGrid}>
            {Object.keys(SUBJECTS).map((subj) => (
              <SubjectIcon key={subj} subject={subj} selected={selectedSubjects.includes(subj)} onToggle={toggleSubject} showCheck variant="card" />
            ))}
          </div>
          {validationErrors.subjects && <div style={styles.subjectError}>{validationErrors.subjects}</div>}
        </div>
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" label={loading ? 'Registering...' : 'Register Learner'} icon="user-graduate" onPress={handleSubmit} fullWidth disabled={loading} />
        </div>
      </Card>
    </div>
  );
}
