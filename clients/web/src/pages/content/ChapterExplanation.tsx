/**
 * ChapterExplanation — Page-by-page explanation with Read/Listen toggle.
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
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 15, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, flex: 1 }}>Chapter Explanation</span>
        <span style={{ fontSize: 11, color: theme.colors.textLight }}>Page {currentPage + 1}/{pages.length}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: mode === 'read' ? 'none' : `1px solid ${theme.colors.border}`, background: mode === 'read' ? theme.gradients.primary : '#fff', fontSize: 12, fontWeight: '600', color: mode === 'read' ? '#fff' : theme.colors.text, cursor: 'pointer', textAlign: 'center' }} onClick={() => setMode('read')}>
          <i className="fas fa-book-open" style={{ marginRight: 6 }} /> Read
        </button>
        <button style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: mode === 'listen' ? 'none' : `1px solid ${theme.colors.border}`, background: mode === 'listen' ? theme.gradients.primary : '#fff', fontSize: 12, fontWeight: '600', color: mode === 'listen' ? '#fff' : theme.colors.text, cursor: 'pointer', textAlign: 'center' }} onClick={() => setMode('listen')}>
          <i className="fas fa-headphones" style={{ marginRight: 6 }} /> Listen
        </button>
      </div>
      <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 18, marginBottom: 12, boxShadow: theme.shadows.card }}>
        <div style={{ fontSize: 13, color: theme.colors.text, lineHeight: 1.7, marginBottom: 14 }}>{page.content}</div>
        {page.summary && (
          <div style={{ marginBottom: 12, paddingTop: 10, borderTop: `1px solid ${theme.colors.border}` }}>
            <div style={{ fontSize: 11, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 6 }}><i className="fas fa-lightbulb" style={{ color: theme.colors.gold, marginRight: 6 }} />Summary</div>
            <div style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.5 }}>{page.summary}</div>
          </div>
        )}
        {page.keyWords.length > 0 && (
          <div style={{ marginBottom: 12, paddingTop: 10, borderTop: `1px solid ${theme.colors.border}` }}>
            <div style={{ fontSize: 11, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 6 }}><i className="fas fa-key" style={{ color: theme.colors.purple, marginRight: 6 }} />Key Words</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {page.keyWords.map((word, i) => <span key={i} style={{ fontSize: 10, backgroundColor: theme.colors.purpleLight, color: theme.colors.purple, padding: '4px 10px', borderRadius: 10, fontWeight: '600' }}>{word}</span>)}
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button style={{ padding: '8px 14px', borderRadius: 16, border: `1px solid ${theme.colors.border}`, background: '#fff', fontSize: 11, fontWeight: '600', cursor: 'pointer', opacity: currentPage === 0 ? 0.4 : 1 }} onClick={() => setCurrentPage(Math.max(0, currentPage - 1))} disabled={currentPage === 0}>← Previous</button>
        <div style={{ display: 'flex', gap: 6 }}>
          {pages.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: i === currentPage ? theme.colors.purple : theme.colors.border, cursor: 'pointer' }} onClick={() => setCurrentPage(i)} />)}
        </div>
        <button style={{ padding: '8px 14px', borderRadius: 16, border: `1px solid ${theme.colors.border}`, background: '#fff', fontSize: 11, fontWeight: '600', cursor: 'pointer', opacity: currentPage === pages.length - 1 ? 0.4 : 1 }} onClick={() => setCurrentPage(Math.min(pages.length - 1, currentPage + 1))} disabled={currentPage === pages.length - 1}>Next →</button>
      </div>
    </div>
  );
}
