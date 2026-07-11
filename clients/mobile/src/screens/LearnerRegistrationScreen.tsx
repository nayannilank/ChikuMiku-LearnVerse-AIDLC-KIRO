/**
 * LearnerRegistrationScreen — Registration form for learner accounts (Android).
 *
 * Pre-filled parent username (read-only, from auth context).
 * Fields: learner username, name, password, gender, relationship, grade, school.
 * Subject selection: 7 defaults as selectable icons (all selected by default).
 * Add custom subject: input (1-50 chars), max 5 custom per learner.
 * Min 1 subject validation.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
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
  validatePassword,
  validateSchoolName,
  validateSubjectName,
} from '@chikumiku/validation';
import { useAuth } from '../context/AuthContext';
import { apiClient, type ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';

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
  { name: 'English', icon: '📝' },
  { name: 'Hindi', icon: '🕉️' },
  { name: 'Maths', icon: '🧮' },
  { name: 'Science', icon: '🔬' },
  { name: 'Computers', icon: '💻' },
  { name: 'EVS', icon: '🌍' },
  { name: 'Kannada', icon: '❋' },
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

interface LearnerRegistrationScreenProps {
  navigation: {
    navigate: (screen: string) => void;
  };
}

/* --- Component --- */

export function LearnerRegistrationScreen({
  navigation,
}: LearnerRegistrationScreenProps): React.ReactElement {
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

  // Grade dropdown visibility
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  /* --- Validation --- */

  const validateField = useCallback(
    (field: TextField, value: string): string | undefined => {
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
    },
    [],
  );

  const validateSubjectsCount = useCallback((): string | undefined => {
    const totalSubjects = selectedSubjects.size + customSubjects.length;
    if (totalSubjects < 1) {
      return 'At least 1 subject must be selected';
    }
    return undefined;
  }, [selectedSubjects, customSubjects]);

  /* --- Handlers --- */

  const handleChange = useCallback(
    (field: TextField, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [touched, validateField],
  );

  const handleBlur = useCallback(
    (field: TextField) => {
      setTouched((prev) => ({ ...prev, [field]: true }));
      const error = validateField(field, formData[field]);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [formData, validateField],
  );

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

    // Check for duplicates
    const allSubjects = [
      ...DEFAULT_SUBJECTS.map((s) => s.name.toLowerCase()),
      ...customSubjects.map((s) => s.toLowerCase()),
    ];
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

    const subjectError = validateSubjectsCount();
    if (subjectError) {
      newErrors.subjects = subjectError;
      hasError = true;
    }

    setErrors(newErrors);
    setTouched({ username: true, name: true, password: true, school: true });

    return !hasError;
  }, [formData, validateField, validateSubjectsCount]);

  const handleSubmit = useCallback(async () => {
    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const allSelectedSubjects = [
        ...Array.from(selectedSubjects),
        ...customSubjects,
      ];

      await apiClient.post('/auth/register/learner', {
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
  }, [formData, parentUsername, selectedSubjects, customSubjects, validateAll]);

  /* --- Render --- */

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>🎉 Learner Registered Successfully!</Text>
        <Text style={styles.successMessage}>
          The learner profile has been created.
        </Text>
        <Text style={styles.successDismiss}>
          This message will dismiss shortly…
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
      <Text style={styles.title}>Register Learner</Text>

      {/* Parent Username (read-only) */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Parent Username</Text>
        <TextInput
          style={[styles.input, styles.readOnlyInput]}
          value={parentUsername || ''}
          editable={false}
          accessibilityLabel="Parent username (read-only)"
        />
      </View>

      {/* Learner Username */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Learner Username</Text>
        <TextInput
          style={[styles.input, touched.username && errors.username ? styles.inputError : null]}
          value={formData.username}
          onChangeText={(value) => handleChange('username', value)}
          onBlur={() => handleBlur('username')}
          placeholder="8-15 chars, lowercase, digits, _ or -"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Learner username"
        />
        {touched.username && errors.username && (
          <Text style={styles.errorText}>{errors.username}</Text>
        )}
      </View>

      {/* Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={[styles.input, touched.name && errors.name ? styles.inputError : null]}
          value={formData.name}
          onChangeText={(value) => handleChange('name', value)}
          onBlur={() => handleBlur('name')}
          placeholder="5-20 chars, letters and spaces"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          accessibilityLabel="Learner name"
        />
        {touched.name && errors.name && (
          <Text style={styles.errorText}>{errors.name}</Text>
        )}
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, touched.password && errors.password ? styles.inputError : null]}
          value={formData.password}
          onChangeText={(value) => handleChange('password', value)}
          onBlur={() => handleBlur('password')}
          placeholder="8-20 chars, upper, lower, digit, special"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Learner password"
        />
        {touched.password && errors.password && (
          <Text style={styles.errorText}>{errors.password}</Text>
        )}
      </View>

      {/* Gender (radio with icons) */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.genderOption,
                formData.gender === opt.value ? styles.genderOptionActive : null,
              ]}
              onPress={() => setFormData((prev) => ({ ...prev, gender: opt.value }))}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: formData.gender === opt.value }}
              accessibilityLabel={opt.label}
            >
              <Text style={styles.genderIcon}>{opt.icon}</Text>
              <Text style={styles.genderLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Relationship (dropdown-like selector) */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Relationship</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowRelationshipPicker(!showRelationshipPicker)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Relationship: ${formData.relationship}`}
        >
          <Text style={styles.dropdownButtonText}>
            {RELATIONSHIP_OPTIONS.find((o) => o.value === formData.relationship)?.label}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {showRelationshipPicker && (
          <View style={styles.dropdownList}>
            {RELATIONSHIP_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.dropdownItem,
                  formData.relationship === opt.value ? styles.dropdownItemActive : null,
                ]}
                onPress={() => {
                  setFormData((prev) => ({ ...prev, relationship: opt.value }));
                  setShowRelationshipPicker(false);
                }}
                accessibilityRole="menuitem"
              >
                <Text style={styles.dropdownItemText}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Grade (dropdown-like selector) */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Grade</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowGradePicker(!showGradePicker)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Grade: ${formData.grade}`}
        >
          <Text style={styles.dropdownButtonText}>{formData.grade}</Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
        {showGradePicker && (
          <View style={styles.dropdownList}>
            {GRADE_OPTIONS.map((grade) => (
              <TouchableOpacity
                key={grade}
                style={[
                  styles.dropdownItem,
                  formData.grade === grade ? styles.dropdownItemActive : null,
                ]}
                onPress={() => {
                  setFormData((prev) => ({ ...prev, grade }));
                  setShowGradePicker(false);
                }}
                accessibilityRole="menuitem"
              >
                <Text style={styles.dropdownItemText}>{grade}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* School Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>School</Text>
        <TextInput
          style={[styles.input, touched.school && errors.school ? styles.inputError : null]}
          value={formData.school}
          onChangeText={(value) => handleChange('school', value)}
          onBlur={() => handleBlur('school')}
          placeholder="5-30 chars, letters, digits, spaces"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="School name"
        />
        {touched.school && errors.school && (
          <Text style={styles.errorText}>{errors.school}</Text>
        )}
      </View>

      {/* Subject Selection */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Subjects</Text>
        <View style={styles.subjectsGrid}>
          {DEFAULT_SUBJECTS.map((subject) => {
            const isSelected = selectedSubjects.has(subject.name);
            return (
              <TouchableOpacity
                key={subject.name}
                style={[
                  styles.subjectChip,
                  isSelected ? styles.subjectChipActive : null,
                ]}
                onPress={() => toggleSubject(subject.name)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={subject.name}
              >
                <Text style={styles.subjectIcon}>{subject.icon}</Text>
                <Text
                  style={[
                    styles.subjectLabel,
                    isSelected ? styles.subjectLabelActive : null,
                  ]}
                >
                  {subject.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom subjects list */}
        {customSubjects.length > 0 && (
          <View style={styles.customSubjectsContainer}>
            <Text style={styles.customSubjectsLabel}>Custom subjects:</Text>
            <View style={styles.customSubjectsList}>
              {customSubjects.map((subj, idx) => (
                <View key={idx} style={styles.customSubjectBadge}>
                  <Text style={styles.customSubjectBadgeText}>{subj}</Text>
                  <TouchableOpacity
                    onPress={() => handleRemoveCustomSubject(idx)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${subj}`}
                    style={styles.customSubjectRemove}
                  >
                    <Text style={styles.customSubjectRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Add custom subject input */}
        <View style={styles.addCustomRow}>
          <TextInput
            style={[styles.input, styles.customSubjectInput]}
            value={customSubjectInput}
            onChangeText={(value) => {
              setCustomSubjectInput(value);
              setErrors((prev) => ({ ...prev, customSubject: undefined }));
            }}
            placeholder="Add custom subject (1-50 chars)"
            placeholderTextColor={colors.textMuted}
            editable={customSubjects.length < MAX_CUSTOM_SUBJECTS}
            accessibilityLabel="Custom subject name"
          />
          <TouchableOpacity
            style={[
              styles.addButton,
              customSubjects.length >= MAX_CUSTOM_SUBJECTS ? styles.addButtonDisabled : null,
            ]}
            onPress={handleAddCustomSubject}
            disabled={customSubjects.length >= MAX_CUSTOM_SUBJECTS}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add custom subject"
          >
            <Text style={styles.addButtonText}>
              {customSubjects.length >= MAX_CUSTOM_SUBJECTS ? 'Max' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.customSubjectsCount}>
          {customSubjects.length}/{MAX_CUSTOM_SUBJECTS} custom subjects added
        </Text>

        {errors.customSubject && (
          <Text style={styles.errorText}>{errors.customSubject}</Text>
        )}
        {errors.subjects && (
          <Text style={styles.errorText}>{errors.subjects}</Text>
        )}
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting ? styles.submitButtonDisabled : null]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Register Learner"
      >
        {isSubmitting ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Register Learner</Text>
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
    paddingBottom: spacing.xxl,
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
  readOnlyInput: {
    backgroundColor: colors.background,
    color: colors.textMuted,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    marginTop: spacing.xs,
  },

  // Gender
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadii.badge,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 48,
  },
  genderOptionActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(233, 79, 155, 0.08)',
  },
  genderIcon: {
    fontSize: 20,
  },
  genderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  // Dropdown
  dropdownButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  dropdownArrow: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dropdownList: {
    backgroundColor: colors.white,
    borderRadius: borderRadii.input,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(233, 79, 155, 0.08)',
  },
  dropdownItemText: {
    fontSize: 15,
    color: colors.textPrimary,
  },

  // Subjects
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadii.badge,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    minHeight: 40,
  },
  subjectChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(233, 79, 155, 0.1)',
  },
  subjectIcon: {
    fontSize: 16,
  },
  subjectLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  subjectLabelActive: {
    color: colors.primary,
  },

  // Custom subjects
  customSubjectsContainer: {
    marginBottom: spacing.sm,
  },
  customSubjectsLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  customSubjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  customSubjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    borderRadius: borderRadii.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  customSubjectBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '500',
  },
  customSubjectRemove: {
    minWidth: 24,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSubjectRemoveText: {
    color: colors.white,
    fontSize: 18,
    lineHeight: 20,
  },

  addCustomRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  customSubjectInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  customSubjectsCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },

  // Submit
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.success,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  successDismiss: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
