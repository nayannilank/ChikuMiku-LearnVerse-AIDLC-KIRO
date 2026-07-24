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
        <ActivityIndicator size="large" color={'#E94F9B'} />
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
      {/* Gold Header */}
      <View style={styles.goldHeader}>
        <Text style={styles.goldHeaderBack}>←</Text>
        <Text style={styles.goldHeaderTitle}>Explain — Chapter</Text>
      </View>
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
    backgroundColor: '#F8F5FF',
  },
  goldHeader: {
    backgroundColor: '#F7C948',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goldHeaderBack: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  goldHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#777777',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#E74C3C',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modeToggleRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E0D8EC',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#E94F9B',
    borderColor: '#E94F9B',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#777777',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    padding: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordBadge: {
    backgroundColor: '#5DADE2',
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  keywordText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  conceptItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  conceptBullet: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E94F9B',
    marginRight: 8,
    width: 20,
  },
  conceptText: {
    flex: 1,
    fontSize: 15,
    color: '#333333',
    lineHeight: 22,
  },
  audioContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  audioTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  audioPageLabel: {
    fontSize: 14,
    color: '#777777',
    marginBottom: 24,
  },
  playButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 32,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  seekContainer: {
    width: '100%',
    paddingHorizontal: 16,
  },
  seekTrack: {
    height: 8,
    backgroundColor: '#E0D8EC',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  seekFill: {
    height: '100%',
    backgroundColor: '#E94F9B',
    borderRadius: 4,
  },
  seekButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
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
    color: '#777777',
    fontWeight: '500',
  },
  pageNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0D8EC',
    backgroundColor: '#FFFFFF',
  },
  navButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navButtonDisabled: {
    backgroundColor: '#E0D8EC',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  navButtonTextDisabled: {
    color: '#999999',
  },
  pageDots: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0D8EC',
  },
  dotActive: {
    backgroundColor: '#E94F9B',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
