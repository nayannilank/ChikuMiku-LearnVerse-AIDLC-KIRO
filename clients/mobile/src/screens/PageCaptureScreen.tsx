/**
 * PageCaptureScreen — Android screen for capturing/uploading textbook pages,
 * classifying them as content or exercise, and initiating OCR processing.
 *
 * Two input modes: Camera (live capture) and Upload (gallery/file picker).
 * Displays pages as numbered thumbnails in a grid with reorder, delete,
 * recapture, and classification toggle controls.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { validateFileUpload } from '@chikumiku/validation';

/* --- Types --- */

type PageClassification = 'content' | 'exercise';

interface CapturedPage {
  id: string;
  uri: string;
  format: string;
  sizeBytes: number;
  classification: PageClassification;
}

/** react-native-image-picker response asset shape */
interface ImagePickerAsset {
  uri: string;
  fileName?: string;
  type?: string;
  fileSize?: number;
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

const MIN_PAGES = 1;
const MAX_CONTENT_PAGES = 50;
const MAX_EXERCISE_PAGES = 20;
const MAX_TOTAL_PAGES = MAX_CONTENT_PAGES + MAX_EXERCISE_PAGES;
const THUMBNAIL_COLUMNS = 3;

/* --- Helpers --- */

function generateId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getFormatFromMimeOrName(mimeType?: string, fileName?: string): string {
  if (mimeType) {
    const parts = mimeType.split('/');
    const ext = parts[1]?.toLowerCase() ?? '';
    if (ext === 'jpg' || ext === 'jpeg') return 'jpeg';
    return ext;
  }
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'jpg') return 'jpeg';
    return ext;
  }
  return '';
}

/* --- Component --- */

export function PageCaptureScreen({ navigation, route }: Props): React.ReactElement {
  const { chapterId } = route.params;

  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const contentPageCount = pages.filter((p) => p.classification === 'content').length;
  const exercisePageCount = pages.filter((p) => p.classification === 'exercise').length;

  /* --- Image picker integration --- */

  /**
   * Processes picked/captured images from react-native-image-picker.
   * In production, this would be called by the image picker response handler.
   */
  const processPickerResponse = useCallback(
    (assets: ImagePickerAsset[]) => {
      setError(null);
      const newPages: CapturedPage[] = [];

      for (const asset of assets) {
        if (pages.length + newPages.length >= MAX_TOTAL_PAGES) {
          setError(`Maximum page limit reached. Cannot add more pages.`);
          break;
        }

        const format = getFormatFromMimeOrName(asset.type, asset.fileName);
        const sizeBytes = asset.fileSize ?? 0;
        const validation = validateFileUpload(format, sizeBytes);

        if (!validation.valid) {
          const reasons = Object.values(validation.errors).join('. ');
          setError(`File rejected: ${reasons}`);
          continue;
        }

        newPages.push({
          id: generateId(),
          uri: asset.uri,
          format,
          sizeBytes,
          classification: 'content',
        });
      }

      if (newPages.length > 0) {
        setPages((prev) => [...prev, ...newPages]);
      }
    },
    [pages.length]
  );

  const handleCameraCapture = useCallback(() => {
    // In production, this calls react-native-image-picker's launchCamera
    // For now, simulate the interface:
    // launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
    //   if (response.assets) processPickerResponse(response.assets);
    // });
    void processPickerResponse;
    Alert.alert('Camera', 'Camera capture would launch here via react-native-image-picker');
  }, [processPickerResponse]);

  const handleUpload = useCallback(() => {
    // In production, this calls react-native-image-picker's launchImageLibrary
    // launchImageLibrary({ mediaType: 'photo', selectionLimit: 0 }, (response) => {
    //   if (response.assets) processPickerResponse(response.assets);
    // });
    void processPickerResponse;
    Alert.alert('Gallery', 'Gallery picker would launch here via react-native-image-picker');
  }, [processPickerResponse]);

  /* --- Page operations --- */

  const handleDelete = useCallback((pageId: string) => {
    setPages((prev) => prev.filter((p) => p.id !== pageId));
    setError(null);
  }, []);

  const handleToggleClassification = useCallback((pageId: string) => {
    setPages((prev) => {
      const page = prev.find((p) => p.id === pageId);
      if (!page) return prev;

      // Enforce limits
      if (page.classification === 'content') {
        // Switching to exercise - check exercise limit
        const currentExercise = prev.filter((p) => p.classification === 'exercise').length;
        if (currentExercise >= MAX_EXERCISE_PAGES) {
          return prev;
        }
      } else {
        // Switching to content - check content limit
        const currentContent = prev.filter((p) => p.classification === 'content').length;
        if (currentContent >= MAX_CONTENT_PAGES) {
          return prev;
        }
      }

      return prev.map((p) =>
        p.id === pageId
          ? { ...p, classification: p.classification === 'content' ? 'exercise' : 'content' }
          : p
      );
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setPages((prev) => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setPages((prev) => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  }, []);

  const handleRecapture = useCallback((_pageId: string) => {
    // In production, launch picker and replace the page
    Alert.alert('Recapture', 'Recapture would launch image picker for this page');
  }, []);

  /* --- Done --- */

  const handleDone = useCallback(() => {
    setError(null);

    if (pages.length === 0) {
      setError('At least 1 page is required. Please capture or upload pages before proceeding.');
      return;
    }

    if (contentPageCount > MAX_CONTENT_PAGES) {
      setError(
        `Cannot proceed: content pages (${contentPageCount}) exceed the maximum of ${MAX_CONTENT_PAGES}. Please remove pages.`
      );
      return;
    }

    if (exercisePageCount > MAX_EXERCISE_PAGES) {
      setError(
        `Cannot proceed: exercise pages (${exercisePageCount}) exceed the maximum of ${MAX_EXERCISE_PAGES}. Please remove pages.`
      );
      return;
    }

    if (contentPageCount < MIN_PAGES) {
      setError('At least 1 content page is required.');
      return;
    }

    // Lock pages and navigate to OCR processing
    setIsLocked(true);
    navigation.navigate('OCRProcessing', { chapterId });
  }, [pages.length, contentPageCount, exercisePageCount, navigation, chapterId]);

  /* --- Render thumbnail item --- */

  const renderThumbnail = useCallback(
    ({ item, index }: { item: CapturedPage; index: number }) => (
      <View style={styles.thumbnailCard}>
        <View style={styles.thumbnailImageContainer}>
          <Image
            source={{ uri: item.uri }}
            style={styles.thumbnailImage}
            accessibilityLabel={`Page ${index + 1}`}
          />
          <View style={styles.pageNumberBadge}>
            <Text style={styles.pageNumberText}>{index + 1}</Text>
          </View>
        </View>

        {/* Classification toggle */}
        <TouchableOpacity
          style={[
            styles.classificationBadge,
            item.classification === 'exercise' && styles.classificationExercise,
          ]}
          onPress={() => handleToggleClassification(item.id)}
          disabled={isLocked}
          accessibilityRole="button"
          accessibilityLabel={`Toggle page ${index + 1} classification, currently ${item.classification}`}
        >
          <Text
            style={[
              styles.classificationText,
              item.classification === 'exercise' && styles.classificationTextExercise,
            ]}
          >
            {item.classification === 'content' ? '📖 Content' : '✏️ Exercise'}
          </Text>
        </TouchableOpacity>

        {/* Action buttons */}
        {!isLocked && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMoveUp(index)}
              disabled={index === 0}
              accessibilityLabel={`Move page ${index + 1} up`}
            >
              <Text style={styles.actionButtonText}>↑</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleMoveDown(index)}
              disabled={index === pages.length - 1}
              accessibilityLabel={`Move page ${index + 1} down`}
            >
              <Text style={styles.actionButtonText}>↓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleRecapture(item.id)}
              accessibilityLabel={`Recapture page ${index + 1}`}
            >
              <Text style={styles.actionButtonText}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => handleDelete(item.id)}
              accessibilityLabel={`Delete page ${index + 1}`}
            >
              <Text style={[styles.actionButtonText, styles.deleteText]}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    ),
    [
      isLocked, pages.length, handleToggleClassification,
      handleMoveUp, handleMoveDown, handleRecapture, handleDelete,
    ]
  );

  /* --- Main render --- */

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Capture Pages</Text>
        <Text style={styles.subtitle}>
          Chapter ID: {chapterId} • {MIN_PAGES}–{MAX_CONTENT_PAGES} content + 0–{MAX_EXERCISE_PAGES} exercise pages
        </Text>
      </View>

      {/* Error display */}
      {error && (
        <View style={styles.errorBanner} accessibilityRole="alert">
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Input modes */}
      {!isLocked && (
        <View style={styles.inputModes}>
          <TouchableOpacity
            style={[styles.modeButton, styles.cameraButton]}
            onPress={handleCameraCapture}
            accessibilityRole="button"
            accessibilityLabel="Capture page with camera"
          >
            <Text style={styles.modeButtonText}>📷 Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, styles.uploadButton]}
            onPress={handleUpload}
            accessibilityRole="button"
            accessibilityLabel="Upload page from gallery"
          >
            <Text style={styles.modeButtonText}>📁 Upload</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Page count */}
      <Text style={styles.pageCount}>
        {pages.length} pages • Content: {contentPageCount}/{MAX_CONTENT_PAGES} • Exercise: {exercisePageCount}/{MAX_EXERCISE_PAGES}
      </Text>

      {/* Thumbnail grid */}
      <FlatList
        data={pages}
        renderItem={renderThumbnail}
        keyExtractor={(item) => item.id}
        numColumns={THUMBNAIL_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              No pages captured yet. Use Camera or Upload to add pages.
            </Text>
          </View>
        }
      />

      {/* Done button */}
      {!isLocked && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={handleDone}
            accessibilityRole="button"
            accessibilityLabel="Done capturing pages, proceed to OCR processing"
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLocked && (
        <View style={styles.lockedBanner}>
          <ActivityIndicator size="small" color={'#E94F9B'} />
          <Text style={styles.lockedText}>Pages locked. Navigating to processing...</Text>
        </View>
      )}
    </View>
  );
}

/* --- Styles --- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
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
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  errorBannerText: {
    color: '#E74C3C',
    fontSize: 14,
  },
  inputModes: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cameraButton: {
    backgroundColor: '#E94F9B',
  },
  uploadButton: {
    backgroundColor: '#9B59B6',
  },
  modeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pageCount: {
    fontSize: 13,
    color: '#777777',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  gridContent: {
    paddingHorizontal: 8,
    paddingBottom: 100,
  },
  gridRow: {
    gap: 8,
    marginBottom: 8,
  },
  thumbnailCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0D8EC',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    maxWidth: '33%',
  },
  thumbnailImageContainer: {
    position: 'relative',
    height: 100,
  },
  thumbnailImage: {
    width: '100%',
    height: 100,
    resizeMode: 'cover',
  },
  pageNumberBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#2C2341',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  pageNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  classificationBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0D8EC',
    backgroundColor: '#F8F5FF',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  classificationExercise: {
    backgroundColor: '#FEF3C7',
  },
  classificationText: {
    fontSize: 11,
    color: '#777777',
    fontWeight: '500',
  },
  classificationTextExercise: {
    color: '#92400E',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
    justifyContent: 'center',
  },
  actionButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0D8EC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 12,
  },
  deleteButton: {
    borderColor: '#E74C3C',
  },
  deleteText: {
    color: '#E74C3C',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#F8F5FF',
    borderTopWidth: 1,
    borderTopColor: '#E0D8EC',
  },
  doneButton: {
    backgroundColor: '#E94F9B',
    borderRadius: 22,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  lockedText: {
    fontSize: 14,
    color: '#777777',
  },
});
