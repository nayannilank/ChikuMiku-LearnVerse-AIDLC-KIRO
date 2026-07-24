/**
 * ParentRegistrationScreen — Registration form for parent accounts (Android).
 *
 * Purple header with back arrow + title.
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

interface ParentRegistrationScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
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

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

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

      setSuccess(true);
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
  }, [formData, validateAll]);

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successEmoji}>✅</Text>
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
    <View style={styles.container}>
      {/* Purple Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register as Parent</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoBannerIcon}>🛡️</Text>
          <View style={styles.infoBannerTextContainer}>
            <Text style={styles.infoBannerTitle}>Parent Account</Text>
            <Text style={styles.infoBannerSub}>Create first, add children later</Text>
          </View>
        </View>

        {/* Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Parent Username <Text style={styles.required}>*</Text>
            <Text style={styles.hint}> (8-15 chars)</Text>
          </Text>
          <TextInput
            style={[styles.input, touched.username && errors.username ? styles.inputError : null]}
            value={formData.username}
            onChangeText={(value) => handleChange('username', value)}
            onBlur={() => handleBlur('username')}
            placeholder="8-15 chars, lowercase, digits, _ or -"
            placeholderTextColor="#999"
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
          <Text style={styles.label}>
            Name <Text style={styles.required}>*</Text>
            <Text style={styles.hint}> (5-20 chars)</Text>
          </Text>
          <TextInput
            style={[styles.input, touched.fullName && errors.fullName ? styles.inputError : null]}
            value={formData.fullName}
            onChangeText={(value) => handleChange('fullName', value)}
            onBlur={() => handleBlur('fullName')}
            placeholder="Full name"
            placeholderTextColor="#999"
            autoCapitalize="words"
            accessibilityLabel="Full Name"
          />
          {touched.fullName && errors.fullName && (
            <Text style={styles.errorText}>{errors.fullName}</Text>
          )}
        </View>

        {/* Phone */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Phone <Text style={styles.required}>*</Text>
            <Text style={styles.hint}> (10 digits)</Text>
          </Text>
          <TextInput
            style={[styles.input, touched.phone && errors.phone ? styles.inputError : null]}
            value={formData.phone}
            onChangeText={(value) => handleChange('phone', value)}
            onBlur={() => handleBlur('phone')}
            placeholder="10 digit phone number"
            placeholderTextColor="#999"
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
          <Text style={styles.label}>
            Email <Text style={styles.required}>*</Text>
            <Text style={styles.hint}> (≤30 chars)</Text>
          </Text>
          <TextInput
            style={[styles.input, touched.email && errors.email ? styles.inputError : null]}
            value={formData.email}
            onChangeText={(value) => handleChange('email', value)}
            onBlur={() => handleBlur('email')}
            placeholder="your@email.com"
            placeholderTextColor="#999"
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
          <Text style={styles.label}>
            Password <Text style={styles.required}>*</Text>
            <Text style={styles.hint}> (8-20, Aa+num+sym)</Text>
          </Text>
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
              placeholder="••••••••"
              placeholderTextColor="#999"
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
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Register Parent"
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>👤 Register Parent</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },

  // Header
  header: {
    backgroundColor: '#9B59B6',
    paddingTop: 44,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Form
  scrollView: {
    flex: 1,
  },
  formContent: {
    padding: 14,
    paddingBottom: 32,
  },

  // Info Banner
  infoBanner: {
    backgroundColor: '#F3E8F9',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoBannerIcon: {
    fontSize: 20,
  },
  infoBannerTextContainer: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2341',
  },
  infoBannerSub: {
    fontSize: 10,
    color: '#777777',
    marginTop: 1,
  },

  // Fields
  fieldGroup: {
    marginBottom: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 4,
  },
  required: {
    color: '#E74C3C',
  },
  hint: {
    color: '#999999',
    fontWeight: '400',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0D8EC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333333',
    minHeight: 42,
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 11,
    marginTop: 3,
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
    right: 10,
    minWidth: 40,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleButtonText: {
    fontSize: 18,
  },

  // Submit
  submitButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 8,
    shadowColor: '#E94F9B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Success state
  successContainer: {
    flex: 1,
    backgroundColor: '#F8F5FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#27AE60',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 15,
    color: '#333333',
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 13,
    color: '#777777',
  },
  countdownNumber: {
    fontWeight: '700',
    color: '#E94F9B',
  },
});
