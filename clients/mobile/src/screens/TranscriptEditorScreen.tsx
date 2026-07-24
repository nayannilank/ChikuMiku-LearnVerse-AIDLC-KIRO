/**
 * TranscriptEditorScreen — Android screen for viewing and editing OCR transcripts.
 *
 * Displays transcript page-by-page with page markers (Page 1, Page 2, etc.).
 * Separates content pages from exercise pages.
 * Allows text editing on any page.
 * Save button: persists atomically, shows success only after verification.
 * Handles save errors with retry option.
 *
 * Validates: Requirements 8.4, 8.5, 8.6
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { apiClient } from '../services/api';

/* --- Types --- */

type PageStatus = 'success' | 'pending' | 'failed';
type PageClassification = 'content' | 'exercise';

interface TranscriptPage {
  pageNumber: number;
  classification: PageClassification;
  text: string;
  language: string;
  status: PageStatus;
}

interface NavigationProp {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  goBack: () => void;
}

interface RouteProp {
  params: { chapterId: string };
}

interface Props {
  navigation: NavigationProp;
  route: RouteProp;
}

/* --- Component --- */

export function TranscriptEditorScreen({ navigation, route }: Props): React.ReactElement {
  const { chapterId } = route.params;

  const [pages, setPages] = useState<TranscriptPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Check if any page is unprocessed
  const hasUnprocessedPages = pages.some(
    (p) => p.status === 'pending' || p.status === 'failed'
  );

  // Separate pages by classification (Req 8.4)
  const contentPages = pages.filter((p) => p.classification === 'content');
  const exercisePages = pages.filter((p) => p.classification === 'exercise');

  /* --- Load transcript data --- */

  useEffect(() => {
    let cancelled = false;

    async function loadTranscript() {
      setIsLoading(true);
      try {
        const response = await apiClient.get<{ pages: TranscriptPage[] }>(
          `/learner/chapters/${encodeURIComponent(chapterId)}/transcript`
        );
        if (!cancelled) {
          setPages(response.data.pages);
        }
      } catch {
        // Load with empty state on failure
        if (!cancelled) {
          setPages([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTranscript();
    return () => { cancelled = true; };
  }, [chapterId]);

  /* --- Handle text editing (Req 8.5) --- */

  const handleTextChange = useCallback((pageNumber: number, newText: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, text: newText } : p
      )
    );
    // Clear save status on edit
    setSaveSuccess(false);
    setSaveError(null);
  }, []);

  /* --- Handle save (Req 8.6) --- */

  const handleSave = useCallback(async () => {
    if (hasUnprocessedPages) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Persist atomically
      const response = await apiClient.post<{ success: boolean; error?: string }>(
        `/learner/chapters/${encodeURIComponent(chapterId)}/transcript/save`,
        { pages }
      );

      if (response.data.success) {
        // Verify persistence
        const verify = await apiClient.get<{ verified: boolean }>(
          `/learner/chapters/${encodeURIComponent(chapterId)}/transcript/verify`
        );

        if (verify.data.verified) {
          setSaveSuccess(true);
        } else {
          setSaveError('Save could not be verified. Please try again.');
        }
      } else {
        setSaveError(response.data.error ?? 'Failed to save transcript.');
      }
    } catch {
      setSaveError('An unexpected error occurred while saving. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [hasUnprocessedPages, chapterId, pages]);

  /* --- Render --- */

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={'#E94F9B'} />
        <Text style={styles.loadingText}>Loading transcript...</Text>
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyTitle}>No Transcript Available</Text>
        <Text style={styles.loadingText}>
          OCR processing may not have completed. Please go back and check.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Transcript Editor</Text>
          <Text style={styles.subtitle}>
            {pages.length} pages • {contentPages.length} content • {exercisePages.length} exercise
          </Text>
        </View>
      </View>

      {/* Warning banner if unprocessed pages */}
      {hasUnprocessedPages && (
        <View style={styles.warningBanner} accessibilityRole="alert">
          <Text style={styles.warningText}>
            ⚠️ Some pages have not been processed. Save is disabled until all pages are ready.
          </Text>
        </View>
      )}

      {/* Save status */}
      {saveSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ Chapter saved successfully!</Text>
        </View>
      )}
      {saveError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>✗ {saveError}</Text>
        </View>
      )}

      {/* Transcript pages */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Content Pages Section */}
        {contentPages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📖 Content Pages ({contentPages.length})</Text>
            {contentPages.map((page) => (
              <View key={page.pageNumber} style={styles.pageCard}>
                <View style={styles.pageHeader}>
                  <Text style={styles.pageLabel}>Page {page.pageNumber}</Text>
                  <View style={styles.pageMetaRow}>
                    <View style={styles.languageBadge}>
                      <Text style={styles.languageBadgeText}>{page.language}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        page.status === 'success' && styles.statusSuccess,
                        page.status === 'pending' && styles.statusPending,
                        page.status === 'failed' && styles.statusFailed,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {page.status === 'success' ? '✓ Processed' :
                         page.status === 'pending' ? '⏳ Pending' : '✗ Failed'}
                      </Text>
                    </View>
                  </View>
                </View>
                <TextInput
                  style={[
                    styles.textArea,
                    page.status !== 'success' && styles.textAreaDisabled,
                  ]}
                  value={page.text}
                  onChangeText={(text) => handleTextChange(page.pageNumber, text)}
                  multiline
                  editable={page.status === 'success'}
                  textAlignVertical="top"
                  accessibilityLabel={`Transcript text for page ${page.pageNumber}`}
                />
              </View>
            ))}
          </View>
        )}

        {/* Exercise Pages Section */}
        {exercisePages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✏️ Exercise Pages ({exercisePages.length})</Text>
            {exercisePages.map((page) => (
              <View key={page.pageNumber} style={styles.pageCard}>
                <View style={styles.pageHeader}>
                  <Text style={styles.pageLabel}>Page {page.pageNumber}</Text>
                  <View style={styles.pageMetaRow}>
                    <View style={styles.languageBadge}>
                      <Text style={styles.languageBadgeText}>{page.language}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        page.status === 'success' && styles.statusSuccess,
                        page.status === 'pending' && styles.statusPending,
                        page.status === 'failed' && styles.statusFailed,
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {page.status === 'success' ? '✓ Processed' :
                         page.status === 'pending' ? '⏳ Pending' : '✗ Failed'}
                      </Text>
                    </View>
                  </View>
                </View>
                <TextInput
                  style={[
                    styles.textArea,
                    page.status !== 'success' && styles.textAreaDisabled,
                  ]}
                  value={page.text}
                  onChangeText={(text) => handleTextChange(page.pageNumber, text)}
                  multiline
                  editable={page.status === 'success'}
                  textAlignVertical="top"
                  accessibilityLabel={`Transcript text for page ${page.pageNumber}`}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Save button (fixed bottom) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.saveButton,
            (hasUnprocessedPages || isSaving) && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={hasUnprocessedPages || isSaving}
          accessibilityRole="button"
          accessibilityLabel="Save transcript"
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={'#FFFFFF'} />
          ) : (
            <Text style={styles.saveButtonText}>Save Transcript</Text>
          )}
        </TouchableOpacity>

        {saveError && (
          <TouchableOpacity
            style={styles.retryLink}
            onPress={handleSave}
            accessibilityRole="button"
            accessibilityLabel="Retry save"
          >
            <Text style={styles.retryLinkText}>Tap to retry</Text>
          </TouchableOpacity>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F5FF',
    padding: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#777777',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  header: {
    backgroundColor: '#F7C948',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  headerLeft: {
    flex: 1,
  },
  warningBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F7C948',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  warningText: {
    color: '#92400E',
    fontSize: 13,
  },
  successBanner: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
  },
  errorBannerText: {
    color: '#E74C3C',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  pageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0D8EC',
    padding: 16,
    marginBottom: 16,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  pageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageBadge: {
    backgroundColor: '#F8F5FF',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  languageBadgeText: {
    fontSize: 11,
    color: '#999999',
  },
  statusBadge: {
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  statusSuccess: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusFailed: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#E0D8EC',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    lineHeight: 22,
    color: '#333333',
    minHeight: 120,
    backgroundColor: '#FFFFFF',
  },
  textAreaDisabled: {
    backgroundColor: '#F8F5FF',
    opacity: 0.6,
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0D8EC',
    backgroundColor: '#F8F5FF',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#27AE60',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  retryLink: {
    marginTop: 8,
    padding: 4,
    minHeight: 48,
    justifyContent: 'center',
  },
  retryLinkText: {
    color: '#E94F9B',
    fontSize: 14,
    fontWeight: '500',
  },
});
