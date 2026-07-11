/**
 * DetailPanel — Reusable detail view component for dashboard screens.
 *
 * Displays chapter details (stats, progress bar, activity log, action buttons)
 * or aggregated summaries for non-chapter nodes.
 * Context-aware rendering based on node type and caller (parent vs. learner).
 *
 * Validates: Requirements 14.2, 14.3, 15.2, 15.3, 15.4, 15.5
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { typography } from '../theme/typography';

// --- Types ---

export interface ActivityEntry {
  timestamp: string;
  description: string;
}

export interface ChapterDetailData {
  name: string;
  bookName?: string;
  subjectName?: string;
  subjectIcon?: string;
  readingProgress: number;
  exerciseScore: number;
  pagesRead: number;
  totalPages: number;
  lastSessionDate?: string;
  activities: ActivityEntry[];
}

export interface AggregatedDetailData {
  name: string;
  icon?: string;
  completionPercentage: number;
  totalPagesRead: number;
  activities: ActivityEntry[];
}

export interface ActionButton {
  label: string;
  icon: string;
  onPress: () => void;
  color: string;
}

export interface DetailPanelProps {
  /** Chapter-specific detail data (shown when node is a chapter) */
  chapterData?: ChapterDetailData;
  /** Aggregated data (shown when node is learner/subject/book) */
  aggregatedData?: AggregatedDetailData;
  /** Action buttons to display (learner dashboard context) */
  actionButtons?: ActionButton[];
  /** Mode determines display context */
  mode: 'parent' | 'learner';
}

// --- Constants ---

const MIN_TOUCH_TARGET = 48;
const MAX_ACTIVITIES = 10;

// --- Helpers ---

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

// --- Sub-Components ---

function ProgressBar({ percentage }: { percentage: number }) {
  return (
    <View
      style={styles.progressBarContainer}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percentage }}
      accessibilityLabel={`Progress: ${percentage}%`}
    >
      <View
        style={[
          styles.progressBarFill,
          {
            width: `${percentage}%`,
            backgroundColor: getProgressColor(percentage),
          },
        ]}
      />
    </View>
  );
}

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActivityLog({ activities }: { activities: ActivityEntry[] }) {
  const limited = activities.slice(0, MAX_ACTIVITIES);

  if (limited.length === 0) {
    return (
      <Text style={styles.emptyActivityText}>No activity recorded yet.</Text>
    );
  }

  return (
    <View accessibilityLabel="Recent activity log">
      {limited.map((entry, idx) => (
        <View key={idx} style={styles.activityItem}>
          <Text style={styles.activityDescription} numberOfLines={2}>
            {entry.description}
          </Text>
          <Text style={styles.activityTimestamp}>
            {formatDate(entry.timestamp)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// --- Main Component ---

export function DetailPanel({
  chapterData,
  aggregatedData,
  actionButtons,
  mode,
}: DetailPanelProps): React.ReactElement {
  // Chapter detail view
  if (chapterData) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Header */}
        <View style={styles.header}>
          {chapterData.subjectIcon && (
            <Text style={styles.headerIcon}>{chapterData.subjectIcon}</Text>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>{chapterData.name}</Text>
            {mode === 'learner' && chapterData.bookName && (
              <Text style={styles.headerSubtitle}>
                {chapterData.bookName}
                {chapterData.subjectName ? ` • ${chapterData.subjectName}` : ''}
              </Text>
            )}
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard value={`${chapterData.readingProgress}%`} label="Read" />
          <StatCard value={`${chapterData.exerciseScore}%`} label="Exercise" />
          <StatCard value={chapterData.pagesRead} label="Pages Done" />
          {mode === 'learner' && (
            <StatCard
              value={chapterData.totalPages - chapterData.pagesRead}
              label="Pages Left"
            />
          )}
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Reading Progress</Text>
            <Text style={styles.progressPercentLabel}>
              {chapterData.readingProgress}%
            </Text>
          </View>
          <ProgressBar percentage={chapterData.readingProgress} />
        </View>

        {/* Action Buttons (learner mode) */}
        {mode === 'learner' && actionButtons && actionButtons.length > 0 && (
          <View style={styles.actionButtonsContainer}>
            {actionButtons.map((button, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.actionButton, { backgroundColor: button.color }]}
                onPress={button.onPress}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={button.label}
              >
                <Text style={styles.actionButtonIcon}>{button.icon}</Text>
                <Text style={styles.actionButtonLabel}>{button.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Last Session (parent mode) */}
        {mode === 'parent' && chapterData.lastSessionDate && (
          <View style={styles.lastSessionCard}>
            <Text style={styles.lastSessionText}>
              Last Session: {formatDate(chapterData.lastSessionDate)}
            </Text>
          </View>
        )}

        {/* Activity Log */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>
            Recent Activity (up to {MAX_ACTIVITIES})
          </Text>
          <ActivityLog activities={chapterData.activities} />
        </View>
      </ScrollView>
    );
  }

  // Aggregated summary view (non-chapter nodes)
  if (aggregatedData) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Header */}
        <View style={styles.header}>
          {aggregatedData.icon && (
            <Text style={styles.headerIcon}>{aggregatedData.icon}</Text>
          )}
          <Text style={styles.headerTitle}>{aggregatedData.name}</Text>
        </View>

        {/* Aggregated Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            value={`${aggregatedData.completionPercentage}%`}
            label="Total Completion"
          />
          <StatCard
            value={aggregatedData.totalPagesRead}
            label="Total Pages Read"
          />
        </View>

        {/* Progress Bar */}
        <View style={styles.progressSection}>
          <ProgressBar percentage={aggregatedData.completionPercentage} />
        </View>

        {/* Activity Log */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>
            Recent Activity (up to {MAX_ACTIVITIES})
          </Text>
          <ActivityLog activities={aggregatedData.activities} />
        </View>
      </ScrollView>
    );
  }

  // No data — should not normally be reached
  return <View style={styles.container} />;
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    fontSize: 32,
    marginRight: spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.heading.h3,
    fontWeight: typography.weight.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.background,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: typography.weight.bold,
    color: colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressPercentLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadii.button,
  },
  actionButtonIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  actionButtonLabel: {
    fontSize: typography.bodyFontSize,
    fontWeight: typography.weight.semibold,
    color: colors.white,
  },
  lastSessionCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadii.card,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lastSessionText: {
    fontSize: typography.bodyFontSize,
    color: colors.textSecondary,
  },
  activitySection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.heading.h4,
    fontWeight: typography.weight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  activityDescription: {
    flex: 1,
    fontSize: typography.bodyFontSize,
    color: colors.textPrimary,
  },
  activityTimestamp: {
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyActivityText: {
    fontSize: typography.bodyFontSize,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
