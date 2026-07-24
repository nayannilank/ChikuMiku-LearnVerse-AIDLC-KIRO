/**
 * SelectSubjectBook — First step of content ingestion. Select Subject, Book, Chapter.
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

  return (
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Add Chapter</span>
      </div>
      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 500 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 6, display: 'block' }}>Subject <span style={{ color: theme.colors.red }}>*</span></label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {subjects.map((s) => (
              <div key={s.id} style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${selectedSubject === s.id ? theme.colors.purple : theme.colors.border}`, background: selectedSubject === s.id ? theme.colors.purpleLight : '#fff', textAlign: 'center', cursor: 'pointer' }} onClick={() => setSelectedSubject(s.id)}>
                <span style={{ fontSize: 10, fontWeight: '600', color: selectedSubject === s.id ? theme.colors.purple : theme.colors.text }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
        {selectedSubject && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 6, display: 'block' }}>Book Name <span style={{ color: theme.colors.red }}>*</span></label>
              <input style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.colors.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} placeholder="Enter book name" value={bookName} onChange={(e) => setBookName(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: '0 0 80px' }}>
                <label style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 6, display: 'block' }}>Chapter #</label>
                <input style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.colors.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} type="number" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} min="1" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 6, display: 'block' }}>Chapter Name <span style={{ color: theme.colors.red }}>*</span></label>
                <input style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${theme.colors.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} placeholder="e.g. Numbers, The Kite" value={chapterName} onChange={(e) => setChapterName(e.target.value)} />
              </div>
            </div>
            <button style={{ width: '100%', padding: 14, border: 'none', borderRadius: theme.borderRadius.button, background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer', opacity: chapterName ? 1 : 0.5 }} onClick={handleSubmit} disabled={!chapterName}>
              <i className="fas fa-arrow-right" style={{ marginRight: 8 }} />Next — Add Pages
            </button>
          </>
        )}
      </div>
    </div>
  );
}
