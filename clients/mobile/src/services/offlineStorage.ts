/**
 * Mobile client offline storage using AsyncStorage.
 *
 * Implements the OfflineStore interface with:
 * - Atomic persistence: all chapter components save together or rollback entirely
 * - 5-second timeout on persist operations
 * - Learner notification on failure
 *
 * Uses a key-value approach where each chapter is stored as a single JSON blob
 * to ensure atomic read/write operations.
 *
 * Validates: Requirements 21.1
 */

import type {
  ChapterData,
  SyncResult,
  OfflineStore,
  PersistenceError,
} from '@chikumiku/types';

/** Storage key prefix for offline chapters. */
const CHAPTER_KEY_PREFIX = '@chikumiku/offline_chapter_';
/** Storage key for the chapter index (list of stored chapter IDs). */
const CHAPTER_INDEX_KEY = '@chikumiku/offline_chapter_index';

/** Maximum time allowed for a persist operation (ms). */
const PERSIST_TIMEOUT_MS = 5000;

/**
 * AsyncStorage interface for React Native.
 * Lazily loaded to avoid native module resolution at import time.
 */
interface AsyncStorageModule {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  multiSet(keyValuePairs: [string, string][]): Promise<void>;
  multiGet(keys: string[]): Promise<[string, string | null][]>;
  multiRemove(keys: string[]): Promise<void>;
}

/**
 * Lazy-loaded reference to AsyncStorage.
 * Allows TypeScript compilation without the native module present.
 */
function getAsyncStorage(): AsyncStorageModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default as AsyncStorageModule;
}

/**
 * Listener type for persistence failure notifications.
 */
export type PersistenceFailureListener = (error: PersistenceError) => void;

/** Registered listeners for persistence failures. */
let failureListeners: PersistenceFailureListener[] = [];

/**
 * Register a listener to be notified when persistence fails.
 */
export function onPersistenceFailure(listener: PersistenceFailureListener): () => void {
  failureListeners.push(listener);
  return () => {
    failureListeners = failureListeners.filter((l) => l !== listener);
  };
}

/**
 * Notify all registered listeners of a persistence failure.
 */
function notifyFailure(error: PersistenceError): void {
  for (const listener of failureListeners) {
    listener(error);
  }
}

/**
 * Wrap an operation with a timeout. Rejects if the operation
 * does not complete within the specified duration.
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Validate that the ChapterData object contains all required components.
 * Throws if any component is missing or malformed.
 */
function validateChapterData(chapter: ChapterData): void {
  if (!chapter.chapterId) {
    throw new Error('ChapterData missing chapterId');
  }
  if (!chapter.transcript || !Array.isArray(chapter.transcript)) {
    throw new Error('ChapterData missing transcript');
  }
  if (!chapter.explanations || !Array.isArray(chapter.explanations)) {
    throw new Error('ChapterData missing explanations');
  }
  if (!chapter.exercises || !Array.isArray(chapter.exercises)) {
    throw new Error('ChapterData missing exercises');
  }
  if (!chapter.progress) {
    throw new Error('ChapterData missing progress');
  }
}

/**
 * Get the current chapter index (list of stored chapter IDs).
 */
async function getChapterIndex(): Promise<string[]> {
  const storage = getAsyncStorage();
  const raw = await storage.getItem(CHAPTER_INDEX_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as string[];
}

/**
 * Mobile client implementation of OfflineStore using AsyncStorage.
 * Ensures atomic persistence — all components save together or fail entirely.
 */
export const mobileOfflineStore: OfflineStore = {
  /**
   * Atomically persist a chapter's transcript, explanations, exercises, and progress.
   * The entire operation must complete within 5 seconds.
   * If any component fails, the entire operation fails and the learner is notified.
   *
   * Atomicity is achieved by:
   * 1. Serializing all chapter data into a single JSON value
   * 2. Using multiSet to write both the chapter data and updated index atomically
   * 3. On failure, no partial data is written (multiSet is all-or-nothing)
   */
  async persistChapter(chapter: ChapterData): Promise<void> {
    const persistOperation = async (): Promise<void> => {
      // Validate all components before starting
      validateChapterData(chapter);

      const storage = getAsyncStorage();
      const chapterKey = `${CHAPTER_KEY_PREFIX}${chapter.chapterId}`;

      // Set persistence timestamp
      const dataToStore: ChapterData = {
        ...chapter,
        persistedAt: new Date().toISOString(),
      };

      // Get current index and add this chapter if not already present
      const currentIndex = await getChapterIndex();
      const updatedIndex = currentIndex.includes(chapter.chapterId)
        ? currentIndex
        : [...currentIndex, chapter.chapterId];

      // Write chapter data and index atomically using multiSet
      // AsyncStorage.multiSet is an atomic batch operation —
      // if any write fails, none are committed
      await storage.multiSet([
        [chapterKey, JSON.stringify(dataToStore)],
        [CHAPTER_INDEX_KEY, JSON.stringify(updatedIndex)],
      ]);
    };

    try {
      await withTimeout(persistOperation(), PERSIST_TIMEOUT_MS, 'persistChapter');
    } catch (error) {
      const persistenceError: PersistenceError = {
        operation: 'persist',
        chapterId: chapter.chapterId,
        message: error instanceof Error ? error.message : 'Unknown persistence error',
        timestamp: new Date().toISOString(),
      };
      notifyFailure(persistenceError);
      throw error;
    }
  },

  /**
   * Retrieve all locally persisted chapters.
   */
  async getOfflineChapters(): Promise<ChapterData[]> {
    const storage = getAsyncStorage();
    const index = await getChapterIndex();

    if (index.length === 0) return [];

    const keys = index.map((id) => `${CHAPTER_KEY_PREFIX}${id}`);
    const results = await storage.multiGet(keys);

    const chapters: ChapterData[] = [];
    for (const [, value] of results) {
      if (value) {
        chapters.push(JSON.parse(value) as ChapterData);
      }
    }

    return chapters;
  },

  /**
   * Synchronize offline progress data to the server.
   *
   * Implements server-wins conflict resolution:
   * - Sends local progress data to the server
   * - If the server responds with newer data (conflict), the local copy is
   *   updated to match the server's version (server wins)
   * - Failed syncs are tracked so they can be retried on next reconnection
   *
   * Validates: Requirements 21.3
   */
  async syncProgress(serverUrl: string): Promise<SyncResult> {
    const chapters = await this.getOfflineChapters();
    const syncedIds: string[] = [];
    const failedIds: string[] = [];
    let conflictsResolved = 0;

    for (const chapter of chapters) {
      try {
        const response = await fetch(`${serverUrl}/learn/progress/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId: chapter.chapterId,
            progress: chapter.progress,
            localTimestamp: chapter.progress.lastAccessedAt,
          }),
        });

        if (response.ok) {
          const serverData = await response.json() as {
            conflict?: boolean;
            serverProgress?: typeof chapter.progress;
          };

          // Server-wins conflict resolution: if server has newer data,
          // update local storage with the server's version
          if (serverData.conflict && serverData.serverProgress) {
            const updatedChapter = {
              ...chapter,
              progress: serverData.serverProgress,
              persistedAt: new Date().toISOString(),
            };
            await this.persistChapter(updatedChapter);
            conflictsResolved += 1;
          }

          syncedIds.push(chapter.chapterId);
        } else {
          failedIds.push(chapter.chapterId);
        }
      } catch {
        failedIds.push(chapter.chapterId);
      }
    }

    return {
      success: failedIds.length === 0,
      syncedChapterIds: syncedIds,
      failedChapterIds: failedIds,
      conflictsResolved,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * Filter persisted chapters by academic year.
   */
  async getAcademicYearContent(year: number): Promise<ChapterData[]> {
    const chapters = await this.getOfflineChapters();
    return chapters.filter((chapter) => chapter.academicYear === year);
  },
};
