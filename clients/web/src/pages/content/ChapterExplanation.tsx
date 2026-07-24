/**
 * ChapterExplanation — Split layout with original text (left) and explanation (right) + Read/Listen toggle.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { aiApi } from '../../services/aiApi';

interface ExplanationPage { pageNumber: number; content: string; summary: string; keyWords: string[]; concepts: string[] }

export function ChapterExplanation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const [pages, setPages] = useState<ExplanationPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<'read' | 'listen'>('read');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!chapterId) return;
    aiApi.getChapterExplanations(chapterId)
      .then((data) => {
        setPages(data.map((d, i) => ({ pageNumber: i + 1, content: (d as unknown as Record<string, string>).explanation || '', summary: (d as unknown as Record<string, string>).summary || '', keyWords: ((d as unknown as Record<string, string[]>).keyWords) || [], concepts: ((d as unknown as Record<string, string[]>).concepts) || [] })));
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [chapterId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading explanations...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: theme.colors.red, fontFamily: theme.fonts.family }}>{error}</div>;

  const page = pages[currentPage];
  if (!page) return null;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
          <span style={{ fontSize: 15, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Chapter Explanation</span>
          <span style={{ fontSize: 11, color: theme.colors.textLight }}>Page {currentPage + 1}/{pages.length}</span>
        </div>
        {/* Read/Listen toggle */}
        <div style={styles.toggleContainer}>
          <button style={{ ...styles.toggleBtn, ...(mode === 'read' ? styles.toggleActive : {}) }} onClick={() => setMode('read')}>
            <i className="fas fa-book-open" style={{ marginRight: 4 }} /> Read
          </button>
          <button style={{ ...styles.toggleBtn, ...(mode === 'listen' ? styles.toggleActive : {}) }} onClick={() => setMode('listen')}>
            <i className="fas fa-headphones" style={{ marginRight: 4 }} /> Listen
          </button>
        </div>
      </div>

      {/* Split layout */}
      <div style={styles.splitLayout}>
        {/* Left - original content */}
        <div style={styles.leftPanel}>
          <div style={{ fontSize: 11, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 10 }}>Original Text</div>
          <div style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.7 }}>{page.content}</div>
        </div>

        {/* Right - explanation */}
        <div style={styles.rightPanel}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <i className="fas fa-lightbulb" style={{ color: theme.colors.gold, fontSize: 14 }} />
            <span style={{ fontSize: 12, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Explanation</span>
          </div>

          {page.summary && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.6 }}>{page.summary}</div>
            </div>
          )}

          {page.keyWords.length > 0 && (
            <div style={{ marginBottom: 14, paddingTop: 10, borderTop: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: 11, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 6 }}>
                <i className="fas fa-key" style={{ color: theme.colors.purple, marginRight: 6 }} />Key Words
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {page.keyWords.map((word, i) => <span key={i} style={{ fontSize: 10, backgroundColor: theme.colors.purpleLight, color: theme.colors.purple, padding: '4px 10px', borderRadius: 10, fontWeight: '600' }}>{word}</span>)}
              </div>
            </div>
          )}

          {page.concepts.length > 0 && (
            <div style={{ paddingTop: 10, borderTop: `1px solid ${theme.colors.border}` }}>
              <div style={{ fontSize: 11, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 6 }}>
                <i className="fas fa-brain" style={{ color: theme.colors.pink, marginRight: 6 }} />Concepts
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {page.concepts.map((concept, i) => <span key={i} style={{ fontSize: 10, backgroundColor: theme.colors.pinkLight, color: theme.colors.pink, padding: '4px 10px', borderRadius: 10, fontWeight: '600' }}>{concept}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Page navigation */}
      <div style={styles.pageNav}>
        <button style={{ ...styles.navBtn, opacity: currentPage === 0 ? 0.4 : 1 }} onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>← Previous</button>
        <div style={{ display: 'flex', gap: 6 }}>
          {pages.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: i === currentPage ? theme.colors.purple : theme.colors.border, cursor: 'pointer' }} onClick={() => setCurrentPage(i)} />)}
        </div>
        <button style={{ ...styles.navBtn, opacity: currentPage === pages.length - 1 ? 0.4 : 1 }} onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1}>Next →</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleContainer: { display: 'flex', background: '#fff', borderRadius: 20, border: `1px solid ${theme.colors.border}`, overflow: 'hidden' },
  toggleBtn: { padding: '8px 16px', border: 'none', background: 'transparent', fontSize: 11, fontWeight: '600', color: theme.colors.text, cursor: 'pointer' },
  toggleActive: { background: theme.gradients.primary, color: '#fff', borderRadius: 20 },
  splitLayout: { display: 'flex', gap: 16, marginBottom: 16 },
  leftPanel: { flex: 1, background: '#fff', borderRadius: theme.borderRadius.card, padding: 18, boxShadow: theme.shadows.card },
  rightPanel: { flex: 1, background: theme.colors.purpleLight, borderRadius: theme.borderRadius.card, padding: 18 },
  pageNav: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { padding: '8px 14px', borderRadius: 16, border: `1px solid ${theme.colors.border}`, background: '#fff', fontSize: 11, fontWeight: '600', cursor: 'pointer' },
};
