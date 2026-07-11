/**
 * PageCapture — Page for capturing/uploading textbook pages,
 * classifying them, and initiating OCR processing.
 *
 * Validates: Requirements 7.1, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 8.1, 8.2, 8.8
 */
import { useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { validateFileUpload } from '@chikumiku/validation';
import { useTheme } from '../theme';

/* --- Types --- */

type PageClassification = 'content' | 'exercise';

interface CapturedPage {
  id: string;
  file: File;
  thumbnailUrl: string;
  classification: PageClassification;
}

type OcrStatus = 'idle' | 'processing' | 'complete';

interface OcrPageResult {
  pageId: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
}

/* --- Constants --- */

const MIN_PAGES = 1;
const MAX_PAGES = 50;
const OCR_TIME_PER_PAGE_MS = 2000; // Mock: ~2 seconds per page

/* --- Helpers --- */

function generateId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getFileFormat(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg') return 'jpeg';
  return ext;
}

/* --- Component --- */

export function PageCapture() {
  const { id: chapterId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Page capture state
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // OCR state
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>('idle');
  const [ocrResults, setOcrResults] = useState<OcrPageResult[]>([]);
  const [ocrCurrentPage, setOcrCurrentPage] = useState(0);

  // File input refs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  /* --- File handling --- */

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      const newPages: CapturedPage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Check page limit before adding
        if (pages.length + newPages.length >= MAX_PAGES) {
          setError(`Maximum ${MAX_PAGES} pages reached. Cannot add more pages.`);
          break;
        }

        // Validate file format and size
        const format = getFileFormat(file);
        const validation = validateFileUpload(format, file.size);

        if (!validation.valid) {
          const reasons = Object.values(validation.errors).join('. ');
          setError(`File "${file.name}" rejected: ${reasons}`);
          continue;
        }

        newPages.push({
          id: generateId(),
          file,
          thumbnailUrl: URL.createObjectURL(file),
          classification: 'content',
        });
      }

      if (newPages.length > 0) {
        setPages((prev) => [...prev, ...newPages]);
      }
    },
    [pages.length],
  );

  const handleCameraCapture = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const handleUpload = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  /* --- Page operations --- */

  const handleDelete = useCallback((pageId: string) => {
    setPages((prev) => {
      const page = prev.find((p) => p.id === pageId);
      if (page) URL.revokeObjectURL(page.thumbnailUrl);
      return prev.filter((p) => p.id !== pageId);
    });
    setError(null);
  }, []);

  const handleToggleClassification = useCallback((pageId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, classification: p.classification === 'content' ? 'exercise' : 'content' }
          : p,
      ),
    );
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setPages((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  }, []);

  const handleRecapture = useCallback(
    (pageId: string) => {
      // Create a temporary input for recapture
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/heic';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const format = getFileFormat(file);
        const validation = validateFileUpload(format, file.size);
        if (!validation.valid) {
          const reasons = Object.values(validation.errors).join('. ');
          setError(`File "${file.name}" rejected: ${reasons}`);
          return;
        }

        setPages((prev) =>
          prev.map((p) => {
            if (p.id === pageId) {
              URL.revokeObjectURL(p.thumbnailUrl);
              return {
                ...p,
                file,
                thumbnailUrl: URL.createObjectURL(file),
              };
            }
            return p;
          }),
        );
        setError(null);
      };
      input.click();
    },
    [],
  );

  /* --- Done & OCR --- */

  const handleDone = useCallback(() => {
    setError(null);

    if (pages.length === 0) {
      setError('At least 1 page is required. Please capture or upload pages before proceeding.');
      return;
    }

    if (pages.length > MAX_PAGES) {
      setError(
        `Cannot proceed: ${pages.length} pages exceed the maximum of ${MAX_PAGES}. Please remove pages before proceeding.`,
      );
      return;
    }

    // Lock pages and start OCR
    setIsLocked(true);
    setOcrStatus('processing');

    const results: OcrPageResult[] = pages.map((p) => ({
      pageId: p.id,
      status: 'pending' as const,
    }));
    setOcrResults(results);
    processOcr(results);
  }, [pages]);

  const processOcr = useCallback(
    (results: OcrPageResult[]) => {
      let currentIndex = 0;

      const processNext = () => {
        if (currentIndex >= results.length) {
          setOcrStatus('complete');
          // Navigate to transcript editor on complete
          setTimeout(() => {
            navigate(`/learner/chapter/${chapterId}/transcript`);
          }, 500);
          return;
        }

        setOcrCurrentPage(currentIndex + 1);
        setOcrResults((prev) =>
          prev.map((r, i) => (i === currentIndex ? { ...r, status: 'processing' as const } : r)),
        );

        // Simulate OCR processing with random success/failure
        setTimeout(() => {
          const success = Math.random() > 0.1; // 90% success rate
          setOcrResults((prev) =>
            prev.map((r, i) =>
              i === currentIndex ? { ...r, status: success ? 'success' : 'failed' } : r,
            ),
          );

          currentIndex++;
          processNext();
        }, OCR_TIME_PER_PAGE_MS);
      };

      processNext();
    },
    [chapterId, navigate],
  );

  const handleRetryOcr = useCallback(
    (pageId: string) => {
      const pageIndex = ocrResults.findIndex((r) => r.pageId === pageId);
      if (pageIndex === -1) return;

      setOcrResults((prev) =>
        prev.map((r) => (r.pageId === pageId ? { ...r, status: 'processing' as const } : r)),
      );

      // Simulate retry
      setTimeout(() => {
        const success = Math.random() > 0.2; // 80% success on retry
        setOcrResults((prev) =>
          prev.map((r) =>
            r.pageId === pageId ? { ...r, status: success ? 'success' : 'failed' } : r,
          ),
        );

        // Check if all done
        setOcrResults((prev) => {
          const allComplete = prev.every((r) => r.status === 'success' || r.status === 'failed');
          const allSuccess = prev.every((r) => r.status === 'success');
          if (allComplete && allSuccess) {
            setTimeout(() => {
              navigate(`/learner/chapter/${chapterId}/transcript`);
            }, 500);
          }
          return prev;
        });
      }, OCR_TIME_PER_PAGE_MS);
    },
    [ocrResults, chapterId, navigate],
  );

  /* --- Styles --- */

  const styles = {
    container: {
      maxWidth: '960px',
      margin: '0 auto',
      padding: '24px 16px',
    } as React.CSSProperties,
    header: {
      marginBottom: '24px',
    } as React.CSSProperties,
    title: {
      fontSize: '24px',
      fontWeight: 600,
      color: theme.colors.textPrimary,
      marginBottom: '8px',
    } as React.CSSProperties,
    subtitle: {
      fontSize: '14px',
      color: theme.colors.textSecondary,
    } as React.CSSProperties,
    inputModes: {
      display: 'flex',
      gap: '12px',
      marginBottom: '20px',
    } as React.CSSProperties,
    modeButton: {
      padding: '12px 24px',
      borderRadius: theme.radii.button,
      border: 'none',
      fontWeight: 600,
      fontSize: '14px',
      cursor: 'pointer',
      color: theme.colors.white,
      minHeight: '48px',
    } as React.CSSProperties,
    cameraButton: {
      backgroundColor: theme.colors.primary,
    } as React.CSSProperties,
    uploadButton: {
      backgroundColor: theme.colors.secondary,
    } as React.CSSProperties,
    error: {
      backgroundColor: '#FEE2E2',
      border: `1px solid ${theme.colors.error}`,
      borderRadius: theme.radii.input,
      padding: '12px 16px',
      color: theme.colors.error,
      fontSize: '14px',
      marginBottom: '16px',
    } as React.CSSProperties,
    pageCount: {
      fontSize: '14px',
      color: theme.colors.textSecondary,
      marginBottom: '16px',
    } as React.CSSProperties,
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: '16px',
      marginBottom: '24px',
    } as React.CSSProperties,
    thumbnail: {
      borderRadius: theme.radii.card,
      border: `1px solid ${theme.colors.border}`,
      overflow: 'hidden',
      position: 'relative' as const,
    } as React.CSSProperties,
    thumbnailImage: {
      width: '100%',
      height: '120px',
      objectFit: 'cover' as const,
      display: 'block',
    } as React.CSSProperties,
    thumbnailOverlay: {
      position: 'absolute' as const,
      top: '4px',
      left: '4px',
      backgroundColor: theme.colors.dark,
      color: theme.colors.white,
      fontSize: '12px',
      fontWeight: 600,
      padding: '2px 8px',
      borderRadius: '10px',
    } as React.CSSProperties,
    thumbnailActions: {
      padding: '8px',
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '6px',
    } as React.CSSProperties,
    classificationToggle: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontSize: '11px',
      color: theme.colors.textSecondary,
    } as React.CSSProperties,
    toggleButton: {
      padding: '3px 8px',
      borderRadius: '10px',
      border: `1px solid ${theme.colors.border}`,
      fontSize: '11px',
      cursor: 'pointer',
      backgroundColor: theme.colors.white,
    } as React.CSSProperties,
    toggleActive: {
      backgroundColor: theme.colors.primary,
      color: theme.colors.white,
      borderColor: theme.colors.primary,
    } as React.CSSProperties,
    actionRow: {
      display: 'flex',
      gap: '4px',
      flexWrap: 'wrap' as const,
    } as React.CSSProperties,
    smallButton: {
      padding: '4px 8px',
      borderRadius: '8px',
      border: `1px solid ${theme.colors.border}`,
      fontSize: '11px',
      cursor: 'pointer',
      backgroundColor: theme.colors.white,
      color: theme.colors.textSecondary,
    } as React.CSSProperties,
    doneButton: {
      padding: '14px 32px',
      borderRadius: theme.radii.button,
      border: 'none',
      backgroundColor: theme.colors.primary,
      color: theme.colors.white,
      fontWeight: 600,
      fontSize: '16px',
      cursor: 'pointer',
      minHeight: '48px',
    } as React.CSSProperties,
    ocrContainer: {
      textAlign: 'center' as const,
      padding: '48px 24px',
    } as React.CSSProperties,
    ocrTitle: {
      fontSize: '20px',
      fontWeight: 600,
      color: theme.colors.textPrimary,
      marginBottom: '16px',
    } as React.CSSProperties,
    ocrProgress: {
      fontSize: '16px',
      color: theme.colors.textSecondary,
      marginBottom: '24px',
    } as React.CSSProperties,
    ocrPageList: {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: '8px',
      justifyContent: 'center',
      marginTop: '24px',
    } as React.CSSProperties,
    ocrPageBadge: {
      padding: '6px 12px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: 500,
    } as React.CSSProperties,
  };

  /* --- OCR Processing Screen --- */

  if (ocrStatus === 'processing' || ocrStatus === 'complete') {
    const failedPages = ocrResults.filter((r) => r.status === 'failed');
    const successPages = ocrResults.filter((r) => r.status === 'success');
    const totalPages = ocrResults.length;

    return (
      <div style={styles.container}>
        <div style={styles.ocrContainer}>
          <h2 style={styles.ocrTitle}>OCR Processing</h2>
          <p style={styles.ocrProgress}>
            Extracting text from pages... {ocrCurrentPage} of {totalPages}
          </p>

          {ocrStatus === 'complete' && failedPages.length === 0 && (
            <p style={{ color: theme.colors.success, fontWeight: 600 }}>
              All pages processed successfully! Redirecting...
            </p>
          )}

          {ocrStatus === 'complete' && failedPages.length > 0 && (
            <p style={{ color: theme.colors.error }}>
              {failedPages.length} page(s) failed. {successPages.length}/{totalPages} processed
              successfully.
            </p>
          )}

          <div style={styles.ocrPageList} role="list" aria-label="OCR page status">
            {ocrResults.map((result, index) => {
              let bgColor: string = theme.colors.border;
              let textColor: string = theme.colors.textSecondary;

              if (result.status === 'processing') {
                bgColor = theme.colors.warning;
                textColor = theme.colors.dark;
              } else if (result.status === 'success') {
                bgColor = theme.colors.success;
                textColor = theme.colors.white;
              } else if (result.status === 'failed') {
                bgColor = theme.colors.error;
                textColor = theme.colors.white;
              }

              return (
                <div
                  key={result.pageId}
                  role="listitem"
                  style={{
                    ...styles.ocrPageBadge,
                    backgroundColor: bgColor,
                    color: textColor,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Page {index + 1}</span>
                  {result.status === 'failed' && (
                    <button
                      onClick={() => handleRetryOcr(result.pageId)}
                      aria-label={`Retry OCR for page ${index + 1}`}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid white',
                        backgroundColor: 'transparent',
                        color: 'white',
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* --- Page Capture Screen --- */

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Capture Pages</h2>
        <p style={styles.subtitle}>
          Chapter ID: {chapterId} — Capture or upload textbook pages ({MIN_PAGES}–{MAX_PAGES}{' '}
          pages)
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div style={styles.error} role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {/* Input modes */}
      {!isLocked && (
        <div style={styles.inputModes}>
          <button
            onClick={handleCameraCapture}
            style={{ ...styles.modeButton, ...styles.cameraButton }}
            aria-label="Capture page with camera"
          >
            📷 Camera
          </button>
          <button
            onClick={handleUpload}
            style={{ ...styles.modeButton, ...styles.uploadButton }}
            aria-label="Upload page from file"
          >
            📁 Upload
          </button>

          {/* Hidden file inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic"
            capture="environment"
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/heic"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            style={{ display: 'none' }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Page count */}
      <p style={styles.pageCount}>
        {pages.length} / {MAX_PAGES} pages captured
      </p>

      {/* Thumbnail grid */}
      {pages.length > 0 && (
        <div style={styles.grid} role="list" aria-label="Captured pages">
          {pages.map((page, index) => (
            <div key={page.id} style={styles.thumbnail} role="listitem">
              <img
                src={page.thumbnailUrl}
                alt={`Page ${index + 1}`}
                style={styles.thumbnailImage}
              />
              <div style={styles.thumbnailOverlay}>{index + 1}</div>

              <div style={styles.thumbnailActions}>
                {/* Classification toggle */}
                <div style={styles.classificationToggle}>
                  <button
                    onClick={() => handleToggleClassification(page.id)}
                    style={{
                      ...styles.toggleButton,
                      ...(page.classification === 'content' ? styles.toggleActive : {}),
                    }}
                    aria-pressed={page.classification === 'content'}
                    aria-label={`Page ${index + 1} classification: ${page.classification}`}
                  >
                    {page.classification === 'content' ? 'Content' : 'Exercise'}
                  </button>
                </div>

                {/* Action buttons */}
                {!isLocked && (
                  <div style={styles.actionRow}>
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={styles.smallButton}
                      aria-label={`Move page ${index + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === pages.length - 1}
                      style={styles.smallButton}
                      aria-label={`Move page ${index + 1} down`}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => handleRecapture(page.id)}
                      style={styles.smallButton}
                      aria-label={`Recapture page ${index + 1}`}
                    >
                      🔄
                    </button>
                    <button
                      onClick={() => handleDelete(page.id)}
                      style={{ ...styles.smallButton, color: theme.colors.error }}
                      aria-label={`Delete page ${index + 1}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Done button */}
      {!isLocked && (
        <button
          onClick={handleDone}
          style={styles.doneButton}
          aria-label="Done capturing pages, proceed to OCR"
        >
          Done
        </button>
      )}
    </div>
  );
}
