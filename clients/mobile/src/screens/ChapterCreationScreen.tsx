/**
 * ChapterCreationScreen — Android screen for creating a new chapter.
 *
 * Flow: Subject selection → Book selection (existing or new) →
 *       Chapter number (auto-suggested, overridable 1-999) → Chapter name.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { validateBookName, validateChapterName } from '@chikumiku/validation';
import { apiClient } from '../services/api';

/* --- Types --- */

interface Book {
  id: string;
  name: string;
}

interface Chapter {
  id: string;
  chapterNumber: number;
  chapterName: string;
}

interface FormErrors {
  subject?: string;
  book?: string;
  chapterNumber?: string;
  chapterName?: string;
}

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

interface Props {
  navigation: NavigationProp;
}

/* --- Constants --- */

const MAX_BOOKS_PER_SUBJECT = 50;
const MAX_CHAPTERS_PER_BOOK = 100;

/* --- Component --- */

export function ChapterCreationScreen({ navigation }: Props): React.ReactElement {
  // Data from API
  const [subjects, setSubjects] = useState<string[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Form state
  const [selectedSubject, setSelectedSubject] = useState('');
  const [bookMode, setBookMode] = useState<'existing' | 'new'>('existing');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [newBookName, setNewBookName] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [chapterName, setChapterName] = useState('');

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /* --- Load enrolled subjects on mount --- */

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const response = await apiClient.get<string[]>('/learner/subjects');
        if (!cancelled) {
          setSubjects(response.data);
        }
      } catch {
        // Handle load failure gracefully
        if (!cancelled) {
          setSubjects([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* --- Load books when subject changes --- */

  useEffect(() => {
    if (!selectedSubject) {
      setBooks([]);
      setChapters([]);
      setSelectedBookId('');
      setChapterNumber('');
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const response = await apiClient.get<Book[]>(
          `/learner/subjects/${encodeURIComponent(selectedSubject)}/books`
        );
        if (!cancelled) {
          setBooks(response.data);
          setSelectedBookId('');
          setChapters([]);
          setChapterNumber('');
          if (response.data.length === 0) {
            setBookMode('new');
          }
        }
      } catch {
        if (!cancelled) {
          setBooks([]);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedSubject]);

  /* --- Load chapters when book changes --- */

  useEffect(() => {
    if (!selectedBookId) {
      setChapters([]);
      if (bookMode === 'new') {
        setChapterNumber('1');
      }
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const response = await apiClient.get<Chapter[]>(
          `/learner/books/${encodeURIComponent(selectedBookId)}/chapters`
        );
        if (!cancelled) {
          setChapters(response.data);
          const maxNum = response.data.reduce(
            (max, ch) => Math.max(max, ch.chapterNumber),
            0
          );
          setChapterNumber(String(maxNum + 1));
        }
      } catch {
        if (!cancelled) {
          setChapters([]);
          setChapterNumber('1');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedBookId, bookMode]);

  /* --- Auto-suggest chapter 1 for new books --- */

  useEffect(() => {
    if (bookMode === 'new') {
      setChapterNumber('1');
      setChapters([]);
    }
  }, [bookMode]);

  /* --- Validation --- */

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!selectedSubject) {
      newErrors.subject = 'Please select a subject';
    }

    if (bookMode === 'existing') {
      if (!selectedBookId) {
        newErrors.book = 'Please select a book';
      }
    } else {
      const trimmed = newBookName.trim();
      if (!trimmed) {
        newErrors.book = 'Book name is required';
      } else {
        const result = validateBookName(trimmed);
        if (!result.valid) {
          newErrors.book = result.errors.bookName;
        }
      }
      // Enforce max books per subject
      if (books.length >= MAX_BOOKS_PER_SUBJECT) {
        newErrors.book = `Maximum ${MAX_BOOKS_PER_SUBJECT} books per subject reached`;
      }
    }

    if (!chapterNumber.trim()) {
      newErrors.chapterNumber = 'Chapter number is required';
    } else {
      const num = Number(chapterNumber);
      if (!Number.isInteger(num) || num < 1 || num > 999) {
        newErrors.chapterNumber = 'Chapter number must be between 1 and 999';
      } else {
        // Check duplicate chapter number
        const isDuplicate = chapters.some((ch) => ch.chapterNumber === num);
        if (isDuplicate) {
          newErrors.chapterNumber = 'This chapter number is already in use';
        }
      }
      // Enforce max chapters per book
      if (chapters.length >= MAX_CHAPTERS_PER_BOOK) {
        newErrors.chapterNumber = `Maximum ${MAX_CHAPTERS_PER_BOOK} chapters per book reached`;
      }
    }

    const trimmedName = chapterName.trim();
    if (!trimmedName) {
      newErrors.chapterName = 'Chapter name is required';
    } else {
      const result = validateChapterName(trimmedName);
      if (!result.valid) {
        newErrors.chapterName = result.errors.chapterName;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    selectedSubject, bookMode, selectedBookId, newBookName,
    chapterNumber, chapterName, books.length, chapters,
  ]);

  /* --- Submit --- */

  const handleSubmit = useCallback(async () => {
    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const bookNameValue = bookMode === 'existing'
        ? books.find((b) => b.id === selectedBookId)?.name || ''
        : newBookName.trim();

      const response = await apiClient.post<{ chapterId: string; success: boolean; error?: string }>(
        '/learner/chapters',
        {
          subjectName: selectedSubject,
          bookName: bookNameValue,
          chapterNumber: Number(chapterNumber),
          chapterName: chapterName.trim(),
        }
      );

      if (!response.data.success) {
        // Requirement 6.3: duplicate chapter number
        setErrors((prev) => ({ ...prev, chapterNumber: response.data.error }));
        return;
      }

      navigation.navigate('PageCapture', { chapterId: response.data.chapterId });
    } catch {
      setErrors((prev) => ({
        ...prev,
        chapterName: 'An error occurred. Please try again.',
      }));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateAll, bookMode, books, selectedBookId, newBookName,
    selectedSubject, chapterNumber, chapterName, navigation,
  ]);

  /* --- Render --- */

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={'#E94F9B'} />
        <Text style={styles.loadingText}>Loading subjects...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F5FF' }}>
      {/* Gold Header */}
      <View style={styles.goldHeader}>
        <Text style={styles.goldHeaderBack}>←</Text>
        <Text style={styles.goldHeaderTitle}>Add Chapter Content</Text>
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Subject Selection */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Subject</Text>
        {subjects.map((subj) => (
          <TouchableOpacity
            key={subj}
            style={[
              styles.optionButton,
              selectedSubject === subj && styles.optionButtonActive,
            ]}
            onPress={() => {
              setSelectedSubject(subj);
              setErrors((prev) => ({ ...prev, subject: undefined }));
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: selectedSubject === subj }}
            accessibilityLabel={`Select subject ${subj}`}
          >
            <Text
              style={[
                styles.optionButtonText,
                selectedSubject === subj && styles.optionButtonTextActive,
              ]}
            >
              {subj}
            </Text>
          </TouchableOpacity>
        ))}
        {errors.subject && (
          <Text style={styles.errorText} accessibilityRole="alert">
            {errors.subject}
          </Text>
        )}
      </View>

      {/* Book Selection */}
      {selectedSubject !== '' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Book</Text>
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                bookMode === 'existing' && styles.modeButtonActive,
              ]}
              onPress={() => {
                setBookMode('existing');
                setSelectedBookId('');
                setNewBookName('');
                setErrors((prev) => ({ ...prev, book: undefined }));
              }}
              disabled={books.length === 0}
              accessibilityRole="button"
              accessibilityState={{ selected: bookMode === 'existing' }}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  bookMode === 'existing' && styles.modeButtonTextActive,
                ]}
              >
                Existing
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                bookMode === 'new' && styles.modeButtonActive,
              ]}
              onPress={() => {
                setBookMode('new');
                setSelectedBookId('');
                setNewBookName('');
                setErrors((prev) => ({ ...prev, book: undefined }));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: bookMode === 'new' }}
            >
              <Text
                style={[
                  styles.modeButtonText,
                  bookMode === 'new' && styles.modeButtonTextActive,
                ]}
              >
                New Book
              </Text>
            </TouchableOpacity>
          </View>

          {bookMode === 'existing' ? (
            <View>
              {books.map((book) => (
                <TouchableOpacity
                  key={book.id}
                  style={[
                    styles.optionButton,
                    selectedBookId === book.id && styles.optionButtonActive,
                  ]}
                  onPress={() => {
                    setSelectedBookId(book.id);
                    setErrors((prev) => ({ ...prev, book: undefined }));
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedBookId === book.id }}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      selectedBookId === book.id && styles.optionButtonTextActive,
                    ]}
                  >
                    {book.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <TextInput
              style={[styles.input, errors.book ? styles.inputError : undefined]}
              value={newBookName}
              onChangeText={(text) => {
                setNewBookName(text);
                if (errors.book) {
                  const result = validateBookName(text.trim());
                  setErrors((prev) => ({
                    ...prev,
                    book: result.valid ? undefined : result.errors.bookName,
                  }));
                }
              }}
              placeholder="Book name (3-50 chars)"
              placeholderTextColor={'#999999'}
              maxLength={50}
              accessibilityLabel="New book name"
            />
          )}
          {errors.book && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errors.book}
            </Text>
          )}
        </View>
      )}

      {/* Chapter Number */}
      {selectedSubject !== '' && (bookMode === 'new' || selectedBookId !== '') && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Chapter Number</Text>
          <TextInput
            style={[styles.input, errors.chapterNumber ? styles.inputError : undefined]}
            value={chapterNumber}
            onChangeText={(text) => {
              setChapterNumber(text.replace(/[^0-9]/g, ''));
              setErrors((prev) => ({ ...prev, chapterNumber: undefined }));
            }}
            placeholder="1-999"
            placeholderTextColor={'#999999'}
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel="Chapter number"
          />
          {chapters.length > 0 && (
            <Text style={styles.hintText}>
              Auto-suggested: next available number for this book
            </Text>
          )}
          {errors.chapterNumber && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errors.chapterNumber}
            </Text>
          )}
        </View>
      )}

      {/* Chapter Name */}
      {selectedSubject !== '' && (bookMode === 'new' || selectedBookId !== '') && (
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Chapter Name</Text>
          <TextInput
            style={[styles.input, errors.chapterName ? styles.inputError : undefined]}
            value={chapterName}
            onChangeText={(text) => {
              setChapterName(text);
              if (errors.chapterName) {
                const result = validateChapterName(text.trim());
                setErrors((prev) => ({
                  ...prev,
                  chapterName: result.valid ? undefined : result.errors.chapterName,
                }));
              }
            }}
            placeholder="Chapter name (3-100 chars)"
            placeholderTextColor={'#999999'}
            maxLength={100}
            accessibilityLabel="Chapter name"
          />
          {errors.chapterName && (
            <Text style={styles.errorText} accessibilityRole="alert">
              {errors.chapterName}
            </Text>
          )}
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Create chapter"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={'#FFFFFF'} />
        ) : (
          <Text style={styles.submitButtonText}>Create Chapter</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  goldHeader: {
    backgroundColor: '#F7C948',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goldHeaderBack: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  goldHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#777777',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 24,
    textAlign: 'center',
  },
  fieldGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0D8EC',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#333333',
    backgroundColor: '#FFFFFF',
    minHeight: 48,
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  modeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E0D8EC',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#E94F9B',
    borderColor: '#E94F9B',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#777777',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0D8EC',
    marginBottom: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#E94F9B',
    borderColor: '#E94F9B',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#333333',
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    color: '#E74C3C',
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
