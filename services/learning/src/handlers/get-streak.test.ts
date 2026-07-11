/**
 * Unit tests for Get Streak Handler
 * GET /learn/streak/:learnerId
 *
 * Tests streak data retrieval.
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { handleGetStreak } from './get-streak';
import type { ILearnerRepository, LearnerStreakRecord } from './record-activity';

function createMockLearnerRepo(
  streakData: LearnerStreakRecord | null
): ILearnerRepository {
  return {
    getStreakData: jest.fn(async () => streakData),
    updateStreakData: jest.fn(async () => {}),
  };
}

describe('handleGetStreak', () => {
  it('returns streak data for an existing learner', async () => {
    const learnerRepository = createMockLearnerRepo({
      currentStreak: 7,
      lastActiveDate: '2024-06-15',
      longestStreak: 12,
    });

    const result = await handleGetStreak('learner-001', { learnerRepository });

    expect(result).toHaveProperty('success', true);
    const response = result as any;
    expect(response.streakData.currentStreak).toBe(7);
    expect(response.streakData.lastActiveDate).toBe('2024-06-15');
    expect(response.streakData.longestStreak).toBe(12);
  });

  it('returns 404 when learner is not found', async () => {
    const learnerRepository = createMockLearnerRepo(null);

    const result = await handleGetStreak('nonexistent', { learnerRepository });

    expect(result).toHaveProperty('statusCode', 404);
    expect(result).toHaveProperty('errorCode', 'LEARNER_NOT_FOUND');
  });

  it('returns 400 for empty learnerId', async () => {
    const learnerRepository = createMockLearnerRepo(null);

    const result = await handleGetStreak('', { learnerRepository });

    expect(result).toHaveProperty('statusCode', 400);
    expect(result).toHaveProperty('errorCode', 'VALIDATION_ERROR');
  });

  it('returns 400 for whitespace-only learnerId', async () => {
    const learnerRepository = createMockLearnerRepo(null);

    const result = await handleGetStreak('   ', { learnerRepository });

    expect(result).toHaveProperty('statusCode', 400);
  });

  it('returns empty lastActiveDate string when null in DB', async () => {
    const learnerRepository = createMockLearnerRepo({
      currentStreak: 0,
      lastActiveDate: null,
      longestStreak: 0,
    });

    const result = await handleGetStreak('learner-new', { learnerRepository });

    expect(result).toHaveProperty('success', true);
    const response = result as any;
    expect(response.streakData.currentStreak).toBe(0);
    expect(response.streakData.lastActiveDate).toBe('');
    expect(response.streakData.longestStreak).toBe(0);
  });
});
