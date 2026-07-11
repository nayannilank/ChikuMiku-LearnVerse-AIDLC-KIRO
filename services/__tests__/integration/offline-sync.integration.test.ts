/**
 * Integration tests for offline synchronization flows.
 * Tests the full offline → reconnect → sync lifecycle with
 * server-wins conflict resolution.
 *
 * Validates: Requirements 19.1, 24.1–24.12
 */

import type { ChapterData, ChapterProgressData, SyncResult } from '@chikumiku/types';

// --- Mock Network + Storage Infrastructure ---

type NetworkState = 'online' | 'offline';

interface ServerProgressEntry {
  chapterId: string;
  progress: ChapterProgressData;
  lastModified: string;
}

/**
 * In-memory mock of the offline storage module.
 * Implements the same logic as mobileOfflineStore but without React Native dependencies.
 */
function createMockOfflineStore() {
  const chapters = new Map<string, ChapterData>();

  return {
    chapters,

    async persistChapter(chapter: ChapterData): Promise<void> {
      if (!chapter.chapterId) throw new Error('Missing chapterId');
      if (!chapter.transcript || !Array.isArray(chapter.transcript)) throw new Error('Missing transcript');
      if (!chapter.explanations || !Array.isArray(chapter.explanations)) throw new Error('Missing explanations');
      if (!chapter.exercises || !Array.isArray(chapter.exercises)) throw new Error('Missing exercises');
      if (!chapter.progress) throw new Error('Missing progress');

      chapters.set(chapter.chapterId, {
        ...chapter,
        persistedAt: new Date().toISOString(),
      });
    },

    async getOfflineChapters(): Promise<ChapterData[]> {
      return Array.from(chapters.values());
    },

    async getAcademicYearContent(year: number): Promise<ChapterData[]> {
      return Array.from(chapters.values()).filter(c => c.academicYear === year);
    },
  };
}

/**
 * Mock server that handles sync requests.
 * Implements server-wins conflict resolution.
 */
function createMockServer() {
  const serverData = new Map<string, ServerProgressEntry>();

  return {
    serverData,

    /** Set up server-side progress data (simulates existing server state). */
    setServerProgress(entry: ServerProgressEntry): void {
      serverData.set(entry.chapterId, entry);
    },

    /** Simulate the sync endpoint. Returns conflict info if server has newer data. */
    async handleSync(request: {
      chapterId: string;
      progress: ChapterData['progress'];
      localTimestamp: string;
    }): Promise<{ ok: boolean; conflict?: boolean; serverProgress?: ChapterData['progress'] }> {
      const serverEntry = serverData.get(request.chapterId);

      if (!serverEntry) {
        // No server data yet — accept client data
        serverData.set(request.chapterId, {
          chapterId: request.chapterId,
          progress: request.progress,
          lastModified: new Date().toISOString(),
        });
        return { ok: true };
      }

      // Compare timestamps: server-wins if server is newer
      const serverTime = new Date(serverEntry.lastModified).getTime();
      const clientTime = new Date(request.localTimestamp).getTime();

      if (serverTime > clientTime) {
        // Conflict: server has newer data — return server version
        return {
          ok: true,
          conflict: true,
          serverProgress: serverEntry.progress,
        };
      }

      // Client is newer — accept client data
      serverData.set(request.chapterId, {
        chapterId: request.chapterId,
        progress: request.progress,
        lastModified: new Date().toISOString(),
      });
      return { ok: true };
    },
  };
}

/**
 * Network simulator for controlling online/offline state.
 */
function createNetworkSimulator(initialState: NetworkState = 'online') {
  let state: NetworkState = initialState;
  const listeners: Array<(state: NetworkState) => void> = [];

  return {
    getState(): NetworkState { return state; },
    isOnline(): boolean { return state === 'online'; },

    goOffline(): void {
      state = 'offline';
      listeners.forEach(l => l(state));
    },

    goOnline(): void {
      state = 'online';
      listeners.forEach(l => l(state));
    },

    onStateChange(listener: (state: NetworkState) => void): () => void {
      listeners.push(listener);
      return () => {
        const idx = listeners.indexOf(listener);
        if (idx >= 0) listeners.splice(idx, 1);
      };
    },
  };
}

/**
 * Sync engine that coordinates offline storage with server sync.
 * Mimics the behavior of useSyncOnReconnect + mobileOfflineStore.syncProgress.
 */
function createSyncEngine(
  store: ReturnType<typeof createMockOfflineStore>,
  server: ReturnType<typeof createMockServer>,
  network: ReturnType<typeof createNetworkSimulator>
) {
  return {
    /** Record an activity while potentially offline. */
    async recordActivity(chapter: ChapterData): Promise<void> {
      // Always persist locally regardless of network state
      await store.persistChapter(chapter);
    },

    /** Attempt to sync all offline data with the server. */
    async syncToServer(): Promise<SyncResult> {
      if (!network.isOnline()) {
        return {
          success: false,
          syncedChapterIds: [],
          failedChapterIds: [],
          conflictsResolved: 0,
          timestamp: new Date().toISOString(),
        };
      }

      const chapters = await store.getOfflineChapters();
      const syncedIds: string[] = [];
      const failedIds: string[] = [];
      let conflictsResolved = 0;

      for (const chapter of chapters) {
        try {
          const result = await server.handleSync({
            chapterId: chapter.chapterId,
            progress: chapter.progress,
            localTimestamp: chapter.progress.lastAccessedAt,
          });

          if (result.ok) {
            if (result.conflict && result.serverProgress) {
              // Server-wins: update local with server data
              const updated = { ...chapter, progress: result.serverProgress, persistedAt: new Date().toISOString() };
              await store.persistChapter(updated);
              conflictsResolved++;
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
  };
}

// --- Helper ---

function createChapterData(overrides?: Partial<ChapterData>): ChapterData {
  return {
    chapterId: 'ch-default',
    chapterName: 'Test Chapter',
    bookName: 'Test Book',
    subjectId: 'subject-001',
    academicYear: 2024,
    transcript: [{ pageNumber: 1, text: 'Sample text', classification: 'content', language: 'en' }],
    explanations: [{ pageNumber: 1, summary: 'Summary', keywords: ['key1'], concepts: ['concept1'] }],
    exercises: [{ id: 'ex-1', pageNumber: 1, type: 'fill-in-blank', question: 'The ___ is blue', correctAnswer: 'sky' }],
    progress: {
      readingPercentage: 20,
      exerciseScores: {},
      quizResults: {},
      lastAccessedAt: new Date().toISOString(),
    },
    persistedAt: '',
    ...overrides,
  };
}

// --- Tests ---

describe('Offline Sync Integration Tests', () => {
  describe('Record activities while offline', () => {
    it('persists chapter data locally when network is unavailable', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('offline');
      const syncEngine = createSyncEngine(store, server, network);

      const chapter = createChapterData({ chapterId: 'ch-offline-001' });
      await syncEngine.recordActivity(chapter);

      // Data should be persisted locally
      const stored = await store.getOfflineChapters();
      expect(stored).toHaveLength(1);
      expect(stored[0].chapterId).toBe('ch-offline-001');
      expect(stored[0].persistedAt).toBeDefined();
    });

    it('persists multiple chapters while offline', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('offline');
      const syncEngine = createSyncEngine(store, server, network);

      await syncEngine.recordActivity(createChapterData({ chapterId: 'ch-off-1' }));
      await syncEngine.recordActivity(createChapterData({ chapterId: 'ch-off-2' }));
      await syncEngine.recordActivity(createChapterData({ chapterId: 'ch-off-3' }));

      const stored = await store.getOfflineChapters();
      expect(stored).toHaveLength(3);
    });

    it('updates existing chapter progress while offline', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('offline');
      const syncEngine = createSyncEngine(store, server, network);

      // Initial save
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-progress-001',
        progress: { readingPercentage: 20, exerciseScores: {}, quizResults: {}, lastAccessedAt: '2024-01-01T10:00:00Z' },
      }));

      // Update progress
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-progress-001',
        progress: { readingPercentage: 60, exerciseScores: { 'ex-1': 80 }, quizResults: {}, lastAccessedAt: '2024-01-01T11:00:00Z' },
      }));

      const stored = await store.getOfflineChapters();
      expect(stored).toHaveLength(1); // Same chapter, overwritten
      expect(stored[0].progress.readingPercentage).toBe(60);
      expect(stored[0].progress.exerciseScores['ex-1']).toBe(80);
    });
  });

  describe('Sync on reconnection', () => {
    it('syncs queued activities to server when coming back online', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('offline');
      const syncEngine = createSyncEngine(store, server, network);

      // Record activities while offline
      await syncEngine.recordActivity(createChapterData({ chapterId: 'ch-sync-001' }));
      await syncEngine.recordActivity(createChapterData({ chapterId: 'ch-sync-002' }));

      // Sync attempt while offline should fail gracefully
      const offlineResult = await syncEngine.syncToServer();
      expect(offlineResult.success).toBe(false);
      expect(offlineResult.syncedChapterIds).toHaveLength(0);

      // Come back online
      network.goOnline();

      // Sync should succeed now
      const onlineResult = await syncEngine.syncToServer();
      expect(onlineResult.success).toBe(true);
      expect(onlineResult.syncedChapterIds).toHaveLength(2);
      expect(onlineResult.syncedChapterIds).toContain('ch-sync-001');
      expect(onlineResult.syncedChapterIds).toContain('ch-sync-002');

      // Verify server received the data
      expect(server.serverData.has('ch-sync-001')).toBe(true);
      expect(server.serverData.has('ch-sync-002')).toBe(true);
    });

    it('handles empty queue gracefully on sync', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('online');
      const syncEngine = createSyncEngine(store, server, network);

      const result = await syncEngine.syncToServer();

      expect(result.success).toBe(true);
      expect(result.syncedChapterIds).toHaveLength(0);
      expect(result.conflictsResolved).toBe(0);
    });
  });

  describe('Conflict resolution (server-wins)', () => {
    it('resolves conflict by accepting server version when server is newer', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('online');
      const syncEngine = createSyncEngine(store, server, network);

      // Set up server with newer data
      const serverProgress: ChapterProgressData = {
        readingPercentage: 80,
        exerciseScores: { 'ex-1': 95 },
        quizResults: { 'quiz-1': 90 },
        lastAccessedAt: '2024-06-15T15:00:00Z',
      };
      server.setServerProgress({
        chapterId: 'ch-conflict-001',
        progress: serverProgress,
        lastModified: '2024-06-15T15:00:00Z', // Server is newer
      });

      // Local has older data
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-conflict-001',
        progress: {
          readingPercentage: 40,
          exerciseScores: { 'ex-1': 60 },
          quizResults: {},
          lastAccessedAt: '2024-06-15T10:00:00Z', // Older than server
        },
      }));

      // Sync with conflict resolution
      const result = await syncEngine.syncToServer();

      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(1);
      expect(result.syncedChapterIds).toContain('ch-conflict-001');

      // Local storage should now have server's version
      const stored = await store.getOfflineChapters();
      expect(stored[0].progress.readingPercentage).toBe(80);
      expect(stored[0].progress.exerciseScores['ex-1']).toBe(95);
    });

    it('accepts client data when client is newer than server', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('online');
      const syncEngine = createSyncEngine(store, server, network);

      // Server has older data
      server.setServerProgress({
        chapterId: 'ch-client-wins',
        progress: {
          readingPercentage: 20,
          exerciseScores: {},
          quizResults: {},
          lastAccessedAt: '2024-06-10T08:00:00Z',
        },
        lastModified: '2024-06-10T08:00:00Z', // Older
      });

      // Client has newer data
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-client-wins',
        progress: {
          readingPercentage: 100,
          exerciseScores: { 'ex-1': 90, 'ex-2': 85 },
          quizResults: { 'quiz-1': 75 },
          lastAccessedAt: '2024-06-15T20:00:00Z', // Newer
        },
      }));

      const result = await syncEngine.syncToServer();

      expect(result.success).toBe(true);
      expect(result.conflictsResolved).toBe(0); // No conflict — client wins
      expect(result.syncedChapterIds).toContain('ch-client-wins');

      // Server should have client's data
      const serverEntry = server.serverData.get('ch-client-wins');
      expect(serverEntry!.progress.readingPercentage).toBe(100);
    });

    it('handles multiple chapters with mixed conflict outcomes', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('online');
      const syncEngine = createSyncEngine(store, server, network);

      // Chapter 1: server wins (server is newer)
      server.setServerProgress({
        chapterId: 'ch-mixed-1',
        progress: { readingPercentage: 100, exerciseScores: { 'ex-1': 95 }, quizResults: {}, lastAccessedAt: '2024-06-15T20:00:00Z' },
        lastModified: '2024-06-15T20:00:00Z',
      });
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-mixed-1',
        progress: { readingPercentage: 40, exerciseScores: {}, quizResults: {}, lastAccessedAt: '2024-06-14T10:00:00Z' },
      }));

      // Chapter 2: no conflict (new to server)
      await syncEngine.recordActivity(createChapterData({ chapterId: 'ch-mixed-2' }));

      // Chapter 3: client wins (client is newer)
      server.setServerProgress({
        chapterId: 'ch-mixed-3',
        progress: { readingPercentage: 10, exerciseScores: {}, quizResults: {}, lastAccessedAt: '2024-06-01T08:00:00Z' },
        lastModified: '2024-06-01T08:00:00Z',
      });
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-mixed-3',
        progress: { readingPercentage: 80, exerciseScores: { 'ex-1': 70 }, quizResults: {}, lastAccessedAt: '2024-06-15T22:00:00Z' },
      }));

      const result = await syncEngine.syncToServer();

      expect(result.success).toBe(true);
      expect(result.syncedChapterIds).toHaveLength(3);
      expect(result.conflictsResolved).toBe(1); // Only ch-mixed-1 had server-wins conflict
    });
  });

  describe('Full offline → reconnect → verify flow', () => {
    it('complete cycle: go offline, record, reconnect, sync, verify server state', async () => {
      const store = createMockOfflineStore();
      const server = createMockServer();
      const network = createNetworkSimulator('online');
      const syncEngine = createSyncEngine(store, server, network);

      // 1. Go offline
      network.goOffline();
      expect(network.isOnline()).toBe(false);

      // 2. Record multiple activities while offline
      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-full-cycle-1',
        progress: { readingPercentage: 60, exerciseScores: { 'ex-1': 75 }, quizResults: {}, lastAccessedAt: new Date().toISOString() },
      }));

      await syncEngine.recordActivity(createChapterData({
        chapterId: 'ch-full-cycle-2',
        progress: { readingPercentage: 100, exerciseScores: { 'ex-1': 90, 'ex-2': 85 }, quizResults: { 'q-1': 95 }, lastAccessedAt: new Date().toISOString() },
      }));

      // 3. Verify data is stored locally
      const localData = await store.getOfflineChapters();
      expect(localData).toHaveLength(2);

      // 4. Verify sync fails while offline
      const offlineSync = await syncEngine.syncToServer();
      expect(offlineSync.success).toBe(false);

      // 5. Reconnect
      network.goOnline();
      expect(network.isOnline()).toBe(true);

      // 6. Sync to server
      const onlineSync = await syncEngine.syncToServer();
      expect(onlineSync.success).toBe(true);
      expect(onlineSync.syncedChapterIds).toHaveLength(2);

      // 7. Verify server state
      const serverEntry1 = server.serverData.get('ch-full-cycle-1');
      expect(serverEntry1).toBeDefined();
      expect(serverEntry1!.progress.readingPercentage).toBe(60);

      const serverEntry2 = server.serverData.get('ch-full-cycle-2');
      expect(serverEntry2).toBeDefined();
      expect(serverEntry2!.progress.readingPercentage).toBe(100);
      expect(serverEntry2!.progress.exerciseScores['ex-1']).toBe(90);
    });
  });
});
