/**
 * ForgotPasswordScreen — Multi-step password reset flow (Android).
 *
 * Stage 1: Username entry → POST /auth/forgot-password → generic error if not found.
 * Stage 2: OTP verification (6-digit input, 5-min countdown, max 3 attempts, shows remaining).
 * Stage 3: New password entry with same validation as registration.
 * On password set: navigate to Login within 3 seconds.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { validatePassword } from '@chikumiku/validation';
import { apiClient, type ApiError } from '../services/api';

interface ForgotPasswordScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
  };
}

type Stage = 'username' | 'otp' | 'newPassword' | 'success';

const OTP_TIMER_SECONDS = 5 * 60; // 5 minutes
const MAX_OTP_ATTEMPTS = 3;
const REDIRECT_DELAY_MS = 3000;

export function ForgotPasswordScreen({
  navigation,
}: ForgotPasswordScreenProps): React.ReactElement {
  const [stage, setStage] = useState<Stage>('username');
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  // OTP state
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(OTP_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start countdown timer when entering OTP stage
  useEffect(() => {
    if (stage === 'otp') {
      setTimerSeconds(OTP_TIMER_SECONDS);
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  // Redirect to login after success
  useEffect(() => {
    if (stage === 'success') {
      const timeout = setTimeout(() => {
        navigation.navigate('Login');
      }, REDIRECT_DELAY_MS);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [stage, navigation]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Stage 1: Username submission
  const handleUsernameSubmit = useCallback(async () => {
    setError('');

    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/forgot-password', { username: username.trim() });
      setStage('otp');
    } catch {
      // Requirement 4.1: generic error if not found
      setError('Unable to process request');
    } finally {
      setLoading(false);
    }
  }, [username]);

  // Stage 2: OTP submission
  const handleOtpSubmit = useCallback(async () => {
    setError('');

    if (timerSeconds <= 0) {
      setError('OTP has expired. Please try again.');
      return;
    }

    if (otpAttempts >= MAX_OTP_ATTEMPTS) {
      setError('Maximum attempts reached. Please restart the process.');
      return;
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/verify-otp', { username, otp });
      if (timerRef.current) clearInterval(timerRef.current);
      setStage('newPassword');
    } catch {
      const newAttempts = otpAttempts + 1;
      setOtpAttempts(newAttempts);
      if (newAttempts >= MAX_OTP_ATTEMPTS) {
        setError('Maximum attempts reached. Please restart the process.');
      } else {
        setError(
          `Invalid OTP. ${MAX_OTP_ATTEMPTS - newAttempts} attempt(s) remaining.`,
        );
      }
    } finally {
      setLoading(false);
    }
  }, [username, otp, otpAttempts, timerSeconds]);

  // Stage 3: New password submission
  const handlePasswordSubmit = useCallback(async () => {
    setError('');
    setPasswordError('');

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setPasswordError(validation.errors.password || 'Invalid password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        username,
        newPassword,
      });
      setStage('success');
    } catch {
      setError('Unable to process request');
    } finally {
      setLoading(false);
    }
  }, [username, newPassword, confirmPassword]);

  const handleRestart = () => {
    setStage('username');
    setUsername('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setPasswordError('');
    setOtpAttempts(0);
    setTimerSeconds(OTP_TIMER_SECONDS);
  };

  const timerExpired = timerSeconds <= 0;
  const maxAttemptsReached = otpAttempts >= MAX_OTP_ATTEMPTS;

  return (
    <View style={styles.outerContainer}>
      {/* Purple Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reset Password</Text>
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

      {/* Stage 1: Username Entry */}
      {stage === 'username' && (
        <View>
          <Text style={styles.description}>
            Enter your username to receive a verification code.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Username"
            />
          </View>

          {error !== '' && <Text style={styles.errorMessage}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitButton, loading ? styles.submitButtonDisabled : null]}
            onPress={handleUsernameSubmit}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Send Verification Code"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Send Verification Code</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Stage 2: OTP Verification */}
      {stage === 'otp' && (
        <View>
          <Text style={styles.description}>
            Enter the 6-digit verification code sent to your registered contact.
          </Text>

          {/* Timer display */}
          <Text
            style={[
              styles.timerText,
              timerExpired ? styles.timerExpired : null,
            ]}
            accessibilityLabel={`Time remaining: ${formatTime(timerSeconds)}`}
          >
            {timerExpired ? 'Expired' : formatTime(timerSeconds)}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={(value) =>
                setOtp(value.replace(/\D/g, '').slice(0, 6))
              }
              placeholder="000000"
              placeholderTextColor="#999"
              keyboardType="number-pad"
              maxLength={6}
              editable={!timerExpired && !maxAttemptsReached}
              accessibilityLabel="Verification code"
            />
          </View>

          {error !== '' && <Text style={styles.errorMessage}>{error}</Text>}

          {timerExpired || maxAttemptsReached ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleRestart}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Start Over"
            >
              <Text style={styles.secondaryButtonText}>Start Over</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, loading ? styles.submitButtonDisabled : null]}
              onPress={handleOtpSubmit}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Verify Code"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Verify Code</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Stage 3: New Password */}
      {stage === 'newPassword' && (
        <View>
          <Text style={styles.description}>Enter your new password.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New Password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="New password"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Confirm new password"
            />
          </View>

          {passwordError !== '' && (
            <Text style={styles.errorMessage}>{passwordError}</Text>
          )}
          {error !== '' && <Text style={styles.errorMessage}>{error}</Text>}

          <TouchableOpacity
            style={[styles.submitButton, loading ? styles.submitButtonDisabled : null]}
            onPress={handlePasswordSubmit}
            disabled={loading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Reset Password"
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hintText}>
            Password must be 8-20 characters with at least one uppercase letter,
            one lowercase letter, one digit, and one special character (!@#$%^&*).
          </Text>
        </View>
      )}

      {/* Success Stage */}
      {stage === 'success' && (
        <View style={styles.successContainer}>
          <Text style={styles.successEmoji}>✅</Text>
          <Text style={styles.successTitle}>Password reset successful</Text>
          <Text style={styles.successMessage}>
            Redirecting to login in 3 seconds…
          </Text>
        </View>
      )}
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#F8F5FF' },
  header: {
    backgroundColor: '#9B59B6', paddingTop: 44, paddingBottom: 14,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  container: { flex: 1, backgroundColor: '#F8F5FF' },
  content: { padding: 16 },
  description: { fontSize: 14, color: '#777777', marginBottom: 16 },
  fieldGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#555555', marginBottom: 4 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0D8EC',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#333333', minHeight: 44,
  },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  timerText: { fontSize: 20, fontWeight: '600', color: '#2C2341', textAlign: 'center', marginBottom: 16 },
  timerExpired: { color: '#E74C3C' },
  errorMessage: { color: '#E74C3C', fontSize: 13, marginBottom: 12 },
  hintText: { fontSize: 11, color: '#999999', marginTop: 8 },
  submitButton: {
    backgroundColor: '#E94F9B', borderRadius: 22, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 2, borderColor: '#9B59B6',
    paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48,
  },
  secondaryButtonText: { color: '#9B59B6', fontSize: 15, fontWeight: '700' },
  successContainer: { alignItems: 'center', paddingVertical: 32 },
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#27AE60', marginBottom: 8 },
  successMessage: { fontSize: 14, color: '#777777' },
});
