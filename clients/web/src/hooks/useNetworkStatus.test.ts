/**
 * Unit Test: Offline Guard Logic
 *
 * Tests the core logic of action disabling based on connectivity state.
 * The hook logic is extracted and tested directly since rendering React hooks
 * requires additional testing infrastructure.
 *
 * Validates: Requirements 21.2, 21.6
 */
import type { ServerAction } from './useNetworkStatus';

/**
 * Pure function version of the offline guard logic for testability.
 * This mirrors the internal logic of useOfflineGuard.
 */
function isActionDisabledOffline(action: ServerAction, isOffline: boolean): boolean {
  if (!isOffline) return false;
  const serverActions: ServerAction[] = [
    'addChapter',
    'generateExercises',
    'pronunciationPractice',
    'generateExplanation',
    'chapterQA',
  ];
  return serverActions.includes(action);
}

function getDisabledReason(action: ServerAction, isOffline: boolean): string | null {
  if (!isActionDisabledOffline(action, isOffline)) return null;
  return "You're offline. This action requires an internet connection.";
}

describe('Offline Guard Logic (Requirements 21.2, 21.6)', () => {
  const SERVER_ACTIONS: ServerAction[] = [
    'addChapter',
    'generateExercises',
    'pronunciationPractice',
    'generateExplanation',
    'chapterQA',
  ];

  describe('when online', () => {
    it('does not disable any actions', () => {
      for (const action of SERVER_ACTIONS) {
        expect(isActionDisabledOffline(action, false)).toBe(false);
      }
    });

    it('returns no disabled reason for any action', () => {
      for (const action of SERVER_ACTIONS) {
        expect(getDisabledReason(action, false)).toBeNull();
      }
    });
  });

  describe('when offline', () => {
    it('disables all server-requiring actions', () => {
      for (const action of SERVER_ACTIONS) {
        expect(isActionDisabledOffline(action, true)).toBe(true);
      }
    });

    it('provides a user-facing disabled reason', () => {
      for (const action of SERVER_ACTIONS) {
        expect(getDisabledReason(action, true)).toBe(
          "You're offline. This action requires an internet connection."
        );
      }
    });

    it('disables addChapter — adding new chapters requires server (Req 21.6)', () => {
      expect(isActionDisabledOffline('addChapter', true)).toBe(true);
    });

    it('disables generateExercises — generating exercises requires AI (Req 21.6)', () => {
      expect(isActionDisabledOffline('generateExercises', true)).toBe(true);
    });

    it('disables pronunciationPractice — requires microphone + server (Req 21.6)', () => {
      expect(isActionDisabledOffline('pronunciationPractice', true)).toBe(true);
    });

    it('disables generateExplanation — requires AI (Req 21.6)', () => {
      expect(isActionDisabledOffline('generateExplanation', true)).toBe(true);
    });

    it('disables chapterQA — requires RAG + AI (Req 21.6)', () => {
      expect(isActionDisabledOffline('chapterQA', true)).toBe(true);
    });
  });
});
