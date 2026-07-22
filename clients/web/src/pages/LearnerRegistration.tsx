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
  color: string;
  bgColor: string;
}

const DEFAULT_SUBJECTS: DefaultSubject[] = [
  { name: 'English', icon: '📖', color: '#5DADE2', bgColor: '#E8F6FD' },
  { name: 'Hindi', icon: '🕉️', color: '#E5A100', bgColor: '#FFF8E1' },
  { name: 'Kannada', icon: '✍️', color: '#9B59B6', bgColor: '#F3E8F9' },
  { name: 'Maths', icon: '🔢', color: '#E94F9B', bgColor: '#FDE8F4' },
  { name: 'Science', icon: '🔬', color: '#27AE60', bgColor: '#E8F8EE' },
  { name: 'EVS', icon: '🌿', color: '#E67E22', bgColor: '#FFF0E0' },
  { name: 'Computers', icon: '💻', color: '#4A6CF7', bgColor: '#EBF0FF' },
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
      <div
        style={{
          maxWidth: 560,
          margin: '60px auto',
          background: 'var(--color-white)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
        }}
      >
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
    <div style={{ minHeight: '100vh', background: 'var(--color-background)' }}>
      {/* Header bar */}
      <div
        style={{
          background: 'linear-gradient(135deg, #2C2341, #9B59B6)',
          padding: '16px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span style={{ fontSize: '1rem' }} aria-hidden="true">📖</span>
        <span style={{ color: 'white', fontSize: '0.875rem', fontWeight: 800 }}>
          ChikuMiku LearnVerse
        </span>
      </div>

      {/* Main Content */}
      <div style={{ padding: '24px 32px', maxWidth: '760px', margin: '0 auto' }}>
        {/* Title with back arrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ color: 'var(--color-secondary)', fontSize: '1rem', cursor: 'pointer' }} aria-hidden="true">←</span>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-dark)', margin: 0 }}>
            Register New Learner
          </h2>
        </div>

        {/* Form Card */}
        <div
          style={{
            background: 'var(--color-white)',
            borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
          }}
        >
          <form onSubmit={handleSubmit} noValidate aria-label="Learner registration form">
            {/* 2-column form layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
              {/* Parent Username (read-only) */}
              <div>
                <label
                  htmlFor="parentUsername"
                  style={{ display: 'block', marginBottom: '4px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Parent Username
                </label>
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#EDE8F5',
                    border: '1px solid #D0C8DC',
                    fontSize: '0.875rem',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minHeight: '48px',
                  }}
                >
                  <span aria-hidden="true">🔒</span> {parentUsername || 'parent_username'}
                </div>
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
                placeholder="8-15 chars (a-z, 0-9, -, _)"
                autoComplete="username"
                required
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
                required
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
                required
              />

              {/* Gender */}
              <div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                  Gender <span style={{ color: 'var(--color-error)' }}>*</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleGenderChange(opt.value)}
                      style={{
                        flex: 1,
                        padding: '10px 6px',
                        borderRadius: '8px',
                        border: formData.gender === opt.value
                          ? '2px solid var(--color-primary)'
                          : '2px solid var(--color-border)',
                        background: formData.gender === opt.value
                          ? '#FDE8F4'
                          : 'var(--color-white)',
                        textAlign: 'center',
                        cursor: 'pointer',
                        minHeight: 'auto',
                        minWidth: 'auto',
                      }}
                      aria-pressed={formData.gender === opt.value}
                    >
                      <div style={{ fontSize: '1.5rem' }} aria-hidden="true">{opt.icon}</div>
                      <div style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        color: formData.gender === opt.value ? 'var(--color-primary)' : '#666',
                        marginTop: '2px',
                      }}>
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Relationship */}
              <div>
                <label
                  htmlFor="relationship"
                  style={{ display: 'block', marginBottom: '4px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Relationship <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <select
                  id="relationship"
                  value={formData.relationship}
                  onChange={handleSelectChange('relationship')}
                  style={{ borderRadius: '8px', padding: '10px 12px', fontSize: '0.875rem' }}
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Grade */}
              <div>
                <label
                  htmlFor="grade"
                  style={{ display: 'block', marginBottom: '4px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}
                >
                  Grade <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <select
                  id="grade"
                  value={formData.grade}
                  onChange={handleSelectChange('grade')}
                  style={{ borderRadius: '8px', padding: '10px 12px', fontSize: '0.875rem' }}
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* School Name (full width) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <FormField
                  id="school"
                  label="School Name"
                  type="text"
                  value={formData.school}
                  error={touched.school ? errors.school : undefined}
                  onChange={handleChange('school')}
                  onBlur={handleBlur('school')}
                  placeholder="5-30 chars, letters, digits, spaces"
                  autoComplete="organization"
                  required
                />
              </div>
            </div>

            {/* Subject Selection */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                  Select Subjects <span style={{ color: 'var(--color-error)' }}>*</span>
                  <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: '6px' }}>(min. 1 required)</span>
                </div>
              </div>

              {/* Subject pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {DEFAULT_SUBJECTS.map((subject) => {
                  const isSelected = selectedSubjects.has(subject.name);
                  return (
                    <button
                      key={subject.name}
                      type="button"
                      onClick={() => toggleSubject(subject.name)}
                      aria-pressed={isSelected}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '18px',
                        border: isSelected
                          ? `2px solid ${subject.color}`
                          : '2px solid var(--color-border)',
                        background: isSelected ? subject.bgColor : 'var(--color-white)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: isSelected ? subject.color : 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        cursor: 'pointer',
                        minHeight: 'auto',
                        minWidth: 'auto',
                      }}
                    >
                      <span aria-hidden="true">{subject.icon}</span>
                      {subject.name}
                      {isSelected && <span aria-hidden="true">✓</span>}
                    </button>
                  );
                })}

                {/* Custom subjects as pills */}
                {customSubjects.map((subj, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '18px',
                      border: '2px dashed var(--color-border)',
                      background: 'var(--color-white)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--color-secondary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {subj}
                    <span style={{ color: 'var(--color-secondary)', fontSize: '0.625rem' }}>(custom)</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomSubject(idx)}
                      aria-label={`Remove ${subj}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-error)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        minHeight: 'auto',
                        minWidth: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add custom subject */}
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
                    style={{ borderRadius: '8px', padding: '10px 12px', fontSize: '0.875rem' }}
                  />
                  {errors.customSubject && (
                    <p
                      id="customSubject-error"
                      role="alert"
                      style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '2px' }}
                    >
                      {errors.customSubject}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomSubject}
                  disabled={customSubjects.length >= MAX_CUSTOM_SUBJECTS}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '18px',
                    border: '2px solid var(--color-secondary)',
                    background: 'var(--color-white)',
                    color: 'var(--color-secondary)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: customSubjects.length >= MAX_CUSTOM_SUBJECTS ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    minHeight: 'auto',
                    minWidth: 'auto',
                    opacity: customSubjects.length >= MAX_CUSTOM_SUBJECTS ? 0.5 : 1,
                  }}
                >
                  {customSubjects.length >= MAX_CUSTOM_SUBJECTS ? 'Max reached' : '+ Add'}
                </button>
              </div>

              <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                {customSubjects.length}/{MAX_CUSTOM_SUBJECTS} custom subjects added
              </p>

              {errors.subjects && (
                <p
                  role="alert"
                  style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: 'var(--space-sm)' }}
                >
                  {errors.subjects}
                </p>
              )}
            </div>

            {/* Submit */}
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '12px 40px',
                  border: 'none',
                  borderRadius: '22px',
                  background: 'linear-gradient(135deg, #E94F9B, #9B59B6)',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(233,79,155,0.3)',
                  minHeight: '48px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span aria-hidden="true">🎓</span>
                {isSubmitting ? 'Registering…' : 'Register Learner'}
              </button>
            </div>
          </form>
        </div>
      </div>
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
  required?: boolean;
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
  required,
}: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          marginBottom: '4px',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-error)', marginLeft: '2px' }}>*</span>}
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
        style={{
          borderColor: error ? 'var(--color-error)' : undefined,
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '0.875rem',
        }}
      />
      {error && (
        <p
          id={errorId}
          role="alert"
          style={{
            color: 'var(--color-error)',
            fontSize: '0.75rem',
            marginTop: '2px',
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
