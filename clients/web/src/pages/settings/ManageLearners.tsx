/**
 * ManageLearners — List of registered learners with actions.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';
import { learningApi } from '../../services/learningApi';
import type { LearnerProfile } from '../../services/learningApi';

export function ManageLearners() {
  const navigate = useNavigate();
  const [learners, setLearners] = useState<LearnerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    learningApi.getLearners()
      .then((data) => { setLearners(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this learner? This cannot be undone.')) return;
    try {
      await learningApi.removeLearner(id);
      setLearners(learners.filter((l) => l.id !== id));
    } catch (err: unknown) {
      setError((err as { message?: string })?.message || 'Failed to remove learner');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading...</div>;

  return (
    <div style={{ fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" style={{ color: theme.colors.purple, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate(-1)} />
        <span style={{ fontSize: 16, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, flex: 1 }}>Manage Learners</span>
        <span style={{ fontSize: 11, color: theme.colors.textLight }}>{learners.length} learner{learners.length !== 1 ? 's' : ''}</span>
      </div>
      {error && <div style={{ background: theme.colors.redLight, color: theme.colors.red, padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500 }}>
        {learners.map((learner) => (
          <div key={learner.id} style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 16, boxShadow: theme.shadows.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 28 }}>{learner.gender === 'female' ? '👧' : learner.gender === 'male' ? '👦' : '🧒'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: '700', color: theme.colors.dark }}>{learner.name}</div>
                <div style={{ fontSize: 11, color: theme.colors.textLight }}>{learner.gender} • Grade: {learner.grade}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
              {learner.subjects.map((s) => <span key={s} style={{ fontSize: 9, fontWeight: '600', padding: '3px 8px', borderRadius: 8, background: theme.colors.purpleLight, color: theme.colors.purple }}>{s}</span>)}
            </div>
            <div style={{ display: 'flex', gap: 6, paddingTop: 8, borderTop: `1px solid ${theme.colors.border}` }}>
              <button style={{ fontSize: 10, fontWeight: '600', color: theme.colors.purple, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }} onClick={() => navigate('/register/learner')}>
                <i className="fas fa-edit" style={{ marginRight: 4 }} /> Edit
              </button>
              <button style={{ fontSize: 10, fontWeight: '600', color: theme.colors.red, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }} onClick={() => handleRemove(learner.id)}>
                <i className="fas fa-trash" style={{ marginRight: 4 }} /> Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <button style={{ width: '100%', maxWidth: 500, padding: 14, borderRadius: 22, border: `2px dashed ${theme.colors.purple}`, background: theme.colors.purpleLight, color: theme.colors.purple, fontSize: 13, fontWeight: '600', cursor: 'pointer', marginTop: 12 }} onClick={() => navigate('/register/learner')}>
        <i className="fas fa-plus" style={{ marginRight: 8 }} /> Add New Learner
      </button>
    </div>
  );
}
