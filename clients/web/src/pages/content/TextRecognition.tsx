/**
 * TextRecognition — OCR processing and transcript editing.
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

  return (
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Chapter Transcript</span>
      </div>
      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: theme.colors.textLight, padding: '8px 12px', backgroundColor: '#fff', borderRadius: 8, marginBottom: 16 }}>
        <span><i className="fas fa-file-alt" style={{ marginRight: 4 }} />{transcript.length} pages</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {transcript.map((page) => (
          <div key={page.pageNumber} style={{ background: '#fff', borderRadius: 12, padding: 14, border: `1px solid ${theme.colors.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: theme.fonts.weights.bold, color: theme.colors.purple }}>Page {page.pageNumber}</span>
              {page.language && <span style={{ fontSize: 9, backgroundColor: theme.colors.purpleLight, color: theme.colors.purple, padding: '2px 8px', borderRadius: 8, fontWeight: '600' }}>{page.language}</span>}
              <button style={{ marginLeft: 'auto', fontSize: 10, color: theme.colors.blue, fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setEditingPage(editingPage === page.pageNumber ? null : page.pageNumber)}>
                <i className={`fas fa-${editingPage === page.pageNumber ? 'check' : 'edit'}`} style={{ marginRight: 4 }} />{editingPage === page.pageNumber ? 'Done' : 'Edit'}
              </button>
            </div>
            {editingPage === page.pageNumber ? (
              <textarea style={{ width: '100%', padding: 10, borderRadius: 8, border: `1px solid ${theme.colors.purple}`, fontSize: 12, lineHeight: 1.6, fontFamily: theme.fonts.family, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} value={page.text} onChange={(e) => handleTextChange(page.pageNumber, e.target.value)} rows={6} />
            ) : (
              <pre style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, fontFamily: theme.fonts.family }}>{page.text}</pre>
            )}
          </div>
        ))}
      </div>
      <button style={{ width: '100%', padding: 14, border: 'none', borderRadius: theme.borderRadius.button, background: `linear-gradient(135deg, ${theme.colors.green}, #1E8449)`, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer' }} onClick={handleSave} disabled={saving}>
        <i className="fas fa-save" style={{ marginRight: 8 }} />{saving ? 'Saving...' : 'Save Transcript'}
      </button>
    </div>
  );
}
