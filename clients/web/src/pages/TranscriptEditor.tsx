/**
 * TranscriptEditor — Displays OCR results page-by-page, allows editing, and saves transcript.
 *
 * - Pages organized by classification: Content Pages and Exercise Pages (Req 8.4)
 * - Editable textareas per page for transcript editing before save (Req 8.5)
 * - Save button: atomic persist, verify, success confirmation (Req 8.6)
 * - Save blocked if any page is unprocessed (Req 8.6)
 *
 * Validates: Requirements 8.4, 8.5, 8.6
 */
import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../theme';
import { contentApi } from '../services/api';

// --- Types ---

type PageStatus = 'success' | 'pending' | 'failed';
type PageClassification = 'content' | 'exercise';

interface TranscriptPage {
  pageNumber: number;
  classification: PageClassification;
  text: string;
  language: string;
  status: PageStatus;
}

// --- Mock OCR Result Data ---

function getMockOcrPages(chapterId: string): TranscriptPage[] {
  // Generate mock OCR results for the chapter
  void chapterId; // used for future API integration
  return [
    {
      pageNumber: 1,
      classification: 'content',
      text: 'Chapter 1: Introduction to Nouns\n\nA noun is a word that represents a person, place, thing, or idea. Nouns are one of the most fundamental parts of speech in English grammar.\n\nExamples: cat, Mumbai, happiness, teacher',
      language: 'English',
      status: 'success',
    },
    {
      pageNumber: 2,
      classification: 'content',
      text: 'Types of Nouns:\n\n1. Common Nouns - general names (city, dog, book)\n2. Proper Nouns - specific names (Delhi, Rex, Harry Potter)\n3. Abstract Nouns - ideas or concepts (love, freedom, courage)\n4. Collective Nouns - groups (flock, team, family)',
      language: 'English',
      status: 'success',
    },
    {
      pageNumber: 3,
      classification: 'content',
      text: 'Countable and Uncountable Nouns:\n\nCountable nouns can be counted (one apple, two apples).\nUncountable nouns cannot be counted individually (water, rice, information).\n\nRemember: Uncountable nouns do not have a plural form.',
      language: 'English',
      status: 'success',
    },
    {
      pageNumber: 4,
      classification: 'exercise',
      text: 'Exercise 1: Identify the Nouns\n\nUnderline all the nouns in the following sentences:\n\n1. The cat sat on the mat.\n2. Mumbai is a beautiful city.\n3. Happiness comes from within.\n4. The team won the championship.',
      language: 'English',
      status: 'success',
    },
    {
      pageNumber: 5,
      classification: 'exercise',
      text: 'Exercise 2: Classify the Nouns\n\nClassify each noun as Common, Proper, Abstract, or Collective:\n\n1. army ___\n2. London ___\n3. kindness ___\n4. river ___\n5. Microsoft ___',
      language: 'English',
      status: 'success',
    },
  ];
}

// --- Component ---

export function TranscriptEditor() {
  const { id: chapterId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [pages, setPages] = useState<TranscriptPage[]>(() =>
    getMockOcrPages(chapterId ?? '')
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check if any page is unprocessed (pending or failed)
  const hasUnprocessedPages = pages.some(
    (p) => p.status === 'pending' || p.status === 'failed'
  );

  // Separate pages by classification (Req 8.4)
  const contentPages = pages.filter((p) => p.classification === 'content');
  const exercisePages = pages.filter((p) => p.classification === 'exercise');

  // Handle text editing (Req 8.5)
  const handleTextChange = useCallback(
    (pageNumber: number, newText: string) => {
      setPages((prev) =>
        prev.map((p) =>
          p.pageNumber === pageNumber ? { ...p, text: newText } : p
        )
      );
    },
    []
  );

  // Handle save (Req 8.6)
  const handleSave = useCallback(async () => {
    if (hasUnprocessedPages || !chapterId) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const result = await contentApi.saveTranscript(chapterId, pages);
      if (result.success) {
        setSaveSuccess(true);
        // Navigate to dashboard after brief delay to show confirmation
        setTimeout(() => {
          navigate('/learner/dashboard');
        }, 2000);
      } else {
        setSaveError(result.error ?? 'Failed to save transcript.');
      }
    } catch {
      setSaveError('An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  }, [hasUnprocessedPages, chapterId, pages, navigate]);

  // --- Styles ---

  const styles = {
    container: {
      maxWidth: '960px',
      margin: '0 auto',
      padding: theme.spacing.md,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
      flexWrap: 'wrap' as const,
      gap: theme.spacing.md,
    },
    title: {
      margin: 0,
      color: theme.colors.textPrimary,
      fontSize: '1.5rem',
      fontWeight: theme.typography.weight.bold,
    },
    subtitle: {
      margin: `${theme.spacing.xs} 0 0`,
      color: theme.colors.textSecondary,
      fontSize: '0.875rem',
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: '1.125rem',
      fontWeight: theme.typography.weight.semibold,
      marginBottom: theme.spacing.md,
      marginTop: theme.spacing.lg,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    pageCard: {
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      border: `1px solid ${theme.colors.border}`,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    pageMarker: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.sm,
    },
    pageLabel: {
      fontWeight: theme.typography.weight.semibold,
      color: theme.colors.textPrimary,
      fontSize: '0.875rem',
    },
    languageBadge: {
      fontSize: '0.75rem',
      color: theme.colors.textMuted,
      background: theme.colors.background,
      borderRadius: theme.radii.badge,
      padding: `2px ${theme.spacing.sm}`,
    },
    statusIndicator: {
      fontSize: '0.75rem',
      padding: `2px ${theme.spacing.sm}`,
      borderRadius: theme.radii.badge,
      fontWeight: theme.typography.weight.medium,
    },
    textarea: {
      width: '100%',
      minHeight: '120px',
      padding: theme.spacing.sm,
      borderRadius: theme.radii.input,
      border: `1px solid ${theme.colors.border}`,
      fontFamily: theme.typography.fontFamily,
      fontSize: '0.875rem',
      lineHeight: '1.5',
      resize: 'vertical' as const,
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as const,
    },
    saveButton: {
      borderRadius: theme.radii.button,
      padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '1rem',
      minHeight: '48px',
      color: theme.colors.white,
      background: theme.colors.primary,
      opacity: 1,
      transition: 'opacity 0.2s',
    },
    saveButtonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    successMessage: {
      background: theme.colors.success,
      color: theme.colors.white,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      fontSize: '0.875rem',
      fontWeight: theme.typography.weight.medium,
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    errorMessage: {
      background: theme.colors.error,
      color: theme.colors.white,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      fontSize: '0.875rem',
      fontWeight: theme.typography.weight.medium,
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    warningBanner: {
      background: `${theme.colors.warning}20`,
      border: `1px solid ${theme.colors.warning}`,
      borderRadius: theme.radii.input,
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      fontSize: '0.875rem',
      color: theme.colors.dark,
      marginBottom: theme.spacing.md,
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
  };

  // --- Status helpers ---

  function getStatusStyle(status: PageStatus): React.CSSProperties {
    switch (status) {
      case 'success':
        return {
          ...styles.statusIndicator,
          background: `${theme.colors.success}20`,
          color: theme.colors.success,
        };
      case 'pending':
        return {
          ...styles.statusIndicator,
          background: `${theme.colors.warning}20`,
          color: theme.colors.warning,
        };
      case 'failed':
        return {
          ...styles.statusIndicator,
          background: `${theme.colors.error}20`,
          color: theme.colors.error,
        };
    }
  }

  function getStatusLabel(status: PageStatus): string {
    switch (status) {
      case 'success':
        return '✓ Processed';
      case 'pending':
        return '⏳ Pending';
      case 'failed':
        return '✗ Failed';
    }
  }

  // --- Render page card ---

  function renderPageCard(page: TranscriptPage) {
    return (
      <div key={page.pageNumber} style={styles.pageCard}>
        <div style={styles.pageMarker}>
          <span style={styles.pageLabel}>Page {page.pageNumber}</span>
          <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
            <span style={styles.languageBadge}>{page.language}</span>
            <span style={getStatusStyle(page.status)}>
              {getStatusLabel(page.status)}
            </span>
          </div>
        </div>
        <textarea
          style={styles.textarea}
          value={page.text}
          onChange={(e) => handleTextChange(page.pageNumber, e.target.value)}
          aria-label={`Transcript text for page ${page.pageNumber}`}
          disabled={page.status !== 'success'}
        />
      </div>
    );
  }

  // --- Main Render ---

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Transcript Editor</h1>
          <p style={styles.subtitle}>
            Chapter ID: {chapterId ?? 'unknown'} • {pages.length} pages total
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
          {saveSuccess && (
            <span style={styles.successMessage}>
              ✓ Chapter saved successfully!
            </span>
          )}
          {saveError && (
            <span style={styles.errorMessage}>
              ✗ {saveError}
            </span>
          )}
          <button
            style={{
              ...styles.saveButton,
              ...(hasUnprocessedPages || isSaving ? styles.saveButtonDisabled : {}),
            }}
            onClick={handleSave}
            disabled={hasUnprocessedPages || isSaving}
            aria-label="Save transcript"
          >
            {isSaving ? 'Saving...' : 'Save Transcript'}
          </button>
        </div>
      </div>

      {/* Warning if unprocessed pages */}
      {hasUnprocessedPages && (
        <div style={styles.warningBanner} role="alert">
          ⚠️ Some pages have not been successfully processed. Save is disabled until all pages are processed.
        </div>
      )}

      {/* Content Pages Section (Req 8.4) */}
      {contentPages.length > 0 && (
        <section>
          <h2 style={styles.sectionTitle}>
            📖 Content Pages ({contentPages.length})
          </h2>
          {contentPages.map(renderPageCard)}
        </section>
      )}

      {/* Exercise Pages Section (Req 8.4) */}
      {exercisePages.length > 0 && (
        <section>
          <h2 style={styles.sectionTitle}>
            ✏️ Exercise Pages ({exercisePages.length})
          </h2>
          {exercisePages.map(renderPageCard)}
        </section>
      )}
    </div>
  );
}
