/**
 * PageCapture — Drag & drop page upload with 6-column thumbnail grid.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { contentApi, fileToPageUploadData, type PageUploadInput } from '../../services/contentApi';

/** True when a File is a PDF (by MIME type or extension). Kept local so the
 * heavy pdf.js module stays lazily imported only at upload time. */
function fileIsPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * A selected source item. An image file maps to a single page; a PDF file maps
 * to one page per PDF page (expanded at upload time). `isExercise` applies to
 * all pages produced from that item.
 */
interface Item { id: string; label: string; isExercise: boolean; file: File; isPdf: boolean }

export function PageCapture() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const learnerId = searchParams.get('learnerId') || '';
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    // Accept raster images and PDFs; PDFs are split into page images client-side.
    input.accept = 'image/jpeg,image/png,image/heic,application/pdf,.pdf';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        const newItems: Item[] = Array.from(files).map((file, i) => ({
          id: `item-${Date.now()}-${items.length + i}`,
          label: file.name,
          isExercise: false,
          file,
          isPdf: fileIsPdf(file),
        }));
        setItems((prev) => [...prev, ...newItems]);
      }
    };
    input.click();
  };

  const toggleExercise = (id: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, isExercise: !it.isExercise } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  /**
   * Expands all selected items into page uploads (images → 1 page each, PDFs →
   * one page per PDF page) with sequential page order, then uploads them.
   */
  const uploadAll = async (): Promise<boolean> => {
    const uploads: PageUploadInput[] = [];
    let pageOrder = 1;
    for (const item of items) {
      const classification = item.isExercise ? 'exercise' : 'content';
      if (item.isPdf) {
        // Lazily load pdf.js only when a PDF is actually being uploaded, so the
        // heavy worker/library isn't in the initial bundle for other users.
        const { pdfFileToPageUploads } = await import('../../services/pdfToPages');
        const pdfPages = await pdfFileToPageUploads(item.file, pageOrder, classification);
        uploads.push(...pdfPages);
        pageOrder += pdfPages.length;
      } else {
        const { imageData, format, sizeBytes } = await fileToPageUploadData(item.file);
        uploads.push({ imageData, format, sizeBytes, pageOrder, classification });
        pageOrder += 1;
      }
    }
    if (uploads.length > 0) {
      await contentApi.uploadPages(chapterId, uploads);
    }
    return true;
  };

  const contentHref = learnerId
    ? `/content/manage?learnerId=${encodeURIComponent(learnerId)}`
    : '/content/manage';

  // Upload the pages and go on to the OCR / transcript step.
  const handleExtract = async () => {
    setUploading(true);
    setError('');
    try {
      await uploadAll();
      const q = learnerId ? `?chapterId=${chapterId}&learnerId=${encodeURIComponent(learnerId)}` : `?chapterId=${chapterId}`;
      navigate(`/content/ocr${q}`);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Upload the pages (if any) and return to Content Management, so the user can
  // come back and extract text / add more chapters later.
  const handleSaveAndExit = async () => {
    setUploading(true);
    setError('');
    try {
      await uploadAll();
      navigate(contentHref);
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
          <span style={{ fontSize: 10, color: theme.colors.textLight }}>Images (JPEG, PNG, HEIC) or PDF • Max 10MB</span>
          <button
            style={{ background: 'none', border: `1px solid ${theme.colors.border}`, borderRadius: 14, padding: '6px 12px', color: theme.colors.purple, fontSize: 10, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer' }}
            onClick={() => navigate(learnerId ? `/content/manage?learnerId=${encodeURIComponent(learnerId)}` : '/content/manage')}
          >
            <i className="fas fa-folder-open" style={{ marginRight: 6 }} />Back to Content
          </button>
        </div>
      </div>

      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}

      {/* Drag & drop zone */}
      <div style={styles.dropZone} onClick={handleUpload}>
        <i className="fas fa-cloud-upload-alt" style={{ fontSize: 32, color: theme.colors.purple, marginBottom: 8 }} />
        <div style={{ fontSize: 13, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 4 }}>Add images or a PDF</div>
        <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 4 }}>Each image is one page; a PDF is split into one page per PDF page.</div>
        <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 12 }}>or</div>
        <button style={styles.browseBtn}>Browse Files</button>
      </div>

      {/* Item counter */}
      <div style={{ fontSize: 12, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 12 }}>
        Selected Files ({items.length})
      </div>

      {/* Selected-file list */}
      {items.length > 0 && (
        <div style={styles.thumbGrid}>
          {items.map((item) => (
            <div key={item.id} style={styles.thumbCard}>
              <div style={styles.thumbImage}>
                <i className={`fas fa-${item.isPdf ? 'file-pdf' : 'file-image'}`} style={{ color: item.isPdf ? theme.colors.red : theme.colors.border, fontSize: 20 }} />
              </div>
              <button style={styles.deleteBtn} onClick={() => removeItem(item.id)}>✕</button>
              <div style={styles.thumbLabel}>
                <span style={{ fontSize: 9, color: theme.colors.textLight, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }} title={item.label}>
                  {item.isPdf ? 'PDF' : item.label}
                </span>
                <button style={{ ...styles.typeToggle, ...(item.isExercise ? { background: theme.colors.goldLight, color: theme.colors.hindi, borderColor: theme.colors.gold } : {}) }} onClick={() => toggleExercise(item.id)}>
                  {item.isExercise ? 'Exercise' : 'Content'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer actions: save & exit, or continue to text extraction */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          style={{ ...styles.saveExitBtn, opacity: items.length > 0 && !uploading ? 1 : 0.5 }}
          onClick={handleSaveAndExit}
          disabled={items.length === 0 || uploading}
        >
          <i className="fas fa-check" style={{ marginRight: 8 }} />{uploading ? 'Saving...' : 'Save & Exit'}
        </button>
        <button
          style={{ ...styles.doneBtn, opacity: items.length > 0 && !uploading ? 1 : 0.5 }}
          onClick={handleExtract}
          disabled={items.length === 0 || uploading}
        >
          <i className="fas fa-arrow-right" style={{ marginRight: 8 }} />{uploading ? 'Uploading...' : 'Extract Text →'}
        </button>
      </div>
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
  doneBtn: { flex: 1, padding: 14, border: 'none', borderRadius: theme.borderRadius.button, background: `linear-gradient(135deg, ${theme.colors.gold}, #E5A100)`, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer' },
  saveExitBtn: { flex: 1, padding: 14, border: `1px solid ${theme.colors.purple}`, borderRadius: theme.borderRadius.button, background: '#fff', color: theme.colors.purple, fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer' },
};
