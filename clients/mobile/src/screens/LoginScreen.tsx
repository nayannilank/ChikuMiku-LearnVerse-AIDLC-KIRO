/**
 * LoginScreen — Authentication screen with role selector, credentials, and validation.
 *
 * Features:
 * - Role selector (Parent/Learner) via selectable buttons
 * - Username and masked password fields
 * - Client-side validation: requires role, username, password
 * - Generic error on auth failure (no info leakage)
 * - Account lockout display (15 min after 5 failures)
 * - Redirect to role-appropriate dashboard on success
 * - Forgot Password link
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuth, type UserRole } from '../context/AuthContext';
import { apiClient, type ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';

interface LoginScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

interface FormErrors {
  role?: string;
  username?: string;
  password?: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role: UserRole;
  username: string;
  grade?: string;
}

export function LoginScreen({ navigation }: LoginScreenProps): React.ReactElement {
  const { login } = useAuth();

  const [role, setRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback((): FormErrors => {
    const fieldErrors: FormErrors = {};
    if (!role) {
      fieldErrors.role = 'Please select a role.';
    }
    if (!username.trim()) {
      fieldErrors.username = 'Username is required.';
    }
    if (!password) {
      fieldErrors.password = 'Password is required.';
    }
    return fieldErrors;
  }, [role, username, password]);

  const handleSubmit = useCallback(async () => {
    setApiError(null);

    const fieldErrors = validate();
    setErrors(fieldErrors);

    // Requirement 3.3: Don't submit if validation fails
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        role: role!,
        username: username.trim(),
        password,
      });

      // On success, store tokens and navigate to appropriate dashboard
      await login({
        username: response.data.username,
        role: response.data.role,
        grade: response.data.grade,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });

      // Requirement 3.2: navigate to role-appropriate dashboard
      const dashboardScreen =
        response.data.role === 'parent' ? 'ParentDashboard' : 'LearnerDashboard';
      navigation.navigate(dashboardScreen);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      // Requirement 3.4: generic error (no info leakage)
      // Requirement 3.5: lockout display after 5 failures
      if (apiErr.status === 423) {
        setApiError('Account locked for 15 minutes. Please try again later.');
      } else {
        setApiError('Invalid credentials. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [role, username, password, validate, login, navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Login</Text>

      {/* Role Selector — Requirement 3.1 */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>I am a</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'parent' ? styles.roleButtonActive : null,
            ]}
            onPress={() => {
              setRole('parent');
              setErrors((prev) => ({ ...prev, role: undefined }));
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: role === 'parent' }}
            accessibilityLabel="Parent"
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'parent' ? styles.roleButtonTextActive : null,
              ]}
            >
              Parent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'learner' ? styles.roleButtonActive : null,
            ]}
            onPress={() => {
              setRole('learner');
              setErrors((prev) => ({ ...prev, role: undefined }));
            }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityState={{ selected: role === 'learner' }}
            accessibilityLabel="Learner"
          >
            <Text
              style={[
                styles.roleButtonText,
                role === 'learner' ? styles.roleButtonTextActive : null,
              ]}
            >
              Learner
            </Text>
          </TouchableOpacity>
        </View>
        {errors.role && <Text style={styles.errorText}>{errors.role}</Text>}
      </View>

      {/* Username */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Username</Text>
        <TextInput
          style={[styles.input, errors.username ? styles.inputError : null]}
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setErrors((prev) => ({ ...prev, username: undefined }));
          }}
          placeholder="Enter your username"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Username"
        />
        {errors.username && (
          <Text style={styles.errorText}>{errors.username}</Text>
        )}
      </View>

      {/* Password (masked) */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, errors.password ? styles.inputError : null]}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder="Enter your password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Password"
        />
        {errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      {/* API error / lockout message — Requirements 3.4, 3.5 */}
      {apiError && (
        <View style={styles.apiErrorContainer}>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      )}

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Login"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Login</Text>
        )}
      </TouchableOpacity>

      {/* Forgot Password link */}
      <TouchableOpacity
        style={styles.forgotPasswordLink}
        onPress={() => navigation.navigate('ForgotPassword')}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel="Forgot Password?"
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
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
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
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

  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  roleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  roleButtonTextActive: {
    color: colors.white,
  },

  // API error
  apiErrorContainer: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderRadius: borderRadii.input,
    borderWidth: 1,
    borderColor: colors.error,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  apiErrorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },

  // Submit
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // Forgot password
  forgotPasswordLink: {
    alignItems: 'center',
    marginTop: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
