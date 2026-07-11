/**
 * Web client offline storage using IndexedDB.
 *
 * Implements the OfflineStore interface with:
 * - Atomic persistence: all chapter components save together or rollback entirely
 * - 5-second timeout on persist operations
 * - Learner notification on failure
 *
 * Validates: Requirements 21.1
 */

import type {
  ChapterData,
  SyncResult,
  OfflineStore,
  PersistenceError,
} from '@chikumiku/types';

const DB_NAME = 'chikumiku-offline';
const DB_VERSION = 1;
const STORE_NAME = 'chapters';

/** Maximum time allowed for a persist operation (ms). */
const PERSIST_TIMEOUT_MS = 5000;

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
 * Open (or create) the IndexedDB database.
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'chapterId' });
        store.createIndex('academicYear', 'academicYear', { unique: false });
        store.createIndex('subjectId', 'subjectId', { unique: false });
        store.createIndex('persistedAt', 'persistedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB: ${(event.target as IDBOpenDBRequest).error?.message}`));
    };
  });
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
 * Web client implementation of OfflineStore using IndexedDB.
 * Ensures atomic persistence — all components save together or fail entirely.
 */
export const webOfflineStore: OfflineStore = {
  /**
   * Atomically persist a chapter's transcript, explanations, exercises, and progress.
   * The entire operation must complete within 5 seconds.
   * If any component fails, the entire operation fails and the learner is notified.
   */
  async persistChapter(chapter: ChapterData): Promise<void> {
    const persistOperation = async (): Promise<void> => {
      // Validate all components are present before starting
      validateChapterData(chapter);

      const db = await openDatabase();

      try {
        // Use a single transaction for atomicity — if anything fails,
        // the transaction aborts and no data is written
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);

          // Set the persistence timestamp
          const dataToStore: ChapterData = {
            ...chapter,
            persistedAt: new Date().toISOString(),
          };

          const request = store.put(dataToStore);

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => {
            reject(new Error(`Transaction failed: ${transaction.error?.message}`));
          };
          transaction.onabort = () => {
            reject(new Error(`Transaction aborted: ${transaction.error?.message}`));
          };
          request.onerror = () => {
            reject(new Error(`Put request failed: ${request.error?.message}`));
          };
        });
      } finally {
        db.close();
      }
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
    const db = await openDatabase();

    try {
      return await new Promise<ChapterData[]>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result as ChapterData[]);
        };
        request.onerror = () => {
          reject(new Error(`Failed to retrieve chapters: ${request.error?.message}`));
        };
      });
    } finally {
      db.close();
    }
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
    const db = await openDatabase();

    try {
      return await new Promise<ChapterData[]>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('academicYear');
        const request = index.getAll(year);

        request.onsuccess = () => {
          resolve(request.result as ChapterData[]);
        };
        request.onerror = () => {
          reject(new Error(`Failed to retrieve chapters for year ${year}: ${request.error?.message}`));
        };
      });
    } finally {
      db.close();
    }
  },
};
