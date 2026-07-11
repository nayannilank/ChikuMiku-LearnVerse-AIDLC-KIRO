/**
 * ChapterExplanation — Page-by-page explanation view for a chapter.
 *
 * Displays summary, keywords, and concepts per page.
 * Supports Read (text, default) and Listen (audio playback) modes.
 * Previous/Next navigation with page dots indicator.
 * Error state with Retry button on generation failure.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.8
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from '../theme';

// --- Types ---

type ExplanationStatus = 'ready' | 'loading' | 'error';

interface PageExplanation {
  pageNumber: number;
  status: ExplanationStatus;
  summary: string;
  keywords: string[];
  concepts: string[];
  audioUrl: string;
}

type ExplanationMode = 'read' | 'listen';

// --- Mock Data (Req 9.1) ---

const MOCK_EXPLANATIONS: PageExplanation[] = [
  {
    pageNumber: 1,
    status: 'ready',
    summary:
      'This page introduces the fundamental concepts of the chapter. It explains the core ideas that will be explored in depth throughout the remaining pages. Students are encouraged to read carefully and take notes on the key vocabulary introduced here.',
    keywords: ['introduction', 'fundamentals', 'concepts', 'vocabulary', 'overview'],
    concepts: [
      'Every chapter begins with foundational ideas that connect to prior learning.',
      'Key vocabulary helps learners navigate complex topics.',
      'Active reading improves comprehension and retention.',
    ],
    audioUrl: '',
  },
  {
    pageNumber: 2,
    status: 'ready',
    summary:
      'The second page dives deeper into the main topic, providing examples and detailed explanations. Real-world applications are highlighted to show how theoretical concepts translate into practical use. Diagrams and illustrations support the textual content.',
    keywords: ['examples', 'applications', 'diagrams', 'details', 'theory', 'practice'],
    concepts: [
      'Examples bridge the gap between abstract ideas and concrete understanding.',
      'Visual aids like diagrams enhance memory recall.',
      'Connecting theory to real-world scenarios strengthens learning.',
      'Practice exercises reinforce newly learned material.',
    ],
    audioUrl: '',
  },
  {
    pageNumber: 3,
    status: 'ready',
    summary:
      'Page three presents a summary of the key formulas and rules discussed so far. It serves as a reference page that learners can return to when solving exercises. Important definitions are highlighted in bold for quick access.',
    keywords: ['formulas', 'rules', 'definitions', 'reference', 'summary', 'exercises', 'highlights'],
    concepts: [
      'Reference pages consolidate information for quick review.',
      'Highlighted definitions assist in exam preparation.',
    ],
    audioUrl: '',
  },
  {
    pageNumber: 4,
    status: 'error',
    summary: '',
    keywords: [],
    concepts: [],
    audioUrl: '',
  },
  {
    pageNumber: 5,
    status: 'ready',
    summary:
      'The final page wraps up the chapter with a conclusion and a list of reflection questions. Learners are encouraged to self-assess their understanding before moving on to the exercises. A brief preview of the next chapter is also provided.',
    keywords: ['conclusion', 'reflection', 'self-assessment', 'preview', 'next chapter'],
    concepts: [
      'Self-assessment helps identify areas that need further review.',
      'Reflection questions deepen understanding of core material.',
      'Previewing upcoming content primes the brain for new learning.',
    ],
    audioUrl: '',
  },
];

// --- Component ---

export function ChapterExplanation() {
  const { theme } = useTheme();
  const { id: chapterId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse initial values from query params
  const initialPage = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const initialMode: ExplanationMode = searchParams.get('mode') === 'listen' ? 'listen' : 'read';

  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [mode, setMode] = useState<ExplanationMode>(initialMode);
  const [isLoading, setIsLoading] = useState(true);
  const [explanations, setExplanations] = useState<PageExplanation[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalPages = explanations.length;
  const currentExplanation = explanations[currentPage - 1] || null;

  // Simulate initial loading (Req 9.1 — generation delay mock)
  useEffect(() => {
    const timer = setTimeout(() => {
      setExplanations(MOCK_EXPLANATIONS);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Sync query params when page or mode changes
  useEffect(() => {
    const params: Record<string, string> = { page: String(currentPage) };
    if (mode === 'listen') {
      params.mode = 'listen';
    }
    setSearchParams(params, { replace: true });
  }, [currentPage, mode, setSearchParams]);

  // Stop audio when switching to Read mode (Req 9.4)
  const handleModeChange = useCallback((newMode: ExplanationMode) => {
    if (newMode === 'read' && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
    setMode(newMode);
  }, []);

  // Navigation (Req 9.5)
  const handlePrevious = useCallback(() => {
    if (currentPage > 1) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
      setCurrentPage((p) => p - 1);
    }
  }, [currentPage]);

  const handleNext = useCallback(() => {
    if (currentPage < totalPages) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
      setCurrentPage((p) => p + 1);
    }
  }, [currentPage, totalPages]);

  // Audio controls (Req 9.4)
  const handlePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {
        // Audio play may fail if no source
      });
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Number(e.target.value);
  }, []);

  // Retry failed explanation (Req 9.8)
  const handleRetry = useCallback(() => {
    if (!currentExplanation) return;
    // Simulate retry: set to loading, then resolve after delay
    setExplanations((prev) =>
      prev.map((p) =>
        p.pageNumber === currentPage ? { ...p, status: 'loading' as ExplanationStatus } : p
      )
    );
    setTimeout(() => {
      setExplanations((prev) =>
        prev.map((p) =>
          p.pageNumber === currentPage
            ? {
                ...p,
                status: 'ready' as ExplanationStatus,
                summary:
                  'This page explanation was successfully regenerated after a retry. The content covers key ideas from this section of the chapter.',
                keywords: ['retry', 'success', 'regenerated'],
                concepts: ['Retrying failed operations can resolve transient errors.'],
                audioUrl: '',
              }
            : p
        )
      );
    }, 1000);
  }, [currentExplanation, currentPage]);

  // --- Styles ---

  const styles = {
    container: {
      maxWidth: '720px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: theme.spacing.lg,
    },
    title: {
      margin: 0,
      fontSize: '1.25rem',
      color: theme.colors.textPrimary,
    },
    subtitle: {
      margin: `${theme.spacing.xs} 0 0`,
      fontSize: '0.875rem',
      color: theme.colors.textMuted,
    },
    toggleContainer: {
      display: 'flex',
      gap: '0',
      border: `2px solid ${theme.colors.primary}`,
      borderRadius: theme.radii.button,
      overflow: 'hidden',
    },
    toggleButton: (active: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: active ? theme.colors.primary : theme.colors.white,
      color: active ? theme.colors.white : theme.colors.primary,
      minHeight: '40px',
      transition: 'background 0.2s, color 0.2s',
    }),
    card: {
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      border: `1px solid ${theme.colors.border}`,
      marginBottom: theme.spacing.lg,
      minHeight: '300px',
    },
    sectionTitle: {
      fontSize: '0.75rem',
      fontWeight: theme.typography.weight.semibold,
      color: theme.colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      marginBottom: theme.spacing.sm,
    },
    summary: {
      fontSize: '1rem',
      lineHeight: 1.6,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    keywordsContainer: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    keyword: {
      background: theme.colors.background,
      color: theme.colors.secondary,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      borderRadius: theme.radii.badge,
      fontSize: '0.8125rem',
      fontWeight: theme.typography.weight.medium,
    },
    conceptItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      fontSize: '0.9375rem',
      lineHeight: 1.5,
      color: theme.colors.textPrimary,
    },
    conceptBullet: {
      flexShrink: 0,
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: theme.colors.accent,
      marginTop: '6px',
    },
    navigation: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    navButton: (disabled: boolean) => ({
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: disabled ? theme.colors.border : theme.colors.primary,
      color: disabled ? theme.colors.textMuted : theme.colors.white,
      opacity: disabled ? 0.6 : 1,
      minHeight: '44px',
      transition: 'background 0.2s, opacity 0.2s',
    }),
    dots: {
      display: 'flex',
      gap: theme.spacing.sm,
      alignItems: 'center',
    },
    dot: (active: boolean) => ({
      width: active ? '12px' : '8px',
      height: active ? '12px' : '8px',
      borderRadius: '50%',
      background: active ? theme.colors.primary : theme.colors.border,
      transition: 'all 0.2s',
    }),
    audioControls: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing.md,
      padding: theme.spacing.md,
      background: theme.colors.background,
      borderRadius: theme.radii.card,
      marginBottom: theme.spacing.lg,
    },
    playButton: {
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      background: theme.colors.primary,
      color: theme.colors.white,
      fontSize: '1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    seekBar: {
      flex: 1,
      height: '4px',
      cursor: 'pointer',
      accentColor: theme.colors.primary,
    },
    errorContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center' as const,
      padding: theme.spacing.xl,
      minHeight: '200px',
    },
    errorIcon: {
      fontSize: '2.5rem',
      marginBottom: theme.spacing.md,
    },
    errorMessage: {
      color: theme.colors.error,
      fontSize: '1rem',
      fontWeight: theme.typography.weight.medium,
      marginBottom: theme.spacing.md,
    },
    retryButton: {
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      borderRadius: theme.radii.button,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      background: theme.colors.error,
      color: theme.colors.white,
      minHeight: '44px',
    },
    loadingContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '300px',
      color: theme.colors.textMuted,
    },
  };

  // --- Loading State ---

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loadingContainer}>
            <p>Generating explanations for chapter…</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Content ---

  function renderContent() {
    if (!currentExplanation) return null;

    // Loading state for individual page retry
    if (currentExplanation.status === 'loading') {
      return (
        <div style={styles.loadingContainer}>
          <p>Regenerating explanation…</p>
        </div>
      );
    }

    // Error state (Req 9.8)
    if (currentExplanation.status === 'error') {
      return (
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon} aria-hidden="true">⚠️</div>
          <p style={styles.errorMessage}>
            Failed to generate explanation for this page.
          </p>
          <button
            style={styles.retryButton}
            onClick={handleRetry}
            aria-label="Retry explanation generation"
          >
            Retry
          </button>
        </div>
      );
    }

    // Listen mode (Req 9.4)
    if (mode === 'listen') {
      return (
        <div>
          <div style={styles.audioControls}>
            <button
              style={styles.playButton}
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              defaultValue={0}
              style={styles.seekBar}
              onChange={handleSeek}
              aria-label="Seek audio"
            />
            <audio
              ref={audioRef}
              src={currentExplanation.audioUrl || undefined}
              onEnded={() => setIsPlaying(false)}
            />
          </div>
          {/* Also show text content below audio in listen mode */}
          {renderTextContent()}
        </div>
      );
    }

    // Read mode (Req 9.3)
    return renderTextContent();
  }

  function renderTextContent() {
    if (!currentExplanation || currentExplanation.status !== 'ready') return null;

    return (
      <div>
        {/* Summary */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h3 style={styles.sectionTitle}>Summary</h3>
          <p style={styles.summary}>{currentExplanation.summary}</p>
        </div>

        {/* Keywords (Req 9.1) */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h3 style={styles.sectionTitle}>Keywords</h3>
          <div style={styles.keywordsContainer}>
            {currentExplanation.keywords.map((kw) => (
              <span key={kw} style={styles.keyword}>
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* Concepts (Req 9.1) */}
        <div>
          <h3 style={styles.sectionTitle}>Concepts</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {currentExplanation.concepts.map((concept, idx) => (
              <li key={idx} style={styles.conceptItem}>
                <span style={styles.conceptBullet} aria-hidden="true" />
                <span>{concept}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header with mode toggle */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Chapter Explanation</h1>
          <p style={styles.subtitle}>
            Chapter {chapterId} — Page {currentPage} of {totalPages}
          </p>
        </div>

        {/* Read/Listen Toggle (Req 9.2) */}
        <div style={styles.toggleContainer} role="radiogroup" aria-label="Explanation mode">
          <button
            style={styles.toggleButton(mode === 'read')}
            onClick={() => handleModeChange('read')}
            role="radio"
            aria-checked={mode === 'read'}
            aria-label="Read mode"
          >
            📖 Read
          </button>
          <button
            style={styles.toggleButton(mode === 'listen')}
            onClick={() => handleModeChange('listen')}
            role="radio"
            aria-checked={mode === 'listen'}
            aria-label="Listen mode"
          >
            🔊 Listen
          </button>
        </div>
      </div>

      {/* Main Content Card */}
      <div style={styles.card}>
        {renderContent()}
      </div>

      {/* Page Navigation (Req 9.5) */}
      <nav style={styles.navigation} aria-label="Page navigation">
        <button
          style={styles.navButton(currentPage <= 1)}
          onClick={handlePrevious}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          ← Previous
        </button>

        {/* Page dots */}
        <div style={styles.dots} aria-label={`Page ${currentPage} of ${totalPages}`}>
          {explanations.map((_, idx) => (
            <span
              key={idx}
              style={styles.dot(idx + 1 === currentPage)}
              aria-hidden="true"
            />
          ))}
        </div>

        <button
          style={styles.navButton(currentPage >= totalPages)}
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          Next →
        </button>
      </nav>
    </div>
  );
}
