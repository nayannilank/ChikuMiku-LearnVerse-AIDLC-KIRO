/**
 * OCRProcessingScreen — Android screen showing OCR progress with per-page status.
 *
 * Displays progress indicator: "Extracting text from pages..." with current/total.
 * Polls for real-time status updates per page.
 * Handles per-page failures with error indicators and Retry buttons.
 * 30-second timeout per page.
 * On completion: navigates to transcript editor.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.7, 8.8
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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

type PageOcrStatus = 'pending' | 'processing' | 'success' | 'failed';

interface OcrPageResult {
  pageNumber: number;
  status: PageOcrStatus;
  errorMessage?: string;
}

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

interface RouteProp {
  params: { chapterId: string };
}

interface Props {
  navigation: NavigationProp;
  route: RouteProp;
}

/* --- Constants --- */

const POLL_INTERVAL_MS = 2000;
const PAGE_TIMEOUT_MS = 30_000;

/* --- Component --- */

export function OCRProcessingScreen({ navigation, route }: Props): React.ReactElement {
  const { chapterId } = route.params;

  const [pages, setPages] = useState<OcrPageResult[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  /* --- Initialize OCR processing --- */

  useEffect(() => {
    let cancelled = false;

    async function initializeOcr() {
      try {
        // Start OCR processing on the server
        const response = await apiClient.post<{ totalPages: number }>(
          `/learner/chapters/${encodeURIComponent(chapterId)}/ocr/start`
        );

        if (!cancelled) {
          const total = response.data.totalPages;
          setTotalPages(total);
          setPages(
            Array.from({ length: total }, (_, i) => ({
              pageNumber: i + 1,
              status: 'pending' as const,
            }))
          );
          setIsInitializing(false);
        }
      } catch {
        if (!cancelled) {
          // Fallback: simulate with a default page count
          setTotalPages(0);
          setPages([]);
          setIsInitializing(false);
        }
      }
    }

    initializeOcr();
    return () => { cancelled = true; };
  }, [chapterId]);

  /* --- Poll for OCR status updates --- */

  useEffect(() => {
    if (isInitializing || totalPages === 0 || isComplete) return;

    async function pollStatus() {
      try {
        const response = await apiClient.get<{
          pages: Array<{ pageNumber: number; status: PageOcrStatus; error?: string }>;
        }>(`/learner/chapters/${encodeURIComponent(chapterId)}/ocr/status`);

        setPages((prev) =>
          prev.map((page) => {
            const update = response.data.pages.find(
              (p) => p.pageNumber === page.pageNumber
            );
            if (update) {
              return {
                pageNumber: page.pageNumber,
                status: update.status,
                errorMessage: update.error,
              };
            }
            return page;
          })
        );

        // Update current page indicator
        const processing = response.data.pages.find((p) => p.status === 'processing');
        if (processing) {
          setCurrentPage(processing.pageNumber);
        }

        // Check completion
        const allDone = response.data.pages.every(
          (p) => p.status === 'success' || p.status === 'failed'
        );
        const allSuccess = response.data.pages.every((p) => p.status === 'success');

        if (allDone) {
          setIsComplete(true);
          if (allSuccess) {
            // Navigate to transcript editor
            setTimeout(() => {
              navigation.navigate('TranscriptEditor', { chapterId });
            }, 1000);
          }
        }
      } catch {
        // Continue polling on failure
      }
    }

    pollIntervalRef.current = setInterval(pollStatus, POLL_INTERVAL_MS);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isInitializing, totalPages, isComplete, chapterId, navigation]);

  /* --- Set up per-page timeouts --- */

  useEffect(() => {
    pages.forEach((page) => {
      if (page.status === 'processing' && !timeoutRefs.current.has(page.pageNumber)) {
        const timeout = setTimeout(() => {
          setPages((prev) =>
            prev.map((p) =>
              p.pageNumber === page.pageNumber && p.status === 'processing'
                ? { ...p, status: 'failed', errorMessage: 'Processing timed out (30s)' }
                : p
            )
          );
          timeoutRefs.current.delete(page.pageNumber);
        }, PAGE_TIMEOUT_MS);
        timeoutRefs.current.set(page.pageNumber, timeout);
      }

      // Clear timeout if page completed
      if (
        (page.status === 'success' || page.status === 'failed') &&
        timeoutRefs.current.has(page.pageNumber)
      ) {
        clearTimeout(timeoutRefs.current.get(page.pageNumber));
        timeoutRefs.current.delete(page.pageNumber);
      }
    });
  }, [pages]);

  /* --- Cleanup timeouts on unmount --- */

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  /* --- Retry handler --- */

  const handleRetry = useCallback(
    async (pageNumber: number) => {
      setPages((prev) =>
        prev.map((p) =>
          p.pageNumber === pageNumber
            ? { ...p, status: 'processing', errorMessage: undefined }
            : p
        )
      );

      try {
        await apiClient.post(
          `/learner/chapters/${encodeURIComponent(chapterId)}/ocr/retry`,
          { pageNumber }
        );
      } catch {
        setPages((prev) =>
          prev.map((p) =>
            p.pageNumber === pageNumber
              ? { ...p, status: 'failed', errorMessage: 'Retry request failed' }
              : p
          )
        );
      }
    },
    [chapterId]
  );

  /* --- Computed values --- */

  const successCount = pages.filter((p) => p.status === 'success').length;
  const failedCount = pages.filter((p) => p.status === 'failed').length;
  const allSuccess = isComplete && failedCount === 0;

  /* --- Render --- */

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparing OCR processing...</Text>
      </View>
    );
  }

  if (totalPages === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorMainText}>No pages to process</Text>
        <Text style={styles.loadingText}>Please go back and capture pages first.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>OCR Processing</Text>
        <Text style={styles.progressText}>
          Extracting text from pages... {currentPage} of {totalPages}
        </Text>
      </View>

      {/* Progress indicator */}
      {!isComplete && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(successCount / totalPages) * 100}%` },
            ]}
          />
        </View>
      )}

      {/* Completion messages */}
      {allSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>
            ✓ All pages processed successfully! Redirecting...
          </Text>
        </View>
      )}

      {isComplete && failedCount > 0 && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            {failedCount} page(s) failed. {successCount}/{totalPages} processed successfully.
          </Text>
        </View>
      )}

      {/* Page status grid */}
      <View style={styles.pageGrid}>
        {pages.map((page) => (
          <View
            key={page.pageNumber}
            style={[
              styles.pageBadge,
              page.status === 'processing' && styles.pageBadgeProcessing,
              page.status === 'success' && styles.pageBadgeSuccess,
              page.status === 'failed' && styles.pageBadgeFailed,
            ]}
          >
            <Text
              style={[
                styles.pageBadgeText,
                (page.status === 'success' || page.status === 'failed') &&
                  styles.pageBadgeTextLight,
              ]}
            >
              Page {page.pageNumber}
            </Text>

            {page.status === 'processing' && (
              <ActivityIndicator
                size="small"
                color={colors.dark}
                style={styles.pageBadgeLoader}
              />
            )}

            {page.status === 'success' && (
              <Text style={styles.statusIcon}>✓</Text>
            )}

            {page.status === 'failed' && (
              <View style={styles.failedRow}>
                <Text style={styles.statusIcon}>✗</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => handleRetry(page.pageNumber)}
                  accessibilityRole="button"
                  accessibilityLabel={`Retry OCR for page ${page.pageNumber}`}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            )}

            {page.errorMessage && (
              <Text style={styles.pageErrorText} numberOfLines={1}>
                {page.errorMessage}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Navigate to transcript if some pages succeeded */}
      {isComplete && failedCount > 0 && successCount > 0 && (
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => navigation.navigate('TranscriptEditor', { chapterId })}
          accessibilityRole="button"
          accessibilityLabel="Continue to transcript editor"
        >
          <Text style={styles.continueButtonText}>
            Continue with {successCount} pages
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  errorMainText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.error,
    marginBottom: spacing.xs,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  progressText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: borderRadii.input,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadii.input,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  pageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  pageBadge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadii.badge,
    backgroundColor: colors.border,
    alignItems: 'center',
    minWidth: 90,
  },
  pageBadgeProcessing: {
    backgroundColor: colors.warning,
  },
  pageBadgeSuccess: {
    backgroundColor: colors.success,
  },
  pageBadgeFailed: {
    backgroundColor: colors.error,
  },
  pageBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  pageBadgeTextLight: {
    color: colors.white,
  },
  pageBadgeLoader: {
    marginTop: 4,
  },
  statusIcon: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  failedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  retryButton: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.white,
    minHeight: 24,
    justifyContent: 'center',
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '500',
  },
  pageErrorText: {
    color: colors.white,
    fontSize: 10,
    marginTop: 2,
    opacity: 0.8,
  },
  continueButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadii.button,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginTop: spacing.lg,
  },
  continueButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
