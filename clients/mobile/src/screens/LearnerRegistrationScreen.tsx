/**
 * LearnerRegistrationScreen — Registration form for learner accounts (Android).
 *
 * Purple header with back arrow.
 * Pre-filled parent username (read-only, from auth context).
 * Fields: learner username, name, password, gender, relationship, grade, school.
 * Subject selection: 7 defaults as selectable icons (all selected by default).
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

/* --- Constants --- */
type Gender = 'male' | 'female' | 'other';
type Relationship = 'son' | 'daughter' | 'nephew' | 'niece' | 'other';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string; color: string }[] = [
  { value: 'male', label: 'Male', icon: '👦', color: '#E94F9B' },
  { value: 'female', label: 'Female', icon: '👧', color: '#E94F9B' },
  { value: 'other', label: 'Other', icon: '🧒', color: '#E94F9B' },
];

const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'nephew', label: 'Nephew' },
  { value: 'niece', label: 'Niece' },
  { value: 'other', label: 'Other' },
];

const GRADE_OPTIONS = [
  'LKG', 'UKG', 'First', 'Second', 'Third', 'Fourth',
  'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
  'Tenth', 'Eleventh', 'Twelfth',
];

interface DefaultSubject {
  name: string;
  icon: string;
  color: string;
  bg: string;
}

const DEFAULT_SUBJECTS: DefaultSubject[] = [
  { name: 'Maths', icon: '🧮', color: '#E94F9B', bg: '#FDE8F4' },
  { name: 'Science', icon: '🔬', color: '#27AE60', bg: '#E8F8EE' },
  { name: 'Computers', icon: '💻', color: '#4A6CF7', bg: '#EBF0FF' },
  { name: 'EVS', icon: '🌱', color: '#E67E22', bg: '#FFF0E0' },
  { name: 'Hindi', icon: '🕉️', color: '#E5A100', bg: '#FFF8E1' },
  { name: 'English', icon: '📝', color: '#5DADE2', bg: '#E8F6FD' },
  { name: 'Kannada', icon: '❋', color: '#9B59B6', bg: '#F3E8F9' },
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
    goBack: () => void;
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
    username: false, name: false, password: false, school: false,
  });
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(DEFAULT_SUBJECTS.map((s) => s.name)),
  );
  const [customSubjects, setCustomSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showGradePicker, setShowGradePicker] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (successTimerRef.current) clearTimeout(successTimerRef.current); };
  }, []);

  const validateField = useCallback(
    (field: TextField, value: string): string | undefined => {
      let result;
      switch (field) {
        case 'username': result = validateUsername(value); return result.errors.username;
        case 'name': result = validateFullName(value); return result.errors.fullName;
        case 'password': result = validatePassword(value); return result.errors.password;
        case 'school': result = validateSchoolName(value); return result.errors.schoolName;
        default: return undefined;
      }
    }, [],
  );

  const validateSubjectsCount = useCallback((): string | undefined => {
    const total = selectedSubjects.size + customSubjects.length;
    return total < 1 ? 'At least 1 subject must be selected' : undefined;
  }, [selectedSubjects, customSubjects]);

  const handleChange = useCallback((field: TextField, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((field: TextField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, formData[field]);
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, [formData, validateField]);

  const toggleSubject = useCallback((subjectName: string) => {
    setSelectedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subjectName)) next.delete(subjectName); else next.add(subjectName);
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

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let hasError = false;
    const textFields: TextField[] = ['username', 'name', 'password', 'school'];
    for (const field of textFields) {
      const error = validateField(field, formData[field]);
      if (error) { newErrors[field] = error; hasError = true; }
    }
    const subjectError = validateSubjectsCount();
    if (subjectError) { newErrors.subjects = subjectError; hasError = true; }
    setErrors(newErrors);
    setTouched({ username: true, name: true, password: true, school: true });
    return !hasError;
  }, [formData, validateField, validateSubjectsCount]);

  const handleSubmit = useCallback(async () => {
    if (!validateAll()) return;
    setIsSubmitting(true);
    try {
      const allSelectedSubjects = [...Array.from(selectedSubjects), ...customSubjects];
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
          ...prev, username: apiError.message || 'This username is already in use',
        }));
      }
    } finally { setIsSubmitting(false); }
  }, [formData, parentUsername, selectedSubjects, customSubjects, validateAll]);

  if (success) {
    return (
      <View style={styles.successContainer}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>Learner Registered!</Text>
        <Text style={styles.successMessage}>The learner profile has been created.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Purple Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}
          accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Register Learner</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled">
        {/* Parent Username (read-only) */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Parent Username</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.readOnlyText}>{parentUsername || 'parent_user'}</Text>
          </View>
        </View>

        {/* Learner Username */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Learner Username <Text style={styles.required}>*</Text></Text>
          <TextInput style={[styles.input, touched.username && errors.username ? styles.inputError : null]}
            value={formData.username} onChangeText={(v) => handleChange('username', v)}
            onBlur={() => handleBlur('username')} placeholder="8-15 chars (a-z, 0-9, -, _)"
            placeholderTextColor="#999" autoCapitalize="none" autoCorrect={false}
            accessibilityLabel="Learner username" />
          {touched.username && errors.username && <Text style={styles.errorText}>{errors.username}</Text>}
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
          <TextInput style={[styles.input, touched.name && errors.name ? styles.inputError : null]}
            value={formData.name} onChangeText={(v) => handleChange('name', v)}
            onBlur={() => handleBlur('name')} placeholder="5-20 characters"
            placeholderTextColor="#999" autoCapitalize="words" accessibilityLabel="Learner name" />
          {touched.name && errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
          <TextInput style={[styles.input, touched.password && errors.password ? styles.inputError : null]}
            value={formData.password} onChangeText={(v) => handleChange('password', v)}
            onBlur={() => handleBlur('password')} placeholder="••••••••" placeholderTextColor="#999"
            secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Password" />
          <Text style={styles.hintText}>8-20 chars • 1 upper • 1 lower • 1 number • 1 symbol</Text>
          {touched.password && errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        {/* Gender */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Gender <Text style={styles.required}>*</Text></Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity key={opt.value}
                style={[styles.genderOption, formData.gender === opt.value && styles.genderOptionActive]}
                onPress={() => setFormData((prev) => ({ ...prev, gender: opt.value }))}
                activeOpacity={0.7} accessibilityRole="radio"
                accessibilityState={{ selected: formData.gender === opt.value }}>
                <Text style={styles.genderIcon}>{opt.icon}</Text>
                <Text style={[styles.genderLabel,
                  formData.gender === opt.value && styles.genderLabelActive]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Relationship */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Relationship <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity style={styles.dropdownButton}
            onPress={() => setShowRelationshipPicker(!showRelationshipPicker)} activeOpacity={0.7}>
            <Text style={styles.dropdownButtonText}>
              {RELATIONSHIP_OPTIONS.find((o) => o.value === formData.relationship)?.label}
            </Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {showRelationshipPicker && (
            <View style={styles.dropdownList}>
              {RELATIONSHIP_OPTIONS.map((opt) => (
                <TouchableOpacity key={opt.value}
                  style={[styles.dropdownItem, formData.relationship === opt.value && styles.dropdownItemActive]}
                  onPress={() => { setFormData((prev) => ({ ...prev, relationship: opt.value })); setShowRelationshipPicker(false); }}>
                  <Text style={styles.dropdownItemText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Grade */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Grade <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity style={styles.dropdownButton}
            onPress={() => setShowGradePicker(!showGradePicker)} activeOpacity={0.7}>
            <Text style={styles.dropdownButtonText}>{formData.grade}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
          {showGradePicker && (
            <View style={styles.dropdownList}>
              {GRADE_OPTIONS.map((grade) => (
                <TouchableOpacity key={grade}
                  style={[styles.dropdownItem, formData.grade === grade && styles.dropdownItemActive]}
                  onPress={() => { setFormData((prev) => ({ ...prev, grade })); setShowGradePicker(false); }}>
                  <Text style={styles.dropdownItemText}>{grade}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* School */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>School Name <Text style={styles.required}>*</Text></Text>
          <TextInput style={[styles.input, touched.school && errors.school ? styles.inputError : null]}
            value={formData.school} onChangeText={(v) => handleChange('school', v)}
            onBlur={() => handleBlur('school')} placeholder="5-30 characters"
            placeholderTextColor="#999" accessibilityLabel="School name" />
          {touched.school && errors.school && <Text style={styles.errorText}>{errors.school}</Text>}
        </View>

        {/* Subject Selection */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>
            Subjects <Text style={styles.required}>*</Text>
            <Text style={styles.hintInline}> (at least 1 required)</Text>
          </Text>
          <View style={styles.subjectsGrid}>
            {DEFAULT_SUBJECTS.map((subject) => {
              const isSelected = selectedSubjects.has(subject.name);
              return (
                <TouchableOpacity key={subject.name}
                  style={[styles.subjectChip,
                    isSelected && { borderColor: subject.color, backgroundColor: subject.bg }]}
                  onPress={() => toggleSubject(subject.name)} activeOpacity={0.7}
                  accessibilityRole="checkbox" accessibilityState={{ checked: isSelected }}>
                  <Text style={styles.subjectIcon}>{subject.icon}</Text>
                  <Text style={[styles.subjectLabel,
                    isSelected && { color: subject.color }]}>{subject.name}</Text>
                  {isSelected && <Text style={[styles.checkMark, { color: subject.color }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.subjects && <Text style={styles.errorText}>{errors.subjects}</Text>}

          {/* Custom subjects */}
          {customSubjects.length > 0 && (
            <View style={styles.customSubjectsContainer}>
              {customSubjects.map((subj, idx) => (
                <View key={idx} style={styles.customSubjectBadge}>
                  <Text style={styles.customSubjectBadgeText}>{subj}</Text>
                  <TouchableOpacity onPress={() => handleRemoveCustomSubject(idx)}
                    style={styles.customSubjectRemove}>
                    <Text style={styles.customSubjectRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {customSubjects.length < MAX_CUSTOM_SUBJECTS && (
            <View style={styles.addCustomRow}>
              <TextInput style={[styles.input, styles.customSubjectInput]}
                value={customSubjectInput}
                onChangeText={(v) => { setCustomSubjectInput(v); setErrors((prev) => ({ ...prev, customSubject: undefined })); }}
                placeholder="Add custom subject" placeholderTextColor="#999" />
              <TouchableOpacity style={styles.addButton} onPress={handleAddCustomSubject} activeOpacity={0.7}>
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
          {errors.customSubject && <Text style={styles.errorText}>{errors.customSubject}</Text>}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit} disabled={isSubmitting} activeOpacity={0.8}
          accessibilityRole="button" accessibilityLabel="Register Learner">
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>🎓 Register Learner</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F5FF' },
  header: {
    backgroundColor: '#2C2341', paddingTop: 44, paddingBottom: 12,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  backButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  headerTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  scrollView: { flex: 1 },
  formContent: { padding: 14, paddingBottom: 40 },

  fieldGroup: { marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '600', color: '#555555', marginBottom: 4 },
  required: { color: '#E74C3C' },
  hintInline: { color: '#999999', fontWeight: '400' },
  hintText: { fontSize: 10, color: '#999999', marginTop: 2 },
  input: {
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1,
    borderColor: '#E0D8EC', paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13, color: '#333333', minHeight: 40,
  },
  inputError: { borderColor: '#E74C3C' },
  errorText: { color: '#E74C3C', fontSize: 10, marginTop: 3 },

  readOnlyField: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EDE8F5', borderRadius: 8, borderWidth: 1,
    borderColor: '#D0C8DC', paddingHorizontal: 12, paddingVertical: 9,
  },
  lockIcon: { fontSize: 10 },
  readOnlyText: { fontSize: 13, color: '#666666' },

  // Gender
  genderRow: { flexDirection: 'row', gap: 8 },
  genderOption: {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderRadius: 10, borderWidth: 2, borderColor: '#E0D8EC', backgroundColor: '#FFFFFF',
  },
  genderOptionActive: { borderColor: '#E94F9B', backgroundColor: '#FDE8F4' },
  genderIcon: { fontSize: 28, marginBottom: 2 },
  genderLabel: { fontSize: 10, fontWeight: '600', color: '#666666' },
  genderLabelActive: { color: '#E94F9B' },

  // Dropdown
  dropdownButton: {
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E0D8EC',
    paddingHorizontal: 12, paddingVertical: 9, minHeight: 40,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownButtonText: { fontSize: 13, color: '#333333' },
  dropdownArrow: { fontSize: 10, color: '#999999' },
  dropdownList: {
    backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1,
    borderColor: '#E0D8EC', marginTop: 4,
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownItemActive: { backgroundColor: 'rgba(233, 79, 155, 0.08)' },
  dropdownItemText: { fontSize: 13, color: '#333333' },

  // Subjects
  subjectsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8,
  },
  subjectChip: {
    width: '23%', alignItems: 'center', paddingVertical: 8,
    borderRadius: 8, borderWidth: 2, borderColor: '#E0D8EC', backgroundColor: '#FFFFFF',
  },
  subjectIcon: { fontSize: 16, marginBottom: 2 },
  subjectLabel: { fontSize: 9, fontWeight: '600', color: '#666666' },
  checkMark: { fontSize: 10, marginTop: 2 },

  // Custom subjects
  customSubjectsContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8,
  },
  customSubjectBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#9B59B6',
    borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, gap: 4,
  },
  customSubjectBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '500' },
  customSubjectRemove: { minWidth: 18, minHeight: 18, alignItems: 'center', justifyContent: 'center' },
  customSubjectRemoveText: { color: '#FFFFFF', fontSize: 14 },
  addCustomRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  customSubjectInput: { flex: 1 },
  addButton: {
    backgroundColor: '#9B59B6', borderRadius: 8, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },

  // Submit
  submitButton: {
    backgroundColor: '#E94F9B', borderRadius: 22, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
    shadowColor: '#E94F9B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Success
  successContainer: {
    flex: 1, backgroundColor: '#F8F5FF', alignItems: 'center',
    justifyContent: 'center', padding: 24,
  },
  successEmoji: { fontSize: 48, marginBottom: 12 },
  successTitle: { fontSize: 20, fontWeight: '700', color: '#27AE60', marginBottom: 8 },
  successMessage: { fontSize: 15, color: '#333333' },
});
