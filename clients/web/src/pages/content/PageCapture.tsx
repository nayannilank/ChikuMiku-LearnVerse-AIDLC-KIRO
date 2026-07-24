/**
 * PageCapture — Capture or upload textbook pages for a chapter.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { contentApi } from '../../services/contentApi';

interface Page { id: string; pageNumber: number; isExercise: boolean; file?: File }

export function PageCapture() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const [pages, setPages] = useState<Page[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const newPages: Page[] = Array.from(files).map((file, i) => ({
          id: `p${pages.length + i + 1}`,
          pageNumber: pages.length + i + 1,
          isExercise: false,
          file,
        }));
        setPages([...pages, ...newPages]);
      }
    };
    input.click();
  };

  const toggleExercise = (id: string) => {
    setPages(pages.map((p) => p.id === id ? { ...p, isExercise: !p.isExercise } : p));
  };

  const removePage = (id: string) => {
    setPages(pages.filter((p) => p.id !== id));
  };

  const handleDone = async () => {
    setUploading(true);
    setError('');
    try {
      for (const page of pages) {
        if (page.file) {
          await contentApi.uploadPage(chapterId, page.file, page.pageNumber, page.isExercise ? 'exercise' : 'content');
        }
      }
      navigate(`/content/ocr?chapterId=${chapterId}`);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, flex: 1 }}>Add Pages</span>
        <span style={{ fontSize: 11, color: theme.colors.textLight }}>{pages.length}/50 pages</span>
      </div>
      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <button style={{ flex: 1, padding: 20, borderRadius: theme.borderRadius.card, border: `2px dashed ${theme.colors.border}`, background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }} onClick={handleUpload}>
          <i className="fas fa-images" style={{ fontSize: 20, color: theme.colors.blue }} />
          <span style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text }}>Upload Images</span>
        </button>
      </div>
      <div style={{ fontSize: 11, color: theme.colors.textLight, padding: '8px 12px', backgroundColor: theme.colors.blueLight, borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <i className="fas fa-info-circle" style={{ color: theme.colors.blue, marginRight: 6 }} />JPEG, PNG, HEIC • Max 10 MB per image • Up to 50 pages
      </div>
      {pages.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
          {pages.map((page) => (
            <div key={page.id} style={{ borderRadius: 10, border: `2px solid ${page.isExercise ? theme.colors.gold : theme.colors.border}`, overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' }}>
                <i className="fas fa-file-image" style={{ color: theme.colors.border, fontSize: 24 }} />
                <span style={{ fontSize: 9, color: theme.colors.textLight, marginTop: 4 }}>Page {page.pageNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 6px' }}>
                <button style={{ fontSize: 8, fontWeight: '600', padding: '3px 6px', borderRadius: 6, border: `1px solid ${page.isExercise ? theme.colors.gold : theme.colors.border}`, background: page.isExercise ? theme.colors.goldLight : '#fff', color: page.isExercise ? theme.colors.hindi : theme.colors.textLight, cursor: 'pointer' }} onClick={() => toggleExercise(page.id)}>
                  {page.isExercise ? 'Exercise' : 'Content'}
                </button>
                <button style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: theme.colors.redLight, color: theme.colors.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }} onClick={() => removePage(page.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <button style={{ width: '100%', padding: 14, border: 'none', borderRadius: theme.borderRadius.button, background: `linear-gradient(135deg, ${theme.colors.green}, #1E8449)`, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer', opacity: pages.length > 0 ? 1 : 0.5 }} onClick={handleDone} disabled={pages.length === 0 || uploading}>
        <i className="fas fa-check" style={{ marginRight: 8 }} />{uploading ? 'Uploading...' : 'Done — Process Pages'}
      </button>
    </div>
  );
}
