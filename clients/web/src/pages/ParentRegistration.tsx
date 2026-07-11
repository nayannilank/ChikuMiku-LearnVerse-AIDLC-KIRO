/**
 * ParentRegistration — Registration form for parent accounts.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  validateUsername,
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
} from '@chikumiku/validation';
import { authApi, type ApiError } from '../services/api';

interface FormData {
  username: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
}

interface FormErrors {
  username?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  password?: string;
}

type FieldName = keyof FormData;

const INITIAL_FORM: FormData = {
  username: '',
  fullName: '',
  phone: '',
  email: '',
  password: '',
};

export function ParentRegistration() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    username: false,
    fullName: false,
    phone: false,
    email: false,
    password: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup countdown on unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Countdown timer after successful registration
  useEffect(() => {
    if (success) {
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
            }
            navigate('/login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [success, navigate]);

  const validateField = useCallback((field: FieldName, value: string): string | undefined => {
    let result;
    switch (field) {
      case 'username':
        result = validateUsername(value);
        return result.errors.username;
      case 'fullName':
        result = validateFullName(value);
        return result.errors.fullName;
      case 'phone':
        result = validatePhone(value);
        return result.errors.phone;
      case 'email':
        result = validateEmail(value);
        return result.errors.email;
      case 'password':
        result = validatePassword(value);
        return result.errors.password;
      default:
        return undefined;
    }
  }, []);

  const handleChange = useCallback(
    (field: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));

      // Validate on change only if field has been touched
      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (field: FieldName) => () => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, formData[field]);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [formData, validateField],
  );

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let hasError = false;

    for (const field of Object.keys(formData) as FieldName[]) {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
        hasError = true;
      }
    }

    setErrors(newErrors);
    setTouched({
      username: true,
      fullName: true,
      phone: true,
      email: true,
      password: true,
    });

    return !hasError;
  }, [formData, validateField]);

  const hasValidationErrors = useCallback((): boolean => {
    // Check if any currently shown errors exist
    return Object.values(errors).some((e) => !!e);
  }, [errors]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Requirement 1.3: SHALL NOT submit when validation errors exist
      if (!validateAll()) {
        return;
      }

      if (hasValidationErrors()) {
        return;
      }

      setIsSubmitting(true);

      try {
        await authApi.registerParent({
          username: formData.username,
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          password: formData.password,
        });

        // Requirement 1.2: show success + 5s countdown redirect
        setSuccess(true);
      } catch (err: unknown) {
        const apiError = err as ApiError;
        // Requirement 1.5: duplicate username — show field error, retain other data
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
    [formData, validateAll, hasValidationErrors],
  );

  if (success) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--color-success)', marginBottom: 'var(--space-md)' }}>
          Registration Successful!
        </h2>
        <p>Your parent account has been created.</p>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Redirecting to login in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}…
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 480, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>Parent Registration</h2>

      <form onSubmit={handleSubmit} noValidate aria-label="Parent registration form">
        <FormField
          id="username"
          label="Username"
          type="text"
          value={formData.username}
          error={touched.username ? errors.username : undefined}
          onChange={handleChange('username')}
          onBlur={handleBlur('username')}
          placeholder="8-15 chars, lowercase, digits, _ or -"
          autoComplete="username"
        />

        <FormField
          id="fullName"
          label="Full Name"
          type="text"
          value={formData.fullName}
          error={touched.fullName ? errors.fullName : undefined}
          onChange={handleChange('fullName')}
          onBlur={handleBlur('fullName')}
          placeholder="5-20 chars, letters and spaces"
          autoComplete="name"
        />

        <FormField
          id="phone"
          label="Phone"
          type="tel"
          value={formData.phone}
          error={touched.phone ? errors.phone : undefined}
          onChange={handleChange('phone')}
          onBlur={handleBlur('phone')}
          placeholder="10 digit phone number"
          autoComplete="tel"
        />

        <FormField
          id="email"
          label="Email"
          type="email"
          value={formData.email}
          error={touched.email ? errors.email : undefined}
          onChange={handleChange('email')}
          onBlur={handleBlur('email')}
          placeholder="your@email.com"
          autoComplete="email"
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          value={formData.password}
          error={touched.password ? errors.password : undefined}
          onChange={handleChange('password')}
          onBlur={handleBlur('password')}
          placeholder="8-20 chars, upper, lower, digit, special"
          autoComplete="new-password"
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%', marginTop: 'var(--space-md)' }}
        >
          {isSubmitting ? 'Registering…' : 'Register'}
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
