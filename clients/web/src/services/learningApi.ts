/**
 * Learning API — Typed service layer for learning/progress endpoints.
 *
 * Connects dashboard, progress tracking, streak data, and activity
 * recording to the backend Learning Lambda via the API client.
 *
 * Validates: Requirements 14.1, 15.1, 19.1, 19.2
 */
import { apiClient } from './apiClient';
import type {
  StreakData,
  ProgressPercentage,
  DashboardTreeNode,
  ActivityRecord,
} from '@chikumiku/types';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface LearnerProfile {
  id: string;
  username: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  grade: string;
  school: string;
  subjects: string[];
}

export interface UpdateLearnerRequest {
  name?: string;
  grade?: string;
  school?: string;
  subjects?: string[];
}

export interface DashboardSummary {
  streak: StreakData;
  overallProgress: ProgressPercentage;
  recentActivity: ActivityRecord[];
  tree: DashboardTreeNode[];
}

export interface WeakAreaRecommendation {
  chapterId: string;
  chapterName: string;
  bookName: string;
  subjectName: string;
  weakTopics: string[];
  recommendedAction: string;
}

// ─── Learning API Service ────────────────────────────────────────────────────

export const learningApi = {
  /**
   * Get the learner dashboard data including streak, progress, tree navigation.
   */
  async getDashboard(learnerId?: string): Promise<DashboardSummary> {
    const path = learnerId
      ? `/learning/dashboard?learnerId=${learnerId}`
      : '/learning/dashboard';
    const { data } = await apiClient.get<DashboardSummary>(path);
    return data;
  },

  /**
   * Get streak data for the current learner or a specific learner.
   */
  async getStreak(learnerId?: string): Promise<StreakData> {
    const path = learnerId
      ? `/learning/streak?learnerId=${learnerId}`
      : '/learning/streak';
    const { data } = await apiClient.get<StreakData>(path);
    return data;
  },

  /**
   * Get progress for a specific chapter.
   */
  async getChapterProgress(chapterId: string): Promise<ProgressPercentage> {
    const { data } = await apiClient.get<ProgressPercentage>(
      `/learning/chapters/${chapterId}/progress`,
    );
    return data;
  },

  /**
   * Record a learning activity (read, exercise, quiz, pronunciation).
   */
  async recordActivity(activity: Omit<ActivityRecord, 'timestamp'>): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(
      '/learning/activity',
      activity,
    );
    return data;
  },

  /**
   * Get recent activity history for the current learner.
   */
  async getActivityHistory(limit?: number): Promise<ActivityRecord[]> {
    const path = limit
      ? `/learning/activity?limit=${limit}`
      : '/learning/activity';
    const { data } = await apiClient.get<ActivityRecord[]>(path);
    return data;
  },

  /**
   * Get weak area recommendations for the learner.
   */
  async getWeakAreas(learnerId?: string): Promise<WeakAreaRecommendation[]> {
    const path = learnerId
      ? `/learning/weak-areas?learnerId=${learnerId}`
      : '/learning/weak-areas';
    const { data } = await apiClient.get<WeakAreaRecommendation[]>(path);
    return data;
  },

  /**
   * Get all learner profiles under the parent account.
   */
  async getLearners(): Promise<LearnerProfile[]> {
    const { data } = await apiClient.get<LearnerProfile[]>('/learning/learners');
    return data;
  },

  /**
   * Update a learner's profile.
   */
  async updateLearner(
    learnerId: string,
    updates: UpdateLearnerRequest,
  ): Promise<{ success: boolean }> {
    const { data } = await apiClient.patch<{ success: boolean }>(
      `/learning/learners/${learnerId}`,
      updates,
    );
    return data;
  },

  /**
   * Reset a learner's password (parent action).
   */
  async resetLearnerPassword(
    learnerId: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(
      `/learning/learners/${learnerId}/reset-password`,
      { newPassword },
    );
    return data;
  },

  /**
   * Remove (soft-delete) a learner profile.
   */
  async removeLearner(learnerId: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.delete<{ success: boolean }>(
      `/learning/learners/${learnerId}`,
    );
    return data;
  },
};
