/**
 * TextRecognition — Split layout with page thumbnails (left) and editable transcript (right).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { contentApi } from '../../services/contentApi';

export function TextRecognition() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const [transcript, setTranscript] = useState<Array<{ pageNumber: number; text: string; language?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingPage, setEditingPage] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);

  useEffect(() => {
    if (!chapterId) return;
    contentApi.getTranscript(chapterId)
      .then((data) => { setTranscript(data.map((p) => ({ pageNumber: p.pageNumber, text: p.text, language: p.language }))); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [chapterId]);

  const handleTextChange = (pageNumber: number, newText: string) => {
    setTranscript((prev) => prev.map((p) => p.pageNumber === pageNumber ? { ...p, text: newText } : p));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await contentApi.saveTranscript(chapterId, transcript as never);
      navigate(`/content/explain?chapterId=${chapterId}`);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Processing pages...</div>;

  const currentPage = transcript.find((p) => p.pageNumber === selectedPage);
  const wordCount = currentPage ? currentPage.text.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
          <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Chapter Transcript</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.editBtn} onClick={() => setEditingPage(editingPage === selectedPage ? null : selectedPage)}>
            <i className={`fas fa-${editingPage === selectedPage ? 'check' : 'edit'}`} style={{ marginRight: 4 }} />
            {editingPage === selectedPage ? 'Done' : 'Edit'}
          </button>
          <button style={styles.saveBtn} onClick={handleSave} disabled={saving}>
            <i className="fas fa-save" style={{ marginRight: 4 }} />{saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Success banner */}
      <div style={styles.successBanner}>
        <i className="fas fa-check-circle" style={{ color: theme.colors.green, marginRight: 8 }} />
        <span>Text successfully extracted from {transcript.length} pages</span>
      </div>

      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}

      {/* Split layout */}
      <div style={styles.splitLayout}>
        {/* Left - page thumbnails */}
        <div style={styles.leftPanel}>
          {transcript.map((page) => (
            <div
              key={page.pageNumber}
              style={{
                padding: '10px 8px',
                borderRadius: 8,
                border: `1px solid ${selectedPage === page.pageNumber ? theme.colors.purple : theme.colors.border}`,
                borderLeft: selectedPage === page.pageNumber ? `3px solid ${theme.colors.purple}` : `1px solid ${theme.colors.border}`,
                background: selectedPage === page.pageNumber ? theme.colors.purpleLight : '#fff',
                cursor: 'pointer',
                marginBottom: 8,
                textAlign: 'center',
              }}
              onClick={() => setSelectedPage(page.pageNumber)}
            >
              <i className="fas fa-file-alt" style={{ fontSize: 18, color: selectedPage === page.pageNumber ? theme.colors.purple : theme.colors.textLight, marginBottom: 4 }} />
              <div style={{ fontSize: 9, color: theme.colors.textLight }}>Page {page.pageNumber}</div>
            </div>
          ))}
        </div>

        {/* Right - page content */}
        <div style={styles.rightPanel}>
          {currentPage && (
            <div style={styles.contentCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10, fontWeight: theme.fonts.weights.bold, color: '#fff', background: theme.colors.purple, padding: '3px 10px', borderRadius: 10 }}>Page {selectedPage}</span>
                {currentPage.language && <span style={{ fontSize: 9, backgroundColor: theme.colors.purpleLight, color: theme.colors.purple, padding: '3px 8px', borderRadius: 8, fontWeight: '600' }}>{currentPage.language}</span>}
                <span style={{ fontSize: 10, color: theme.colors.textLight, marginLeft: 'auto' }}>{wordCount} words</span>
              </div>
              {editingPage === selectedPage ? (
                <textarea style={styles.textArea} value={currentPage.text} onChange={(e) => handleTextChange(currentPage.pageNumber, e.target.value)} rows={12} />
              ) : (
                <pre style={styles.preText}>{currentPage.text}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  editBtn: { padding: '6px 12px', borderRadius: 14, border: `1px solid ${theme.colors.blue}`, background: '#fff', fontSize: 10, fontWeight: '600', color: theme.colors.blue, cursor: 'pointer' },
  saveBtn: { padding: '6px 12px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${theme.colors.green}, #1E8449)`, fontSize: 10, fontWeight: '600', color: '#fff', cursor: 'pointer' },
  successBanner: { display: 'flex', alignItems: 'center', padding: '10px 14px', background: theme.colors.greenLight, borderRadius: 8, marginBottom: 12, fontSize: 11, color: theme.colors.text },
  splitLayout: { display: 'flex', gap: 16, height: 'calc(100vh - 160px)' },
  leftPanel: { width: 200, overflowY: 'auto' as const },
  rightPanel: { flex: 1, overflowY: 'auto' as const },
  contentCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 18, boxShadow: theme.shadows.card },
  textArea: { width: '100%', padding: 12, borderRadius: 8, border: `1px solid ${theme.colors.purple}`, fontSize: 12, lineHeight: 1.7, fontFamily: theme.fonts.family, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const },
  preText: { fontSize: 12, color: theme.colors.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const, margin: 0, fontFamily: theme.fonts.family },
};
