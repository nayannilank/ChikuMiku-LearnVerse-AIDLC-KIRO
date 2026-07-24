/**
 * LoginScreen — Authentication screen with role selector, credentials, and validation.
 *
 * Features:
 * - Logo icon + brand name at top
 * - Role selector (Parent/Learner) with icons
 * - Username and masked password fields
 * - Client-side validation: requires role, username, password
 * - Generic error on auth failure (no info leakage)
 * - Account lockout display (15 min after 5 failures)
 * - Redirect to role-appropriate dashboard on success
 * - Forgot Password link
 * - Create Account outline button
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

      await login({
        username: response.data.username,
        role: response.data.role,
        grade: response.data.grade,
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      });

      const dashboardScreen =
        response.data.role === 'parent' ? 'ParentDashboard' : 'LearnerDashboard';
      navigation.navigate(dashboardScreen);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
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
      {/* Logo + Brand */}
      <View style={styles.logoSection}>
        <View style={styles.logoBox}>
          <Text style={styles.logoEmoji}>📖</Text>
        </View>
        <Text style={styles.brandName}>ChikuMiku LearnVerse</Text>
        <Text style={styles.brandTagline}>Where Curiosity Comes Alive</Text>
      </View>

      {/* Role Selector */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>I am a...</Text>
        <View style={styles.roleRow}>
          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'parent' && styles.roleButtonActive,
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
            <Text style={styles.roleIcon}>🛡️</Text>
            <Text
              style={[
                styles.roleButtonText,
                role === 'parent' && styles.roleButtonTextActive,
              ]}
            >
              Parent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleButton,
              role === 'learner' && styles.roleButtonActive,
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
            <Text style={styles.roleIcon}>🧒</Text>
            <Text
              style={[
                styles.roleButtonText,
                role === 'learner' && styles.roleButtonTextActive,
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
          placeholderTextColor="#999"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Username"
        />
        {errors.username && (
          <Text style={styles.errorText}>{errors.username}</Text>
        )}
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, errors.password ? styles.inputError : null]}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((prev) => ({ ...prev, password: undefined }));
          }}
          placeholder="••••••••"
          placeholderTextColor="#999"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Password"
        />
        {errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      {/* API error / lockout message */}
      {apiError && (
        <View style={styles.apiErrorContainer}>
          <Text style={styles.apiErrorText}>{apiError}</Text>
        </View>
      )}

      {/* Login Button */}
      <TouchableOpacity
        style={[styles.loginButton, isSubmitting && styles.loginButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Login"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </TouchableOpacity>

      {/* Forgot Password link */}
      <TouchableOpacity
        style={styles.forgotLink}
        onPress={() => navigation.navigate('ForgotPassword')}
        activeOpacity={0.7}
        accessibilityRole="link"
        accessibilityLabel="Forgot Password?"
      >
        <Text style={styles.forgotLinkText}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Create Account button */}
      <TouchableOpacity
        style={styles.createAccountButton}
        onPress={() => navigation.navigate('ParentRegistration')}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Create Account"
      >
        <Text style={styles.createAccountText}>Create Account</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 12,
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FDE8F4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoEmoji: {
    fontSize: 22,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2C2341',
  },
  brandTagline: {
    fontSize: 11,
    color: '#E94F9B',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Form
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0D8EC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333333',
    minHeight: 44,
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    color: '#E74C3C',
    fontSize: 12,
    marginTop: 4,
  },

  // Role selector
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E0D8EC',
    backgroundColor: '#FFFFFF',
  },
  roleButtonActive: {
    borderColor: '#9B59B6',
    backgroundColor: '#F3E8F9',
  },
  roleIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#777777',
  },
  roleButtonTextActive: {
    color: '#9B59B6',
  },

  // API error
  apiErrorContainer: {
    backgroundColor: 'rgba(231, 76, 60, 0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E74C3C',
    padding: 12,
    marginBottom: 12,
  },
  apiErrorText: {
    color: '#E74C3C',
    fontSize: 13,
    textAlign: 'center',
  },

  // Login button
  loginButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Forgot password
  forgotLink: {
    alignItems: 'center',
    marginTop: 12,
  },
  forgotLinkText: {
    color: '#E94F9B',
    fontSize: 13,
    fontWeight: '600',
  },

  // Create Account
  createAccountButton: {
    borderWidth: 2,
    borderColor: '#9B59B6',
    borderRadius: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#FFFFFF',
  },
  createAccountText: {
    color: '#9B59B6',
    fontSize: 15,
    fontWeight: '700',
  },
});
