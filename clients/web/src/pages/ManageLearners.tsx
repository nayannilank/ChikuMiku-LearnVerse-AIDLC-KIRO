/**
 * ManageLearners — Parent screen to view, edit, reset password, and remove learner profiles.
 *
 * Features:
 * - List all learners with name, gender, grade, subjects
 * - Edit learner: modify name, grade, school, subjects (with validation)
 * - Reset Password: new password meeting policy, generic error on invalid
 * - Remove: confirmation dialog with permanent deletion warning, soft delete on confirm
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
import { useState, useEffect, useCallback } from 'react';
import {
  validateFullName,
  validatePassword,
  validateSchoolName,
} from '@chikumiku/validation';
import { colors, spacing, radii, typography } from '../theme';
import {
  learnerApi,
  type LearnerProfile,
} from '../services/api';

/* --- Constants --- */

const GRADE_OPTIONS = [
  'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th',
];

const DEFAULT_SUBJECTS = [
  'English', 'Hindi', 'Kannada', 'Maths', 'Science', 'EVS', 'Computers',
];

const GENDER_LABELS: Record<string, string> = {
  male: '👦 Male',
  female: '👧 Female',
  other: '🧒 Other',
};

/* --- Styles --- */

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: spacing.md,
    fontFamily: typography.fontFamily,
  } as React.CSSProperties,

  heading: {
    color: colors.primary,
    marginBottom: spacing.lg,
    fontSize: '1.5rem',
    fontWeight: typography.weight.bold,
    textAlign: 'center' as const,
  } as React.CSSProperties,

  learnerCard: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: spacing.lg,
    border: `1px solid ${colors.border}`,
    marginBottom: spacing.md,
  } as React.CSSProperties,

  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  } as React.CSSProperties,

  learnerName: {
    fontSize: '1.1rem',
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    margin: 0,
  } as React.CSSProperties,

  learnerMeta: {
    fontSize: '0.85rem',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  } as React.CSSProperties,

  subjectBadge: {
    display: 'inline-block',
    padding: `2px ${spacing.sm}`,
    borderRadius: radii.badge,
    backgroundColor: `${colors.primary}15`,
    color: colors.primary,
    fontSize: '0.8rem',
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  } as React.CSSProperties,

  buttonGroup: {
    display: 'flex',
    gap: spacing.sm,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  btnPrimary: {
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radii.button,
    border: 'none',
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: '0.85rem',
    fontWeight: typography.weight.medium,
    cursor: 'pointer',
    minHeight: '36px',
  } as React.CSSProperties,

  btnSecondary: {
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radii.button,
    border: `1px solid ${colors.secondary}`,
    backgroundColor: 'transparent',
    color: colors.secondary,
    fontSize: '0.85rem',
    fontWeight: typography.weight.medium,
    cursor: 'pointer',
    minHeight: '36px',
  } as React.CSSProperties,

  btnDanger: {
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radii.button,
    border: `1px solid ${colors.error}`,
    backgroundColor: 'transparent',
    color: colors.error,
    fontSize: '0.85rem',
    fontWeight: typography.weight.medium,
    cursor: 'pointer',
    minHeight: '36px',
  } as React.CSSProperties,

  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,

  dialog: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: spacing.lg,
    maxWidth: '480px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto' as const,
  } as React.CSSProperties,

  dialogTitle: {
    fontSize: '1.2rem',
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  } as React.CSSProperties,

  formField: {
    marginBottom: spacing.md,
  } as React.CSSProperties,

  label: {
    display: 'block',
    marginBottom: spacing.xs,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
    fontSize: '0.9rem',
  } as React.CSSProperties,

  input: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radii.input,
    border: `1px solid ${colors.border}`,
    fontSize: '0.9rem',
    fontFamily: typography.fontFamily,
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,

  inputError: {
    borderColor: colors.error,
  } as React.CSSProperties,

  select: {
    width: '100%',
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radii.input,
    border: `1px solid ${colors.border}`,
    fontSize: '0.9rem',
    fontFamily: typography.fontFamily,
    boxSizing: 'border-box' as const,
    backgroundColor: colors.white,
  } as React.CSSProperties,

  errorText: {
    color: colors.error,
    fontSize: '0.8rem',
    marginTop: spacing.xs,
  } as React.CSSProperties,

  successText: {
    color: colors.success,
    fontSize: '0.9rem',
    textAlign: 'center' as const,
    marginBottom: spacing.md,
  } as React.CSSProperties,

  warningText: {
    color: colors.error,
    fontSize: '0.9rem',
    backgroundColor: `${colors.error}10`,
    padding: spacing.md,
    borderRadius: radii.small,
    marginBottom: spacing.md,
    lineHeight: '1.5',
  } as React.CSSProperties,

  subjectToggle: {
    cursor: 'pointer',
    padding: `${spacing.xs} ${spacing.sm}`,
    borderRadius: radii.badge,
    fontSize: '0.8rem',
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
    border: 'none',
    display: 'inline-block',
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: spacing.xxl,
    color: colors.textMuted,
  } as React.CSSProperties,
};

/* --- Edit Dialog --- */

interface EditDialogProps {
  learner: LearnerProfile;
  onSave: (learnerId: string, data: { name: string; grade: string; school: string; subjects: string[] }) => Promise<void>;
  onClose: () => void;
}

function EditDialog({ learner, onSave, onClose }: EditDialogProps) {
  const [name, setName] = useState(learner.name);
  const [grade, setGrade] = useState(learner.grade);
  const [school, setSchool] = useState(learner.school);
  const [subjects, setSubjects] = useState<Set<string>>(new Set(learner.subjects));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const toggleSubject = (subj: string) => {
    setSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subj)) {
        next.delete(subj);
      } else {
        next.add(subj);
      }
      return next;
    });
    setErrors((prev) => ({ ...prev, subjects: '' }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};

    const nameResult = validateFullName(name);
    if (!nameResult.valid) {
      newErrors.name = nameResult.errors.fullName;
    }

    const schoolResult = validateSchoolName(school);
    if (!schoolResult.valid) {
      newErrors.school = schoolResult.errors.schoolName;
    }

    if (subjects.size < 1) {
      newErrors.subjects = 'At least 1 subject must be selected';
    }

    if (Object.keys(newErrors).some((k) => newErrors[k])) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await onSave(learner.id, {
        name,
        grade,
        school,
        subjects: Array.from(subjects),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Edit learner">
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Edit Learner</h3>

        {/* Name */}
        <div style={styles.formField}>
          <label style={styles.label} htmlFor="edit-name">Name</label>
          <input
            id="edit-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
            style={{ ...styles.input, ...(errors.name ? styles.inputError : {}) }}
            placeholder="5-20 chars, letters and spaces"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'edit-name-error' : undefined}
          />
          {errors.name && <p id="edit-name-error" style={styles.errorText} role="alert">{errors.name}</p>}
        </div>

        {/* Grade */}
        <div style={styles.formField}>
          <label style={styles.label} htmlFor="edit-grade">Grade</label>
          <select
            id="edit-grade"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            style={styles.select}
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* School */}
        <div style={styles.formField}>
          <label style={styles.label} htmlFor="edit-school">School</label>
          <input
            id="edit-school"
            type="text"
            value={school}
            onChange={(e) => { setSchool(e.target.value); setErrors((p) => ({ ...p, school: '' })); }}
            style={{ ...styles.input, ...(errors.school ? styles.inputError : {}) }}
            placeholder="5-30 chars, letters, digits, commas, hyphens"
            aria-invalid={!!errors.school}
            aria-describedby={errors.school ? 'edit-school-error' : undefined}
          />
          {errors.school && <p id="edit-school-error" style={styles.errorText} role="alert">{errors.school}</p>}
        </div>

        {/* Subjects */}
        <div style={styles.formField}>
          <label style={styles.label}>Subjects</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.xs }}>
            {DEFAULT_SUBJECTS.map((subj) => {
              const isSelected = subjects.has(subj);
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => toggleSubject(subj)}
                  aria-pressed={isSelected}
                  style={{
                    ...styles.subjectToggle,
                    backgroundColor: isSelected ? `${colors.primary}20` : colors.background,
                    color: isSelected ? colors.primary : colors.textSecondary,
                    border: isSelected ? `1px solid ${colors.primary}` : `1px solid ${colors.border}`,
                  }}
                >
                  {subj}
                </button>
              );
            })}
          </div>
          {errors.subjects && <p style={styles.errorText} role="alert">{errors.subjects}</p>}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.lg }}>
          <button
            type="button"
            onClick={onClose}
            style={styles.btnSecondary}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={styles.btnPrimary}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Reset Password Dialog --- */

interface ResetPasswordDialogProps {
  learnerName: string;
  onReset: (password: string) => Promise<void>;
  onClose: () => void;
}

function ResetPasswordDialog({ learnerName, onReset, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleReset = async () => {
    // Validate password using shared validator
    const result = validatePassword(password);
    if (!result.valid) {
      // Requirement 16.3: display a single generic validation error (no info about which rule failed)
      setError('Password does not meet the required policy');
      return;
    }

    setSaving(true);
    try {
      await onReset(password);
      setSuccess(true);
      setPassword('');
      setError('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Reset learner password">
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Reset Password</h3>
        <p style={{ color: colors.textSecondary, marginBottom: spacing.md, fontSize: '0.9rem' }}>
          Set a new password for <strong>{learnerName}</strong>.
        </p>

        {success ? (
          <div>
            <p style={styles.successText}>Password reset successfully.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={onClose} style={styles.btnPrimary}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.formField}>
              <label style={styles.label} htmlFor="reset-password">New Password</label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                style={{ ...styles.input, ...(error ? styles.inputError : {}) }}
                placeholder="8-20 chars, upper, lower, digit, special"
                autoComplete="new-password"
                aria-invalid={!!error}
                aria-describedby={error ? 'reset-password-error' : undefined}
              />
              {error && <p id="reset-password-error" style={styles.errorText} role="alert">{error}</p>}
            </div>

            <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={styles.btnSecondary}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                style={styles.btnPrimary}
                disabled={saving}
              >
                {saving ? 'Resetting…' : 'Reset Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* --- Remove Confirmation Dialog --- */

interface RemoveDialogProps {
  learnerName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

function RemoveDialog({ learnerName, onConfirm, onCancel }: RemoveDialogProps) {
  const [removing, setRemoving] = useState(false);

  const handleConfirm = async () => {
    setRemoving(true);
    try {
      await onConfirm();
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-label="Confirm learner removal">
      <div style={styles.dialog}>
        <h3 style={styles.dialogTitle}>Remove Learner</h3>

        {/* Requirement 16.4: warn about permanent deletion */}
        <div style={styles.warningText}>
          <strong>Warning:</strong> This action will permanently delete the learner profile for{' '}
          <strong>{learnerName}</strong> and all associated data including chapters, progress,
          and exercise history. This cannot be undone.
        </div>

        <p style={{ color: colors.textSecondary, fontSize: '0.9rem', marginBottom: spacing.lg }}>
          Are you sure you want to remove this learner?
        </p>

        <div style={{ display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={styles.btnSecondary}
            disabled={removing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{ ...styles.btnDanger, backgroundColor: colors.error, color: colors.white }}
            disabled={removing}
          >
            {removing ? 'Removing…' : 'Remove Learner'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --- Main Component --- */

export function ManageLearners() {
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLearner, setEditingLearner] = useState<LearnerProfile | null>(null);
  const [resetPasswordLearner, setResetPasswordLearner] = useState<LearnerProfile | null>(null);
  const [removingLearner, setRemovingLearner] = useState<LearnerProfile | null>(null);

  // Load learners on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await learnerApi.getLearners();
        setLearners(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Edit handler (Req 16.2)
  const handleSaveEdit = useCallback(
    async (learnerId: string, data: { name: string; grade: string; school: string; subjects: string[] }) => {
      const result = await learnerApi.updateLearner(learnerId, data);
      if (result.success) {
        setLearners((prev) =>
          prev.map((l) =>
            l.id === learnerId
              ? { ...l, name: data.name, grade: data.grade, school: data.school, subjects: data.subjects }
              : l
          )
        );
        setEditingLearner(null);
      }
    },
    []
  );

  // Reset password handler (Req 16.3)
  const handleResetPassword = useCallback(
    async (password: string) => {
      if (!resetPasswordLearner) return;
      await learnerApi.resetLearnerPassword(resetPasswordLearner.id, { newPassword: password });
    },
    [resetPasswordLearner]
  );

  // Remove handler (Req 16.5)
  const handleConfirmRemove = useCallback(async () => {
    if (!removingLearner) return;
    const result = await learnerApi.removeLearner(removingLearner.id);
    if (result.success) {
      setLearners((prev) => prev.filter((l) => l.id !== removingLearner.id));
      setRemovingLearner(null);
    }
  }, [removingLearner]);

  // Cancel remove (Req 16.6)
  const handleCancelRemove = useCallback(() => {
    setRemovingLearner(null);
  }, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <h2 style={styles.heading}>Manage Learners</h2>
        <p style={{ textAlign: 'center', color: colors.textMuted }}>Loading learners…</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Manage Learners</h2>

      {learners.length === 0 ? (
        <div style={styles.emptyState}>
          <p style={{ fontSize: '2rem', marginBottom: spacing.sm }}>📭</p>
          <p>No learners registered yet.</p>
        </div>
      ) : (
        <div role="list" aria-label="Registered learners">
          {learners.map((learner) => (
            <div key={learner.id} style={styles.learnerCard} role="listitem">
              <div style={styles.cardHeader}>
                <div>
                  <h3 style={styles.learnerName}>{learner.name}</h3>
                  <p style={styles.learnerMeta}>
                    {GENDER_LABELS[learner.gender] ?? learner.gender} • Grade: {learner.grade}
                  </p>
                </div>
                <div style={styles.buttonGroup}>
                  <button
                    type="button"
                    onClick={() => setEditingLearner(learner)}
                    style={styles.btnPrimary}
                    aria-label={`Edit ${learner.name}`}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetPasswordLearner(learner)}
                    style={styles.btnSecondary}
                    aria-label={`Reset password for ${learner.name}`}
                  >
                    Reset Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemovingLearner(learner)}
                    style={styles.btnDanger}
                    aria-label={`Remove ${learner.name}`}
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Subjects display (Req 16.1) */}
              <div>
                {learner.subjects.map((subj) => (
                  <span key={subj} style={styles.subjectBadge}>{subj}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingLearner && (
        <EditDialog
          learner={editingLearner}
          onSave={handleSaveEdit}
          onClose={() => setEditingLearner(null)}
        />
      )}

      {/* Reset Password Dialog */}
      {resetPasswordLearner && (
        <ResetPasswordDialog
          learnerName={resetPasswordLearner.name}
          onReset={handleResetPassword}
          onClose={() => setResetPasswordLearner(null)}
        />
      )}

      {/* Remove Confirmation Dialog */}
      {removingLearner && (
        <RemoveDialog
          learnerName={removingLearner.name}
          onConfirm={handleConfirmRemove}
          onCancel={handleCancelRemove}
        />
      )}
    </div>
  );
}
