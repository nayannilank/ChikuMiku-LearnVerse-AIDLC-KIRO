/**
 * SelectSubjectBook — Split layout with subject sidebar and book/chapter panel.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';
import { contentApi } from '../../services/contentApi';
import type { Subject } from '../../services/contentApi';

export function SelectSubjectBook() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [bookName, setBookName] = useState('');
  const [chapterNumber, setChapterNumber] = useState('1');
  const [chapterName, setChapterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    contentApi.getEnrolledSubjects()
      .then((data) => { setSubjects(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const handleSubmit = async () => {
    if (!selectedSubject || !bookName || !chapterName) return;
    try {
      const res = await contentApi.createChapter({ subjectId: selectedSubject, bookName, chapterNumber: Number(chapterNumber), chapterName } as never);
      navigate(`/content/capture?chapterId=${res.chapterId}`);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to create chapter');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading...</div>;

  const selectedSubjectData = subjects.find((s) => s.id === selectedSubject);

  return (
    <div style={styles.container}>
      {/* Left subject sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Subjects</div>
        {subjects.map((s) => (
          <div
            key={s.id}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              background: selectedSubject === s.id ? theme.colors.goldLight : 'transparent',
              borderLeft: selectedSubject === s.id ? `3px solid ${theme.colors.gold}` : '3px solid transparent',
              fontSize: 12,
              fontWeight: selectedSubject === s.id ? theme.fonts.weights.bold : theme.fonts.weights.medium,
              color: selectedSubject === s.id ? theme.colors.dark : theme.colors.text,
              marginBottom: 4,
            }}
            onClick={() => setSelectedSubject(s.id)}
          >
            {s.name}
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div style={styles.main}>
        <div style={styles.header}>
          <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>
            {selectedSubjectData ? `${selectedSubjectData.name} — Books & Chapters` : 'Select a Subject'}
          </span>
          {selectedSubject && (
            <button style={styles.newBookBtn}>
              <i className="fas fa-plus" style={{ marginRight: 6 }} />New Book
            </button>
          )}
        </div>

        {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}

        {selectedSubject && (
          <div style={styles.formCard}>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Book Name <span style={{ color: theme.colors.red }}>*</span></label>
              <input style={styles.input} placeholder="Enter book name" value={bookName} onChange={(e) => setBookName(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: '0 0 80px' }}>
                <label style={styles.label}>Chapter #</label>
                <input style={styles.input} type="number" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} min="1" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Chapter Name <span style={{ color: theme.colors.red }}>*</span></label>
                <input style={styles.input} placeholder="e.g. Numbers, The Kite" value={chapterName} onChange={(e) => setChapterName(e.target.value)} />
              </div>
            </div>
            <button style={{ ...styles.submitBtn, opacity: chapterName ? 1 : 0.5 }} onClick={handleSubmit} disabled={!chapterName}>
              <i className="fas fa-arrow-right" style={{ marginRight: 8 }} />Next — Add Pages
            </button>
          </div>
        )}

        {!selectedSubject && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, color: theme.colors.textLight }}>
            <i className="fas fa-hand-pointer" style={{ fontSize: 28, color: theme.colors.border, marginBottom: 12 }} />
            <span style={{ fontSize: 12 }}>Select a subject from the left to add books and chapters</span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', display: 'flex' },
  sidebar: { width: 180, backgroundColor: theme.colors.purpleLight, borderRight: `1px solid ${theme.colors.border}`, padding: 12, overflowY: 'auto' },
  sidebarTitle: { fontSize: 12, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid ${theme.colors.border}` },
  main: { flex: 1, padding: 20, overflowY: 'auto' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  newBookBtn: { padding: '8px 14px', border: 'none', borderRadius: 16, background: theme.gradients.primary, color: '#fff', fontSize: 11, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer' },
  formCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 500 },
  label: { fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 6, display: 'block' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.colors.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  submitBtn: { width: '100%', padding: 14, border: 'none', borderRadius: theme.borderRadius.button, background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer' },
};
