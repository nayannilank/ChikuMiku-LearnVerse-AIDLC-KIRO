/**
 * RevisionQuiz — Revision mode with setup, quiz, and results screens.
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

  const handleStart = async () => {
    setLoading(true); setError('');
    try {
      const res = await aiApi.generateRevisionQuiz(chapterId, questionCount);
      setQuestions(res.questions);
      setPhase('quiz');
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
      <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
          <span style={{ fontSize: 15, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>Revision Quiz</span>
        </div>
        {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <i className="fas fa-clipboard-check" style={{ fontSize: 28, color: theme.colors.purple, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: '700', color: theme.colors.dark, marginBottom: 16 }}>Start Revision Quiz</div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: '600', color: theme.colors.text, marginBottom: 6, display: 'block' }}>Number of Questions</label>
            <input type="range" min="5" max="20" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={{ width: '100%', accentColor: theme.colors.purple }} />
            <span style={{ fontSize: 12, fontWeight: '700', color: theme.colors.purple }}>{questionCount}</span>
          </div>
          <button style={{ width: '100%', padding: 14, borderRadius: 22, border: 'none', background: theme.gradients.primary, color: '#fff', fontSize: 14, fontWeight: '700', cursor: 'pointer' }} onClick={handleStart} disabled={loading}>
            {loading ? 'Generating...' : 'Start Quiz'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'quiz') {
    const q = questions[currentQ];
    if (!q) return null;
    return (
      <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, flex: 1 }}>Question {currentQ + 1}/{questions.length}</span>
        </div>
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 480, margin: '0 auto' }}>
          <div style={{ fontSize: 15, fontWeight: '600', color: theme.colors.dark, lineHeight: 1.5, marginBottom: 16 }}>{q.question}</div>
          {q.type === 'mcq' && (q.options || []).map((opt) => (
            <button key={opt} style={{ width: '100%', padding: '12px', borderRadius: 10, border: `2px solid ${answers[q.id] === opt ? theme.colors.purple : theme.colors.border}`, background: answers[q.id] === opt ? theme.colors.purpleLight : '#fff', fontSize: 13, cursor: 'pointer', textAlign: 'center', marginBottom: 8 }} onClick={() => handleAnswer(q.id, opt)}>{opt}</button>
          ))}
          {q.type !== 'mcq' && (
            <input style={{ width: '100%', padding: '12px', borderRadius: 10, border: `1px solid ${theme.colors.border}`, fontSize: 14, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }} placeholder="Type your answer..." value={answers[q.id] || ''} onChange={(e) => handleAnswer(q.id, e.target.value)} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={{ padding: '10px 16px', borderRadius: 16, border: `1px solid ${theme.colors.border}`, background: '#fff', fontSize: 12, fontWeight: '600', cursor: 'pointer', opacity: currentQ === 0 ? 0.4 : 1 }} onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}>← Prev</button>
            {currentQ < questions.length - 1 ? (
              <button style={{ flex: 1, padding: '10px 16px', borderRadius: 16, border: 'none', background: theme.colors.purple, color: '#fff', fontSize: 12, fontWeight: '600', cursor: 'pointer' }} onClick={() => setCurrentQ(currentQ + 1)}>Next →</button>
            ) : (
              <button style={{ flex: 1, padding: '10px 16px', borderRadius: 16, border: 'none', background: `linear-gradient(135deg, ${theme.colors.green}, #1E8449)`, color: '#fff', fontSize: 12, fontWeight: '700', cursor: 'pointer' }} onClick={handleFinish}>Finish Quiz</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'results' && results) {
    const percentage = Math.round((results.score / results.total) * 100);
    const gradeColor = percentage >= 80 ? theme.colors.green : percentage >= 50 ? theme.colors.gold : theme.colors.red;
    return (
      <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: '800', color: gradeColor }}>{percentage}%</div>
          <div style={{ fontSize: 13, color: theme.colors.textLight, marginBottom: 20 }}>{results.score}/{results.total} correct</div>
          <button style={{ width: '100%', padding: 13, borderRadius: 22, border: `1px solid ${theme.colors.purple}`, background: '#fff', color: theme.colors.purple, fontSize: 13, fontWeight: '700', cursor: 'pointer' }} onClick={() => { setPhase('setup'); setAnswers({}); setCurrentQ(0); }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}
