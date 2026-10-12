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
    // Carry learner identity so selecting the learner node offers content mgmt.
    data: { nodeType: 'learner', learnerId: learner.id, learnerName: learner.name, grade: learner.grade },
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
          <button style={{ padding: '6px 14px', border: 'none', borderRadius: 16, background: theme.gradients.primary, color: '#fff', fontSize: 10, fontWeight: theme.fonts.weights.semibold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('/register/learner')}>
            <i className="fas fa-plus" style={{ fontSize: 9 }} /> Add Learner
          </button>
          <i className="fas fa-bell" style={{ color: theme.colors.textLight, fontSize: 14, cursor: 'pointer' }} />
          <i className="fas fa-cog" style={{ color: theme.colors.textLight, fontSize: 14, cursor: 'pointer' }} onClick={() => navigate('/parent/settings')} />
          <div style={styles.avatar} onClick={logout}>
            <i className="fas fa-user" style={{ color: '#fff', fontSize: 11 }} />
          </div>
        </div>
      </div>
      {learners.length === 0 ? (
        <div style={styles.noLearners}>
          <i className="fas fa-user-plus" style={{ fontSize: 40, color: theme.colors.border }} />
          <h3 style={{ color: theme.colors.dark, marginTop: 16, marginBottom: 4 }}>No learners yet</h3>
          <p style={{ color: theme.colors.textLight, marginBottom: 20, textAlign: 'center', maxWidth: 360 }}>
            Add your first learner to start tracking their reading progress, exercises, and quizzes.
          </p>
          <button
            style={{ padding: '12px 28px', border: 'none', borderRadius: theme.borderRadius.button, background: theme.gradients.primary, color: '#fff', fontSize: 14, fontWeight: theme.fonts.weights.bold, cursor: 'pointer', boxShadow: theme.shadows.button, display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => navigate('/register/learner')}
          >
            <i className="fas fa-plus" /> Add Your First Learner
          </button>
        </div>
      ) : (
        <div style={styles.main}>
          <div style={styles.leftPanel}>
            <TreeNavigation data={treeData} onSelect={handleSelect} />
          </div>
          <div style={styles.rightPanel}>
            {selectedItem ? (
              selectedItem.nodeType === 'learner' ? (
                <LearnerManagePanel item={selectedItem} onManageContent={(id, name) =>
                  navigate(`/content/manage?learnerId=${encodeURIComponent(id)}&learnerName=${encodeURIComponent(name)}`)
                } />
              ) : (
                <DetailView item={selectedItem} />
              )
            ) : (
              <LearnersOverview
                learners={learners}
                onManageContent={(id, name) =>
                  navigate(`/content/manage?learnerId=${encodeURIComponent(id)}&learnerName=${encodeURIComponent(name)}`)
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Default right-panel view (nothing selected): one card per learner, each with
 * a visible "Manage Content" action, so content management is discoverable on
 * dashboard load without having to select a tree node first.
 */
function LearnersOverview({
  learners,
  onManageContent,
}: {
  learners: DashboardLearner[];
  onManageContent: (learnerId: string, learnerName: string) => void;
}) {
  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 15, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark, marginBottom: 4 }}>
        Your Learners
      </div>
      <p style={{ fontSize: 12, color: theme.colors.textLight, marginBottom: 16 }}>
        Select a learner below to add books and chapters, or pick a chapter in the tree to view progress.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
        {learners.map((learner) => (
          <div key={learner.id} style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 16, boxShadow: theme.shadows.card }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: theme.colors.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-user-graduate" style={{ color: theme.colors.purple, fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>{learner.name}</div>
                <div style={{ fontSize: 10, color: theme.colors.textLight }}>Grade {learner.grade}</div>
              </div>
            </div>
            <button
              style={{ width: '100%', padding: '10px 14px', border: 'none', borderRadius: theme.borderRadius.button, background: theme.gradients.primary, color: '#fff', fontSize: 12, fontWeight: theme.fonts.weights.bold, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              onClick={() => onManageContent(learner.id, learner.name)}
            >
              <i className="fas fa-folder-open" /> Manage Content
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Right-panel view shown when a learner node is selected in the tree. */
function LearnerManagePanel({
  item,
  onManageContent,
}: {
  item: Record<string, unknown>;
  onManageContent: (learnerId: string, learnerName: string) => void;
}) {
  const learnerId = (item.learnerId as string) || '';
  const learnerName = (item.learnerName as string) || '';
  const grade = (item.grade as string) || '';
  return (
    <div style={{ background: '#fff', borderRadius: theme.borderRadius.card, padding: 20, boxShadow: theme.shadows.card, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: theme.colors.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fas fa-user-graduate" style={{ color: theme.colors.purple, fontSize: 16 }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: theme.fonts.weights.bold, color: theme.colors.dark }}>{learnerName}</div>
          <div style={{ fontSize: 11, color: theme.colors.textLight }}>Grade {grade}</div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: theme.colors.textLight, lineHeight: 1.5, marginBottom: 16 }}>
        Add books, create chapters, and manage {learnerName ? `${learnerName}'s` : 'this learner\u2019s'} content for each subject.
      </p>
      <button
        style={{ padding: '12px 20px', border: 'none', borderRadius: theme.borderRadius.button, background: theme.gradients.primary, color: '#fff', fontSize: 13, fontWeight: theme.fonts.weights.bold, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
        onClick={() => onManageContent(learnerId, learnerName)}
        disabled={!learnerId}
      >
        <i className="fas fa-folder-open" /> Manage Content
      </button>
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
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  avatar: { width: 28, height: 28, borderRadius: '50%', backgroundColor: theme.colors.purple, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  main: { display: 'flex', height: 'calc(100vh - 52px)' },
  leftPanel: { width: 260, backgroundColor: '#F3EEF9', borderRight: `1px solid ${theme.colors.border}`, overflowY: 'auto', padding: 12 },
  rightPanel: { flex: 1, padding: 20, overflowY: 'auto' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },
  noLearners: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 52px)', padding: 24 },
};
