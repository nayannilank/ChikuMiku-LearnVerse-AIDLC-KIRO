/**
 * PageCapture — Drag & drop page upload with 6-column thumbnail grid.
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
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
          <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Add Pages</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 10, color: theme.colors.textLight }}>JPEG, PNG, HEIC • Max 10MB</span>
          <button style={styles.cameraBtn}>
            <i className="fas fa-camera" style={{ marginRight: 6 }} />Use Camera
          </button>
        </div>
      </div>

      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}

      {/* Drag & drop zone */}
      <div style={styles.dropZone} onClick={handleUpload}>
        <i className="fas fa-cloud-upload-alt" style={{ fontSize: 32, color: theme.colors.purple, marginBottom: 8 }} />
        <div style={{ fontSize: 13, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 4 }}>Drag & drop images here</div>
        <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 12 }}>or</div>
        <button style={styles.browseBtn}>Browse Files</button>
      </div>

      {/* Page counter */}
      <div style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 12 }}>
        Uploaded Pages ({pages.length} of 50)
      </div>

      {/* 6-column thumbnail grid */}
      {pages.length > 0 && (
        <div style={styles.thumbGrid}>
          {pages.map((page) => (
            <div key={page.id} style={styles.thumbCard}>
              <div style={styles.thumbImage}>
                <i className="fas fa-file-image" style={{ color: theme.colors.border, fontSize: 20 }} />
              </div>
              <button style={styles.deleteBtn} onClick={() => removePage(page.id)}>✕</button>
              <div style={styles.thumbLabel}>
                <span style={{ fontSize: 9, color: theme.colors.textLight }}>Page {page.pageNumber}</span>
                <button style={{ ...styles.typeToggle, ...(page.isExercise ? { background: theme.colors.goldLight, color: theme.colors.hindi, borderColor: theme.colors.gold } : {}) }} onClick={() => toggleExercise(page.id)}>
                  {page.isExercise ? 'Exercise' : 'Content'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done button — gold gradient */}
      <button style={{ ...styles.doneBtn, opacity: pages.length > 0 ? 1 : 0.5 }} onClick={handleDone} disabled={pages.length === 0 || uploading}>
        <i className="fas fa-check" style={{ marginRight: 8 }} />{uploading ? 'Uploading...' : 'Done — Extract Text →'}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  cameraBtn: { padding: '6px 12px', border: `1px solid ${theme.colors.border}`, borderRadius: 14, background: '#fff', fontSize: 10, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, cursor: 'pointer' },
  dropZone: { border: `2px dashed ${theme.colors.purple}`, borderRadius: theme.borderRadius.card, padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', cursor: 'pointer', marginBottom: 16 },
  browseBtn: { padding: '8px 20px', border: 'none', borderRadius: 16, background: theme.gradients.primary, color: '#fff', fontSize: 11, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer' },
  thumbGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 },
  thumbCard: { borderRadius: 10, border: `1px solid ${theme.colors.border}`, overflow: 'hidden', background: '#fff', position: 'relative' as const },
  thumbImage: { height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAFA' },
  deleteBtn: { position: 'absolute' as const, top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', border: 'none', background: theme.colors.redLight, color: theme.colors.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 },
  thumbLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 6px' },
  typeToggle: { fontSize: 8, fontWeight: '600', padding: '3px 6px', borderRadius: 6, border: `1px solid ${theme.colors.border}`, background: '#fff', color: theme.colors.textLight, cursor: 'pointer' },
  doneBtn: { width: '100%', padding: 14, border: 'none', borderRadius: theme.borderRadius.button, background: `linear-gradient(135deg, ${theme.colors.gold}, #E5A100)`, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer' },
};
