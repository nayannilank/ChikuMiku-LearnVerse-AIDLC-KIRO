/**
 * TreeNavigator — Reusable hierarchical tree navigation component.
 *
 * Renders expandable nodes with completion percentages, suitable for
 * both Parent and Learner dashboard tree views.
 * Uses FlatList for efficient rendering of visible top-level nodes.
 *
 * Validates: Requirements 14.1, 14.2, 15.1
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { typography } from '../theme/typography';
import type { DashboardTreeNode } from '@chikumiku/types';

// --- Types ---

export interface TreeNavigatorProps {
  /** Root-level tree nodes to render */
  data: DashboardTreeNode[];
  /** Currently selected node ID */
  selectedId: string | null;
  /** Callback when a node is selected */
  onSelect: (node: DashboardTreeNode) => void;
  /** Whether a pull-to-refresh is in progress */
  refreshing?: boolean;
  /** Pull-to-refresh handler */
  onRefresh?: () => void;
  /** Accessible label for the tree */
  accessibilityLabel?: string;
}

// --- Constants ---

const INDENT_PER_LEVEL = 16;
const MIN_TOUCH_TARGET = 48;

const TYPE_ICONS: Record<DashboardTreeNode['type'], string> = {
  learner: '👤',
  subject: '📚',
  book: '📕',
  chapter: '📄',
  exercise: '✏️',
  quiz: '🎯',
};

// --- Flattening for FlatList ---

interface FlattenedNode {
  node: DashboardTreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

function flattenTree(
  nodes: DashboardTreeNode[],
  expandedIds: Set<string>,
  depth: number = 0
): FlattenedNode[] {
  const result: FlattenedNode[] = [];
  for (const node of nodes) {
    const hasChildren = !!(node.children && node.children.length > 0);
    const isExpanded = expandedIds.has(node.id);
    result.push({ node, depth, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      result.push(...flattenTree(node.children!, expandedIds, depth + 1));
    }
  }
  return result;
}

// --- Component ---

export function TreeNavigator({
  data,
  selectedId,
  onSelect,
  refreshing = false,
  onRefresh,
  accessibilityLabel = 'Progress navigation tree',
}: TreeNavigatorProps): React.ReactElement {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
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

  const handlePress = useCallback(
    (item: FlattenedNode) => {
      onSelect(item.node);
      if (item.hasChildren) {
        toggleExpand(item.node.id);
      }
    },
    [onSelect, toggleExpand]
  );

  const flattenedData = flattenTree(data, expandedIds);

  const renderItem = useCallback(
    ({ item }: { item: FlattenedNode }) => {
      const isSelected = selectedId === item.node.id;
      const icon = TYPE_ICONS[item.node.type] ?? '•';
      const expandIcon = item.hasChildren
        ? item.isExpanded
          ? '▾'
          : '▸'
        : ' ';

      return (
        <TouchableOpacity
          style={[
            styles.treeItem,
            { paddingLeft: item.depth * INDENT_PER_LEVEL + spacing.sm },
            isSelected && styles.treeItemSelected,
          ]}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected, expanded: item.hasChildren ? item.isExpanded : undefined }}
          accessibilityLabel={`${item.node.type}: ${item.node.name}, ${item.node.completionPercentage}% complete`}
        >
          <Text style={styles.expandIcon}>{expandIcon}</Text>
          <Text style={styles.typeIcon}>{icon}</Text>
          <Text
            style={[styles.nodeName, isSelected && styles.nodeNameSelected]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.node.name}
          </Text>
          <View style={styles.completionBadge}>
            <Text style={styles.completionText}>
              {item.node.completionPercentage}%
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [selectedId, handlePress]
  );

  const keyExtractor = useCallback(
    (item: FlattenedNode) => item.node.id,
    []
  );

  return (
    <FlatList
      data={flattenedData}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="menu"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        ) : undefined
      }
      showsVerticalScrollIndicator={true}
      contentContainerStyle={styles.listContent}
    />
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: spacing.xs,
  },
  treeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    borderRadius: borderRadii.small,
    marginHorizontal: spacing.xs,
    marginVertical: 1,
  },
  treeItemSelected: {
    backgroundColor: `${colors.primary}15`,
  },
  expandIcon: {
    width: 16,
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  typeIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  nodeName: {
    flex: 1,
    fontSize: typography.bodyFontSize,
    color: colors.textPrimary,
    fontWeight: typography.weight.regular,
  },
  nodeNameSelected: {
    fontWeight: typography.weight.semibold,
    color: colors.primary,
  },
  completionBadge: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadii.badge,
    backgroundColor: colors.background,
  },
  completionText: {
    fontSize: 12,
    fontWeight: typography.weight.medium,
    color: colors.textSecondary,
  },
});
