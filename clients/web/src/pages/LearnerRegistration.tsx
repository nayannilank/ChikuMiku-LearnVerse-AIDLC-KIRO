/**
 * LearnerRegistration — Registration form for learner accounts (child profiles).
 *
 * Pre-fills parent username from AuthContext (read-only).
 * Includes subject selection with 7 defaults + custom subjects.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  validateUsername,
  validateFullName,
  validatePassword,
  validateSchoolName,
  validateSubjectName,
} from '@chikumiku/validation';
import { useAuth } from '../context/AuthContext';
import { authApi, type ApiError } from '../services/api';

/* --- Constants --- */

type Gender = 'male' | 'female' | 'other';
type Relationship = 'son' | 'daughter' | 'other';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: '👦' },
  { value: 'female', label: 'Female', icon: '👧' },
  { value: 'other', label: 'Other', icon: '🧒' },
];

const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'other', label: 'Other' },
];

const GRADE_OPTIONS = [
  'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th',
];

interface DefaultSubject {
  name: string;
  icon: string;
}

const DEFAULT_SUBJECTS: DefaultSubject[] = [
  { name: 'English', icon: '📖' },
  { name: 'Hindi', icon: '🕉️' },
  { name: 'Kannada', icon: '✍️' },
  { name: 'Maths', icon: '🔢' },
  { name: 'Science', icon: '🔬' },
  { name: 'EVS', icon: '🌿' },
  { name: 'Computers', icon: '💻' },
];

const MAX_CUSTOM_SUBJECTS = 5;

/* --- Form Types --- */

interface FormData {
  username: string;
  name: string;
  password: string;
  gender: Gender;
  relationship: Relationship;
  grade: string;
  school: string;
}

interface FormErrors {
  username?: string;
  name?: string;
  password?: string;
  school?: string;
  subjects?: string;
  customSubject?: string;
}

type TextField = 'username' | 'name' | 'password' | 'school';

const INITIAL_FORM: FormData = {
  username: '',
  name: '',
  password: '',
  gender: 'male',
  relationship: 'son',
  grade: 'LKG',
  school: '',
};

/* --- Component --- */

export function LearnerRegistration() {
  const { username: parentUsername } = useAuth();

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<TextField, boolean>>({
    username: false,
    name: false,
    password: false,
    school: false,
  });

  // Subjects state — all defaults selected initially
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(DEFAULT_SUBJECTS.map((s) => s.name)),
  );
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  /* --- Validation --- */

  const validateField = useCallback((field: TextField, value: string): string | undefined => {
    let result;
    switch (field) {
      case 'username':
        result = validateUsername(value);
        return result.errors.username;
      case 'name':
        result = validateFullName(value);
        return result.errors.fullName;
      case 'password':
        result = validatePassword(value);
        return result.errors.password;
      case 'school':
        result = validateSchoolName(value);
        return result.errors.schoolName;
      default:
        return undefined;
    }
  }, []);

  const validateSubjects = useCallback((): string | undefined => {
    const totalSubjects = selectedSubjects.size + customSubjects.length;
    if (totalSubjects < 1) {
      return 'At least 1 subject must be selected';
    }
    return undefined;
  }, [selectedSubjects, customSubjects]);

  /* --- Handlers --- */

  const handleChange = useCallback(
    (field: TextField) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (field: TextField) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, formData[field]);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [formData, validateField],
  );

  const handleSelectChange = useCallback(
    (field: 'relationship' | 'grade') => (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  const handleGenderChange = useCallback((gender: Gender) => {
    setFormData((prev) => ({ ...prev, gender }));
  }, []);

  const toggleSubject = useCallback((subjectName: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectName)) {
        next.delete(subjectName);
      } else {
        next.add(subjectName);
      }
      return next;
    });
    // Clear subject error when toggling
    setErrors((prev) => ({ ...prev, subjects: undefined }));
  }, []);

  const handleAddCustomSubject = useCallback(() => {
    const trimmed = customSubjectInput.trim();
    if (!trimmed) return;

    const result = validateSubjectName(trimmed);
    if (!result.valid) {
      setErrors((prev) => ({ ...prev, customSubject: result.errors.subjectName }));
      return;
    }

    // Check for duplicates
    const allSubjects = [...DEFAULT_SUBJECTS.map((s) => s.name.toLowerCase()), ...customSubjects.map((s) => s.toLowerCase())];
    if (allSubjects.includes(trimmed.toLowerCase())) {
      setErrors((prev) => ({ ...prev, customSubject: 'This subject already exists' }));
      return;
    }

    setCustomSubjects((prev) => [...prev, trimmed]);
    setCustomSubjectInput('');
    setErrors((prev) => ({ ...prev, customSubject: undefined, subjects: undefined }));
  }, [customSubjectInput, customSubjects]);

  const handleRemoveCustomSubject = useCallback((index: number) => {
    setCustomSubjects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCustomSubjectKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddCustomSubject();
      }
    },
    [handleAddCustomSubject],
  );

  /* --- Form Submission --- */

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let hasError = false;

    const textFields: TextField[] = ['username', 'name', 'password', 'school'];
    for (const field of textFields) {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    }

    const subjectError = validateSubjects();
    if (subjectError) {
      newErrors.subjects = subjectError;
      hasError = true;
    }

    setErrors(newErrors);
    setTouched({ username: true, name: true, password: true, school: true });

    return !hasError;
  }, [formData, validateField, validateSubjects]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateAll()) {
        return;
      }

      setIsSubmitting(true);

      try {
        const allSelectedSubjects = [
          ...Array.from(selectedSubjects),
          ...customSubjects,
        ];

        await authApi.registerLearner({
          parentUsername: parentUsername || '',
          username: formData.username,
          name: formData.name,
          password: formData.password,
          gender: formData.gender,
          relationship: formData.relationship,
          grade: formData.grade,
          school: formData.school,
          subjects: allSelectedSubjects,
        });

        // Requirement 2.4: success confirmation within 3 seconds
        setSuccess(true);
        successTimerRef.current = setTimeout(() => {
          setSuccess(false);
          // Reset form for adding another learner
          setFormData(INITIAL_FORM);
          setSelectedSubjects(new Set(DEFAULT_SUBJECTS.map((s) => s.name)));
          setCustomSubjects([]);
          setTouched({ username: false, name: false, password: false, school: false });
          setErrors({});
        }, 3000);
      } catch (err: unknown) {
        const apiError = err as ApiError;
        if (apiError.status === 409 && apiError.field === 'username') {
          setErrors((prev) => ({
            ...prev,
            username: apiError.message || 'This username is already in use',
          }));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, parentUsername, selectedSubjects, customSubjects, validateAll],
  );

  /* --- Render --- */

  if (success) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-success)', marginBottom: 'var(--space-md)' }}>
          🎉 Learner Registered Successfully!
        </h2>
        <p>The learner profile has been created.</p>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-sm)' }}>
          This message will dismiss shortly…
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
        Register Learner
      </h2>

      <form onSubmit={handleSubmit} noValidate aria-label="Learner registration form">
        {/* Parent Username (read-only) */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label
            htmlFor="parentUsername"
            style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
          >
            Parent Username
          </label>
          <input
            id="parentUsername"
            type="text"
            value={parentUsername || ''}
            disabled
            readOnly
            style={{ backgroundColor: 'var(--color-background)', cursor: 'not-allowed' }}
            aria-label="Parent username (read-only)"
          />
        </div>

        {/* Learner Username */}
        <FormField
          id="learnerUsername"
          label="Learner Username"
          type="text"
          value={formData.username}
          error={touched.username ? errors.username : undefined}
          onChange={handleChange('username')}
          onBlur={handleBlur('username')}
          placeholder="8-15 chars, lowercase, digits, _ or -"
          autoComplete="username"
        />

        {/* Name */}
        <FormField
          id="learnerName"
          label="Name"
          type="text"
          value={formData.name}
          error={touched.name ? errors.name : undefined}
          onChange={handleChange('name')}
          onBlur={handleBlur('name')}
          placeholder="5-20 chars, letters and spaces"
          autoComplete="name"
        />

        {/* Password */}
        <FormField
          id="learnerPassword"
          label="Password"
          type="password"
          value={formData.password}
          error={touched.password ? errors.password : undefined}
          onChange={handleChange('password')}
          onBlur={handleBlur('password')}
          placeholder="8-20 chars, upper, lower, digit, special"
          autoComplete="new-password"
        />

        {/* Gender (radio with icons) */}
        <fieldset
          style={{ border: 'none', padding: 0, marginBottom: 'var(--space-md)' }}
        >
          <legend style={{ fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
            Gender
          </legend>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            {GENDER_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  cursor: 'pointer',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderRadius: 'var(--radius-badge)',
                  border: formData.gender === opt.value
                    ? '2px solid var(--color-primary)'
                    : '2px solid var(--color-border)',
                  backgroundColor: formData.gender === opt.value
                    ? 'rgba(233, 79, 155, 0.08)'
                    : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="gender"
                  value={opt.value}
                  checked={formData.gender === opt.value}
                  onChange={() => handleGenderChange(opt.value)}
                  style={{ width: 'auto', minWidth: 'auto', minHeight: 'auto' }}
                />
                <span style={{ fontSize: '1.25rem' }} aria-hidden="true">{opt.icon}</span>
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Relationship (dropdown) */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label
            htmlFor="relationship"
            style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
          >
            Relationship
          </label>
          <select
            id="relationship"
            value={formData.relationship}
            onChange={handleSelectChange('relationship')}
          >
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Grade (dropdown) */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label
            htmlFor="grade"
            style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
          >
            Grade
          </label>
          <select
            id="grade"
            value={formData.grade}
            onChange={handleSelectChange('grade')}
          >
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>

        {/* School Name */}
        <FormField
          id="school"
          label="School"
          type="text"
          value={formData.school}
          error={touched.school ? errors.school : undefined}
          onChange={handleChange('school')}
          onBlur={handleBlur('school')}
          placeholder="5-30 chars, letters, digits, spaces"
          autoComplete="organization"
        />

        {/* Subjects Section */}
        <fieldset style={{ border: 'none', padding: 0, marginBottom: 'var(--space-md)' }}>
          <legend style={{ fontWeight: 500, marginBottom: 'var(--space-sm)' }}>
            Subjects
          </legend>

          {/* Default subjects as toggle-able icon cards */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-md)',
            }}
          >
            {DEFAULT_SUBJECTS.map((subject) => {
              const isSelected = selectedSubjects.has(subject.name);
              return (
                <button
                  key={subject.name}
                  type="button"
                  onClick={() => toggleSubject(subject.name)}
                  className="badge"
                  aria-pressed={isSelected}
                  style={{
                    cursor: 'pointer',
                    padding: 'var(--space-sm) var(--space-md)',
                    fontSize: '0.875rem',
                    border: isSelected
                      ? '2px solid var(--color-primary)'
                      : '2px solid var(--color-border)',
                    backgroundColor: isSelected
                      ? 'rgba(233, 79, 155, 0.1)'
                      : 'var(--color-white)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-badge)',
                  }}
                >
                  <span aria-hidden="true" style={{ marginRight: 'var(--space-xs)' }}>
                    {subject.icon}
                  </span>
                  {subject.name}
                </button>
              );
            })}
          </div>

          {/* Custom subjects list */}
          {customSubjects.length > 0 && (
            <div style={{ marginBottom: 'var(--space-sm)' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xs)' }}>
                Custom subjects:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                {customSubjects.map((subj, idx) => (
                  <span
                    key={idx}
                    className="badge"
                    style={{
                      backgroundColor: 'var(--color-secondary)',
                      color: 'var(--color-white)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 'var(--space-xs)',
                    }}
                  >
                    {subj}
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomSubject(idx)}
                      aria-label={`Remove ${subj}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-white)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        minHeight: 'auto',
                        minWidth: 'auto',
                        fontSize: '1rem',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Add custom subject input */}
          <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={customSubjectInput}
                onChange={(e) => {
                  setCustomSubjectInput(e.target.value);
                  setErrors((prev) => ({ ...prev, customSubject: undefined }));
                }}
                onKeyDown={handleCustomSubjectKeyDown}
                placeholder="Add custom subject (1-50 chars)"
                disabled={customSubjects.length >= MAX_CUSTOM_SUBJECTS}
                aria-label="Custom subject name"
                aria-describedby={errors.customSubject ? 'customSubject-error' : undefined}
              />
              {errors.customSubject && (
                <p
                  id="customSubject-error"
                  role="alert"
                  style={{
                    color: 'var(--color-error)',
                    fontSize: '0.875rem',
                    marginTop: 'var(--space-xs)',
                  }}
                >
                  {errors.customSubject}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleAddCustomSubject}
              disabled={customSubjects.length >= MAX_CUSTOM_SUBJECTS}
              style={{ whiteSpace: 'nowrap' }}
            >
              {customSubjects.length >= MAX_CUSTOM_SUBJECTS ? 'Max reached' : 'Add'}
            </button>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
            {customSubjects.length}/{MAX_CUSTOM_SUBJECTS} custom subjects added
          </p>

          {/* Subjects validation error */}
          {errors.subjects && (
            <p
              role="alert"
              style={{
                color: 'var(--color-error)',
                fontSize: '0.875rem',
                marginTop: 'var(--space-sm)',
              }}
            >
              {errors.subjects}
            </p>
          )}
        </fieldset>

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%', marginTop: 'var(--space-md)' }}
        >
          {isSubmitting ? 'Registering…' : 'Register Learner'}
        </button>
      </form>
    </div>
  );
}

/* --- Internal FormField component --- */

interface FormFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  placeholder?: string;
  autoComplete?: string;
}

function FormField({
  id,
  label,
  type,
  value,
  error,
  onChange,
  onBlur,
  placeholder,
  autoComplete,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div style={{ marginBottom: 'var(--space-md)' }}>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          marginBottom: 'var(--space-xs)',
          fontWeight: 500,
          color: 'var(--color-text-primary)',
        }}
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        style={error ? { borderColor: 'var(--color-error)' } : undefined}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            color: 'var(--color-error)',
            fontSize: '0.875rem',
            marginTop: 'var(--space-xs)',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
