/**
 * Dashboard API — Service layer for dashboard-specific endpoints.
 *
 * Provides aggregated dashboard data for parent and learner views.
 */
import { apiClient } from './apiClient';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardChapter {
  id: string;
  name: string;
  progress: number;
  exerciseProgress: number;
  pagesRead?: number;
  pagesTotal?: number;
}

export interface DashboardBook {
  id: string;
  name: string;
  chapters: DashboardChapter[];
}

export interface DashboardSubject {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  books: DashboardBook[];
  quizzes: { completed: number; total: number };
}

export interface DashboardLearner {
  id: string;
  name: string;
  grade: string;
  subjects: DashboardSubject[];
}

export interface ParentDashboardResponse {
  learners: DashboardLearner[];
}

export interface LearnerDashboardResponse {
  learnerName: string;
  streak: number;
  subjects: DashboardSubject[];
}

// ─── Dashboard API Service ───────────────────────────────────────────────────

export const dashboardApi = {
  /**
   * Get aggregated dashboard data for a parent.
   */
  async getParentDashboard(): Promise<ParentDashboardResponse> {
    const { data } = await apiClient.get<ParentDashboardResponse>(
      '/learn/dashboard/parent',
    );
    return data;
  },

  /**
   * Get aggregated dashboard data for a learner.
   */
  async getLearnerDashboard(): Promise<LearnerDashboardResponse> {
    const { data } = await apiClient.get<LearnerDashboardResponse>(
      '/learn/dashboard/learner',
    );
    return data;
  },
};
