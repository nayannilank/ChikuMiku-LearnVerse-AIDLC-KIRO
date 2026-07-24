/**
 * GrammarExercise — Purple gradient header, exercise card, skip/submit buttons.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../theme';
import { aiApi } from '../../services/aiApi';
import type { GrammarExercise as GrammarExerciseType } from '../../services/aiApi';

export function GrammarExercise() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('chapterId') || '';
  const [exercises, setExercises] = useState<GrammarExerciseType[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!chapterId) return;
    aiApi.getGrammarExercises(chapterId)
      .then((data) => { setExercises(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [chapterId]);

  const handleSubmit = async () => {
    if (!selectedAnswer) return;
    try {
      const res = await aiApi.submitGrammarAnswer(exercises[currentIndex].id, selectedAnswer);
      setIsCorrect(res.correct);
      setIsSubmitted(true);
    } catch { setIsCorrect(selectedAnswer === exercises[currentIndex].correctAnswer); setIsSubmitted(true); }
  };

  const handleNext = () => {
    setSelectedAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setCurrentIndex(currentIndex + 1);
  };

  const handleSkip = () => {
    setSelectedAnswer('');
    setIsSubmitted(false);
    setIsCorrect(false);
    setCurrentIndex(currentIndex + 1);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading exercises...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: theme.colors.red, fontFamily: theme.fonts.family }}>{error}</div>;
  if (exercises.length === 0) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>No exercises available.</div>;

  const exercise = exercises[currentIndex];
  if (!exercise) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>All exercises completed! 🎉</div>;

  return (
    <div style={styles.container}>
      {/* Purple gradient header */}
      <div style={styles.headerBar}>
        <i className="fas fa-arrow-left" style={{ color: '#fff', fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: '#fff' }}>Grammar Exercise</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>{currentIndex + 1}/{exercises.length}</span>
      </div>

      {/* Exercise card */}
      <div style={styles.content}>
        <div style={styles.exerciseCard}>
          {/* Question */}
          <div style={styles.questionBox}>{exercise.question}</div>

          {/* Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {(exercise.options || []).map((option) => {
              let bg = '#fff'; let borderColor = theme.colors.border as string; let color = theme.colors.text as string;
              if (isSubmitted && option === exercise.correctAnswer) { bg = theme.colors.greenLight; borderColor = theme.colors.green; color = theme.colors.green; }
              else if (isSubmitted && option === selectedAnswer && !isCorrect) { bg = theme.colors.redLight; borderColor = theme.colors.red; color = theme.colors.red; }
              else if (!isSubmitted && option === selectedAnswer) { bg = theme.colors.purpleLight; borderColor = theme.colors.purple; color = theme.colors.purple; }
              return (
                <button key={option} style={{ padding: '12px 14px', borderRadius: 10, border: `2px solid ${borderColor}`, background: bg, fontSize: 13, fontWeight: '500', color, cursor: isSubmitted ? 'default' : 'pointer', textAlign: 'center' }} onClick={() => !isSubmitted && setSelectedAnswer(option)} disabled={isSubmitted}>
                  {option}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {isSubmitted && (
            <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${isCorrect ? theme.colors.green : theme.colors.red}`, backgroundColor: isCorrect ? theme.colors.greenLight : theme.colors.redLight, marginBottom: 16 }}>
              <div style={{ fontWeight: '700', color: isCorrect ? theme.colors.green : theme.colors.red, marginBottom: 6 }}>{isCorrect ? 'Correct! 🎉' : 'Not quite!'}</div>
              <div style={{ fontSize: 12, color: theme.colors.text, lineHeight: 1.5 }}>{exercise.explanation}</div>
            </div>
          )}

          {/* Skip/Submit buttons */}
          {!isSubmitted ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={styles.skipBtn} onClick={handleSkip}>Skip</button>
              <button style={{ ...styles.submitBtn, opacity: selectedAnswer ? 1 : 0.5 }} onClick={handleSubmit} disabled={!selectedAnswer}>Submit</button>
            </div>
          ) : (
            <button style={styles.nextExBtn} onClick={handleNext}>Next Exercise →</button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh' },
  headerBar: { background: theme.gradients.dark, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  content: { padding: 20, display: 'flex', justifyContent: 'center' },
  exerciseCard: { background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 500, width: '100%' },
  questionBox: { fontSize: 16, fontWeight: theme.fonts.weights.semibold, color: theme.colors.dark, lineHeight: 1.5, marginBottom: 16, padding: 14, backgroundColor: theme.colors.bg, borderRadius: 10 },
  skipBtn: { flex: 1, padding: 13, borderRadius: 22, border: `1px solid ${theme.colors.border}`, background: '#fff', fontSize: 13, fontWeight: '600', cursor: 'pointer', color: theme.colors.text },
  submitBtn: { flex: 1, padding: 13, borderRadius: 22, border: 'none', background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: '700', cursor: 'pointer' },
  nextExBtn: { width: '100%', padding: 13, borderRadius: 22, border: 'none', background: `linear-gradient(135deg, ${theme.colors.green}, #1E8449)`, color: '#fff', fontSize: 13, fontWeight: '700', cursor: 'pointer' },
};
