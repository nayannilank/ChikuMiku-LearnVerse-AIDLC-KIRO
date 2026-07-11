/**
 * Unit tests for Record Activity Handler
 * POST /learn/activity
 *
 * Tests activity recording and streak management logic.
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { handleRecordActivity, validateActivityRecord } from './record-activity';
import type { IActivityRepository, ILearnerRepository, LearnerStreakRecord } from './record-activity';
import type { ActivityRecord } from '@chikumiku/types';

/** Helper to build a valid activity body. */
function buildActivity(overrides?: Partial<ActivityRecord>): ActivityRecord {
  return {
    learnerId: 'learner-001',
    activityType: 'read',
    chapterId: 'chapter-001',
    timestamp: '2024-06-15T10:30:00Z',
    localDate: '2024-06-15',
    ...overrides,
  };
}

/** Creates mock repositories with configurable behavior. */
function createMockDeps(options?: {
  streakData?: LearnerStreakRecord | null;
  activityDates?: string[];
}) {
  const savedActivities: ActivityRecord[] = [];
  const updatedStreaks: { learnerId: string; data: LearnerStreakRecord }[] = [];
  const activityDates = options?.activityDates ?? [];

  const activityRepository: IActivityRepository = {
    saveActivity: jest.fn(async (activity) => {
      savedActivities.push(activity);
    }),
    getActivityDates: jest.fn(async () => activityDates),
  };

  const learnerRepository: ILearnerRepository = {
    getStreakData: jest.fn(async () => options?.streakData ?? null),
    updateStreakData: jest.fn(async (learnerId, data) => {
      updatedStreaks.push({ learnerId, data });
    }),
  };

  return {
    deps: { activityRepository, learnerRepository },
    savedActivities,
    updatedStreaks,
  };
}

describe('validateActivityRecord', () => {
  it('returns null for a valid activity body', () => {
    expect(validateActivityRecord(buildActivity())).toBeNull();
  });

  it('rejects null body', () => {
    const result = validateActivityRecord(null);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('rejects empty object', () => {
    const result = validateActivityRecord({});
    expect(result).not.toBeNull();
    expect(result!.details).toBeDefined();
    expect(Object.keys(result!.details!)).toHaveLength(5);
  });

  it('rejects invalid activityType', () => {
    const result = validateActivityRecord(buildActivity({ activityType: 'invalid' as any }));
    expect(result).not.toBeNull();
    expect(result!.details!.activityType).toBeDefined();
  });

  it('rejects invalid localDate format', () => {
    const result = validateActivityRecord(buildActivity({ localDate: '15-06-2024' }));
    expect(result).not.toBeNull();
    expect(result!.details!.localDate).toBeDefined();
  });

  it('accepts all valid activity types', () => {
    for (const type of ['read', 'exercise', 'quiz', 'pronunciation'] as const) {
      expect(validateActivityRecord(buildActivity({ activityType: type }))).toBeNull();
    }
  });
});

describe('handleRecordActivity', () => {
  it('returns 400 for invalid body', async () => {
    const { deps } = createMockDeps();
    const result = await handleRecordActivity({}, deps);
    expect(result).toHaveProperty('statusCode', 400);
  });

  it('returns 404 when learner not found', async () => {
    const { deps } = createMockDeps({ streakData: null });
    const result = await handleRecordActivity(buildActivity(), deps);
    expect(result).toHaveProperty('statusCode', 404);
    expect(result).toHaveProperty('errorCode', 'LEARNER_NOT_FOUND');
  });

  it('records activity and starts a streak on first ever activity', async () => {
    const { deps, savedActivities, updatedStreaks } = createMockDeps({
      streakData: { currentStreak: 0, lastActiveDate: null, longestStreak: 0 },
      activityDates: [], // no previous activity dates
    });

    const activity = buildActivity({ localDate: '2024-06-15' });
    const result = await handleRecordActivity(activity, deps);

    expect(result).toHaveProperty('success', true);
    expect(savedActivities).toHaveLength(1);
    expect(savedActivities[0]).toEqual(activity);

    const streakResult = (result as any).streakData;
    expect(streakResult.currentStreak).toBe(1);
    expect(streakResult.lastActiveDate).toBe('2024-06-15');
    expect(streakResult.longestStreak).toBe(1);

    expect(updatedStreaks[0].data.currentStreak).toBe(1);
  });

  it('increments streak on first activity of a new consecutive day', async () => {
    const { deps, updatedStreaks } = createMockDeps({
      streakData: { currentStreak: 3, lastActiveDate: '2024-06-14', longestStreak: 5 },
      activityDates: ['2024-06-12', '2024-06-13', '2024-06-14'],
    });

    const activity = buildActivity({ localDate: '2024-06-15' });
    const result = await handleRecordActivity(activity, deps);

    expect(result).toHaveProperty('success', true);
    const streakResult = (result as any).streakData;
    expect(streakResult.currentStreak).toBe(4);
    expect(streakResult.lastActiveDate).toBe('2024-06-15');
    expect(streakResult.longestStreak).toBe(5); // still 5 (4 < 5)
  });

  it('updates longest streak when current exceeds it', async () => {
    const { deps, updatedStreaks } = createMockDeps({
      streakData: { currentStreak: 5, lastActiveDate: '2024-06-14', longestStreak: 5 },
      activityDates: ['2024-06-10', '2024-06-11', '2024-06-12', '2024-06-13', '2024-06-14'],
    });

    const activity = buildActivity({ localDate: '2024-06-15' });
    const result = await handleRecordActivity(activity, deps);

    expect(result).toHaveProperty('success', true);
    const streakResult = (result as any).streakData;
    expect(streakResult.currentStreak).toBe(6);
    expect(streakResult.longestStreak).toBe(6);
  });

  it('does not increment on duplicate same-day activity', async () => {
    const { deps } = createMockDeps({
      streakData: { currentStreak: 3, lastActiveDate: '2024-06-15', longestStreak: 5 },
      activityDates: ['2024-06-13', '2024-06-14', '2024-06-15'],
    });

    // Same localDate as lastActiveDate
    const activity = buildActivity({ localDate: '2024-06-15' });
    const result = await handleRecordActivity(activity, deps);

    expect(result).toHaveProperty('success', true);
    const streakResult = (result as any).streakData;
    expect(streakResult.currentStreak).toBe(3); // no change
  });

  it('increments streak after a single gap day (grace period)', async () => {
    const { deps } = createMockDeps({
      streakData: { currentStreak: 2, lastActiveDate: '2024-06-13', longestStreak: 4 },
      activityDates: ['2024-06-12', '2024-06-13'], // skipped 2024-06-14
    });

    // Activity on 2024-06-15 after missing 2024-06-14 (grace day)
    const activity = buildActivity({ localDate: '2024-06-15' });
    const result = await handleRecordActivity(activity, deps);

    expect(result).toHaveProperty('success', true);
    const streakResult = (result as any).streakData;
    expect(streakResult.currentStreak).toBe(3); // grace: streak continues
  });

  it('resets streak after missing 2+ consecutive days', async () => {
    const { deps } = createMockDeps({
      streakData: { currentStreak: 5, lastActiveDate: '2024-06-12', longestStreak: 5 },
      activityDates: ['2024-06-10', '2024-06-11', '2024-06-12'], // gap: 13, 14 missed
    });

    // Activity on 2024-06-16 (gap >= 3 from last active)
    const activity = buildActivity({ localDate: '2024-06-16' });
    const result = await handleRecordActivity(activity, deps);

    expect(result).toHaveProperty('success', true);
    const streakResult = (result as any).streakData;
    // shouldReset triggers (gap=4), resets to 0, then shouldIncrement for fresh start
    // Since activityDates doesn't include 2024-06-16, shouldIncrement checks the dates array
    // after reset. The streak goes to 0 first, then since it's a "new" activity day
    // with no recent context, we rely on shouldIncrement. Let's check what actually happens.
    expect(streakResult.currentStreak).toBe(1); // reset to 0, then +1 for new day
    expect(streakResult.longestStreak).toBe(5); // preserved
  });
});
