/**
 * ChapterCreation — Page for creating a new chapter within a book.
 *
 * Flow: Subject selection → Book selection (existing or new) →
 *       Chapter number (auto-suggested, overridable) → Chapter name.
 *
 * Validates: Requirements 6.1, 6.2, 6.3
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateBookName, validateChapterName } from '@chikumiku/validation';
import { contentApi, type Book, type Chapter } from '../services/api';

/* --- Types --- */

interface FormErrors {
  subject?: string;
  book?: string;
  chapterNumber?: string;
  chapterName?: string;
}

/* --- Component --- */

export function ChapterCreation() {
  const navigate = useNavigate();

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
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(true);

  /* --- Load enrolled subjects on mount --- */

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoadingSubjects(true);
      const enrolled = await contentApi.getEnrolledSubjects();
      if (!cancelled) {
        setSubjects(enrolled);
        setIsLoadingSubjects(false);
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
      const subjectBooks = await contentApi.getBooksForSubject(selectedSubject);
      if (!cancelled) {
        setBooks(subjectBooks);
        setSelectedBookId('');
        setChapters([]);
        setChapterNumber('');
        // If no existing books, default to "new" mode
        if (subjectBooks.length === 0) {
          setBookMode('new');
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedSubject]);

  /* --- Load chapters and auto-suggest next number when book changes --- */

  useEffect(() => {
    if (!selectedBookId) {
      setChapters([]);
      // For a new book, auto-suggest chapter 1
      if (bookMode === 'new' && newBookName.trim().length >= 3) {
        setChapterNumber('1');
      } else if (bookMode === 'new') {
        setChapterNumber('1');
      }
      return;
    }

    let cancelled = false;
    async function load() {
      const bookChapters = await contentApi.getChaptersForBook(selectedBookId);
      if (!cancelled) {
        setChapters(bookChapters);
        // Auto-suggest next sequential chapter number
        const maxNum = bookChapters.reduce(
          (max, ch) => Math.max(max, ch.chapterNumber),
          0,
        );
        setChapterNumber(String(maxNum + 1));
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedBookId, bookMode, newBookName]);

  /* --- Auto-suggest chapter 1 for new books --- */

  useEffect(() => {
    if (bookMode === 'new') {
      setChapterNumber('1');
      setChapters([]);
    }
  }, [bookMode]);

  /* --- Validation helpers --- */

  const validateBookField = useCallback((mode: 'existing' | 'new', bookId: string, name: string): string | undefined => {
    if (mode === 'existing') {
      if (!bookId) return 'Please select a book';
      return undefined;
    }
    // new book
    const trimmed = name.trim();
    if (!trimmed) return 'Book name is required';
    const result = validateBookName(trimmed);
    return result.errors.bookName;
  }, []);

  const validateChapterNumberField = useCallback((value: string): string | undefined => {
    if (!value.trim()) return 'Chapter number is required';
    const num = Number(value);
    if (!Number.isInteger(num) || num < 1 || num > 999) {
      return 'Chapter number must be between 1 and 999';
    }
    return undefined;
  }, []);

  const validateChapterNameField = useCallback((value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return 'Chapter name is required';
    const result = validateChapterName(trimmed);
    return result.errors.chapterName;
  }, []);

  /* --- Handlers --- */

  const handleSubjectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSubject(e.target.value);
    setErrors((prev) => ({ ...prev, subject: undefined }));
    setTouched((prev) => ({ ...prev, subject: true }));
  }, []);

  const handleBookModeChange = useCallback((mode: 'existing' | 'new') => {
    setBookMode(mode);
    setSelectedBookId('');
    setNewBookName('');
    setErrors((prev) => ({ ...prev, book: undefined }));
  }, []);

  const handleBookSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBookId(e.target.value);
    setErrors((prev) => ({ ...prev, book: undefined }));
    setTouched((prev) => ({ ...prev, book: true }));
  }, []);

  const handleNewBookNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewBookName(e.target.value);
    if (touched.book) {
      const error = validateBookField('new', '', e.target.value);
      setErrors((prev) => ({ ...prev, book: error }));
    }
  }, [touched.book, validateBookField]);

  const handleNewBookNameBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, book: true }));
    const error = validateBookField('new', '', newBookName);
    setErrors((prev) => ({ ...prev, book: error }));
  }, [newBookName, validateBookField]);

  const handleChapterNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChapterNumber(e.target.value);
    if (touched.chapterNumber) {
      const error = validateChapterNumberField(e.target.value);
      setErrors((prev) => ({ ...prev, chapterNumber: error }));
    }
  }, [touched.chapterNumber, validateChapterNumberField]);

  const handleChapterNumberBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, chapterNumber: true }));
    const error = validateChapterNumberField(chapterNumber);
    setErrors((prev) => ({ ...prev, chapterNumber: error }));
  }, [chapterNumber, validateChapterNumberField]);

  const handleChapterNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setChapterName(e.target.value);
    if (touched.chapterName) {
      const error = validateChapterNameField(e.target.value);
      setErrors((prev) => ({ ...prev, chapterName: error }));
    }
  }, [touched.chapterName, validateChapterNameField]);

  const handleChapterNameBlur = useCallback(() => {
    setTouched((prev) => ({ ...prev, chapterName: true }));
    const error = validateChapterNameField(chapterName);
    setErrors((prev) => ({ ...prev, chapterName: error }));
  }, [chapterName, validateChapterNameField]);

  /* --- Form submission --- */

  const validateAll = useCallback((): boolean => {
    const newErrors: FormErrors = {};
    let hasError = false;

    if (!selectedSubject) {
      newErrors.subject = 'Please select a subject';
      hasError = true;
    }

    const bookError = validateBookField(bookMode, selectedBookId, newBookName);
    if (bookError) {
      newErrors.book = bookError;
      hasError = true;
    }

    const chNumError = validateChapterNumberField(chapterNumber);
    if (chNumError) {
      newErrors.chapterNumber = chNumError;
      hasError = true;
    }

    const chNameError = validateChapterNameField(chapterName);
    if (chNameError) {
      newErrors.chapterName = chNameError;
      hasError = true;
    }

    setErrors(newErrors);
    setTouched({ subject: true, book: true, chapterNumber: true, chapterName: true });
    return !hasError;
  }, [
    selectedSubject, bookMode, selectedBookId, newBookName,
    chapterNumber, chapterName, validateBookField,
    validateChapterNumberField, validateChapterNameField,
  ]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const bookName = bookMode === 'existing'
        ? books.find((b) => b.id === selectedBookId)?.name || ''
        : newBookName.trim();

      const response = await contentApi.createChapter({
        subjectName: selectedSubject,
        bookName,
        chapterNumber: Number(chapterNumber),
        chapterName: chapterName.trim(),
      });

      if (!response.success) {
        // Requirement 6.3: duplicate chapter number error
        setErrors((prev) => ({ ...prev, chapterNumber: response.error }));
        return;
      }

      // Navigate to page capture screen on success
      navigate(`/learner/chapter/${response.chapterId}/pages`);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateAll, bookMode, books, selectedBookId, newBookName,
    selectedSubject, chapterNumber, chapterName, navigate,
  ]);

  /* --- Render --- */

  if (isLoadingSubjects) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <p>Loading subjects…</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
        Create New Chapter
      </h2>

      <form onSubmit={handleSubmit} noValidate aria-label="Chapter creation form">
        {/* Subject Selection */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <label
            htmlFor="subject"
            style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
          >
            Subject
          </label>
          <select
            id="subject"
            value={selectedSubject}
            onChange={handleSubjectChange}
            aria-invalid={!!errors.subject}
            aria-describedby={errors.subject ? 'subject-error' : undefined}
            style={errors.subject ? { borderColor: 'var(--color-error)' } : undefined}
          >
            <option value="">Select a subject</option>
            {subjects.map((subj) => (
              <option key={subj} value={subj}>{subj}</option>
            ))}
          </select>
          {errors.subject && (
            <p id="subject-error" role="alert" style={errorStyle}>
              {errors.subject}
            </p>
          )}
        </div>

        {/* Book Selection */}
        {selectedSubject && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label
              style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
            >
              Book
            </label>

            {/* Toggle between existing and new */}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
              <button
                type="button"
                onClick={() => handleBookModeChange('existing')}
                style={{
                  ...pillButtonStyle,
                  backgroundColor: bookMode === 'existing' ? 'var(--color-primary)' : 'transparent',
                  color: bookMode === 'existing' ? 'var(--color-white)' : 'var(--color-text-secondary)',
                  border: bookMode === 'existing' ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                }}
                aria-pressed={bookMode === 'existing'}
                disabled={books.length === 0}
              >
                Existing Book
              </button>
              <button
                type="button"
                onClick={() => handleBookModeChange('new')}
                style={{
                  ...pillButtonStyle,
                  backgroundColor: bookMode === 'new' ? 'var(--color-primary)' : 'transparent',
                  color: bookMode === 'new' ? 'var(--color-white)' : 'var(--color-text-secondary)',
                  border: bookMode === 'new' ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                }}
                aria-pressed={bookMode === 'new'}
              >
                New Book
              </button>
            </div>

            {bookMode === 'existing' ? (
              <select
                id="book"
                value={selectedBookId}
                onChange={handleBookSelect}
                aria-invalid={!!errors.book}
                aria-describedby={errors.book ? 'book-error' : undefined}
                style={errors.book ? { borderColor: 'var(--color-error)' } : undefined}
              >
                <option value="">Select a book</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            ) : (
              <input
                id="newBookName"
                type="text"
                value={newBookName}
                onChange={handleNewBookNameChange}
                onBlur={handleNewBookNameBlur}
                placeholder="Book name (3-50 chars, letters, digits, spaces, colons, hyphens)"
                aria-invalid={!!errors.book}
                aria-describedby={errors.book ? 'book-error' : undefined}
                style={errors.book ? { borderColor: 'var(--color-error)' } : undefined}
              />
            )}

            {errors.book && (
              <p id="book-error" role="alert" style={errorStyle}>
                {errors.book}
              </p>
            )}
          </div>
        )}

        {/* Chapter Number */}
        {selectedSubject && (bookMode === 'new' || selectedBookId) && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label
              htmlFor="chapterNumber"
              style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
            >
              Chapter Number
            </label>
            <input
              id="chapterNumber"
              type="number"
              min={1}
              max={999}
              value={chapterNumber}
              onChange={handleChapterNumberChange}
              onBlur={handleChapterNumberBlur}
              placeholder="1-999"
              aria-invalid={!!errors.chapterNumber}
              aria-describedby={errors.chapterNumber ? 'chapterNumber-error' : undefined}
              style={errors.chapterNumber ? { borderColor: 'var(--color-error)' } : undefined}
            />
            {chapters.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                Auto-suggested: next available number for this book
              </p>
            )}
            {errors.chapterNumber && (
              <p id="chapterNumber-error" role="alert" style={errorStyle}>
                {errors.chapterNumber}
              </p>
            )}
          </div>
        )}

        {/* Chapter Name */}
        {selectedSubject && (bookMode === 'new' || selectedBookId) && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label
              htmlFor="chapterName"
              style={{ display: 'block', marginBottom: 'var(--space-xs)', fontWeight: 500 }}
            >
              Chapter Name
            </label>
            <input
              id="chapterName"
              type="text"
              value={chapterName}
              onChange={handleChapterNameChange}
              onBlur={handleChapterNameBlur}
              placeholder="Chapter name (3-100 chars, letters, digits, spaces, colons, hyphens)"
              aria-invalid={!!errors.chapterName}
              aria-describedby={errors.chapterName ? 'chapterName-error' : undefined}
              style={errors.chapterName ? { borderColor: 'var(--color-error)' } : undefined}
            />
            {errors.chapterName && (
              <p id="chapterName-error" role="alert" style={errorStyle}>
                {errors.chapterName}
              </p>
            )}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
          style={{ width: '100%', marginTop: 'var(--space-md)' }}
        >
          {isSubmitting ? 'Creating…' : 'Create Chapter'}
        </button>
      </form>
    </div>
  );
}

/* --- Shared styles --- */

const errorStyle: React.CSSProperties = {
  color: 'var(--color-error)',
  fontSize: '0.875rem',
  marginTop: 'var(--space-xs)',
};

const pillButtonStyle: React.CSSProperties = {
  padding: 'var(--space-sm) var(--space-md)',
  borderRadius: '22px',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
  minHeight: '36px',
};
