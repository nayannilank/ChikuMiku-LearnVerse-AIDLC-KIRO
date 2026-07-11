/**
 * ParentSettingsScreen — Parent profile and account management (Android).
 *
 * Sections: Profile update, Change password, Notifications, Custom subjects,
 * Data export (with re-auth), Delete account (with re-auth + confirmation).
 *
 * Validates: Requirements 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  Modal,
  Alert,
} from 'react-native';
import {
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
  validateSubjectName,
} from '@chikumiku/validation';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { layout } from '../theme/layout';
import { apiClient, type ApiError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ParentSettings'>;
}

interface ParentProfile {
  username: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

interface NotificationPrefs {
  progressAlerts: boolean;
  streakReminders: boolean;
}

interface ProfileErrors {
  name?: string;
  phone?: string;
  email?: string;
}

interface PasswordErrors {
  currentPassword?: string;
  newPassword?: string;
}

const RELATIONSHIP_OPTIONS = ['Father', 'Mother', 'Guardian', 'Other'];
const MAX_CUSTOM_SUBJECTS = 10;

export function ParentSettingsScreen({ navigation }: Props): React.ReactElement {
  const { logout } = useAuth();

  // Loading
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Profile section
  const [profile, setProfile] = useState<ParentProfile>({
    username: '', name: '', phone: '', email: '', relationship: '',
  });
  const [profileErrors, setProfileErrors] = useState<ProfileErrors>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Change Password section
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Notifications section
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    progressAlerts: true,
    streakReminders: true,
  });
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  // Custom Subjects section
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  // Export section
  const [exportPassword, setExportPassword] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Delete Account section
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load profile data
  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await apiClient.get<{
        profile: ParentProfile;
        notifications: NotificationPrefs;
        customSubjects: string[];
      }>('/profile');
      setProfile(response.data.profile);
      setNotifications(response.data.notifications);
      setCustomSubjects(response.data.customSubjects);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setLoadError(apiError.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  // --- Profile handlers ---
  const handleProfileChange = useCallback((field: keyof ParentProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setProfileErrors((prev) => ({ ...prev, [field]: undefined }));
    setProfileSuccess(false);
  }, []);

  const validateProfile = useCallback((): boolean => {
    const errors: ProfileErrors = {};
    let hasError = false;

    const nameResult = validateFullName(profile.name);
    if (!nameResult.valid) {
      errors.name = nameResult.errors.fullName;
      hasError = true;
    }

    const phoneResult = validatePhone(profile.phone);
    if (!phoneResult.valid) {
      errors.phone = phoneResult.errors.phone;
      hasError = true;
    }

    const emailResult = validateEmail(profile.email);
    if (!emailResult.valid) {
      errors.email = emailResult.errors.email;
      hasError = true;
    }

    setProfileErrors(errors);
    return !hasError;
  }, [profile]);

  const handleSaveProfile = useCallback(async () => {
    if (!validateProfile()) return;

    setIsSavingProfile(true);
    try {
      await apiClient.put('/profile', {
        name: profile.name,
        phone: profile.phone,
        email: profile.email,
        relationship: profile.relationship,
      });
      setProfileSuccess(true);
      setProfileErrors({});
    } catch (err: unknown) {
      const apiError = err as ApiError;
      if (apiError.field) {
        setProfileErrors((prev) => ({ ...prev, [apiError.field as string]: apiError.message }));
      } else {
        Alert.alert('Error', apiError.message || 'Failed to update profile');
      }
    } finally {
      setIsSavingProfile(false);
    }
  }, [profile, validateProfile]);

  // --- Password handlers ---
  const handleChangePassword = useCallback(async () => {
    const errors: PasswordErrors = {};
    let hasError = false;

    if (!currentPassword) {
      errors.currentPassword = 'Current password is required';
      hasError = true;
    }

    const pwResult = validatePassword(newPassword);
    if (!pwResult.valid) {
      errors.newPassword = pwResult.errors.password;
      hasError = true;
    }

    if (hasError) {
      setPasswordErrors(errors);
      return;
    }

    setIsChangingPassword(true);
    setPasswordErrors({});
    try {
      await apiClient.post('/profile/change-password', {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const apiError = err as ApiError;
      if (apiError.field === 'currentPassword') {
        setPasswordErrors({ currentPassword: apiError.message || 'Current password is incorrect' });
      } else {
        setPasswordErrors({ newPassword: apiError.message || 'Failed to change password' });
      }
    } finally {
      setIsChangingPassword(false);
    }
  }, [currentPassword, newPassword]);

  // --- Notifications handlers ---
  const handleToggleNotification = useCallback((key: keyof NotificationPrefs) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleSaveNotifications = useCallback(async () => {
    setIsSavingNotifications(true);
    try {
      await apiClient.put('/profile/notifications', notifications);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      Alert.alert('Error', apiError.message || 'Failed to save notification preferences');
    } finally {
      setIsSavingNotifications(false);
    }
  }, [notifications]);

  // --- Custom Subjects handlers ---
  const handleAddSubject = useCallback(async () => {
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;

    const result = validateSubjectName(trimmed);
    if (!result.valid) {
      setSubjectError(result.errors.subjectName || 'Invalid subject name');
      return;
    }

    if (customSubjects.length >= MAX_CUSTOM_SUBJECTS) {
      setSubjectError(`Maximum ${MAX_CUSTOM_SUBJECTS} custom subjects allowed`);
      return;
    }

    if (customSubjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSubjectError('This subject already exists');
      return;
    }

    setIsAddingSubject(true);
    setSubjectError(null);
    try {
      await apiClient.post('/profile/custom-subjects', { name: trimmed });
      setCustomSubjects((prev) => [...prev, trimmed]);
      setNewSubjectInput('');
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setSubjectError(apiError.message || 'Failed to add subject');
    } finally {
      setIsAddingSubject(false);
    }
  }, [newSubjectInput, customSubjects]);

  // --- Export handlers ---
  const handleExport = useCallback(async () => {
    if (!exportPassword) {
      setExportError('Password is required for data export');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    try {
      const response = await apiClient.post<{ downloadUrl: string }>('/export/report', {
        password: exportPassword,
      });
      setShowExportModal(false);
      setExportPassword('');
      Alert.alert('Export Ready', 'Your report has been generated and is ready for download.');
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setExportError(apiError.message || 'Failed to generate export');
    } finally {
      setIsExporting(false);
    }
  }, [exportPassword]);

  // --- Delete Account handlers ---
  const handleDeleteAccount = useCallback(async () => {
    if (!deletePassword) {
      setDeleteError('Password is required to delete account');
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiClient.delete('/profile');
      setShowDeleteModal(false);
      await logout();
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setDeleteError(apiError.message || 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  }, [deletePassword, logout]);

  // --- Loading/Error states ---
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading settings" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorMessage}>{loadError}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchProfile}
          accessibilityRole="button"
          accessibilityLabel="Retry loading settings"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.screenTitle}>Settings</Text>

      {/* Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile</Text>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={profile.username}
            editable={false}
            accessibilityLabel="Username (read-only)"
          />
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, profileErrors.name ? styles.inputError : null]}
            value={profile.name}
            onChangeText={(text: string) => handleProfileChange('name', text)}
            placeholder="5-20 chars, letters and spaces"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Full name"
          />
          {profileErrors.name && <Text style={styles.errorText}>{profileErrors.name}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={[styles.input, profileErrors.phone ? styles.inputError : null]}
            value={profile.phone}
            onChangeText={(text: string) => handleProfileChange('phone', text)}
            placeholder="10 digits"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            accessibilityLabel="Phone number"
          />
          {profileErrors.phone && <Text style={styles.errorText}>{profileErrors.phone}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, profileErrors.email ? styles.inputError : null]}
            value={profile.email}
            onChangeText={(text: string) => handleProfileChange('email', text)}
            placeholder="Valid email, max 30 chars"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Email address"
          />
          {profileErrors.email && <Text style={styles.errorText}>{profileErrors.email}</Text>}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Relationship</Text>
          <View style={styles.relationshipRow}>
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.relationshipOption, profile.relationship === opt ? styles.relationshipOptionActive : null]}
                onPress={() => handleProfileChange('relationship', opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: profile.relationship === opt }}
                accessibilityLabel={opt}
              >
                <Text style={[styles.relationshipText, profile.relationship === opt ? styles.relationshipTextActive : null]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSavingProfile ? styles.buttonDisabled : null]}
          onPress={handleSaveProfile}
          disabled={isSavingProfile}
          accessibilityRole="button"
          accessibilityLabel="Update profile"
        >
          {isSavingProfile ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Update Profile</Text>
          )}
        </TouchableOpacity>
        {profileSuccess && <Text style={styles.successText}>Profile updated successfully!</Text>}
      </View>

      {/* Change Password Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={[styles.input, passwordErrors.currentPassword ? styles.inputError : null]}
            value={currentPassword}
            onChangeText={(text: string) => {
              setCurrentPassword(text);
              setPasswordErrors((prev) => ({ ...prev, currentPassword: undefined }));
              setPasswordSuccess(false);
            }}
            placeholder="Enter current password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel="Current password"
          />
          {passwordErrors.currentPassword && (
            <Text style={styles.errorText}>{passwordErrors.currentPassword}</Text>
          )}
        </View>

        <View style={styles.fieldContainer}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={[styles.input, passwordErrors.newPassword ? styles.inputError : null]}
            value={newPassword}
            onChangeText={(text: string) => {
              setNewPassword(text);
              setPasswordErrors((prev) => ({ ...prev, newPassword: undefined }));
              setPasswordSuccess(false);
            }}
            placeholder="8-20 chars, upper, lower, digit, special"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel="New password"
          />
          {passwordErrors.newPassword && (
            <Text style={styles.errorText}>{passwordErrors.newPassword}</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isChangingPassword ? styles.buttonDisabled : null]}
          onPress={handleChangePassword}
          disabled={isChangingPassword}
          accessibilityRole="button"
          accessibilityLabel="Change password"
        >
          {isChangingPassword ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Change Password</Text>
          )}
        </TouchableOpacity>
        {passwordSuccess && <Text style={styles.successText}>Password changed successfully!</Text>}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Progress Alerts</Text>
          <Switch
            value={notifications.progressAlerts}
            onValueChange={() => handleToggleNotification('progressAlerts')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle progress alerts"
            accessibilityRole="switch"
            accessibilityState={{ checked: notifications.progressAlerts }}
          />
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Streak Reminders</Text>
          <Switch
            value={notifications.streakReminders}
            onValueChange={() => handleToggleNotification('streakReminders')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle streak reminders"
            accessibilityRole="switch"
            accessibilityState={{ checked: notifications.streakReminders }}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isSavingNotifications ? styles.buttonDisabled : null]}
          onPress={handleSaveNotifications}
          disabled={isSavingNotifications}
          accessibilityRole="button"
          accessibilityLabel="Save notification preferences"
        >
          {isSavingNotifications ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.primaryButtonText}>Save Preferences</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Custom Subjects Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Subjects</Text>
        <Text style={styles.sectionHint}>
          Add custom subjects available to all your learners (max {MAX_CUSTOM_SUBJECTS})
        </Text>

        {customSubjects.length > 0 && (
          <View style={styles.subjectsList}>
            {customSubjects.map((subj, idx) => (
              <View key={idx} style={styles.subjectBadge}>
                <Text style={styles.subjectBadgeText}>{subj}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.addSubjectRow}>
          <TextInput
            style={[styles.input, styles.addSubjectInput, subjectError ? styles.inputError : null]}
            value={newSubjectInput}
            onChangeText={(text: string) => {
              setNewSubjectInput(text);
              setSubjectError(null);
            }}
            placeholder="Subject name (1-50 chars)"
            placeholderTextColor={colors.textMuted}
            editable={customSubjects.length < MAX_CUSTOM_SUBJECTS}
            accessibilityLabel="New custom subject name"
          />
          <TouchableOpacity
            style={[styles.addButton, (customSubjects.length >= MAX_CUSTOM_SUBJECTS || isAddingSubject) ? styles.buttonDisabled : null]}
            onPress={handleAddSubject}
            disabled={customSubjects.length >= MAX_CUSTOM_SUBJECTS || isAddingSubject}
            accessibilityRole="button"
            accessibilityLabel="Add custom subject"
          >
            {isAddingSubject ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.addButtonText}>Add</Text>
            )}
          </TouchableOpacity>
        </View>
        {subjectError && <Text style={styles.errorText}>{subjectError}</Text>}
        <Text style={styles.subjectCount}>
          {customSubjects.length}/{MAX_CUSTOM_SUBJECTS} subjects added
        </Text>
      </View>

      {/* Export Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Export</Text>
        <Text style={styles.sectionHint}>
          Generate a PDF/CSV report of all learner progress data. Re-authentication is required.
        </Text>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            setShowExportModal(true);
            setExportPassword('');
            setExportError(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Export learner data"
        >
          <Text style={styles.secondaryButtonText}>Export Report</Text>
        </TouchableOpacity>
      </View>

      {/* Delete Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delete Account</Text>
        <Text style={styles.dangerWarning}>
          Deleting your account will schedule all account data for permanent deletion within
          30 days. This includes all learner profiles, chapters, progress, and exercise history.
          This action cannot be undone.
        </Text>
        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => {
            setShowDeleteModal(true);
            setDeletePassword('');
            setDeleteConfirmed(false);
            setDeleteError(null);
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete account"
        >
          <Text style={styles.dangerButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verify Identity</Text>
            <Text style={styles.modalSubtitle}>
              Enter your password to generate the export report.
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, exportError ? styles.inputError : null]}
                value={exportPassword}
                onChangeText={(text: string) => {
                  setExportPassword(text);
                  setExportError(null);
                }}
                placeholder="Enter your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel="Password for export"
              />
              {exportError && <Text style={styles.errorText}>{exportError}</Text>}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowExportModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel export"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, styles.modalPrimaryBtn, isExporting ? styles.buttonDisabled : null]}
                onPress={handleExport}
                disabled={isExporting}
                accessibilityRole="button"
                accessibilityLabel="Generate export"
              >
                {isExporting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Export</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.dangerWarning}>
              This will permanently delete your account and all associated data within 30 days,
              including all learner profiles, chapters, progress, and exercise history.
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Enter your password</Text>
              <TextInput
                style={[styles.input, deleteError ? styles.inputError : null]}
                value={deletePassword}
                onChangeText={(text: string) => {
                  setDeletePassword(text);
                  setDeleteError(null);
                }}
                placeholder="Confirm your password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel="Password to confirm deletion"
              />
              {deleteError && <Text style={styles.errorText}>{deleteError}</Text>}
            </View>

            <TouchableOpacity
              style={styles.confirmCheckRow}
              onPress={() => setDeleteConfirmed((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: deleteConfirmed }}
              accessibilityLabel="Confirm account deletion"
            >
              <View style={[styles.checkbox, deleteConfirmed ? styles.checkboxChecked : null]}>
                {deleteConfirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.confirmText}>
                I understand this action is irreversible
              </Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel deletion"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, styles.modalDangerBtn, (!deleteConfirmed || isDeleting) ? styles.buttonDisabled : null]}
                onPress={handleDeleteAccount}
                disabled={!deleteConfirmed || isDeleting}
                accessibilityRole="button"
                accessibilityLabel="Confirm delete account"
              >
                {isDeleting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.dangerButtonText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  screenTitle: {
    fontSize: typography.heading.h2,
    fontWeight: typography.weight.bold,
    color: colors.dark,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  errorMessage: {
    fontSize: typography.bodyFontSize,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: layout.touchTargetMin,
    justifyContent: 'center',
  },
  retryButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  // Section styles
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.heading.h3,
    fontWeight: typography.weight.bold,
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  // Field styles
  fieldContainer: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: typography.bodyFontSize,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: layout.touchTargetMin,
  },
  inputError: {
    borderColor: colors.error,
  },
  inputDisabled: {
    backgroundColor: colors.background,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
  successText: {
    fontSize: 12,
    color: colors.success,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  // Relationship picker
  relationshipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  relationshipOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadii.badge,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  relationshipOptionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(233, 79, 155, 0.08)',
  },
  relationshipText: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
  },
  relationshipTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTargetMin,
  },
  primaryButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTargetMin,
  },
  secondaryButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTargetMin,
  },
  dangerButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  // Notifications
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: layout.touchTargetMin,
  },
  toggleLabel: {
    fontSize: typography.bodyFontSize,
    color: colors.textPrimary,
  },
  // Custom subjects
  subjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subjectBadge: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadii.badge,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
  },
  subjectBadgeText: {
    fontSize: 12,
    color: colors.white,
    fontWeight: typography.weight.medium,
  },
  addSubjectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  addSubjectInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: layout.touchTargetMin,
  },
  addButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  subjectCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  // Danger section
  dangerWarning: {
    fontSize: typography.bodyFontSize,
    color: colors.error,
    lineHeight: typography.bodyFontSize * typography.lineHeight.normal,
    marginBottom: spacing.md,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.heading.h3,
    fontWeight: typography.weight.bold,
    color: colors.dark,
    marginBottom: spacing.sm,
  },
  modalSubtitle: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTargetMin,
  },
  cancelButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.textSecondary,
  },
  modalPrimaryBtn: {
    flex: 1,
  },
  modalDangerBtn: {
    flex: 1,
  },
  // Checkbox
  confirmCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: layout.touchTargetMin,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: borderRadii.small,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    borderColor: colors.error,
    backgroundColor: colors.error,
  },
  checkmark: {
    fontSize: 14,
    color: colors.white,
    fontWeight: typography.weight.bold,
  },
  confirmText: {
    fontSize: typography.bodyFontSize,
    color: colors.textPrimary,
    flex: 1,
  },
});
