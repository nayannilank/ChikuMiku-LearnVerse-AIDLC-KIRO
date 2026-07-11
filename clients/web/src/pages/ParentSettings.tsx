/**
 * ParentSettings — Parent profile and settings management page.
 *
 * Sections: Profile, Password, Notifications, Data Export, Custom Subjects, Delete Account.
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */
import { useState, useEffect, useCallback } from 'react';
import {
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
  validateSubjectName,
} from '@chikumiku/validation';
import { useAuth } from '../context/AuthContext';
import {
  profileApi,
  type ParentProfile,
  type NotificationPrefs,
  type CustomSubject,
} from '../services/api';

/* ====================================================================
 * Profile Section (Req 17.1, 17.2)
 * ==================================================================== */

interface ProfileFormData {
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

interface ProfileErrors {
  name?: string;
  phone?: string;
  email?: string;
}

function ProfileSection() {
  const { username } = useAuth();
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>({
    name: '',
    phone: '',
    email: '',
    relationship: 'Father',
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    profileApi.getProfile().then((p) => {
      setProfile(p);
      setFormData({
        name: p.name,
        phone: p.phone,
        email: p.email,
        relationship: p.relationship,
      });
    });
  }, []);

  const validateFields = useCallback((): boolean => {
    const newErrors: ProfileErrors = {};

    const nameResult = validateFullName(formData.name);
    if (!nameResult.valid) newErrors.name = nameResult.errors.fullName;

    const phoneResult = validatePhone(formData.phone);
    if (!phoneResult.valid) newErrors.phone = phoneResult.errors.phone;

    const emailResult = validateEmail(formData.email);
    if (!emailResult.valid) newErrors.email = emailResult.errors.email;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSave = useCallback(async () => {
    if (!validateFields()) return;

    setIsSaving(true);
    try {
      await profileApi.updateProfile(formData);
      setProfile({ ...profile!, ...formData });
      setIsEditing(false);
      setSuccessMsg('Profile updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [formData, validateFields, profile]);

  const handleCancel = useCallback(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        relationship: profile.relationship,
      });
    }
    setErrors({});
    setIsEditing(false);
  }, [profile]);

  if (!profile) return <p>Loading profile...</p>;

  return (
    <section className="card" style={{ marginBottom: 'var(--space-lg)' }} aria-labelledby="profile-heading">
      <h3 id="profile-heading" style={{ marginBottom: 'var(--space-md)' }}>Profile</h3>

      {successMsg && (
        <p role="status" style={{ color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }}>
          {successMsg}
        </p>
      )}

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label style={labelStyle}>Username</label>
        <input
          type="text"
          value={username || profile.username}
          readOnly
          disabled
          aria-label="Username (read-only)"
          style={{ backgroundColor: '#f0f0f0' }}
        />
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="profile-name" style={labelStyle}>Name</label>
        <input
          id="profile-name"
          type="text"
          value={formData.name}
          readOnly={!isEditing}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'profile-name-error' : undefined}
          style={errors.name ? { borderColor: 'var(--color-error)' } : undefined}
        />
        {errors.name && <p id="profile-name-error" role="alert" style={errorStyle}>{errors.name}</p>}
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="profile-phone" style={labelStyle}>Phone</label>
        <input
          id="profile-phone"
          type="tel"
          value={formData.phone}
          readOnly={!isEditing}
          onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'profile-phone-error' : undefined}
          style={errors.phone ? { borderColor: 'var(--color-error)' } : undefined}
        />
        {errors.phone && <p id="profile-phone-error" role="alert" style={errorStyle}>{errors.phone}</p>}
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="profile-email" style={labelStyle}>Email</label>
        <input
          id="profile-email"
          type="email"
          value={formData.email}
          readOnly={!isEditing}
          onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'profile-email-error' : undefined}
          style={errors.email ? { borderColor: 'var(--color-error)' } : undefined}
        />
        {errors.email && <p id="profile-email-error" role="alert" style={errorStyle}>{errors.email}</p>}
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="profile-relationship" style={labelStyle}>Relationship</label>
        <select
          id="profile-relationship"
          value={formData.relationship}
          disabled={!isEditing}
          onChange={(e) => setFormData((p) => ({ ...p, relationship: e.target.value }))}
        >
          <option value="Father">Father</option>
          <option value="Mother">Mother</option>
          <option value="Guardian">Guardian</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        {!isEditing ? (
          <button className="btn-primary" onClick={() => setIsEditing(true)}>
            Edit Profile
          </button>
        ) : (
          <>
            <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Update Profile'}
            </button>
            <button className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ====================================================================
 * Password Section (Req 17.3)
 * ==================================================================== */

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<{ current?: string; newPw?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleChangePassword = useCallback(async () => {
    const newErrors: { current?: string; newPw?: string } = {};

    // Validate new password format regardless of current password (Req 17.3)
    const pwResult = validatePassword(newPassword);
    if (!pwResult.valid) {
      newErrors.newPw = pwResult.errors.password;
    }

    if (!currentPassword.trim()) {
      newErrors.current = 'Current password is required';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsSaving(true);
    try {
      const result = await profileApi.changePassword({ currentPassword, newPassword });
      if (!result.success) {
        setErrors({ current: result.error });
      } else {
        setSuccessMsg('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } finally {
      setIsSaving(false);
    }
  }, [currentPassword, newPassword]);

  return (
    <section className="card" style={{ marginBottom: 'var(--space-lg)' }} aria-labelledby="password-heading">
      <h3 id="password-heading" style={{ marginBottom: 'var(--space-md)' }}>Update Password</h3>

      {successMsg && (
        <p role="status" style={{ color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }}>
          {successMsg}
        </p>
      )}

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="current-password" style={labelStyle}>Current Password</label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          aria-invalid={!!errors.current}
          aria-describedby={errors.current ? 'current-pw-error' : undefined}
          style={errors.current ? { borderColor: 'var(--color-error)' } : undefined}
        />
        {errors.current && <p id="current-pw-error" role="alert" style={errorStyle}>{errors.current}</p>}
      </div>

      <div style={{ marginBottom: 'var(--space-md)' }}>
        <label htmlFor="new-password" style={labelStyle}>New Password</label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="8-20 chars, upper, lower, digit, special"
          aria-invalid={!!errors.newPw}
          aria-describedby={errors.newPw ? 'new-pw-error' : undefined}
          style={errors.newPw ? { borderColor: 'var(--color-error)' } : undefined}
        />
        {errors.newPw && <p id="new-pw-error" role="alert" style={errorStyle}>{errors.newPw}</p>}
      </div>

      <button className="btn-primary" onClick={handleChangePassword} disabled={isSaving}>
        {isSaving ? 'Updating…' : 'Update Password'}
      </button>
    </section>
  );
}

/* ====================================================================
 * Notifications Section (Req 17.4)
 * ==================================================================== */

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({ progressAlerts: true, streakReminders: true });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    profileApi.getNotificationPrefs().then(setPrefs);
  }, []);

  const handleToggle = useCallback(async (key: keyof NotificationPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setIsSaving(true);
    try {
      await profileApi.updateNotificationPrefs(updated);
    } finally {
      setIsSaving(false);
    }
  }, [prefs]);

  return (
    <section className="card" style={{ marginBottom: 'var(--space-lg)' }} aria-labelledby="notifications-heading">
      <h3 id="notifications-heading" style={{ marginBottom: 'var(--space-md)' }}>Notification Preferences</h3>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
        <label htmlFor="toggle-progress" style={{ fontWeight: 500 }}>Progress Alerts</label>
        <button
          id="toggle-progress"
          role="switch"
          aria-checked={prefs.progressAlerts}
          onClick={() => handleToggle('progressAlerts')}
          disabled={isSaving}
          style={toggleStyle(prefs.progressAlerts)}
          aria-label="Toggle progress alerts"
        >
          <span style={toggleKnobStyle(prefs.progressAlerts)} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label htmlFor="toggle-streak" style={{ fontWeight: 500 }}>Streak Reminders</label>
        <button
          id="toggle-streak"
          role="switch"
          aria-checked={prefs.streakReminders}
          onClick={() => handleToggle('streakReminders')}
          disabled={isSaving}
          style={toggleStyle(prefs.streakReminders)}
          aria-label="Toggle streak reminders"
        >
          <span style={toggleKnobStyle(prefs.streakReminders)} />
        </button>
      </div>
    </section>
  );
}

/* ====================================================================
 * Export Section (Req 17.5)
 * ==================================================================== */

function ExportSection() {
  const [isExporting, setIsExporting] = useState<'pdf' | 'csv' | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const handleExport = useCallback(async (format: 'pdf' | 'csv') => {
    setIsExporting(format);
    try {
      const result = await profileApi.requestExport(format);
      if (result.success) {
        setSuccessMsg(`${format.toUpperCase()} export ready: ${result.downloadUrl}`);
        setTimeout(() => setSuccessMsg(''), 5000);
      }
    } finally {
      setIsExporting(null);
    }
  }, []);

  return (
    <section className="card" style={{ marginBottom: 'var(--space-lg)' }} aria-labelledby="export-heading">
      <h3 id="export-heading" style={{ marginBottom: 'var(--space-md)' }}>Data Export</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
        Download learner progress reports including scores, completion percentages, and activity history.
      </p>

      {successMsg && (
        <p role="status" style={{ color: 'var(--color-success)', marginBottom: 'var(--space-sm)' }}>
          {successMsg}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
        <button
          className="btn-primary"
          onClick={() => handleExport('pdf')}
          disabled={isExporting !== null}
        >
          {isExporting === 'pdf' ? 'Generating…' : 'Export PDF'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => handleExport('csv')}
          disabled={isExporting !== null}
        >
          {isExporting === 'csv' ? 'Generating…' : 'Export CSV'}
        </button>
      </div>
    </section>
  );
}

/* ====================================================================
 * Custom Subjects Section (Req 17.7)
 * ==================================================================== */

function CustomSubjectsSection() {
  const [subjects, setSubjects] = useState<CustomSubject[]>([]);
  const [newSubject, setNewSubject] = useState('');
  const [error, setError] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    profileApi.getCustomSubjects().then(setSubjects);
  }, []);

  const handleAdd = useCallback(async () => {
    setError('');

    const trimmed = newSubject.trim();
    const validation = validateSubjectName(trimmed);
    if (!validation.valid) {
      setError(validation.errors.subjectName || 'Invalid subject name');
      return;
    }

    if (subjects.length >= 10) {
      setError('Maximum of 10 custom subjects reached');
      return;
    }

    setIsAdding(true);
    try {
      const result = await profileApi.addCustomSubject(trimmed);
      if (result.success && result.subject) {
        setSubjects((prev) => [...prev, result.subject!]);
        setNewSubject('');
      } else if (result.error) {
        setError(result.error);
      }
    } finally {
      setIsAdding(false);
    }
  }, [newSubject, subjects.length]);

  return (
    <section className="card" style={{ marginBottom: 'var(--space-lg)' }} aria-labelledby="subjects-heading">
      <h3 id="subjects-heading" style={{ marginBottom: 'var(--space-md)' }}>Custom Subjects</h3>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
        Add custom subjects available to all your learners ({subjects.length}/10).
      </p>

      {subjects.length > 0 && (
        <ul style={{ listStyle: 'none', marginBottom: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
          {subjects.map((s) => (
            <li key={s.id} className="badge" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
              {s.name}
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            placeholder="Subject name (1-50 characters)"
            aria-label="New custom subject name"
            aria-invalid={!!error}
            aria-describedby={error ? 'subject-error' : undefined}
            style={error ? { borderColor: 'var(--color-error)' } : undefined}
          />
          {error && <p id="subject-error" role="alert" style={errorStyle}>{error}</p>}
        </div>
        <button
          className="btn-primary"
          onClick={handleAdd}
          disabled={isAdding || subjects.length >= 10}
          style={{ whiteSpace: 'nowrap' }}
        >
          {isAdding ? 'Adding…' : 'Add Subject'}
        </button>
      </div>
    </section>
  );
}

/* ====================================================================
 * Delete Account Section (Req 17.6)
 * ==================================================================== */

function DeleteAccountSection() {
  const { logout } = useAuth();
  const [step, setStep] = useState<'idle' | 'password' | 'warning' | 'confirm'>('idle');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handlePasswordSubmit = useCallback(() => {
    if (!password.trim()) {
      setError('Password is required');
      return;
    }
    setError('');
    setStep('warning');
  }, [password]);

  const handleConfirmDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      const result = await profileApi.deleteAccount(password);
      if (!result.success) {
        setError(result.error || 'Account deletion failed');
        setStep('password');
      } else {
        logout();
      }
    } finally {
      setIsDeleting(false);
    }
  }, [password, logout]);

  const handleCancel = useCallback(() => {
    setStep('idle');
    setPassword('');
    setError('');
  }, []);

  return (
    <section className="card" style={{ borderColor: 'var(--color-error)' }} aria-labelledby="delete-heading">
      <h3 id="delete-heading" style={{ marginBottom: 'var(--space-md)', color: 'var(--color-error)' }}>
        Delete Account
      </h3>

      {step === 'idle' && (
        <>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            className="btn-secondary"
            style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            onClick={() => setStep('password')}
          >
            Delete Account
          </button>
        </>
      )}

      {step === 'password' && (
        <>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            Please re-enter your password to proceed:
          </p>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
              aria-label="Password for account deletion"
              aria-invalid={!!error}
              aria-describedby={error ? 'delete-pw-error' : undefined}
              style={error ? { borderColor: 'var(--color-error)' } : undefined}
            />
            {error && <p id="delete-pw-error" role="alert" style={errorStyle}>{error}</p>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn-primary" onClick={handlePasswordSubmit}>
              Continue
            </button>
            <button className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      )}

      {step === 'warning' && (
        <>
          <div
            role="alert"
            style={{
              backgroundColor: '#FDF0F0',
              border: '1px solid var(--color-error)',
              borderRadius: 'var(--radius-badge)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-md)',
            }}
          >
            <p style={{ fontWeight: 600, color: 'var(--color-error)', marginBottom: 'var(--space-sm)' }}>
              ⚠️ Warning: This will permanently delete:
            </p>
            <ul style={{ paddingLeft: 'var(--space-lg)', color: 'var(--color-text-secondary)' }}>
              <li>Your parent account and profile</li>
              <li>All learner profiles under your account</li>
              <li>All chapters, transcripts, and uploaded content</li>
              <li>All progress data, scores, and activity history</li>
              <li>All custom subjects and notification settings</li>
            </ul>
            <p style={{ marginTop: 'var(--space-sm)', color: 'var(--color-text-secondary)' }}>
              Data will be scheduled for permanent deletion within 30 days.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              className="btn-primary"
              style={{ backgroundColor: 'var(--color-error)' }}
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button className="btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </>
      )}
    </section>
  );
}

/* ====================================================================
 * Main Page Component
 * ==================================================================== */

export function ParentSettings() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-xl)' }}>
      <h2 style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>Settings</h2>

      <ProfileSection />
      <PasswordSection />
      <NotificationsSection />
      <ExportSection />
      <CustomSubjectsSection />
      <DeleteAccountSection />
    </div>
  );
}

/* ====================================================================
 * Shared Styles
 * ==================================================================== */

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--space-xs)',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
};

const errorStyle: React.CSSProperties = {
  color: 'var(--color-error)',
  fontSize: '0.875rem',
  marginTop: 'var(--space-xs)',
};

function toggleStyle(checked: boolean): React.CSSProperties {
  return {
    width: 52,
    height: 28,
    borderRadius: 14,
    backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-border)',
    position: 'relative',
    border: 'none',
    padding: 0,
    minWidth: 52,
    minHeight: 28,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  };
}

function toggleKnobStyle(checked: boolean): React.CSSProperties {
  return {
    display: 'block',
    width: 22,
    height: 22,
    borderRadius: '50%',
    backgroundColor: '#fff',
    position: 'absolute',
    top: 3,
    left: checked ? 27 : 3,
    transition: 'left 0.2s ease',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  };
}
