/**
 * ContentManager — Browse and manage a learner's content.
 *
 * Three-column flow for a single learner (identified by ?learnerId=):
 *   Subjects (sidebar) → Books (middle) → Chapters (right)
 * with inline actions to add a book, create a chapter, and edit a chapter.
 *
 * Content is always scoped to one learner. Either a parent or the learner can
 * manage it; the caller passes the learnerId in the query string.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { contentApi } from '../../services/contentApi';
import type { Subject, Book, Chapter } from '../../services/contentApi';

export function ContentManager() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const learnerId = searchParams.get('learnerId') ?? '';
  const learnerName = searchParams.get('learnerName') ?? '';

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  // Per-chapter page counts (content + exercise), keyed by chapter id, so the
  // chapter cards can show how many pages have actually been uploaded.
  const [pageCounts, setPageCounts] = useState<Record<string, number>>({});
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [error, setError] = useState('');

  // Add-book inline form state.
  const [newBookName, setNewBookName] = useState('');

  // Optional deep-link selection: when returning from the capture flow, the
  // URL carries the subject/book that was just worked on so we can restore it.
  const initialSubjectId = searchParams.get('subjectId') ?? '';
  const initialBookId = searchParams.get('bookId') ?? '';

  // Load subjects on mount, and restore any deep-linked subject → book → chapters.
  useEffect(() => {
    if (!learnerId) {
      setError('No learner selected. Open content management from a learner.');
      setLoadingSubjects(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const subjs = await contentApi.getEnrolledSubjects(learnerId);
        if (cancelled) return;
        setSubjects(subjs);
        setLoadingSubjects(false);

        // Restore the deep-linked subject (and book) if present.
        const subject = initialSubjectId ? subjs.find((s) => s.id === initialSubjectId) : undefined;
        if (!subject) return;
        setSelectedSubject(subject);
        setLoadingBooks(true);
        const subjectBooks = await contentApi.getBooksForSubject(subject.id, learnerId);
        if (cancelled) return;
        setBooks(subjectBooks);
        setLoadingBooks(false);

        const book = initialBookId ? subjectBooks.find((b) => b.id === initialBookId) : undefined;
        if (!book) return;
        setSelectedBook(book);
        setLoadingChapters(true);
        const bookChapters = await contentApi.getChaptersForBook(book.id);
        if (cancelled) return;
        setChapters(bookChapters);
        const counts = await Promise.all(
          bookChapters.map(async (c) => {
            try {
              const detail = await contentApi.getChapter(c.id);
              return [c.id, detail.totalContentPages + detail.totalExercisePages] as const;
            } catch {
              return [c.id, 0] as const;
            }
          })
        );
        if (cancelled) return;
        setPageCounts(Object.fromEntries(counts));
        setLoadingChapters(false);
      } catch (err: unknown) {
        if (!cancelled) {
          setError((err as { message?: string })?.message || 'Failed to load content');
          setLoadingSubjects(false);
          setLoadingBooks(false);
          setLoadingChapters(false);
        }
      }
    })();
    return () => { cancelled = true; };
    // Deep-link params are read once on mount; subsequent navigation uses the
    // click handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnerId]);

  const selectSubject = async (subject: Subject) => {
    setSelectedSubject(subject);
    setSelectedBook(null);
    setChapters([]);
    setBooks([]);
    setError('');
    setLoadingBooks(true);
    try {
      setBooks(await contentApi.getBooksForSubject(subject.id, learnerId));
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load books');
    } finally {
      setLoadingBooks(false);
    }
  };

  const selectBook = async (book: Book) => {
    setSelectedBook(book);
    setChapters([]);
    setPageCounts({});
    setError('');
    setLoadingChapters(true);
    try {
      const bookChapters = await contentApi.getChaptersForBook(book.id);
      setChapters(bookChapters);
      // Fetch each chapter's page counts in parallel so the cards can show how
      // many pages were uploaded. Best-effort: a failed count just shows 0.
      const counts = await Promise.all(
        bookChapters.map(async (c) => {
          try {
            const detail = await contentApi.getChapter(c.id);
            return [c.id, detail.totalContentPages + detail.totalExercisePages] as const;
          } catch {
            return [c.id, 0] as const;
          }
        })
      );
      setPageCounts(Object.fromEntries(counts));
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to load chapters');
    } finally {
      setLoadingChapters(false);
    }
  };

  // "Add Book" creates the book implicitly by creating its first chapter
  // (the backend find-or-creates the book by name). We send the parent to the
  // create-chapter flow pre-scoped to this subject, which is the only way the
  // backend materializes a book. For a lighter-weight "just name a book",
  // we still create a chapter #1 placeholder-free path via the create flow.
  const handleAddBook = () => {
    if (!selectedSubject) return;
    // Jump into the existing create-chapter + capture flow, pre-selecting the
    // subject and carrying the learner, with the typed book name prefilled.
    const params = new URLSearchParams({
      learnerId,
      subjectId: selectedSubject.id,
    });
    if (newBookName.trim()) params.set('bookName', newBookName.trim());
    navigate(`/content/add-chapter?${params.toString()}`);
  };

  const handleCreateChapter = () => {
    if (!selectedSubject) return;
    const params = new URLSearchParams({ learnerId, subjectId: selectedSubject.id });
    if (selectedBook) params.set('bookName', selectedBook.name);
    navigate(`/content/add-chapter?${params.toString()}`);
  };

  const rowItem = (active: boolean): React.CSSProperties => ({
    padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
    background: active ? theme.colors.goldLight : 'transparent',
    borderLeft: active ? `3px solid ${theme.colors.gold}` : '3px solid transparent',
    fontSize: 12, fontWeight: active ? theme.fonts.weights.bold : theme.fonts.weights.medium,
    color: active ? theme.colors.dark : theme.colors.text, marginBottom: 4,
  });

  const styles: Record<string, React.CSSProperties> = {
    container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', display: 'flex' },
    sidebar: { width: 180, backgroundColor: theme.colors.purpleLight, borderRight: `1px solid ${theme.colors.border}`, padding: 12, overflowY: 'auto' },
    sidebarTitle: { fontSize: 12, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${theme.colors.border}` },
    middle: { width: 260, borderRight: `1px solid ${theme.colors.border}`, padding: 16, overflowY: 'auto', background: '#fff' },
    main: { flex: 1, padding: 20, overflowY: 'auto' },
    sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionTitle: { fontSize: 14, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark },
    smallBtn: { padding: '6px 12px', border: 'none', borderRadius: 14, background: theme.gradients.primary, color: '#fff', fontSize: 11, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer' },
    chapterCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 14, boxShadow: theme.shadows.card, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    input: { width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${theme.colors.border}`, fontSize: 12, outline: 'none', boxSizing: 'border-box', marginBottom: 8 },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, color: theme.colors.textLight, fontSize: 12 },
    errorBox: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 },
  };

  if (loadingSubjects) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Subjects */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>
          Subjects{learnerName ? ` · ${learnerName}` : ''}
        </div>
        {subjects.length === 0 && <div style={{ fontSize: 11, color: theme.colors.textLight }}>No subjects enrolled.</div>}
        {subjects.map((s) => (
          <div key={s.id} style={rowItem(selectedSubject?.id === s.id)} onClick={() => selectSubject(s)}>
            {s.name}
          </div>
        ))}
      </div>

      {/* Books */}
      <div style={styles.middle}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Books</span>
        </div>
        {!selectedSubject && <div style={styles.empty}>Select a subject</div>}
        {selectedSubject && (
          <>
            {loadingBooks ? (
              <div style={{ fontSize: 12, color: theme.colors.textLight }}>Loading books...</div>
            ) : (
              <>
                {books.length === 0 && <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 10 }}>No books yet.</div>}
                {books.map((b) => (
                  <div key={b.id} style={rowItem(selectedBook?.id === b.id)} onClick={() => selectBook(b)}>
                    <i className="fas fa-book" style={{ marginRight: 6, color: theme.colors.purple }} />{b.name}
                  </div>
                ))}
                {/* Add book */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${theme.colors.border}` }}>
                  <input
                    style={styles.input}
                    placeholder="New book name"
                    value={newBookName}
                    onChange={(e) => setNewBookName(e.target.value)}
                  />
                  <button
                    style={{ ...styles.smallBtn, width: '100%', opacity: newBookName.trim() ? 1 : 0.5 }}
                    disabled={!newBookName.trim()}
                    onClick={handleAddBook}
                  >
                    <i className="fas fa-plus" style={{ marginRight: 6 }} />Add Book
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Chapters */}
      <div style={styles.main}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>
            {selectedBook ? `${selectedBook.name} — Chapters` : 'Chapters'}
          </span>
          {selectedSubject && (
            <button style={styles.smallBtn} onClick={handleCreateChapter}>
              <i className="fas fa-plus" style={{ marginRight: 6 }} />Create Chapter
            </button>
          )}
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}

        {!selectedBook && !error && <div style={styles.empty}>Select a book to see its chapters</div>}

        {selectedBook && (
          loadingChapters ? (
            <div style={{ fontSize: 12, color: theme.colors.textLight }}>Loading chapters...</div>
          ) : chapters.length === 0 ? (
            <div style={styles.empty}>No chapters yet. Use “Create Chapter” to add one.</div>
          ) : (
            chapters.map((c) => (
              <div key={c.id} style={styles.chapterCard}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>
                    Ch {c.chapterNumber}: {c.chapterName}
                  </div>
                  <div style={{ fontSize: 10, color: theme.colors.textLight, marginTop: 2 }}>
                    {pageCounts[c.id] ?? 0} page{(pageCounts[c.id] ?? 0) === 1 ? '' : 's'}
                    {' · '}
                    {c.aiAssetsGenerated ? 'AI assets ready' : 'No AI assets yet'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={{ fontSize: 11, fontWeight: '600', color: theme.colors.purple, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/content/chapters/${c.id}/edit?learnerId=${encodeURIComponent(learnerId)}`)}
                  >
                    <i className="fas fa-edit" style={{ marginRight: 4 }} />Edit
                  </button>
                  <button
                    style={{ fontSize: 11, fontWeight: '600', color: theme.colors.gold, background: 'none', border: 'none', cursor: 'pointer' }}
                    onClick={() => navigate(`/content/capture?chapterId=${c.id}&learnerId=${encodeURIComponent(learnerId)}`)}
                  >
                    <i className="fas fa-images" style={{ marginRight: 4 }} />Pages
                  </button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
