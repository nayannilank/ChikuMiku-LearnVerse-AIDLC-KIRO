/**
 * ManageLearnersScreen — List, edit, reset password, and remove learners (Android).
 *
 * Displays all learners under the parent account with edit, reset password,
 * and remove actions. Uses shared validators and apiClient.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {
  validateFullName,
  validatePassword,
  validateSchoolName,
  validateSubjectName,
} from '@chikumiku/validation';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { layout } from '../theme/layout';
import { apiClient, type ApiError } from '../services/api';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ManageLearners'>;
}

interface Learner {
  id: string;
  name: string;
  username: string;
  gender: string;
  grade: string;
  school: string;
  subjects: string[];
}

interface EditFormData {
  name: string;
  grade: string;
  school: string;
  subjects: string[];
}

interface EditFormErrors {
  name?: string;
  school?: string;
  subjects?: string;
}

const GRADE_OPTIONS = [
  'LKG', 'UKG',
  '1st', '2nd', '3rd', '4th', '5th', '6th',
  '7th', '8th', '9th', '10th', '11th', '12th',
];

export function ManageLearnersScreen({ navigation }: Props): React.ReactElement {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editLearner, setEditLearner] = useState<Learner | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({ name: '', grade: '', school: '', subjects: [] });
  const [editErrors, setEditErrors] = useState<EditFormErrors>({});
  const [isEditing, setIsEditing] = useState(false);

  // Reset password modal state
  const [resetLearner, setResetLearner] = useState<Learner | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Remove confirmation state
  const [removeLearner, setRemoveLearner] = useState<Learner | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const fetchLearners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<Learner[]>('/learners');
      setLearners(response.data);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Failed to load learners');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLearners();
  }, [fetchLearners]);

  // --- Edit handlers ---
  const openEditModal = useCallback((learner: Learner) => {
    setEditLearner(learner);
    setEditForm({
      name: learner.name,
      grade: learner.grade,
      school: learner.school,
      subjects: [...learner.subjects],
    });
    setEditErrors({});
  }, []);

  const handleEditFieldChange = useCallback((field: keyof EditFormData, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleEditSubject = useCallback((subject: string) => {
    setEditForm((prev) => {
      const subjects = prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject];
      return { ...prev, subjects };
    });
    setEditErrors((prev) => ({ ...prev, subjects: undefined }));
  }, []);

  const validateEditForm = useCallback((): boolean => {
    const newErrors: EditFormErrors = {};
    let hasError = false;

    const nameResult = validateFullName(editForm.name);
    if (!nameResult.valid) {
      newErrors.name = nameResult.errors.fullName;
      hasError = true;
    }

    const schoolResult = validateSchoolName(editForm.school);
    if (!schoolResult.valid) {
      newErrors.school = schoolResult.errors.schoolName;
      hasError = true;
    }

    if (editForm.subjects.length < 1) {
      newErrors.subjects = 'At least 1 subject must be selected';
      hasError = true;
    }

    setEditErrors(newErrors);
    return !hasError;
  }, [editForm]);

  const handleSaveEdit = useCallback(async () => {
    if (!editLearner || !validateEditForm()) return;

    setIsEditing(true);
    try {
      await apiClient.put(`/learners/${editLearner.id}`, {
        name: editForm.name,
        grade: editForm.grade,
        school: editForm.school,
        subjects: editForm.subjects,
      });
      setLearners((prev) =>
        prev.map((l) =>
          l.id === editLearner.id
            ? { ...l, name: editForm.name, grade: editForm.grade, school: editForm.school, subjects: editForm.subjects }
            : l
        ),
      );
      setEditLearner(null);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setEditErrors((prev) => ({ ...prev, name: apiError.message || 'Failed to save changes' }));
    } finally {
      setIsEditing(false);
    }
  }, [editLearner, editForm, validateEditForm]);

  // --- Reset Password handlers ---
  const openResetModal = useCallback((learner: Learner) => {
    setResetLearner(learner);
    setNewPassword('');
    setResetError(null);
  }, []);

  const handleResetPassword = useCallback(async () => {
    if (!resetLearner) return;

    const result = validatePassword(newPassword);
    if (!result.valid) {
      setResetError('Password does not meet the required format');
      return;
    }

    setIsResetting(true);
    try {
      await apiClient.post(`/learners/${resetLearner.id}/reset-password`, {
        newPassword,
      });
      setResetLearner(null);
      setNewPassword('');
      setResetError(null);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      setResetError(apiError.message || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  }, [resetLearner, newPassword]);

  // --- Remove handlers ---
  const openRemoveConfirm = useCallback((learner: Learner) => {
    setRemoveLearner(learner);
  }, []);

  const handleRemoveLearner = useCallback(async () => {
    if (!removeLearner) return;

    setIsRemoving(true);
    try {
      await apiClient.delete(`/learners/${removeLearner.id}`);
      setLearners((prev) => prev.filter((l) => l.id !== removeLearner.id));
      setRemoveLearner(null);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      Alert.alert('Error', apiError.message || 'Failed to remove learner');
      setRemoveLearner(null);
    } finally {
      setIsRemoving(false);
    }
  }, [removeLearner]);

  // --- Render helpers ---
  const renderLearnerItem = useCallback(({ item }: { item: Learner }) => (
    <View style={styles.learnerCard} accessibilityLabel={`Learner ${item.name}`}>
      <View style={styles.learnerInfo}>
        <Text style={styles.learnerName}>{item.name}</Text>
        <Text style={styles.learnerDetail}>
          {item.gender} • Grade {item.grade}
        </Text>
        <Text style={styles.learnerSubjects} numberOfLines={2}>
          {item.subjects.join(', ')}
        </Text>
      </View>
      <View style={styles.learnerActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openEditModal(item)}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => openResetModal(item)}
          accessibilityRole="button"
          accessibilityLabel={`Reset password for ${item.name}`}
        >
          <Text style={styles.actionButtonText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => openRemoveConfirm(item)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), [openEditModal, openResetModal, openRemoveConfirm]);

  // --- Loading/Error states ---
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading learners" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={fetchLearners}
          accessibilityRole="button"
          accessibilityLabel="Retry loading learners"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Manage Learners</Text>

      <FlatList
        data={learners}
        keyExtractor={(item: Learner) => item.id}
        renderItem={renderLearnerItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No learners registered yet.</Text>
        }
      />

      {/* Edit Modal */}
      <Modal
        visible={editLearner !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditLearner(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Learner</Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={[styles.input, editErrors.name ? styles.inputError : null]}
                value={editForm.name}
                onChangeText={(text: string) => handleEditFieldChange('name', text)}
                placeholder="5-20 chars, letters and spaces"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Learner name"
              />
              {editErrors.name && <Text style={styles.errorText}>{editErrors.name}</Text>}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Grade</Text>
              <View style={styles.gradeGrid}>
                {GRADE_OPTIONS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeOption, editForm.grade === g ? styles.gradeOptionActive : null]}
                    onPress={() => handleEditFieldChange('grade', g)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: editForm.grade === g }}
                    accessibilityLabel={`Grade ${g}`}
                  >
                    <Text style={[styles.gradeOptionText, editForm.grade === g ? styles.gradeOptionTextActive : null]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>School</Text>
              <TextInput
                style={[styles.input, editErrors.school ? styles.inputError : null]}
                value={editForm.school}
                onChangeText={(text: string) => handleEditFieldChange('school', text)}
                placeholder="5-30 chars"
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="School name"
              />
              {editErrors.school && <Text style={styles.errorText}>{editErrors.school}</Text>}
            </View>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Subjects</Text>
              <View style={styles.subjectsWrap}>
                {editLearner?.subjects.map((subj) => (
                  <TouchableOpacity
                    key={subj}
                    style={[styles.subjectChip, editForm.subjects.includes(subj) ? styles.subjectChipActive : null]}
                    onPress={() => toggleEditSubject(subj)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: editForm.subjects.includes(subj) }}
                    accessibilityLabel={subj}
                  >
                    <Text style={[styles.subjectChipText, editForm.subjects.includes(subj) ? styles.subjectChipTextActive : null]}>
                      {subj}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {editErrors.subjects && <Text style={styles.errorText}>{editErrors.subjects}</Text>}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditLearner(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel edit"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isEditing ? styles.buttonDisabled : null]}
                onPress={handleSaveEdit}
                disabled={isEditing}
                accessibilityRole="button"
                accessibilityLabel="Save changes"
              >
                {isEditing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        visible={resetLearner !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setResetLearner(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <Text style={styles.modalSubtitle}>
              Set a new password for {resetLearner?.name}
            </Text>

            <View style={styles.fieldContainer}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={[styles.input, resetError ? styles.inputError : null]}
                value={newPassword}
                onChangeText={(text: string) => {
                  setNewPassword(text);
                  setResetError(null);
                }}
                placeholder="8-20 chars, upper, lower, digit, special"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                accessibilityLabel="New password"
              />
              {resetError && <Text style={styles.errorText}>{resetError}</Text>}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setResetLearner(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel reset password"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isResetting ? styles.buttonDisabled : null]}
                onPress={handleResetPassword}
                disabled={isResetting}
                accessibilityRole="button"
                accessibilityLabel="Reset password"
              >
                {isResetting ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={removeLearner !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRemoveLearner(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Remove Learner</Text>
            <Text style={styles.warningText}>
              Are you sure you want to remove {removeLearner?.name}? This will permanently
              delete their profile and all associated data including chapters, progress,
              and exercise history. This action cannot be undone.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setRemoveLearner(null)}
                accessibilityRole="button"
                accessibilityLabel="Cancel removal"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dangerButton, isRemoving ? styles.buttonDisabled : null]}
                onPress={handleRemoveLearner}
                disabled={isRemoving}
                accessibilityRole="button"
                accessibilityLabel="Confirm remove learner"
              >
                {isRemoving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.dangerButtonText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.heading.h2,
    fontWeight: typography.weight.bold,
    color: colors.dark,
    textAlign: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    fontSize: typography.bodyFontSize,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
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
  // Learner card
  learnerCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  learnerInfo: {
    marginBottom: spacing.sm,
  },
  learnerName: {
    fontSize: typography.heading.h4,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
  },
  learnerDetail: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  learnerSubjects: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  learnerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTargetMin,
  },
  actionButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  removeButton: {
    borderColor: colors.error,
  },
  removeButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.error,
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
    maxHeight: '85%',
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
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.touchTargetMin,
  },
  saveButtonText: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: colors.error,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
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
  // Form styles
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
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
  warningText: {
    fontSize: typography.bodyFontSize,
    color: colors.error,
    lineHeight: typography.bodyFontSize * typography.lineHeight.normal,
    marginBottom: spacing.sm,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gradeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadii.badge,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: layout.touchTargetMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(233, 79, 155, 0.08)',
  },
  gradeOptionText: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
  },
  gradeOptionTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
  subjectsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  subjectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadii.badge,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  subjectChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(233, 79, 155, 0.1)',
  },
  subjectChipText: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
  },
  subjectChipTextActive: {
    color: colors.primary,
    fontWeight: typography.weight.medium,
  },
});
