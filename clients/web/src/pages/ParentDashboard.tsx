/**
 * ParentDashboard — Full parent dashboard with tree navigation and detail panel.
 *
 * Left panel: tree navigation (Learner → Subject → Book → Chapter → Exercise → Quizzes)
 * Right panel: detail view (chapter detail or aggregated summary)
 * Uses floor-based completion percentages per Requirement 14.1.
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { colors, spacing, radii, typography } from '../theme';

// --- Types ---

type TreeNodeType = 'learner' | 'subject' | 'book' | 'chapter' | 'exercise' | 'quiz';

interface ActivityEntry {
  timestamp: string;
  action: string;
}

interface TreeNode {
  id: string;
  type: TreeNodeType;
  name: string;
  completionPercentage: number;
  children?: TreeNode[];
  // Chapter-specific fields
  totalPages?: number;
  pagesRead?: number;
  exerciseScore?: number;
  lastSessionDate?: string;
  activities?: ActivityEntry[];
  subjectIcon?: string;
}

interface DetailData {
  node: TreeNode;
  isChapter: boolean;
}

// --- Mock Data ---

function generateMockActivities(count: number): ActivityEntry[] {
  const actions = [
    'Read page 3 of Chapter 1',
    'Completed exercise set A',
    'Took revision quiz (Score: 80%)',
    'Practiced pronunciation',
    'Read page 5 of Chapter 1',
    'Answered grammar exercise',
    'Completed reading session',
    'Started new chapter',
    'Reviewed explanations',
    'Finished quiz attempt',
    'Read page 7 of Chapter 2',
    'Completed fill-in-the-blank exercise',
  ];

  const result: ActivityEntry[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    result.push({
      timestamp: new Date(now - i * 3600000 * 2).toISOString(),
      action: actions[i % actions.length],
    });
  }
  return result;
}

const SUBJECT_ICONS: Record<string, string> = {
  English: '📖',
  Hindi: '🕉️',
  Maths: '🧮',
  Science: '🔬',
  EVS: '🌿',
  Computers: '💻',
  Kannada: '📜',
};

function createMockTree(): TreeNode[] {
  return [
    {
      id: 'learner-1',
      type: 'learner',
      name: 'Chiku (Grade 5)',
      completionPercentage: 65,
      activities: generateMockActivities(10),
      children: [
        {
          id: 'subject-eng',
          type: 'subject',
          name: 'English',
          completionPercentage: 72,
          subjectIcon: '📖',
          activities: generateMockActivities(8),
          children: [
            {
              id: 'book-eng-1',
              type: 'book',
              name: 'Marigold Book 5',
              completionPercentage: 72,
              activities: generateMockActivities(6),
              children: [
                {
                  id: 'chapter-eng-1',
                  type: 'chapter',
                  name: 'The Ice Cream Man',
                  completionPercentage: Math.floor((8 / 12) * 100),
                  totalPages: 12,
                  pagesRead: 8,
                  exerciseScore: Math.floor((6 / 10) * 100),
                  lastSessionDate: new Date(Date.now() - 86400000).toISOString(),
                  activities: generateMockActivities(10),
                  subjectIcon: '📖',
                  children: [
                    {
                      id: 'exercise-eng-1',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: Math.floor((6 / 10) * 100),
                      activities: generateMockActivities(4),
                      children: [
                        {
                          id: 'quiz-eng-1',
                          type: 'quiz',
                          name: 'Revision Quiz',
                          completionPercentage: 80,
                          activities: generateMockActivities(2),
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'chapter-eng-2',
                  type: 'chapter',
                  name: 'Wonderful Waste',
                  completionPercentage: Math.floor((5 / 10) * 100),
                  totalPages: 10,
                  pagesRead: 5,
                  exerciseScore: Math.floor((3 / 8) * 100),
                  lastSessionDate: new Date(Date.now() - 172800000).toISOString(),
                  activities: generateMockActivities(7),
                  subjectIcon: '📖',
                  children: [
                    {
                      id: 'exercise-eng-2',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: Math.floor((3 / 8) * 100),
                      activities: generateMockActivities(3),
                      children: [
                        {
                          id: 'quiz-eng-2',
                          type: 'quiz',
                          name: 'Revision Quiz',
                          completionPercentage: 0,
                          activities: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'subject-math',
          type: 'subject',
          name: 'Maths',
          completionPercentage: 55,
          subjectIcon: '🧮',
          activities: generateMockActivities(5),
          children: [
            {
              id: 'book-math-1',
              type: 'book',
              name: 'Math Magic 5',
              completionPercentage: 55,
              activities: generateMockActivities(5),
              children: [
                {
                  id: 'chapter-math-1',
                  type: 'chapter',
                  name: 'Shapes and Angles',
                  completionPercentage: Math.floor((7 / 14) * 100),
                  totalPages: 14,
                  pagesRead: 7,
                  exerciseScore: Math.floor((4 / 6) * 100),
                  lastSessionDate: new Date(Date.now() - 43200000).toISOString(),
                  activities: generateMockActivities(10),
                  subjectIcon: '🧮',
                  children: [
                    {
                      id: 'exercise-math-1',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: Math.floor((4 / 6) * 100),
                      activities: generateMockActivities(4),
                      children: [
                        {
                          id: 'quiz-math-1',
                          type: 'quiz',
                          name: 'Revision Quiz',
                          completionPercentage: 90,
                          activities: generateMockActivities(2),
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'subject-sci',
          type: 'subject',
          name: 'Science',
          completionPercentage: 0,
          subjectIcon: '🔬',
          activities: [],
          children: [],
        },
      ],
    },
    {
      id: 'learner-2',
      type: 'learner',
      name: 'Miku (Grade 3)',
      completionPercentage: 40,
      activities: generateMockActivities(6),
      children: [
        {
          id: 'subject-hindi-2',
          type: 'subject',
          name: 'Hindi',
          completionPercentage: 40,
          subjectIcon: '🕉️',
          activities: generateMockActivities(4),
          children: [
            {
              id: 'book-hindi-1',
              type: 'book',
              name: 'Rimjhim 3',
              completionPercentage: 40,
              activities: generateMockActivities(4),
              children: [
                {
                  id: 'chapter-hindi-1',
                  type: 'chapter',
                  name: 'कक्कू',
                  completionPercentage: Math.floor((4 / 10) * 100),
                  totalPages: 10,
                  pagesRead: 4,
                  exerciseScore: Math.floor((2 / 5) * 100),
                  lastSessionDate: new Date(Date.now() - 259200000).toISOString(),
                  activities: generateMockActivities(5),
                  subjectIcon: '🕉️',
                  children: [
                    {
                      id: 'exercise-hindi-1',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: Math.floor((2 / 5) * 100),
                      activities: generateMockActivities(2),
                      children: [
                        {
                          id: 'quiz-hindi-1',
                          type: 'quiz',
                          name: 'Revision Quiz',
                          completionPercentage: 0,
                          activities: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

// --- Styles ---

const styles = {
  container: {
    display: 'flex',
    gap: spacing.md,
    minHeight: '600px',
    fontFamily: typography.fontFamily,
  } as React.CSSProperties,

  leftPanel: {
    width: '320px',
    minWidth: '280px',
    borderRight: `1px solid ${colors.border}`,
    paddingRight: spacing.md,
    overflowY: 'auto' as const,
    maxHeight: '80vh',
  } as React.CSSProperties,

  rightPanel: {
    flex: 1,
    padding: spacing.md,
    overflowY: 'auto' as const,
    maxHeight: '80vh',
  } as React.CSSProperties,

  heading: {
    color: colors.primary,
    marginBottom: spacing.md,
    fontSize: '1.5rem',
    fontWeight: typography.weight.bold,
  } as React.CSSProperties,

  treeItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.xs} ${spacing.sm}`,
    cursor: 'pointer',
    borderRadius: radii.small,
    transition: 'background-color 0.15s',
    fontSize: '0.9rem',
    lineHeight: '1.4',
  } as React.CSSProperties,

  treeItemSelected: {
    backgroundColor: `${colors.primary}15`,
    fontWeight: typography.weight.semibold,
  } as React.CSSProperties,

  treeItemHover: {
    backgroundColor: `${colors.background}`,
  } as React.CSSProperties,

  expandIcon: {
    width: '16px',
    textAlign: 'center' as const,
    fontSize: '0.75rem',
    color: colors.textMuted,
    flexShrink: 0,
  } as React.CSSProperties,

  completionBadge: {
    marginLeft: 'auto',
    fontSize: '0.75rem',
    padding: `2px ${spacing.xs}`,
    borderRadius: radii.badge,
    backgroundColor: colors.background,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
    flexShrink: 0,
  } as React.CSSProperties,

  card: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: spacing.lg,
    border: `1px solid ${colors.border}`,
    marginBottom: spacing.md,
  } as React.CSSProperties,

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: spacing.md,
    marginBottom: spacing.lg,
  } as React.CSSProperties,

  statCard: {
    backgroundColor: colors.background,
    borderRadius: radii.card,
    padding: spacing.md,
    textAlign: 'center' as const,
  } as React.CSSProperties,

  statValue: {
    fontSize: '1.5rem',
    fontWeight: typography.weight.bold,
    color: colors.primary,
  } as React.CSSProperties,

  statLabel: {
    fontSize: '0.8rem',
    color: colors.textMuted,
    marginTop: spacing.xs,
  } as React.CSSProperties,

  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: colors.border,
    borderRadius: '4px',
    overflow: 'hidden' as const,
    marginTop: spacing.sm,
  } as React.CSSProperties,

  progressFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  } as React.CSSProperties,

  activityList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  } as React.CSSProperties,

  activityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: `${spacing.sm} 0`,
    borderBottom: `1px solid ${colors.border}`,
    fontSize: '0.85rem',
    gap: spacing.sm,
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: spacing.xxl,
    color: colors.textMuted,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: '1rem',
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  } as React.CSSProperties,
};

// --- Helper functions ---

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProgressColor(percentage: number): string {
  if (percentage >= 75) return colors.success;
  if (percentage >= 40) return colors.warning;
  return colors.primary;
}

function getTypeIcon(type: TreeNodeType): string {
  switch (type) {
    case 'learner': return '👤';
    case 'subject': return '📚';
    case 'book': return '📕';
    case 'chapter': return '📄';
    case 'exercise': return '✏️';
    case 'quiz': return '🎯';
    default: return '•';
  }
}

function collectActivities(node: TreeNode): ActivityEntry[] {
  const all: ActivityEntry[] = [...(node.activities ?? [])];
  if (node.children) {
    for (const child of node.children) {
      all.push(...collectActivities(child));
    }
  }
  all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return all.slice(0, 10);
}

function collectTotalPages(node: TreeNode): number {
  let total = 0;
  if (node.type === 'chapter') {
    total += node.pagesRead ?? 0;
  }
  if (node.children) {
    for (const child of node.children) {
      total += collectTotalPages(child);
    }
  }
  return total;
}

// --- Sub-Components ---

interface TreeItemProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (node: TreeNode) => void;
  onToggle: (id: string) => void;
}

function TreeItem({ node, depth, selectedId, expandedIds, onSelect, onToggle }: TreeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;

  const handleClick = () => {
    onSelect(node);
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  const icon = node.subjectIcon && node.type === 'subject'
    ? node.subjectIcon
    : (SUBJECT_ICONS[node.name] ?? getTypeIcon(node.type));

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        style={{
          ...styles.treeItem,
          paddingLeft: `${depth * 16 + 8}px`,
          ...(isSelected ? styles.treeItemSelected : {}),
        }}
      >
        <span style={styles.expandIcon}>
          {hasChildren ? (isExpanded ? '▾' : '▸') : ' '}
        </span>
        <span>{icon}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        <span style={styles.completionBadge}>
          {node.completionPercentage}%
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div role="group">
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ActivityLogProps {
  activities: ActivityEntry[];
}

function ActivityLog({ activities }: ActivityLogProps) {
  if (activities.length === 0) {
    return <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>No activity recorded yet.</p>;
  }

  return (
    <ul style={styles.activityList} aria-label="Recent activity log">
      {activities.map((entry, idx) => (
        <li key={idx} style={styles.activityItem}>
          <span style={{ color: colors.textPrimary }}>{entry.action}</span>
          <span style={{ color: colors.textMuted, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            {formatDate(entry.timestamp)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// --- Detail Panels ---

interface ChapterDetailProps {
  node: TreeNode;
}

function ChapterDetail({ node }: ChapterDetailProps) {
  const readingProgress = node.completionPercentage;
  const activities = (node.activities ?? []).slice(0, 10);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <span style={{ fontSize: '2rem' }}>{node.subjectIcon ?? '📄'}</span>
        <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '1.25rem' }}>{node.name}</h3>
      </div>

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{readingProgress}%</div>
          <div style={styles.statLabel}>Reading Progress</div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${readingProgress}%`,
                backgroundColor: getProgressColor(readingProgress),
              }}
            />
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{node.exerciseScore ?? 0}%</div>
          <div style={styles.statLabel}>Exercise Score</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{node.pagesRead ?? 0}</div>
          <div style={styles.statLabel}>Pages Read</div>
        </div>
      </div>

      {/* Last Session */}
      {node.lastSessionDate && (
        <div style={{ ...styles.card, padding: spacing.md }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: colors.textSecondary }}>
            <strong>Last Session:</strong> {formatDate(node.lastSessionDate)}
          </p>
        </div>
      )}

      {/* Activity Log */}
      <div style={styles.card}>
        <h4 style={styles.sectionTitle}>Recent Activity (up to 10)</h4>
        <ActivityLog activities={activities} />
      </div>
    </div>
  );
}

interface AggregatedDetailProps {
  node: TreeNode;
}

function AggregatedDetail({ node }: AggregatedDetailProps) {
  const totalPages = collectTotalPages(node);
  const activities = collectActivities(node);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <span style={{ fontSize: '2rem' }}>{getTypeIcon(node.type)}</span>
        <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '1.25rem' }}>{node.name}</h3>
      </div>

      {/* Aggregated Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{node.completionPercentage}%</div>
          <div style={styles.statLabel}>Total Completion</div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${node.completionPercentage}%`,
                backgroundColor: getProgressColor(node.completionPercentage),
              }}
            />
          </div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{totalPages}</div>
          <div style={styles.statLabel}>Total Pages Read</div>
        </div>
      </div>

      {/* Activity Log */}
      <div style={styles.card}>
        <h4 style={styles.sectionTitle}>Recent Activity (up to 10)</h4>
        <ActivityLog activities={activities} />
      </div>
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
}

function EmptyState({ message }: EmptyStateProps) {
  return (
    <div style={styles.emptyState}>
      <p style={{ fontSize: '2rem', marginBottom: spacing.sm }}>📭</p>
      <p style={{ fontSize: '1rem', color: colors.textMuted }}>
        {message ?? 'No content available yet.'}
      </p>
    </div>
  );
}

// --- Main Component ---

export function ParentDashboard() {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Load data on mount and on navigation (Requirement 14.5)
  useEffect(() => {
    const data = createMockTree();
    setTreeData(data);
  }, []);

  const handleSelect = useCallback((node: TreeNode) => {
    setSelectedNode(node);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectedId = selectedNode?.id ?? null;

  // Determine which detail panel to show
  const detailContent = useMemo(() => {
    if (!selectedNode) {
      return (
        <div style={styles.emptyState}>
          <p style={{ fontSize: '2rem', marginBottom: spacing.sm }}>👈</p>
          <p style={{ fontSize: '1rem', color: colors.textMuted }}>
            Select an item from the tree to view details.
          </p>
        </div>
      );
    }

    // Empty state check (Requirement 14.4)
    const hasNoContent =
      (selectedNode.type === 'subject' || selectedNode.type === 'book') &&
      (!selectedNode.children || selectedNode.children.length === 0);

    if (hasNoContent) {
      return <EmptyState message={`No content available yet for "${selectedNode.name}".`} />;
    }

    // Chapter-level detail (Requirement 14.2)
    if (selectedNode.type === 'chapter') {
      return <ChapterDetail node={selectedNode} />;
    }

    // Non-chapter aggregated summary (Requirement 14.3)
    return <AggregatedDetail node={selectedNode} />;
  }, [selectedNode]);

  return (
    <div style={{ padding: spacing.md }}>
      <h2 style={styles.heading}>Parent Dashboard</h2>

      <div style={styles.container}>
        {/* Left Panel: Tree Navigation */}
        <nav style={styles.leftPanel} aria-label="Learner progress tree">
          <div role="tree" aria-label="Progress navigation">
            {treeData.map((learner) => (
              <TreeItem
                key={learner.id}
                node={learner}
                depth={0}
                selectedId={selectedId}
                expandedIds={expandedIds}
                onSelect={handleSelect}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </nav>

        {/* Right Panel: Detail View */}
        <section style={styles.rightPanel} aria-label="Detail view" aria-live="polite">
          {detailContent}
        </section>
      </div>
    </div>
  );
}
