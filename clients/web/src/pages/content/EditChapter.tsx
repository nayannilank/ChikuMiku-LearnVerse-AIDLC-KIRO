/**
 * EditChapter — Edit an existing chapter's number and name.
 *
 * Only the chapter number and name are editable here (pages are managed via
 * the capture/OCR flow). Loads the chapter via GET /content/chapters/:id and
 * saves via PUT /content/chapters/:id.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';
import { contentApi } from '../../services/contentApi';

export function EditChapter() {
  const navigate = useNavigate();
  const { chapterId } = useParams<{ chapterId: string }>();
  const [searchParams] = useSearchParams();
  const learnerId = searchParams.get('learnerId') ?? '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [bookName, setBookName] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [chapterName, setChapterName] = useState('');

  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;
    contentApi
      .getChapter(chapterId)
      .then((chapter) => {
        if (cancelled) return;
        setBookName(chapter.bookName);
        setChapterNumber(String(chapter.chapterNumber));
        setChapterName(chapter.chapterName);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setServerError((err as { message?: string })?.message || 'Failed to load chapter');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  const validate = () => {
    const errors: Record<string, string> = {};
    const num = Number(chapterNumber);
    if (!Number.isInteger(num) || num < 1 || num > 999) errors.chapterNumber = '1-999';
    if (chapterName.trim().length < 3 || chapterName.trim().length > 100) errors.chapterName = '3-100 characters required';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !chapterId) return;
    setSaving(true);
    setServerError('');
    try {
      await contentApi.editChapter(chapterId, {
        chapterNumber: Number(chapterNumber),
        chapterName: chapterName.trim(),
      });
      navigate(learnerId ? `/content/manage?learnerId=${encodeURIComponent(learnerId)}` : '/content/manage');
    } catch (err: unknown) {
      setServerError((err as { message?: string })?.message || 'Failed to save chapter');
    } finally {
      setSaving(false);
    }
  };

  const styles: Record<string, React.CSSProperties> = {
    page: { minHeight: '100vh', background: theme.colors.bg, fontFamily: theme.fonts.family },
    content: { display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 20px' },
    card: { width: '100%', maxWidth: 560 },
    backRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 },
    title: { fontSize: theme.fonts.sizes.xl, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark },
    row: { display: 'flex', gap: 12 },
    error: { background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: theme.borderRadius.input, fontSize: theme.fonts.sizes.sm, marginBottom: 12, textAlign: 'center' },
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading...</div>;
  }

  return (
    <div style={styles.page}>
      <div style={styles.content}>
        <Card style={styles.card} padding="24px">
          <div style={styles.backRow}>
            <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
            <span style={styles.title}>Edit Chapter</span>
          </div>

          {serverError && <div style={styles.error}>{serverError}</div>}

          <Input label="Book" value={bookName} readOnly />

          <div style={styles.row}>
            <div style={{ flex: '0 0 100px' }}>
              <Input label="Chapter #" type="number" value={chapterNumber} onChange={(e) => setChapterNumber(e.target.value)} required error={validationErrors.chapterNumber} />
            </div>
            <div style={{ flex: 1 }}>
              <Input label="Chapter Name" value={chapterName} onChange={(e) => setChapterName(e.target.value)} placeholder="3-100 characters" required error={validationErrors.chapterName} />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <Button variant="primary" label={saving ? 'Saving...' : 'Save Chapter'} icon="save" onPress={handleSave} fullWidth disabled={saving} />
          </div>
        </Card>
      </div>
    </div>
  );
}
