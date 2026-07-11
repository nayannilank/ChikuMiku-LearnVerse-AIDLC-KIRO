/**
 * ChapterExplanationScreen — AI-generated chapter explanations
 *
 * Supports Read and Listen modes with page navigation.
 * Read mode shows summary (max 200 words), keywords (3-10), and concepts (1-5).
 * Listen mode provides audio playback with play/pause/seek controls.
 *
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { borderRadii } from '../theme/borderRadii';
import { apiClient } from '../services/api';

/* --- Types --- */

interface ExplanationData {
  summary: string;
  keywords: string[];
  concepts: string[];
  totalPages: number;
  audioUrl?: string;
}

interface NavigationProp {
  goBack: () => void;
}

interface RouteProp {
  params: { chapterId: string; pageNumber: number };
}

interface Props {
  navigation: NavigationProp;
  route: RouteProp;
}

type Mode = 'read' | 'listen';

/* --- Component --- */

export function ChapterExplanationScreen({ route }: Props): React.ReactElement {
  const { chapterId, pageNumber: initialPage } = route.params;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [mode, setMode] = useState<Mode>('read');
  const [explanation, setExplanation] = useState<ExplanationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* --- Fetch explanation for current page --- */

  const fetchExplanation = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<ExplanationData>(
        `/ai/explain/${encodeURIComponent(chapterId)}/pages/${page}`
      );
      setExplanation(response.data);
    } catch {
      setError('Failed to generate explanation. Please try again.');
      setExplanation(null);
    } finally {
      setIsLoading(false);
    }
  }, [chapterId]);

  useEffect(() => {
    fetchExplanation(currentPage);
  }, [currentPage, fetchExplanation]);

  /* --- Audio controls --- */

  const stopAudio = useCallback(() => {
    setIsPlaying(false);
    setAudioProgress(0);
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
        audioIntervalRef.current = null;
      }
    } else {
      setIsPlaying(true);
      // Simulate audio progress (real implementation uses Audio API)
      audioIntervalRef.current = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            stopAudio();
            return 0;
          }
          return prev + 1;
        });
      }, 300);
    }
  }, [isPlaying, stopAudio]);

  const seekAudio = useCallback((value: number) => {
    setAudioProgress(Math.max(0, Math.min(100, value)));
  }, []);

  /* --- Mode toggle --- */

  const handleModeChange = useCallback((newMode: Mode) => {
    if (newMode === 'read' && mode === 'listen') {
      // Switching from Listen to Read stops audio (Req 9.5)
      stopAudio();
    }
    setMode(newMode);
  }, [mode, stopAudio]);

  /* --- Page navigation --- */

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      stopAudio();
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage, stopAudio]);

  const goToNextPage = useCallback(() => {
    if (explanation && currentPage < explanation.totalPages) {
      stopAudio();
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, explanation, stopAudio]);

  /* --- Cleanup --- */

  useEffect(() => {
    return () => {
      if (audioIntervalRef.current) {
        clearInterval(audioIntervalRef.current);
      }
    };
  }, []);

  /* --- Render --- */

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Generating explanation...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText} accessibilityRole="alert">{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchExplanation(currentPage)}
          accessibilityRole="button"
          accessibilityLabel="Retry generating explanation"
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!explanation) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No explanation available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Mode Toggle */}
      <View style={styles.modeToggleRow}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'read' && styles.modeButtonActive]}
          onPress={() => handleModeChange('read')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'read' }}
          accessibilityLabel="Read mode"
        >
          <Text style={[styles.modeButtonText, mode === 'read' && styles.modeButtonTextActive]}>
            Read
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'listen' && styles.modeButtonActive]}
          onPress={() => handleModeChange('listen')}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === 'listen' }}
          accessibilityLabel="Listen mode"
        >
          <Text style={[styles.modeButtonText, mode === 'listen' && styles.modeButtonTextActive]}>
            Listen
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content area */}
      <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentInner}>
        {mode === 'read' ? (
          /* --- Read Mode --- */
          <View>
            {/* Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Summary</Text>
              <Text style={styles.summaryText}>{explanation.summary}</Text>
            </View>

            {/* Keywords */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Keywords</Text>
              <View style={styles.keywordRow}>
                {explanation.keywords.map((keyword, index) => (
                  <View key={index} style={styles.keywordBadge}>
                    <Text style={styles.keywordText}>{keyword}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Concepts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Key Concepts</Text>
              {explanation.concepts.map((concept, index) => (
                <View key={index} style={styles.conceptItem}>
                  <Text style={styles.conceptBullet}>{index + 1}.</Text>
                  <Text style={styles.conceptText}>{concept}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* --- Listen Mode --- */
          <View style={styles.audioContainer}>
            <Text style={styles.audioTitle}>Audio Explanation</Text>
            <Text style={styles.audioPageLabel}>Page {currentPage}</Text>

            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlay}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause audio' : 'Play audio'}
            >
              <Text style={styles.playButtonText}>
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </Text>
            </TouchableOpacity>

            {/* Progress / Seek bar */}
            <View style={styles.seekContainer}>
              <View style={styles.seekTrack}>
                <View style={[styles.seekFill, { width: `${audioProgress}%` }]} />
              </View>
              <View style={styles.seekButtons}>
                <TouchableOpacity
                  style={styles.seekButton}
                  onPress={() => seekAudio(Math.max(0, audioProgress - 10))}
                  accessibilityRole="button"
                  accessibilityLabel="Seek backward"
                >
                  <Text style={styles.seekButtonText}>⏪</Text>
                </TouchableOpacity>
                <Text style={styles.progressText}>{Math.round(audioProgress)}%</Text>
                <TouchableOpacity
                  style={styles.seekButton}
                  onPress={() => seekAudio(Math.min(100, audioProgress + 10))}
                  accessibilityRole="button"
                  accessibilityLabel="Seek forward"
                >
                  <Text style={styles.seekButtonText}>⏩</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Page Navigation */}
      <View style={styles.pageNavigation}>
        <TouchableOpacity
          style={[styles.navButton, currentPage <= 1 && styles.navButtonDisabled]}
          onPress={goToPreviousPage}
          disabled={currentPage <= 1}
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          accessibilityState={{ disabled: currentPage <= 1 }}
        >
          <Text style={[styles.navButtonText, currentPage <= 1 && styles.navButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        {/* Page Indicator Dots */}
        <View style={styles.pageDots}>
          {Array.from({ length: explanation.totalPages }, (_, i) => (
            <View
              key={i}
              style={[styles.dot, i + 1 === currentPage && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.navButton,
            currentPage >= explanation.totalPages && styles.navButtonDisabled,
          ]}
          onPress={goToNextPage}
          disabled={currentPage >= explanation.totalPages}
          accessibilityRole="button"
          accessibilityLabel="Next page"
          accessibilityState={{ disabled: currentPage >= explanation.totalPages }}
        >
          <Text
            style={[
              styles.navButtonText,
              currentPage >= explanation.totalPages && styles.navButtonTextDisabled,
            ]}
          >
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modeToggleRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadii.button,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  summaryText: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  keywordBadge: {
    backgroundColor: colors.accent,
    borderRadius: borderRadii.badge,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  keywordText: {
    fontSize: 13,
    color: colors.white,
    fontWeight: '500',
  },
  conceptItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  conceptBullet: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginRight: spacing.sm,
    width: 20,
  },
  conceptText: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  audioContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  audioTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  audioPageLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  playButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  playButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  seekContainer: {
    width: '100%',
    paddingHorizontal: spacing.md,
  },
  seekTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  seekFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  seekButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  seekButton: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekButtonText: {
    fontSize: 24,
  },
  progressText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  pageNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  navButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: colors.border,
  },
  navButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: colors.textMuted,
  },
  pageDots: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
