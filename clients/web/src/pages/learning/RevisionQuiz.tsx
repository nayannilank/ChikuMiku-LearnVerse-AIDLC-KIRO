/**
 * RevisionQuiz — Timer + progress at top, question card with MCQ, submit button.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { aiApi } from '../../services/aiApi';
import type { RevisionQuestion } from '../../services/aiApi';

export function RevisionQuiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const [phase, setPhase] = useState<'setup' | 'quiz' | 'results'>('setup');
  const [questions, setQuestions] = useState<RevisionQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ score: number; total: number } | null>(null);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (phase !== 'quiz') return;
    const interval = setInterval(() => setTimer((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const handleStart = async () => {
    setLoading(true); setError('');
    try {
      const res = await aiApi.generateRevisionQuiz(chapterId, questionCount);
      setQuestions(res.questions);
      setPhase('quiz');
      setTimer(0);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to generate quiz');
    } finally { setLoading(false); }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleFinish = () => {
    const score = questions.reduce((acc, q) => acc + (answers[q.id] === q.correctAnswer ? 1 : 0), 0);
    setResults({ score, total: questions.length });
    setPhase('results');
  };

  if (phase === 'setup') {
    return (
      <div style={styles.container}>
        <div style={styles.headerBar}>
          <i className="fas fa-arrow-left" style={{ color: '#fff', fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
          <span style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: '#fff' }}>Revision Quiz</span>
          <div style={{ width: 14 }} />
        </div>
        <div style={styles.content}>
          {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
          <div style={styles.setupCard}>
            <i className="fas fa-clipboard-check" style={{ fontSize: 32, color: theme.colors.purple, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: '700', color: theme.colors.dark, marginBottom: 16 }}>Start Revision Quiz</div>
            <div style={{ marginBottom: 16, width: '100%' }}>
              <label style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, marginBottom: 6, display: 'block' }}>Number of Questions</label>
              <input type="range" min="5" max="20" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={{ width: '100%', accentColor: theme.colors.purple }} />
              <span style={{ fontSize: 12, fontWeight: '700', color: theme.colors.purple }}>{questionCount}</span>
            </div>
            <button style={styles.startBtn} onClick={handleStart} disabled={loading}>
              {loading ? 'Generating...' : 'Start Quiz'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    const q = questions[currentQ];
    if (!q) return null;
    const progress = ((currentQ + 1) / questions.length) * 100;

    return (
      <div style={styles.container}>
        {/* Header with timer + progress */}
        <div style={styles.headerBar}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
            <i className="fas fa-clock" style={{ marginRight: 4 }} />{formatTime(timer)}
          </span>
          <span style={{ fontSize: 13, fontWeight: theme.fonts.weights.bold, color: '#fff' }}>Question {currentQ + 1}/{questions.length}</span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{Math.round(progress)}%</span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.2)' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: theme.colors.gold, borderRadius: 2 }} />
        </div>

        <div style={styles.content}>
          <div style={styles.quizCard}>
            {/* Question number badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: '700', color: '#fff', background: theme.colors.purple, padding: '3px 10px', borderRadius: 10 }}>Q{currentQ + 1}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: '600', color: theme.colors.dark, lineHeight: 1.5, marginBottom: 16 }}>{q.question}</div>

            {/* MCQ options (radio style) */}
            {q.type === 'mcq' && (q.options || []).map((opt, i) => (
              <button key={opt} style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: `2px solid ${answers[q.id] === opt ? theme.colors.purple : theme.colors.border}`,
                background: answers[q.id] === opt ? theme.colors.purpleLight : '#fff',
                fontSize: 13, cursor: 'pointer', textAlign: 'left', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 10,
              }} onClick={() => handleAnswer(q.id, opt)}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${answers[q.id] === opt ? theme.colors.purple : theme.colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {answers[q.id] === opt && <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.colors.purple }} />}
                </span>
                <span>{String.fromCharCode(65 + i)}. {opt}</span>
              </button>
            ))}

            {q.type !== 'mcq' && (
              <input style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${theme.colors.border}`, fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} placeholder="Type your answer..." value={answers[q.id] || ''} onChange={(e) => handleAnswer(q.id, e.target.value)} />
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button style={{ ...styles.navBtn, opacity: currentQ === 0 ? 0.4 : 1 }} onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>← Prev</button>
              {currentQ < questions.length - 1 ? (
                <button style={styles.nextQBtn} onClick={() => setCurrentQ(currentQ + 1)}>Next →</button>
              ) : (
                <button style={styles.finishBtn} onClick={handleFinish}>Submit Quiz</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'results' && results) {
    const percentage = Math.round((results.score / results.total) * 100);
    const gradeColor = percentage >= 80 ? theme.colors.green : percentage >= 50 ? theme.colors.gold : theme.colors.red;
    return (
      <div style={styles.container}>
        <div style={styles.headerBar}>
          <div style={{ width: 14 }} />
          <span style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: '#fff' }}>Quiz Results</span>
          <div style={{ width: 14 }} />
        </div>
        <div style={styles.content}>
          <div style={{ ...styles.setupCard, padding: 28 }}>
            <div style={{ fontSize: 48, fontWeight: '800', color: gradeColor }}>{percentage}%</div>
            <div style={{ fontSize: 13, color: theme.colors.textLight, marginBottom: 6 }}>{results.score}/{results.total} correct</div>
            <div style={{ fontSize: 11, color: theme.colors.textLight, marginBottom: 20 }}>Time: {formatTime(timer)}</div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button style={{ flex: 1, padding: 13, borderRadius: 22, border: `1px solid ${theme.colors.purple}`, background: '#fff', color: theme.colors.purple, fontSize: 13, fontWeight: '700', cursor: 'pointer' }} onClick={() => { setPhase('setup'); setAnswers({}); setCurrentQ(0); setTimer(0); }}>
                Try Again
              </button>
              <button style={{ flex: 1, padding: 13, borderRadius: 22, border: 'none', background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: '700', cursor: 'pointer' }} onClick={() => navigate(-1)}>
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh' },
  headerBar: { background: theme.gradients.dark, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  content: { padding: 20, display: 'flex', justifyContent: 'center' },
  setupCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 24, boxShadow: theme.shadows.card, maxWidth: 480, width: '100%', textAlign: 'center' as const, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  startBtn: { width: '100%', padding: 14, borderRadius: 22, border: 'none', background: theme.gradients.primary, color: '#fff', fontSize: 14, fontWeight: '700', cursor: 'pointer' },
  quizCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 520, width: '100%' },
  navBtn: { padding: '10px 16px', borderRadius: 16, border: `1px solid ${theme.colors.border}`, background: '#fff', fontSize: 12, fontWeight: '600', cursor: 'pointer' },
  nextQBtn: { flex: 1, padding: '10px 16px', borderRadius: 16, border: 'none', background: theme.colors.purple, color: '#fff', fontSize: 12, fontWeight: '600', cursor: 'pointer' },
  finishBtn: { flex: 1, padding: '10px 16px', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${theme.colors.green}, #1E8449)`, color: '#fff', fontSize: 12, fontWeight: '700', cursor: 'pointer' },
};
