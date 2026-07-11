/**
 * ParentDashboardScreen — Parent dashboard with tree navigation and detail panel (Android).
 *
 * Tree navigation: Learner → Subject → Book → Chapter (with completion %) → Exercise % → Quizzes
 * Detail panel:
 *   - Chapter tap: subject icon, chapter name, reading progress (% + bar),
 *     exercise score, pages read, up to 10 recent activities, last session date.
 *   - Non-chapter tap (Learner/Subject/Book): aggregated summary with name,
 *     total completion %, total pages read, 10 recent activities.
 * Uses floor-based completion: floor((pagesRead/totalPages) × 100)
 * Exercise completion: floor((correctAnswers/totalQuestions) × 100)
 *
 * Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { typography } from '../theme/typography';
import { apiClient, type ApiError } from '../services/api';
import {
  calculateParentCompletion,
  calculateExerciseCompletion,
} from '@chikumiku/validation';
import type { DashboardTreeNode } from '@chikumiku/types';
import { TreeNavigator } from '../components/TreeNavigator';
import {
  DetailPanel,
  type ChapterDetailData,
  type AggregatedDetailData,
  type ActivityEntry,
} from '../components/DetailPanel';

// --- Extended local types for chapter metadata ---

interface ChapterMeta {
  totalPages: number;
  pagesRead: number;
  correctAnswers: number;
  totalQuestions: number;
  lastSessionDate?: string;
  subjectIcon?: string;
  activities: ActivityEntry[];
}

interface AggregatedMeta {
  totalPagesRead: number;
  activities: ActivityEntry[];
}

// --- API response types ---

interface DashboardResponse {
  tree: DashboardTreeNode[];
  chapterMeta: Record<string, ChapterMeta>;
  aggregatedMeta: Record<string, AggregatedMeta>;
}

// --- Mock data generator (will be replaced by real API) ---

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

function createMockDashboardData(): DashboardResponse {
  const tree: DashboardTreeNode[] = [
    {
      id: 'learner-1',
      type: 'learner',
      name: 'Chiku (Grade 5)',
      completionPercentage: 65,
      children: [
        {
          id: 'subject-eng',
          type: 'subject',
          name: 'English',
          completionPercentage: 72,
          children: [
            {
              id: 'book-eng-1',
              type: 'book',
              name: 'Marigold Book 5',
              completionPercentage: 72,
              children: [
                {
                  id: 'chapter-eng-1',
                  type: 'chapter',
                  name: 'The Ice Cream Man',
                  completionPercentage: calculateParentCompletion(8, 12),
                  children: [
                    {
                      id: 'exercise-eng-1',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: calculateExerciseCompletion(6, 10),
                      children: [
                        { id: 'quiz-eng-1', type: 'quiz', name: 'Revision Quiz', completionPercentage: 80 },
                      ],
                    },
                  ],
                },
                {
                  id: 'chapter-eng-2',
                  type: 'chapter',
                  name: 'Wonderful Waste',
                  completionPercentage: calculateParentCompletion(5, 10),
                  children: [
                    {
                      id: 'exercise-eng-2',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: calculateExerciseCompletion(3, 8),
                      children: [
                        { id: 'quiz-eng-2', type: 'quiz', name: 'Revision Quiz', completionPercentage: 0 },
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
          children: [
            {
              id: 'book-math-1',
              type: 'book',
              name: 'Math Magic 5',
              completionPercentage: 55,
              children: [
                {
                  id: 'chapter-math-1',
                  type: 'chapter',
                  name: 'Shapes and Angles',
                  completionPercentage: calculateParentCompletion(7, 14),
                  children: [
                    {
                      id: 'exercise-math-1',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: calculateExerciseCompletion(4, 6),
                      children: [
                        { id: 'quiz-math-1', type: 'quiz', name: 'Revision Quiz', completionPercentage: 90 },
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
          children: [],
        },
      ],
    },
    {
      id: 'learner-2',
      type: 'learner',
      name: 'Miku (Grade 3)',
      completionPercentage: 40,
      children: [
        {
          id: 'subject-hindi-2',
          type: 'subject',
          name: 'Hindi',
          completionPercentage: 40,
          children: [
            {
              id: 'book-hindi-1',
              type: 'book',
              name: 'Rimjhim 3',
              completionPercentage: 40,
              children: [
                {
                  id: 'chapter-hindi-1',
                  type: 'chapter',
                  name: 'कक्कू',
                  completionPercentage: calculateParentCompletion(4, 10),
                  children: [
                    {
                      id: 'exercise-hindi-1',
                      type: 'exercise',
                      name: 'Exercises',
                      completionPercentage: calculateExerciseCompletion(2, 5),
                      children: [
                        { id: 'quiz-hindi-1', type: 'quiz', name: 'Revision Quiz', completionPercentage: 0 },
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

  const chapterMeta: Record<string, ChapterMeta> = {
    'chapter-eng-1': {
      totalPages: 12,
      pagesRead: 8,
      correctAnswers: 6,
      totalQuestions: 10,
      lastSessionDate: new Date(Date.now() - 86400000).toISOString(),
      subjectIcon: '📖',
      activities: generateMockActivities(10),
    },
    'chapter-eng-2': {
      totalPages: 10,
      pagesRead: 5,
      correctAnswers: 3,
      totalQuestions: 8,
      lastSessionDate: new Date(Date.now() - 172800000).toISOString(),
      subjectIcon: '📖',
      activities: generateMockActivities(7),
    },
    'chapter-math-1': {
      totalPages: 14,
      pagesRead: 7,
      correctAnswers: 4,
      totalQuestions: 6,
      lastSessionDate: new Date(Date.now() - 43200000).toISOString(),
      subjectIcon: '🧮',
      activities: generateMockActivities(10),
    },
    'chapter-hindi-1': {
      totalPages: 10,
      pagesRead: 4,
      correctAnswers: 2,
      totalQuestions: 5,
      lastSessionDate: new Date(Date.now() - 259200000).toISOString(),
      subjectIcon: '🕉️',
      activities: generateMockActivities(5),
    },
  };

  const aggregatedMeta: Record<string, AggregatedMeta> = {
    'learner-1': { totalPagesRead: 20, activities: generateMockActivities(10) },
    'learner-2': { totalPagesRead: 4, activities: generateMockActivities(6) },
    'subject-eng': { totalPagesRead: 13, activities: generateMockActivities(8) },
    'subject-math': { totalPagesRead: 7, activities: generateMockActivities(5) },
    'subject-sci': { totalPagesRead: 0, activities: [] },
    'subject-hindi-2': { totalPagesRead: 4, activities: generateMockActivities(4) },
    'book-eng-1': { totalPagesRead: 13, activities: generateMockActivities(6) },
    'book-math-1': { totalPagesRead: 7, activities: generateMockActivities(5) },
    'book-hindi-1': { totalPagesRead: 4, activities: generateMockActivities(4) },
  };

  return { tree, chapterMeta, aggregatedMeta };
}

// --- Component ---

export function ParentDashboardScreen(): React.ReactElement {
  const [treeData, setTreeData] = useState<DashboardTreeNode[]>([]);
  const [chapterMeta, setChapterMeta] = useState<Record<string, ChapterMeta>>({});
  const [aggregatedMeta, setAggregatedMeta] = useState<Record<string, AggregatedMeta>>({});
  const [selectedNode, setSelectedNode] = useState<DashboardTreeNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setError(null);
      // In production, call the API:
      // const response = await apiClient.get<DashboardResponse>('/parent/dashboard');
      // For now, use mock data:
      const data = createMockDashboardData();
      setTreeData(data.tree);
      setChapterMeta(data.chapterMeta);
      setAggregatedMeta(data.aggregatedMeta);
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

  // Refresh on selection change (Req 14.5)
  const handleSelect = useCallback((node: DashboardTreeNode) => {
    setSelectedNode(node);
  }, []);

  // Build detail panel data based on selection
  const detailContent = useMemo(() => {
    if (!selectedNode) {
      return { type: 'empty' as const };
    }

    // Empty state for nodes with no children (Req 14.4)
    if (
      (selectedNode.type === 'subject' || selectedNode.type === 'book') &&
      (!selectedNode.children || selectedNode.children.length === 0)
    ) {
      return { type: 'empty-content' as const, name: selectedNode.name };
    }

    // Chapter detail (Req 14.2)
    if (selectedNode.type === 'chapter') {
      const meta = chapterMeta[selectedNode.id];
      if (meta) {
        const chapterData: ChapterDetailData = {
          name: selectedNode.name,
          subjectIcon: meta.subjectIcon,
          readingProgress: calculateParentCompletion(meta.pagesRead, meta.totalPages),
          exerciseScore: calculateExerciseCompletion(meta.correctAnswers, meta.totalQuestions),
          pagesRead: meta.pagesRead,
          totalPages: meta.totalPages,
          lastSessionDate: meta.lastSessionDate,
          activities: meta.activities.slice(0, 10),
        };
        return { type: 'chapter' as const, chapterData };
      }
    }

    // Aggregated view (Req 14.3)
    const aggMeta = aggregatedMeta[selectedNode.id];
    const TYPE_ICONS: Record<string, string> = {
      learner: '👤',
      subject: '📚',
      book: '📕',
      exercise: '✏️',
      quiz: '🎯',
    };

    const aggregatedData: AggregatedDetailData = {
      name: selectedNode.name,
      icon: TYPE_ICONS[selectedNode.type] ?? '📋',
      completionPercentage: selectedNode.completionPercentage,
      totalPagesRead: aggMeta?.totalPagesRead ?? 0,
      activities: aggMeta?.activities?.slice(0, 10) ?? [],
    };
    return { type: 'aggregated' as const, aggregatedData };
  }, [selectedNode, chapterMeta, aggregatedMeta]);

  // --- Loading state ---
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Parent Dashboard</Text>
      </View>

      {/* Two-panel layout */}
      <View style={styles.panelsContainer}>
        {/* Left: Tree Navigation */}
        <View style={styles.leftPanel}>
          <TreeNavigator
            data={treeData}
            selectedId={selectedNode?.id ?? null}
            onSelect={handleSelect}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            accessibilityLabel="Learner progress tree"
          />
        </View>

        {/* Right: Detail Panel */}
        <View style={styles.rightPanel}>
          {detailContent.type === 'empty' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>👈</Text>
              <Text style={styles.emptyStateText}>
                Select an item from the tree to view details.
              </Text>
            </View>
          )}

          {detailContent.type === 'empty-content' && (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📭</Text>
              <Text style={styles.emptyStateText}>
                No content available yet for "{detailContent.name}".
              </Text>
            </View>
          )}

          {detailContent.type === 'chapter' && (
            <DetailPanel
              chapterData={detailContent.chapterData}
              mode="parent"
            />
          )}

          {detailContent.type === 'aggregated' && (
            <DetailPanel
              aggregatedData={detailContent.aggregatedData}
              mode="parent"
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
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  heading: {
    fontSize: typography.heading.h2,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  panelsContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: 280,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  rightPanel: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.bodyFontSize,
    color: colors.textMuted,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.bodyFontSize,
    color: colors.error,
    textAlign: 'center',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyStateText: {
    fontSize: typography.bodyFontSize,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: typography.bodyFontSize * typography.lineHeight.normal,
  },
});
