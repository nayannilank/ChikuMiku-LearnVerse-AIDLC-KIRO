/**
 * ParentDashboard — Main dashboard for parent role with tree navigation.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../theme';
import { TreeNavigation } from '../../components/TreeNavigation';
import type { TreeNodeData } from '../../components/TreeNavigation';
import { dashboardApi } from '../../services/dashboardApi';
import type { DashboardLearner } from '../../services/dashboardApi';
import { useAuth } from '../../context/AuthContext';

export function ParentDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [learners, setLearners] = useState<DashboardLearner[]>([]);
  const [selectedItem, setSelectedItem] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardApi.getParentDashboard()
      .then((res) => { setLearners(res.learners); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard'); setLoading(false); });
  }, []);

  const treeData: TreeNodeData[] = learners.map((learner) => ({
    id: learner.id,
    label: learner.name,
    icon: 'user-graduate',
    iconColor: theme.colors.purple,
    meta: `Grade ${learner.grade}`,
    children: learner.subjects.map((subject) => ({
      id: subject.id,
      label: subject.name,
      icon: subject.icon,
      iconColor: subject.color,
      children: subject.books.map((book) => ({
        id: book.id,
        label: book.name,
        icon: 'book',
        iconColor: theme.colors.textLight,
        children: book.chapters.map((ch) => ({
          id: ch.id,
          label: ch.name,
          progress: ch.progress,
          iconColor: subject.color,
          data: { ...ch, subjectName: subject.name, subjectIcon: subject.icon, subjectColor: subject.color, subjectBg: subject.bgColor, bookName: book.name, learnerName: learner.name },
        })),
      })),
    })),
  }));

  const handleSelect = (node: TreeNodeData) => {
    if (node.data) setSelectedItem(node.data);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', fontFamily: theme.fonts.family }}>Loading dashboard...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: theme.colors.red, fontFamily: theme.fonts.family }}>{error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <i className="fas fa-book-open-reader" style={{ color: theme.colors.pink, fontSize: 18 }} />
          <span style={styles.headerTitle}>ChikuMiku LearnVerse</span>
          <span style={styles.headerSub}>Parent Dashboard</span>
        </div>
        <div style={styles.headerRight}>
          <i className="fas fa-cog" style={{ color: theme.colors.textLight, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate('/parent/settings')} />
          <div style={styles.avatar} onClick={logout}>
            <i className="fas fa-user" style={{ color: '#fff', fontSize: 11 }} />
          </div>
        </div>
      </div>
      <div style={styles.main}>
        <div style={styles.leftPanel}>
          <TreeNavigation data={treeData} onSelect={handleSelect} />
        </div>
        <div style={styles.rightPanel}>
          {selectedItem ? (
            <DetailView item={selectedItem} />
          ) : (
            <div style={styles.emptyState}>
              <i className="fas fa-hand-pointer" style={{ fontSize: 32, color: theme.colors.border }} />
              <p style={{ color: theme.colors.textLight, marginTop: 12 }}>Select a chapter from the tree to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailView({ item }: { item: Record<string, unknown> }) {
  const progress = (item.progress as number) || 0;
  const exerciseProgress = (item.exerciseProgress as number) || 0;
  return (
    <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: (item.subjectBg as string) || theme.colors.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`fas fa-${item.subjectIcon || 'book'}`} style={{ color: (item.subjectColor as string) || theme.colors.purple, fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>{item.name as string}</div>
          <div style={{ fontSize: 11, color: theme.colors.textLight }}>{item.bookName as string} • {item.subjectName as string} • {item.learnerName as string}</div>
        </div>
        <div style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 14, fontSize: 12, fontWeight: theme.fonts.weights.bold, backgroundColor: (item.subjectBg as string) || theme.colors.purpleLight, color: (item.subjectColor as string) || theme.colors.purple }}>{progress}%</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <div style={{ borderRadius: 10, padding: 12, textAlign: 'center', backgroundColor: (item.subjectBg as string) || theme.colors.purpleLight }}>
          <div style={{ fontSize: 20, fontWeight: '800', color: (item.subjectColor as string) || theme.colors.purple }}>{progress}%</div>
          <div style={{ fontSize: 10, color: theme.colors.textLight }}>Chapter Read</div>
        </div>
        <div style={{ borderRadius: 10, padding: 12, textAlign: 'center', backgroundColor: theme.colors.greenLight }}>
          <div style={{ fontSize: 20, fontWeight: '800', color: theme.colors.green }}>{exerciseProgress}%</div>
          <div style={{ fontSize: 10, color: theme.colors.textLight }}>Exercise Score</div>
        </div>
        <div style={{ borderRadius: 10, padding: 12, textAlign: 'center', backgroundColor: theme.colors.blueLight }}>
          <div style={{ fontSize: 20, fontWeight: '800', color: theme.colors.blue }}>{(item.pagesRead as number) || 0}</div>
          <div style={{ fontSize: 10, color: theme.colors.textLight }}>Pages Read</div>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: theme.fonts.weights.semibold, color: theme.colors.text, marginBottom: 4 }}>Reading Progress</div>
        <div style={{ height: 8, backgroundColor: '#F0E8F5', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: theme.gradients.primary, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: theme.fonts.family, backgroundColor: theme.colors.bg, minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#fff', borderBottom: `1px solid ${theme.colors.border}` },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 13, fontWeight: theme.fonts.weights.extrabold, color: theme.colors.dark },
  headerSub: { fontSize: 11, color: theme.colors.purple, fontWeight: theme.fonts.weights.semibold, marginLeft: 8 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 28, height: 28, borderRadius: '50%', backgroundColor: theme.colors.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  main: { display: 'flex', height: 'calc(100vh - 52px)' },
  leftPanel: { width: 260, backgroundColor: '#F3EEF9', borderRight: `1px solid ${theme.colors.border}`, overflowY: 'auto', padding: 12 },
  rightPanel: { flex: 1, padding: 20, overflowY: 'auto' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
};
