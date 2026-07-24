/**
 * LearnerDashboardScreen — Learner dashboard with tree navigation, chapter details,
 * action buttons, and streak display (Android).
 *
 * Tree navigation: Subject → Book → Chapter (with completion %) → Exercise % → Quizzes
 * Completion uses round-based: round((pagesRead/totalPages) × 100)
 * Exercise: round((answered/total) × 100)
 *
 * On chapter tap: chapter details (name, book, subject), stats cards
 * (Read %, Exercise %, Pages Done, Pages Left), progress bar, action buttons:
 *   - Continue Reading → explanation at last read page (or page 1)
 *   - Take Exercise → exercise screen
 *   - Listen → explanation in speech mode
 *
 * Streak display showing current streak count.
 * Empty state for no chapters.
 *
 * Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 5.4
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { apiClient, type ApiError } from '../services/api';
import {
  calculateLearnerCompletion,
  calculatePagesLeft,
} from '@chikumiku/validation';
import type { DashboardTreeNode, StreakData } from '@chikumiku/types';
import { TreeNavigator } from '../components/TreeNavigator';
import {
  DetailPanel,
  type ChapterDetailData,
  type ActionButton,
  type ActivityEntry,
} from '../components/DetailPanel';

// --- Extended local types ---

interface LearnerChapterMeta {
  totalPages: number;
  pagesRead: number;
  lastReadPage: number;
  answeredQuestions: number;
  totalQuestions: number;
  bookName: string;
  subjectName: string;
  subjectIcon?: string;
  activities: ActivityEntry[];
}

interface LearnerDashboardResponse {
  tree: DashboardTreeNode[];
  chapterMeta: Record<string, LearnerChapterMeta>;
  streak: StreakData;
}

// --- Mock data ---

function generateMockActivities(count: number): ActivityEntry[] {
  const actions = [
    'Read page 3',
    'Completed exercise set',
    'Took revision quiz',
    'Practiced pronunciation',
    'Finished reading session',
    'Answered grammar question',
    'Started new chapter',
    'Reviewed explanation',
    'Completed quiz attempt',
    'Read page 7',
  ];
  const result: ActivityEntry[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    result.push({
      timestamp: new Date(now - i * 3600000 * 2).toISOString(),
      description: actions[i % actions.length],
    });
  }
  return result;
}

function createMockLearnerData(): LearnerDashboardResponse {
  const tree: DashboardTreeNode[] = [
    {
      id: 'subject-hindi',
      type: 'subject',
      name: 'Hindi',
      completionPercentage: 73,
      children: [
        {
          id: 'book-hindi-1',
          type: 'book',
          name: 'Hindi Primer',
          completionPercentage: 73,
          children: [
            {
              id: 'chapter-1',
              type: 'chapter',
              name: 'Introduction to Hindi',
              completionPercentage: calculateLearnerCompletion(7, 10),
              children: [
                {
                  id: 'exercise-1',
                  type: 'exercise',
                  name: 'Chapter 1 Exercise',
                  completionPercentage: Math.round((3 / 5) * 100),
                  children: [
                    { id: 'quiz-1', type: 'quiz', name: 'Quiz 1', completionPercentage: 100 },
                    { id: 'quiz-2', type: 'quiz', name: 'Quiz 2', completionPercentage: 0 },
                  ],
                },
              ],
            },
            {
              id: 'chapter-2',
              type: 'chapter',
              name: 'Hindi Alphabets',
              completionPercentage: calculateLearnerCompletion(15, 15),
              children: [
                {
                  id: 'exercise-2',
                  type: 'exercise',
                  name: 'Chapter 2 Exercise',
                  completionPercentage: Math.round((8 / 8) * 100),
                  children: [
                    { id: 'quiz-3', type: 'quiz', name: 'Quiz 1', completionPercentage: 100 },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'subject-comp',
      type: 'subject',
      name: 'Computers',
      completionPercentage: 0,
      children: [
        {
          id: 'book-comp-1',
          type: 'book',
          name: 'Introduction to Computers',
          completionPercentage: 0,
          children: [
            {
              id: 'chapter-3',
              type: 'chapter',
              name: 'What is a Computer?',
              completionPercentage: calculateLearnerCompletion(0, 12),
              children: [
                {
                  id: 'exercise-3',
                  type: 'exercise',
                  name: 'Chapter 1 Exercise',
                  completionPercentage: Math.round((0 / 6) * 100),
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'subject-evs',
      type: 'subject',
      name: 'EVS',
      completionPercentage: 0,
      children: [],
    },
  ];

  const chapterMeta: Record<string, LearnerChapterMeta> = {
    'chapter-1': {
      totalPages: 10,
      pagesRead: 7,
      lastReadPage: 7,
      answeredQuestions: 3,
      totalQuestions: 5,
      bookName: 'Hindi Primer',
      subjectName: 'Hindi',
      subjectIcon: '🕉️',
      activities: generateMockActivities(8),
    },
    'chapter-2': {
      totalPages: 15,
      pagesRead: 15,
      lastReadPage: 15,
      answeredQuestions: 8,
      totalQuestions: 8,
      bookName: 'Hindi Primer',
      subjectName: 'Hindi',
      subjectIcon: '🕉️',
      activities: generateMockActivities(6),
    },
    'chapter-3': {
      totalPages: 12,
      pagesRead: 0,
      lastReadPage: 0,
      answeredQuestions: 0,
      totalQuestions: 6,
      bookName: 'Introduction to Computers',
      subjectName: 'Computers',
      subjectIcon: '💻',
      activities: [],
    },
  };

  const streak: StreakData = {
    currentStreak: 5,
    lastActiveDate: new Date().toISOString().split('T')[0],
    longestStreak: 12,
  };

  return { tree, chapterMeta, streak };
}

// --- Navigation helper type (will be replaced by real navigation) ---

interface NavigationAction {
  screen: string;
  params: Record<string, unknown>;
}

// --- Component ---

export function LearnerDashboardScreen(): React.ReactElement {
  const [treeData, setTreeData] = useState<DashboardTreeNode[]>([]);
  const [chapterMeta, setChapterMeta] = useState<Record<string, LearnerChapterMeta>>({});
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [selectedNode, setSelectedNode] = useState<DashboardTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      // In production:
      // const response = await apiClient.get<LearnerDashboardResponse>('/learner/dashboard');
      const data = createMockLearnerData();
      setTreeData(data.tree);
      setChapterMeta(data.chapterMeta);
      setStreak(data.streak);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleSelect = useCallback((node: DashboardTreeNode) => {
    setSelectedNode(node);
  }, []);

  // Build navigation action handlers (Req 15.3, 15.4, 15.5)
  const getNavigationAction = useCallback(
    (action: 'read' | 'exercise' | 'listen'): NavigationAction | null => {
      if (!selectedNode || selectedNode.type !== 'chapter') return null;
      const meta = chapterMeta[selectedNode.id];
      if (!meta) return null;

      const page = meta.lastReadPage || 1;

      switch (action) {
        case 'read':
          // Continue Reading → explanation at last read page (Req 15.3)
          return {
            screen: 'ChapterExplanation',
            params: { chapterId: selectedNode.id, pageNumber: page },
          };
        case 'exercise':
          // Take Exercise → exercise screen (Req 15.4)
          return {
            screen: 'GrammarExercise',
            params: { chapterId: selectedNode.id },
          };
        case 'listen':
          // Listen → explanation in speech mode (Req 15.5)
          return {
            screen: 'ChapterExplanation',
            params: { chapterId: selectedNode.id, pageNumber: page, mode: 'speech' },
          };
        default:
          return null;
      }
    },
    [selectedNode, chapterMeta]
  );

  // Action buttons for learner detail view
  const actionButtons: ActionButton[] = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'chapter') return [];

    return [
      {
        label: 'Continue Reading',
        icon: '📖',
        color: '#E94F9B',
        onPress: () => {
          const nav = getNavigationAction('read');
          if (nav) {
            // In production: navigation.navigate(nav.screen, nav.params);
            // For now, action is wired up — navigation will be connected when RootNavigator is activated.
          }
        },
      },
      {
        label: 'Take Exercise',
        icon: '✏️',
        color: '#9B59B6',
        onPress: () => {
          const nav = getNavigationAction('exercise');
          if (nav) {
            // navigation.navigate(nav.screen, nav.params);
          }
        },
      },
      {
        label: 'Listen',
        icon: '🔊',
        color: '#5DADE2',
        onPress: () => {
          const nav = getNavigationAction('listen');
          if (nav) {
            // navigation.navigate(nav.screen, nav.params);
          }
        },
      },
    ];
  }, [selectedNode, getNavigationAction]);

  // Build detail panel data
  const detailContent = useMemo(() => {
    if (!selectedNode) {
      return { type: 'empty' as const };
    }

    // Empty state for chapters not available (Req 15.6)
    if (selectedNode.type !== 'chapter') {
      if (!selectedNode.children || selectedNode.children.length === 0) {
        return { type: 'no-chapters' as const };
      }
      return { type: 'select-chapter' as const };
    }

    const meta = chapterMeta[selectedNode.id];
    if (!meta) {
      return { type: 'empty' as const };
    }

    const chapterData: ChapterDetailData = {
      name: selectedNode.name,
      bookName: meta.bookName,
      subjectName: meta.subjectName,
      subjectIcon: meta.subjectIcon,
      readingProgress: calculateLearnerCompletion(meta.pagesRead, meta.totalPages),
      exerciseScore: Math.round(
        meta.totalQuestions > 0
          ? (meta.answeredQuestions / meta.totalQuestions) * 100
          : 0
      ),
      pagesRead: meta.pagesRead,
      totalPages: meta.totalPages,
      activities: meta.activities.slice(0, 10),
    };
    return { type: 'chapter' as const, chapterData };
  }, [selectedNode, chapterMeta]);

  // --- Loading state ---
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={'#E94F9B'} />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  // --- Error state ---
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with streak (Req 5.4) */}
      <View style={styles.header}>
        <Text style={styles.heading}>My Learning</Text>
        {streak && (
          <View
            style={styles.streakBadge}
            accessibilityLabel={`Current streak: ${streak.currentStreak} days`}
          >
            <Text style={styles.streakText}>
              🔥 {streak.currentStreak} day streak
            </Text>
          </View>
        )}
      </View>

      {/* Two-panel layout */}
      <View style={styles.panelsContainer}>
        {/* Left: Tree Navigation (Req 15.1) */}
        <View style={styles.leftPanel}>
          <Text style={styles.panelTitle}>My Subjects</Text>
          <TreeNavigator
            data={treeData}
            selectedId={selectedNode?.id ?? null}
            onSelect={handleSelect}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            accessibilityLabel="Course navigation tree"
          />
        </View>

        {/* Right: Detail Panel */}
        <View style={styles.rightPanel}>
          {detailContent.type === 'empty' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>👈</Text>
              <Text style={styles.emptyStateText}>
                Select a chapter from the tree to view details and start learning.
              </Text>
            </View>
          )}

          {detailContent.type === 'no-chapters' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📭</Text>
              <Text style={styles.emptyStateText}>
                No chapters available yet. Ask your parent to add content.
              </Text>
            </View>
          )}

          {detailContent.type === 'select-chapter' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📄</Text>
              <Text style={styles.emptyStateText}>
                Expand the tree and select a chapter to see your progress.
              </Text>
            </View>
          )}

          {detailContent.type === 'chapter' && (
            <DetailPanel
              chapterData={detailContent.chapterData}
              actionButtons={actionButtons}
              mode="learner"
            />
          )}
        </View>
      </View>
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 14,
    backgroundColor: '#2C2341',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  streakBadge: {
    backgroundColor: '#F7C948',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C2341',
  },
  panelsContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: '#E0D8EC',
    paddingTop: 8,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  rightPanel: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999999',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 14 * 1.5,
  },
});
