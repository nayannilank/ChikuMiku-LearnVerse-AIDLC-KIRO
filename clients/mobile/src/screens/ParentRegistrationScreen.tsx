/**
 * ParentRegistrationScreen — Registration form for parent accounts (Android).
 *
 * Fields: username, fullName, phone, email, password (masked with toggle).
 * Client-side validation using shared validators.
 * On success: shows success message + 5-second countdown, auto-navigates to Login.
 * On duplicate username: displays field error, retains other data.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  validateUsername,
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
} from '@chikumiku/validation';
import { apiClient, type ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';

interface ParentRegistrationScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

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

export function ParentRegistrationScreen({
  navigation,
}: ParentRegistrationScreenProps): React.ReactElement {
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
  const [showPassword, setShowPassword] = useState(false);
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
            navigation.navigate('Login');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [success, navigation]);

  const validateField = useCallback(
    (field: FieldName, value: string): string | undefined => {
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
    },
    [],
  );

  const handleChange = useCallback(
    (field: FieldName, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (field: FieldName) => {
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

  const handleSubmit = useCallback(async () => {
    // Requirement 1.3: SHALL NOT submit when validation errors exist
    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/auth/register/parent', {
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
  }, [formData, validateAll, navigation]);

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>Registration Successful!</Text>
        <Text style={styles.successMessage}>
          Your parent account has been created.
        </Text>
        <Text style={styles.countdownText}>
          Redirecting to login in{' '}
          <Text style={styles.countdownNumber}>{countdown}</Text> second
          {countdown !== 1 ? 's' : ''}…
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Parent Registration</Text>

      {/* Username */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, touched.username && errors.username ? styles.inputError : null]}
          value={formData.username}
          onChangeText={(value) => handleChange('username', value)}
          onBlur={() => handleBlur('username')}
          placeholder="8-15 chars, lowercase, digits, _ or -"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Username"
        />
        {touched.username && errors.username && (
          <Text style={styles.errorText}>{errors.username}</Text>
        )}
      </View>

      {/* Full Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={[styles.input, touched.fullName && errors.fullName ? styles.inputError : null]}
          value={formData.fullName}
          onChangeText={(value) => handleChange('fullName', value)}
          onBlur={() => handleBlur('fullName')}
          placeholder="5-20 chars, letters and spaces"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          accessibilityLabel="Full Name"
        />
        {touched.fullName && errors.fullName && (
          <Text style={styles.errorText}>{errors.fullName}</Text>
        )}
      </View>

      {/* Phone */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={[styles.input, touched.phone && errors.phone ? styles.inputError : null]}
          value={formData.phone}
          onChangeText={(value) => handleChange('phone', value)}
          onBlur={() => handleBlur('phone')}
          placeholder="10 digit phone number"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={10}
          accessibilityLabel="Phone number"
        />
        {touched.phone && errors.phone && (
          <Text style={styles.errorText}>{errors.phone}</Text>
        )}
      </View>

      {/* Email */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, touched.email && errors.email ? styles.inputError : null]}
          value={formData.email}
          onChangeText={(value) => handleChange('email', value)}
          onBlur={() => handleBlur('email')}
          placeholder="your@email.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Email"
        />
        {touched.email && errors.email && (
          <Text style={styles.errorText}>{errors.email}</Text>
        )}
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[
              styles.input,
              styles.passwordInput,
              touched.password && errors.password ? styles.inputError : null,
            ]}
            value={formData.password}
            onChangeText={(value) => handleChange('password', value)}
            onBlur={() => handleBlur('password')}
            placeholder="8-20 chars, upper, lower, digit, special"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Password"
          />
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setShowPassword((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Text style={styles.toggleButtonText}>
              {showPassword ? '🙈' : '👁️'}
            </Text>
          </TouchableOpacity>
        </View>
        {touched.password && errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Register"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Register</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.dark,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 48,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
  },
  toggleButton: {
    position: 'absolute',
    right: 12,
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.success,
    marginBottom: spacing.md,
  },
  successMessage: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  countdownText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  countdownNumber: {
    fontWeight: '700',
    color: colors.primary,
  },
});
