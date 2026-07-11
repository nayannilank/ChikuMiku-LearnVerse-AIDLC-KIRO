/**
 * Unit tests for the web client offline storage module (IndexedDB).
 *
 * Tests cover:
 * - Atomic persistence success and failure/rollback
 * - 5-second timeout enforcement
 * - Failure notification to registered listeners
 * - Offline chapter retrieval
 * - Academic year filtering
 * - Sync on reconnection
 * - Conflict resolution (server-wins strategy)
 *
 * Validates: Requirements 21.1, 21.2, 21.3
 */

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ChapterData, PersistenceError } from '@chikumiku/types';
import { webOfflineStore, onPersistenceFailure } from './offlineStorage';

// Reset IndexedDB between tests
beforeEach(() => {
  // Replace global indexedDB with a fresh instance for isolation
  Object.defineProperty(globalThis, 'indexedDB', {
    value: new IDBFactory(),
    writable: true,
  });
});

/** Helper to create valid ChapterData for tests. */
function createValidChapter(overrides: Partial<ChapterData> = {}): ChapterData {
  return {
    chapterId: 'chapter-001',
    chapterName: 'Introduction to Algebra',
    bookName: 'Mathematics Part 1',
    subjectId: 'subject-math',
    academicYear: 2024,
    transcript: [
      { pageNumber: 1, classification: 'content', text: 'Page 1 text', language: 'en' },
    ],
    explanations: [
      { pageNumber: 1, summary: 'An introduction', keywords: ['algebra'], concepts: ['variables'] },
    ],
    exercises: [
      {
        id: 'ex-1',
        pageNumber: 1,
        question: 'What is x + 1 = 2?',
        correctAnswer: 'x = 1',
        type: 'short-answer',
      },
    ],
    progress: {
      readingPercentage: 50,
      exerciseScores: { 'ex-1': 80 },
      quizResults: {},
      lastAccessedAt: new Date().toISOString(),
    },
    persistedAt: '',
    ...overrides,
  };
}

describe('webOfflineStore', () => {
  describe('persistChapter — atomic persistence success', () => {
    it('saves all components (transcript, explanations, exercises, progress) when all are valid', async () => {
      const chapter = createValidChapter();

      await webOfflineStore.persistChapter(chapter);

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(1);
      expect(stored[0].chapterId).toBe('chapter-001');
      expect(stored[0].transcript).toHaveLength(1);
      expect(stored[0].explanations).toHaveLength(1);
      expect(stored[0].exercises).toHaveLength(1);
      expect(stored[0].progress.readingPercentage).toBe(50);
      // persistedAt should be set by the module
      expect(stored[0].persistedAt).toBeTruthy();
    });

    it('overwrites existing chapter data on re-persist', async () => {
      const chapter = createValidChapter();
      await webOfflineStore.persistChapter(chapter);

      const updated = createValidChapter({
        progress: {
          readingPercentage: 100,
          exerciseScores: { 'ex-1': 95 },
          quizResults: { 'quiz-1': 90 },
          lastAccessedAt: new Date().toISOString(),
        },
      });
      await webOfflineStore.persistChapter(updated);

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(1);
      expect(stored[0].progress.readingPercentage).toBe(100);
    });
  });

  describe('persistChapter — atomic persistence failure/rollback', () => {
    it('fails entirely when chapterId is missing', async () => {
      const invalid = createValidChapter({ chapterId: '' });

      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow(
        'ChapterData missing chapterId'
      );

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(0);
    });

    it('fails entirely when transcript is missing', async () => {
      const invalid = createValidChapter({ transcript: undefined as any });

      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow(
        'ChapterData missing transcript'
      );

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(0);
    });

    it('fails entirely when explanations is missing', async () => {
      const invalid = createValidChapter({ explanations: undefined as any });

      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow(
        'ChapterData missing explanations'
      );

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(0);
    });

    it('fails entirely when exercises is missing', async () => {
      const invalid = createValidChapter({ exercises: undefined as any });

      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow(
        'ChapterData missing exercises'
      );

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(0);
    });

    it('fails entirely when progress is missing', async () => {
      const invalid = createValidChapter({ progress: undefined as any });

      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow(
        'ChapterData missing progress'
      );

      const stored = await webOfflineStore.getOfflineChapters();
      expect(stored).toHaveLength(0);
    });
  });

  describe('persistChapter — 5-second timeout', () => {
    it('rejects operations exceeding 5 seconds', async () => {
      jest.useFakeTimers();

      // Mock globalThis indexedDB.open to return a request that never completes
      const mockRequest = {
        result: null,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).indexedDB = {
        open: () => mockRequest,
      };

      const chapter = createValidChapter();
      const promise = webOfflineStore.persistChapter(chapter);

      // Advance time past the 5-second timeout
      jest.advanceTimersByTime(5001);

      await expect(promise).rejects.toThrow(/timed out after 5000ms/i);

      // Restore real indexedDB for subsequent tests
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).indexedDB = new IDBFactory();

      jest.useRealTimers();
    });
  });

  describe('persistChapter — failure notification', () => {
    it('notifies registered listeners on persistence failure', async () => {
      const listener = jest.fn();
      const unsubscribe = onPersistenceFailure(listener);

      const invalid = createValidChapter({ chapterId: '' });

      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow();

      expect(listener).toHaveBeenCalledTimes(1);
      const error: PersistenceError = listener.mock.calls[0][0];
      expect(error.operation).toBe('persist');
      expect(error.chapterId).toBe('');
      expect(error.message).toContain('missing chapterId');
      expect(error.timestamp).toBeTruthy();

      unsubscribe();
    });

    it('does not notify after listener is unsubscribed', async () => {
      const listener = jest.fn();
      const unsubscribe = onPersistenceFailure(listener);
      unsubscribe();

      const invalid = createValidChapter({ chapterId: '' });
      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow();

      expect(listener).not.toHaveBeenCalled();
    });

    it('notifies multiple listeners on failure', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const unsub1 = onPersistenceFailure(listener1);
      const unsub2 = onPersistenceFailure(listener2);

      const invalid = createValidChapter({ exercises: undefined as any });
      await expect(webOfflineStore.persistChapter(invalid)).rejects.toThrow();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });
  });

  describe('getOfflineChapters — offline chapter retrieval', () => {
    it('returns empty array when no chapters are persisted', async () => {
      const chapters = await webOfflineStore.getOfflineChapters();
      expect(chapters).toEqual([]);
    });

    it('returns all persisted chapters', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-1' }));
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-2' }));
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-3' }));

      const chapters = await webOfflineStore.getOfflineChapters();
      expect(chapters).toHaveLength(3);
      const ids = chapters.map((c) => c.chapterId);
      expect(ids).toContain('ch-1');
      expect(ids).toContain('ch-2');
      expect(ids).toContain('ch-3');
    });

    it('returns complete chapter data with all components', async () => {
      await webOfflineStore.persistChapter(createValidChapter());

      const [chapter] = await webOfflineStore.getOfflineChapters();
      expect(chapter.transcript).toHaveLength(1);
      expect(chapter.explanations).toHaveLength(1);
      expect(chapter.exercises).toHaveLength(1);
      expect(chapter.progress).toBeDefined();
      expect(chapter.chapterName).toBe('Introduction to Algebra');
      expect(chapter.bookName).toBe('Mathematics Part 1');
    });
  });

  describe('getAcademicYearContent — academic year filtering', () => {
    it('returns only chapters matching the requested academic year', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-2024-a', academicYear: 2024 }));
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-2024-b', academicYear: 2024 }));
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-2023', academicYear: 2023 }));

      const result = await webOfflineStore.getAcademicYearContent(2024);
      expect(result).toHaveLength(2);
      expect(result.every((c) => c.academicYear === 2024)).toBe(true);
    });

    it('returns empty array when no chapters match the year', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-1', academicYear: 2024 }));

      const result = await webOfflineStore.getAcademicYearContent(2025);
      expect(result).toHaveLength(0);
    });
  });

  describe('syncProgress — sync on reconnection', () => {
    afterEach(() => {
      (global.fetch as any) = undefined;
    });

    it('sends progress to server and returns success when all sync', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-1' }));
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-2' }));

      // Verify chapters are persisted before sync
      const persisted = await webOfflineStore.getOfflineChapters();
      expect(persisted).toHaveLength(2);

      // Create a manual implementation to debug what's happening
      const fetchImpl = jest.fn(async (_url: string, _opts?: any) => {
        return { ok: true, status: 200, json: async () => ({}) };
      });
      global.fetch = fetchImpl as any;

      const result = await webOfflineStore.syncProgress('https://api.example.com');

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.syncedChapterIds).toContain('ch-1');
      expect(result.syncedChapterIds).toContain('ch-2');
      expect(result.failedChapterIds).toHaveLength(0);
      expect(result.timestamp).toBeTruthy();
    });

    it('returns failure when server rejects sync', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-1' }));

      global.fetch = jest.fn(async () => ({ ok: false, status: 500 })) as any;

      const result = await webOfflineStore.syncProgress('https://api.example.com');

      expect(result.success).toBe(false);
      expect(result.syncedChapterIds).toHaveLength(0);
      expect(result.failedChapterIds).toContain('ch-1');
    });

    it('returns failure when network error occurs', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-1' }));

      global.fetch = jest.fn(async () => { throw new Error('Network error'); }) as any;

      const result = await webOfflineStore.syncProgress('https://api.example.com');

      expect(result.success).toBe(false);
      expect(result.failedChapterIds).toContain('ch-1');
    });

    it('sends correct payload to server endpoint', async () => {
      const chapter = createValidChapter({ chapterId: 'ch-1' });
      await webOfflineStore.persistChapter(chapter);

      const mockFetch = jest.fn(async () => ({ ok: true, json: async () => ({}) }));
      global.fetch = mockFetch as any;

      await webOfflineStore.syncProgress('https://api.example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/learn/progress/sync',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const body = JSON.parse((mockFetch.mock.calls[0] as any[])[1].body);
      expect(body.chapterId).toBe('ch-1');
      expect(body.progress).toBeDefined();
      expect(body.progress.readingPercentage).toBe(50);
    });

    it('returns partial success when some chapters sync and others fail', async () => {
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-success' }));
      await webOfflineStore.persistChapter(createValidChapter({ chapterId: 'ch-fail' }));

      global.fetch = (async (_input: any, init?: any) => {
        const bodyStr = init?.body as string;
        const parsed = JSON.parse(bodyStr);
        if (parsed.chapterId === 'ch-success') {
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return { ok: false, status: 500 };
      }) as any;

      const result = await webOfflineStore.syncProgress('https://api.example.com');

      expect(result.success).toBe(false);
      expect(result.syncedChapterIds).toContain('ch-success');
      expect(result.failedChapterIds).toContain('ch-fail');
    });
  });

  describe('conflict resolution — server-wins strategy', () => {
    afterEach(() => {
      (global.fetch as any) = undefined;
    });

    it('overwrites local progress when server has newer data', async () => {
      // Persist a chapter locally with old progress
      const localChapter = createValidChapter({
        chapterId: 'ch-conflict',
        progress: {
          readingPercentage: 30,
          exerciseScores: { 'ex-1': 60 },
          quizResults: {},
          lastAccessedAt: '2024-01-01T00:00:00.000Z',
        },
      });
      await webOfflineStore.persistChapter(localChapter);

      // Server responds with newer progress data during sync (server-wins)
      const serverProgress = {
        readingPercentage: 80,
        exerciseScores: { 'ex-1': 95 },
        quizResults: { 'quiz-1': 100 },
        lastAccessedAt: '2024-06-01T00:00:00.000Z',
      };

      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
          conflict: true,
          serverProgress,
        }),
      })) as any;

      // syncProgress should detect the conflict and apply server data locally
      const result = await webOfflineStore.syncProgress('https://api.example.com');
      expect(result.success).toBe(true);
      expect(result.syncedChapterIds).toContain('ch-conflict');
      expect(result.conflictsResolved).toBe(1);

      // Verify the local data has been overwritten with server progress
      const [stored] = await webOfflineStore.getOfflineChapters();
      expect(stored.progress.readingPercentage).toBe(80);
      expect(stored.progress.exerciseScores['ex-1']).toBe(95);
      expect(stored.progress.lastAccessedAt).toBe('2024-06-01T00:00:00.000Z');
    });

    it('local data remains when server sync succeeds with no conflict', async () => {
      const chapter = createValidChapter({
        chapterId: 'ch-no-conflict',
        progress: {
          readingPercentage: 70,
          exerciseScores: {},
          quizResults: {},
          lastAccessedAt: '2024-06-01T00:00:00.000Z',
        },
      });
      await webOfflineStore.persistChapter(chapter);

      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ conflict: false }),
      })) as any;

      const result = await webOfflineStore.syncProgress('https://api.example.com');
      expect(result.success).toBe(true);

      // Local data should remain unchanged
      const [stored] = await webOfflineStore.getOfflineChapters();
      expect(stored.progress.readingPercentage).toBe(70);
    });
  });
});
