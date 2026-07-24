/**
 * ComprehensionQA — Chat-style Q&A interface with timer and progress indicator.
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
    <div style={styles.container}>
      {/* Header with timer */}
      <div style={styles.headerBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="fas fa-arrow-left" style={{ color: '#fff', fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
          <span style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: '#fff' }}>Comprehension Q&A</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-clock" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
          <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Session</span>
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}

        {/* Chat-style area */}
        <div style={styles.chatArea}>
          {answer && (
            <div style={styles.answerBubble}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: theme.colors.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-robot" style={{ color: theme.colors.purple, fontSize: 10 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: '700', color: theme.colors.purple }}>LearnVerse AI</span>
              </div>
              <pre style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, fontFamily: theme.fonts.family }}>{answer}</pre>
            </div>
          )}

          {question && !answer && !loading && (
            <div style={styles.questionBubble}>
              <span style={{ fontSize: 12, color: theme.colors.dark }}>{question}</span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={styles.inputArea}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: '600', color: theme.colors.text, marginBottom: 4, display: 'block' }}>Ask a question about this chapter</label>
            <textarea style={styles.textArea} placeholder="Type your question here..." value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} />
          </div>
          <button style={{ ...styles.askBtn, opacity: question.trim() ? 1 : 0.5 }} onClick={handleAsk} disabled={!question.trim() || loading}>
            <i className="fas fa-paper-plane" style={{ marginRight: 6 }} />{loading ? 'Thinking...' : 'Ask Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  headerBar: { background: theme.gradients.dark, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  content: { flex: 1, padding: 20, display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto', width: '100%' },
  chatArea: { flex: 1, marginBottom: 16, overflowY: 'auto' as const },
  answerBubble: { padding: 14, backgroundColor: theme.colors.purpleLight, borderRadius: 12, marginBottom: 12 },
  questionBubble: { padding: 12, backgroundColor: '#fff', borderRadius: 12, border: `1px solid ${theme.colors.border}`, marginBottom: 12, marginLeft: 'auto', maxWidth: '80%' },
  inputArea: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 16, boxShadow: theme.shadows.card },
  textArea: { width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${theme.colors.border}`, fontSize: 13, lineHeight: 1.5, fontFamily: theme.fonts.family, resize: 'vertical' as const, outline: 'none', boxSizing: 'border-box' as const },
  askBtn: { width: '100%', padding: 13, borderRadius: 22, border: 'none', background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: '700', cursor: 'pointer' },
};
