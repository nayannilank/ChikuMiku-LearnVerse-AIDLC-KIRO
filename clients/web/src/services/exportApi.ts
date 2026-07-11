/**
 * Export API — Typed service layer for report generation endpoints.
 *
 * Connects progress report export (PDF/CSV) and notification preferences
 * to the backend Export Lambda via the API client.
 *
 * Validates: Requirements 17.5, 19.1, 19.2
 */
import { apiClient } from './apiClient';
import type { ExportRequest } from '@chikumiku/types';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface ExportResponse {
  exportId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
}

export interface ExportStatusResponse {
  exportId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ParentProfile {
  username: string;
  name: string;
  phone: string;
  email: string;
  relationship: string;
}

export interface NotificationPrefs {
  progressAlerts: boolean;
  streakReminders: boolean;
}

// ─── Export API Service ──────────────────────────────────────────────────────

export const exportApi = {
  /**
   * Request a progress report export in PDF or CSV format (Req 17.5).
   */
  async requestExport(request: Omit<ExportRequest, 'parentId'>): Promise<ExportResponse> {
    const { data } = await apiClient.post<ExportResponse>(
      '/export/reports',
      request,
    );
    return data;
  },

  /**
   * Check export generation status.
   */
  async getExportStatus(exportId: string): Promise<ExportStatusResponse> {
    const { data } = await apiClient.get<ExportStatusResponse>(
      `/export/reports/${exportId}`,
    );
    return data;
  },

  /**
   * Get parent profile details (Req 17.1).
   */
  async getProfile(): Promise<ParentProfile> {
    const { data } = await apiClient.get<ParentProfile>('/profile');
    return data;
  },

  /**
   * Update parent profile (Req 17.2).
   */
  async updateProfile(updates: {
    name: string;
    phone: string;
    email: string;
    relationship: string;
  }): Promise<{ success: boolean }> {
    const { data } = await apiClient.put<{ success: boolean }>(
      '/profile',
      updates,
    );
    return data;
  },

  /**
   * Change password (Req 17.3).
   */
  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(
      '/profile/change-password',
      { currentPassword, newPassword },
    );
    return data;
  },

  /**
   * Get notification preferences (Req 17.4).
   */
  async getNotificationPrefs(): Promise<NotificationPrefs> {
    const { data } = await apiClient.get<NotificationPrefs>('/profile/notifications');
    return data;
  },

  /**
   * Update notification preferences (Req 17.4).
   */
  async updateNotificationPrefs(prefs: NotificationPrefs): Promise<{ success: boolean }> {
    const { data } = await apiClient.put<{ success: boolean }>(
      '/profile/notifications',
      prefs,
    );
    return data;
  },

  /**
   * Request account deletion (Req 17.6).
   * Requires password re-entry for verification.
   */
  async deleteAccount(password: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(
      '/profile/delete-account',
      { password },
    );
    return data;
  },
};
