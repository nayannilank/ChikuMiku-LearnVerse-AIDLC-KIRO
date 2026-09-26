/**
 * EditLearner — Edit an existing learner's editable fields.
 *
 * Per product spec, a parent may edit ONLY:
 *   - Password (optional; left blank = unchanged)
 *   - Grade
 *   - Subjects
 *   - School
 * Username, name, gender, and relationship are immutable here and shown
 * read-only for context.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { theme, SUBJECTS, GRADES } from '../../theme';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { SubjectIcon } from '../../components/common/SubjectIcon';
import { Card } from '../../components/common/Card';
import { learningApi } from '../../services/learningApi';

export function EditLearner() {
  const navigate = useNavigate();
  const { learnerId } = useParams<{ learnerId: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Immutable fields shown read-only.
  const [readOnly, setReadOnly] = useState({ username: '', name: '' });
  // Editable fields.
  const [password, setPassword] = useState('');
  const [grade, setGrade] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    learningApi
      .getLearners()
      .then((learners) => {
        if (cancelled) return;
        const learner = learners.find((l) => l.id === learnerId);
        if (!learner) {
          setServerError('Learner not found.');
          setLoading(false);
          return;
        }
        setReadOnly({ username: learner.username, name: learner.name });
        setGrade(learner.grade);
        setSchoolName(learner.school);
        setSelectedSubjects(learner.subjects);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setServerError((err as { message?: string })?.message || 'Failed to load learner');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [learnerId]);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
    if (validationErrors.subjects) setValidationErrors({ ...validationErrors, subjects: '' });
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    // Password is optional on edit; only validate when the parent typed one.
    if (password.length > 0 && (password.length < 8 || password.length > 20)) {
      errors.password = '8-20 characters';
    }
    if (!grade) errors.grade = 'Select grade';
    if (schoolName.length < 5 || schoolName.length > 30) errors.schoolName = '5-30 characters required';
    if (selectedSubjects.length === 0) errors.subjects = 'Select at least 1 subject';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !learnerId) return;
    setSaving(true);
    setServerError('');
    try {
      // Update the editable profile fields (grade, school, subjects).
      await learningApi.updateLearner(learnerId, {
        grade,
        school: schoolName,
        subjects: selectedSubjects,
      });
      // Reset the password only if the parent entered a new one.
      if (password.length > 0) {
        await learningApi.resetLearnerPassword(learnerId, password);
      }
      navigate('/parent/manage-learners');
    } catch (err: unknown) {
      setServerError((err as { message?: string })?.message || 'Failed to save learner');
    } finally {
      setSaving(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: theme.colors.bg, fontFamily: theme.fonts.family },
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

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.content}>
        <Card style={styles.card} padding="24px">
          <div style={styles.backRow}>
            <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
            <span style={styles.title}>Edit Learner</span>
          </div>

          {serverError && <div style={styles.error}>{serverError}</div>}

          <div style={styles.twoCol}>
            <Input label="Learner Username" value={readOnly.username} readOnly />
            <Input label="Name" value={readOnly.name} readOnly />
            <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" showPasswordToggle error={validationErrors.password} />
            <Select label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} options={GRADES} placeholder="Select grade..." required error={validationErrors.grade} />
          </div>

          <div style={styles.fullWidth}>
            <Input label="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="5-30 characters" required error={validationErrors.schoolName} />
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

          <div style={{ marginTop: 16 }}>
            <Button variant="primary" label={saving ? 'Saving...' : 'Save Learner'} icon="save" onPress={handleSave} fullWidth disabled={saving} />
          </div>
        </Card>
      </div>
    </div>
  );
}
