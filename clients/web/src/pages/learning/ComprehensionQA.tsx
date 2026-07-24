/**
 * ComprehensionQA — Chapter Q&A with model answers.
 */
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { aiApi } from '../../services/aiApi';

export function ComprehensionQA() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await aiApi.askQuestion({ chapterId, question, sessionContext: [] });
      setAnswer(res.answer);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to get answer');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 15, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, flex: 1 }}>Q&A</span>
      </div>
      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 560, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text, marginBottom: 4, display: 'block' }}>Ask a question about this chapter</label>
          <textarea style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${theme.colors.border}`, fontSize: 13, lineHeight: 1.5, fontFamily: theme.fonts.family, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} placeholder="Type your question here..." value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
        </div>
        <button style={{ width: '100%', padding: 13, borderRadius: 22, border: 'none', background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: '700', cursor: 'pointer', marginBottom: 16, opacity: question.trim() ? 1 : 0.5 }} onClick={handleAsk} disabled={!question.trim() || loading}>
          {loading ? 'Thinking...' : 'Ask Question'}
        </button>
        {answer && (
          <div style={{ padding: 14, backgroundColor: theme.colors.purpleLight, borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <i className="fas fa-robot" style={{ color: theme.colors.purple, marginRight: 6 }} />
              <span style={{ fontSize: 11, fontWeight: '700', color: theme.colors.purple }}>Answer</span>
            </div>
            <pre style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, fontFamily: theme.fonts.family }}>{answer}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
