/**
 * LearnerDashboard — Main dashboard for a logged-in learner with tree navigation.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';
import { TreeNavigation } from '../../components/TreeNavigation';
import type { TreeNodeData } from '../../components/TreeNavigation';
import { dashboardApi } from '../../services/dashboardApi';
import type { DashboardSubject } from '../../services/dashboardApi';
import { useAuth } from '../../context/AuthContext';

export function LearnerDashboard() {
  const navigate = useNavigate();
  const { username } = useAuth();
  const [subjects, setSubjects] = useState<DashboardSubject[]>([]);
  const [learnerName, setLearnerName] = useState('');
  const [streak, setStreak] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.getLearnerDashboard()
      .then((res) => { setSubjects(res.subjects); setLearnerName(res.learnerName); setStreak(res.streak); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard'); setLoading(false); });
  }, []);

  const treeData: TreeNodeData[] = subjects.map((subject) => ({
    id: subject.id,
    label: subject.name,
    icon: subject.icon,
    iconColor: subject.color,
    children: [
      ...subject.books.map((book) => ({
        id: book.id,
        label: book.name,
        icon: 'book',
        iconColor: theme.colors.textLight,
        children: book.chapters.map((ch) => ({
          id: ch.id,
          label: ch.name,
          progress: ch.progress,
          iconColor: subject.color,
          data: { ...ch, subjectName: subject.name, subjectIcon: subject.icon, subjectColor: subject.color, subjectBg: subject.bgColor, bookName: book.name },
        })),
      })),
      { id: `${subject.id}-quiz`, label: 'Quizzes', icon: 'clipboard-check', iconColor: theme.colors.textLight, meta: `${subject.quizzes.completed}/${subject.quizzes.total}` },
    ],
  }));

  const handleSelect = (node: TreeNodeData) => { if (node.data) setSelectedItem(node.data); };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading dashboard...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: theme.colors.red, fontFamily: theme.fonts.family }}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fas fa-book-open-reader" style={{ color: theme.colors.pink, fontSize: 16 }} />
          <span style={{ fontSize: 13, fontWeight: theme.fonts.weights.extrabold, color: theme.colors.dark }}>ChikuMiku LearnVerse</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: theme.colors.gold, fontWeight: theme.fonts.weights.semibold }}>🔥 {streak} day streak!</span>
          <span style={{ fontSize: 11, color: theme.colors.text }}>Hi, {learnerName || username}!</span>
        </div>
      </div>
      <div style={styles.banner}>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Hello, {learnerName || username}! 👋</span>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: theme.fonts.weights.bold, display: 'block', marginTop: 2 }}>My Learning</span>
      </div>
      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <div style={{ fontSize: 12, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 8 }}>My Subjects</div>
          <TreeNavigation data={treeData} onSelect={handleSelect} />
        </div>
        <div style={styles.rightPanel}>
          {selectedItem ? (
            <LearnerDetailView item={selectedItem} navigate={navigate} />
          ) : (
            <div style={styles.emptyState}>
              <i className="fas fa-book-reader" style={{ fontSize: 36, color: theme.colors.border }} />
              <p style={{ color: theme.colors.textLight, marginTop: 12 }}>Select a chapter to continue learning</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LearnerDetailView({ item, navigate }: { item: Record<string, unknown>; navigate: (path: string) => void }) {
  const progress = (item.progress as number) || 0;
  const exerciseProgress = (item.exerciseProgress as number) || 0;
  const pagesRead = (item.pagesRead as number) || 0;
  const pagesTotal = (item.pagesTotal as number) || 0;
  const chapterId = item.id as string;

  return (
    <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: (item.subjectBg as string) || theme.colors.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fas fa-${item.subjectIcon || 'book'}`} style={{ color: (item.subjectColor as string) || theme.colors.purple, fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>{item.name as string}</div>
          <div style={{ fontSize: 11, color: theme.colors.textLight }}>{item.bookName as string} • {item.subjectName as string}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ borderRadius: 10, padding: 10, textAlign: 'center', backgroundColor: (item.subjectBg as string) || theme.colors.purpleLight }}>
          <div style={{ fontSize: 18, fontWeight: '800', color: (item.subjectColor as string) || theme.colors.purple }}>{progress}%</div>
          <div style={{ fontSize: 9, color: theme.colors.textLight }}>Read</div>
        </div>
        <div style={{ borderRadius: 10, padding: 10, textAlign: 'center', backgroundColor: theme.colors.greenLight }}>
          <div style={{ fontSize: 18, fontWeight: '800', color: theme.colors.green }}>{exerciseProgress}%</div>
          <div style={{ fontSize: 9, color: theme.colors.textLight }}>Exercise</div>
        </div>
        <div style={{ borderRadius: 10, padding: 10, textAlign: 'center', backgroundColor: theme.colors.blueLight }}>
          <div style={{ fontSize: 18, fontWeight: '800', color: theme.colors.blue }}>{pagesRead}</div>
          <div style={{ fontSize: 9, color: theme.colors.textLight }}>Pages Done</div>
        </div>
        <div style={{ borderRadius: 10, padding: 10, textAlign: 'center', backgroundColor: theme.colors.goldLight }}>
          <div style={{ fontSize: 18, fontWeight: '800', color: theme.colors.hindi }}>{pagesTotal - pagesRead}</div>
          <div style={{ fontSize: 9, color: theme.colors.textLight }}>Pages Left</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={{ flex: 1, padding: '10px 14px', border: 'none', borderRadius: 20, background: theme.gradients.primary, color: '#fff', fontSize: 11, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer' }} onClick={() => navigate(`/content/explain?chapterId=${chapterId}`)}>
          <i className="fas fa-play" style={{ marginRight: 6 }} /> Continue Reading
        </button>
        <button style={{ padding: '10px 14px', border: `1px solid ${theme.colors.border}`, borderRadius: 20, background: '#fff', fontSize: 11, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer' }} onClick={() => navigate(`/learn/revision?chapterId=${chapterId}`)}>
          <i className="fas fa-pen" style={{ marginRight: 6 }} /> Take Exercise
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#fff', borderBottom: `1px solid ${theme.colors.border}` },
  banner: { background: theme.colors.dark, padding: '12px 20px' },
  main: { display: 'flex', height: 'calc(100vh - 100px)' },
  leftPanel: { width: 240, backgroundColor: '#F3EEF9', borderRight: `1px solid ${theme.colors.border}`, overflowY: 'auto', padding: 12 },
  rightPanel: { flex: 1, padding: 20, overflowY: 'auto' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
};
