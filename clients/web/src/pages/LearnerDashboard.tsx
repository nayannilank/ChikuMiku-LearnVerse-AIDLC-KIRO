/**
 * LearnerDashboard — Full learner dashboard with tree navigation and chapter details.
 *
 * Left panel: Subject → Book → Chapter → Exercise → Quizzes tree with completion %.
 * Right panel: chapter details, stats cards, progress bar, action buttons.
 * Empty state: tree visible, right panel shows guidance message.
 * Displays current streak count (Req 5.4).
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 5.4
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme';

// --- Mock Data Types ---

interface Quiz {
  id: string;
  name: string;
  completed: boolean;
}

interface Exercise {
  id: string;
  name: string;
  totalQuestions: number;
  answeredQuestions: number;
  quizzes: Quiz[];
}

interface Chapter {
  id: string;
  name: string;
  totalContentPages: number;
  pagesRead: number;
  lastReadPage: number;
  exercise: Exercise;
}

interface Book {
  id: string;
  name: string;
  chapters: Chapter[];
}

interface Subject {
  id: string;
  name: string;
  books: Book[];
}

// --- Mock Data (Req 15.1) ---

const MOCK_SUBJECTS: Subject[] = [
  {
    id: 'sub-1',
    name: 'Hindi',
    books: [
      {
        id: 'book-1',
        name: 'Hindi Primer',
        chapters: [
          {
            id: 'ch-1',
            name: 'Introduction to Hindi',
            totalContentPages: 10,
            pagesRead: 7,
            lastReadPage: 7,
            exercise: {
              id: 'ex-1',
              name: 'Chapter 1 Exercise',
              totalQuestions: 5,
              answeredQuestions: 3,
              quizzes: [
                { id: 'q-1', name: 'Quiz 1', completed: true },
                { id: 'q-2', name: 'Quiz 2', completed: false },
              ],
            },
          },
          {
            id: 'ch-2',
            name: 'Hindi Alphabets',
            totalContentPages: 15,
            pagesRead: 15,
            lastReadPage: 15,
            exercise: {
              id: 'ex-2',
              name: 'Chapter 2 Exercise',
              totalQuestions: 8,
              answeredQuestions: 8,
              quizzes: [
                { id: 'q-3', name: 'Quiz 1', completed: true },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'sub-2',
    name: 'Computers',
    books: [
      {
        id: 'book-2',
        name: 'Introduction to Computers',
        chapters: [
          {
            id: 'ch-3',
            name: 'What is a Computer?',
            totalContentPages: 12,
            pagesRead: 0,
            lastReadPage: 0,
            exercise: {
              id: 'ex-3',
              name: 'Chapter 1 Exercise',
              totalQuestions: 6,
              answeredQuestions: 0,
              quizzes: [],
            },
          },
        ],
      },
    ],
  },
  {
    id: 'sub-3',
    name: 'EVS',
    books: [],
  },
];

// Mock streak count (Req 5.4)
const MOCK_STREAK_COUNT = 5;

// --- Helper: round-based completion (Req 15.1) ---

function chapterCompletion(chapter: Chapter): number {
  if (chapter.totalContentPages === 0) return 0;
  return Math.round((chapter.pagesRead / chapter.totalContentPages) * 100);
}

function exerciseCompletion(exercise: Exercise): number {
  if (exercise.totalQuestions === 0) return 0;
  return Math.round((exercise.answeredQuestions / exercise.totalQuestions) * 100);
}

// --- Tree Node State ---

interface TreeNodeState {
  [key: string]: boolean;
}

// --- Component ---

export function LearnerDashboard() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [selectedChapter, setSelectedChapter] = useState<{
    chapter: Chapter;
    bookName: string;
    subjectName: string;
  } | null>(null);

  const [expandedNodes, setExpandedNodes] = useState<TreeNodeState>({});
  const [streakCount] = useState(MOCK_STREAK_COUNT);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }, []);

  const handleChapterClick = useCallback(
    (chapter: Chapter, bookName: string, subjectName: string) => {
      setSelectedChapter({ chapter, bookName, subjectName });
    },
    []
  );

  // Action button handlers (Req 15.3, 15.4, 15.5)
  const handleContinueReading = useCallback(() => {
    if (!selectedChapter) return;
    const page = selectedChapter.chapter.lastReadPage || 1;
    navigate(`/learner/chapter/${selectedChapter.chapter.id}/explanation?page=${page}`);
  }, [selectedChapter, navigate]);

  const handleTakeExercise = useCallback(() => {
    if (!selectedChapter) return;
    navigate(`/learner/chapter/${selectedChapter.chapter.id}/exercise`);
  }, [selectedChapter, navigate]);

  const handleListen = useCallback(() => {
    if (!selectedChapter) return;
    const page = selectedChapter.chapter.lastReadPage || 1;
    navigate(`/learner/chapter/${selectedChapter.chapter.id}/explanation?mode=listen&page=${page}`);
  }, [selectedChapter, navigate]);

  // --- Styles ---

  const styles = {
    container: {
      display: 'flex',
      gap: theme.spacing.md,
      minHeight: '70vh',
      flexDirection: 'row' as const,
    },
    leftPanel: {
      width: '320px',
      minWidth: '280px',
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      border: `1px solid ${theme.colors.border}`,
      overflowY: 'auto' as const,
      maxHeight: '75vh',
    },
    rightPanel: {
      flex: 1,
      background: theme.colors.white,
      borderRadius: theme.radii.card,
      padding: theme.spacing.lg,
      border: `1px solid ${theme.colors.border}`,
    },
    streakBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing.sm,
      background: theme.colors.warning,
      color: theme.colors.dark,
      borderRadius: theme.radii.badge,
      padding: `${theme.spacing.xs} ${theme.spacing.md}`,
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      marginBottom: theme.spacing.md,
    },
    treeItem: {
      cursor: 'pointer',
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      borderRadius: theme.radii.small,
      fontSize: '0.875rem',
      lineHeight: '1.5',
    },
    treeItemHover: {
      background: theme.colors.background,
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    statCard: {
      background: theme.colors.background,
      borderRadius: theme.radii.card,
      padding: theme.spacing.md,
      textAlign: 'center' as const,
    },
    statValue: {
      fontSize: '1.5rem',
      fontWeight: theme.typography.weight.bold,
      color: theme.colors.primary,
    },
    statLabel: {
      fontSize: '0.75rem',
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    progressBarContainer: {
      width: '100%',
      height: '12px',
      background: theme.colors.border,
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: theme.spacing.lg,
    },
    actionButtons: {
      display: 'flex',
      gap: theme.spacing.md,
      flexWrap: 'wrap' as const,
    },
    pillButton: {
      borderRadius: theme.radii.button,
      padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
      border: 'none',
      cursor: 'pointer',
      fontWeight: theme.typography.weight.semibold,
      fontSize: '0.875rem',
      minHeight: '48px',
    },
  };

  // --- Render Tree (Req 15.1) ---

  function renderTree() {
    return (
      <nav aria-label="Course navigation tree" role="tree">
        {MOCK_SUBJECTS.map((subject) => (
          <div key={subject.id} role="treeitem" aria-expanded={!!expandedNodes[subject.id]}>
            <div
              style={{
                ...styles.treeItem,
                fontWeight: theme.typography.weight.semibold,
                color: theme.colors.textPrimary,
              }}
              onClick={() => toggleNode(subject.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleNode(subject.id); }}
              tabIndex={0}
              role="button"
              aria-label={`Subject: ${subject.name}`}
            >
              {expandedNodes[subject.id] ? '▾' : '▸'} {subject.name}
            </div>

            {expandedNodes[subject.id] && (
              <div style={{ paddingLeft: theme.spacing.md }} role="group">
                {subject.books.length === 0 && (
                  <div style={{ ...styles.treeItem, color: theme.colors.textMuted, fontStyle: 'italic' }}>
                    No books added yet
                  </div>
                )}
                {subject.books.map((book) => (
                  <div key={book.id} role="treeitem" aria-expanded={!!expandedNodes[book.id]}>
                    <div
                      style={{
                        ...styles.treeItem,
                        fontWeight: theme.typography.weight.medium,
                        color: theme.colors.textSecondary,
                      }}
                      onClick={() => toggleNode(book.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleNode(book.id); }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Book: ${book.name}`}
                    >
                      {expandedNodes[book.id] ? '▾' : '▸'} 📖 {book.name}
                    </div>

                    {expandedNodes[book.id] && (
                      <div style={{ paddingLeft: theme.spacing.md }} role="group">
                        {book.chapters.map((chapter) => {
                          const chapCompletion = chapterCompletion(chapter);
                          const exCompletion = exerciseCompletion(chapter.exercise);
                          const isSelected = selectedChapter?.chapter.id === chapter.id;

                          return (
                            <div key={chapter.id} role="treeitem" aria-expanded={!!expandedNodes[chapter.id]}>
                              <div
                                style={{
                                  ...styles.treeItem,
                                  fontWeight: isSelected ? theme.typography.weight.semibold : theme.typography.weight.regular,
                                  color: isSelected ? theme.colors.primary : theme.colors.textPrimary,
                                  background: isSelected ? theme.colors.background : 'transparent',
                                }}
                                onClick={() => {
                                  handleChapterClick(chapter, book.name, subject.name);
                                  toggleNode(chapter.id);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    handleChapterClick(chapter, book.name, subject.name);
                                    toggleNode(chapter.id);
                                  }
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Chapter: ${chapter.name}, ${chapCompletion}% complete`}
                              >
                                {expandedNodes[chapter.id] ? '▾' : '▸'} 📄 {chapter.name}
                                <span style={{ marginLeft: theme.spacing.sm, fontSize: '0.75rem', color: theme.colors.textMuted }}>
                                  {chapCompletion}%
                                </span>
                              </div>

                              {expandedNodes[chapter.id] && (
                                <div style={{ paddingLeft: theme.spacing.md }} role="group">
                                  {/* Exercise node */}
                                  <div
                                    role="treeitem"
                                    aria-expanded={!!expandedNodes[chapter.exercise.id]}
                                  >
                                    <div
                                      style={{
                                        ...styles.treeItem,
                                        color: theme.colors.textSecondary,
                                      }}
                                      onClick={() => toggleNode(chapter.exercise.id)}
                                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleNode(chapter.exercise.id); }}
                                      tabIndex={0}
                                      role="button"
                                      aria-label={`Exercise: ${chapter.exercise.name}, ${exCompletion}% complete`}
                                    >
                                      {expandedNodes[chapter.exercise.id] ? '▾' : '▸'} ✏️ {chapter.exercise.name}
                                      <span style={{ marginLeft: theme.spacing.sm, fontSize: '0.75rem', color: theme.colors.textMuted }}>
                                        {exCompletion}%
                                      </span>
                                    </div>

                                    {/* Quizzes */}
                                    {expandedNodes[chapter.exercise.id] && (
                                      <div style={{ paddingLeft: theme.spacing.md }} role="group">
                                        {chapter.exercise.quizzes.length === 0 && (
                                          <div style={{ ...styles.treeItem, color: theme.colors.textMuted, fontStyle: 'italic' }}>
                                            No quizzes
                                          </div>
                                        )}
                                        {chapter.exercise.quizzes.map((quiz) => (
                                          <div
                                            key={quiz.id}
                                            style={{
                                              ...styles.treeItem,
                                              color: quiz.completed ? theme.colors.success : theme.colors.textSecondary,
                                            }}
                                            role="treeitem"
                                          >
                                            {quiz.completed ? '✅' : '⬜'} {quiz.name}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
    );
  }

  // --- Render Right Panel (Req 15.2, 15.6) ---

  function renderRightPanel() {
    if (!selectedChapter) {
      // Empty state (Req 15.6)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center' }}>
          <p style={{ fontSize: '1.25rem', color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
            No chapter selected
          </p>
          <p style={{ color: theme.colors.textMuted }}>
            Select a chapter from the navigation tree to view details and start learning. If no chapters are available, ask your parent to add content.
          </p>
        </div>
      );
    }

    const { chapter, bookName, subjectName } = selectedChapter;
    const readPercent = chapterCompletion(chapter);
    const exPercent = exerciseCompletion(chapter.exercise);
    const pagesDone = chapter.pagesRead;
    const pagesLeft = chapter.totalContentPages - chapter.pagesRead;

    return (
      <div>
        {/* Chapter details (Req 15.2) */}
        <div style={{ marginBottom: theme.spacing.lg }}>
          <h2 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: '1.5rem' }}>
            {chapter.name}
          </h2>
          <p style={{ margin: `${theme.spacing.xs} 0 0`, color: theme.colors.textSecondary, fontSize: '0.875rem' }}>
            {bookName} • {subjectName}
          </p>
        </div>

        {/* Stats cards (Req 15.2) */}
        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{readPercent}%</div>
            <div style={styles.statLabel}>Read</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{exPercent}%</div>
            <div style={styles.statLabel}>Exercise</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{pagesDone}</div>
            <div style={styles.statLabel}>Pages Done</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{pagesLeft}</div>
            <div style={styles.statLabel}>Pages Left</div>
          </div>
        </div>

        {/* Progress bar reflecting Read % (Req 15.2) */}
        <div style={{ marginBottom: theme.spacing.sm }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: theme.spacing.xs }}>
            <span style={{ fontSize: '0.75rem', color: theme.colors.textSecondary }}>Reading Progress</span>
            <span style={{ fontSize: '0.75rem', color: theme.colors.textSecondary }}>{readPercent}%</span>
          </div>
          <div style={styles.progressBarContainer} role="progressbar" aria-valuenow={readPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Reading progress">
            <div
              style={{
                width: `${readPercent}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                borderRadius: '6px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Action buttons (Req 15.3, 15.4, 15.5) */}
        <div style={styles.actionButtons}>
          <button
            style={{
              ...styles.pillButton,
              background: theme.colors.primary,
              color: theme.colors.white,
            }}
            onClick={handleContinueReading}
            aria-label="Continue Reading"
          >
            📖 Continue Reading
          </button>
          <button
            style={{
              ...styles.pillButton,
              background: theme.colors.secondary,
              color: theme.colors.white,
            }}
            onClick={handleTakeExercise}
            aria-label="Take Exercise"
          >
            ✏️ Take Exercise
          </button>
          <button
            style={{
              ...styles.pillButton,
              background: theme.colors.accent,
              color: theme.colors.white,
            }}
            onClick={handleListen}
            aria-label="Listen"
          >
            🔊 Listen
          </button>
        </div>
      </div>
    );
  }

  // --- Main Render ---

  return (
    <div>
      {/* Header with streak (Req 5.4) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <h1 style={{ margin: 0, color: theme.colors.textPrimary, fontSize: '1.5rem' }}>
          My Learning
        </h1>
        <div style={styles.streakBadge} aria-label={`Current streak: ${streakCount} days`}>
          🔥 {streakCount} day streak
        </div>
      </div>

      {/* Two-panel layout */}
      <div style={styles.container}>
        {/* Left panel: tree navigation (Req 15.1) */}
        <aside style={styles.leftPanel} aria-label="Course navigation">
          <h2 style={{ margin: `0 0 ${theme.spacing.md}`, fontSize: '1rem', color: theme.colors.textPrimary }}>
            My Subjects
          </h2>
          {renderTree()}
        </aside>

        {/* Right panel: chapter details or empty state (Req 15.2, 15.6) */}
        <section style={styles.rightPanel} aria-label="Chapter details">
          {renderRightPanel()}
        </section>
      </div>
    </div>
  );
}
