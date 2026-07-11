/**
 * Export and notification type definitions.
 */

/** Request to generate a progress report export. */
export interface ExportRequest {
  parentId: string;
  format: 'pdf' | 'csv';
  /** All learners if omitted */
  learnerIds?: string[];
}

/** Notification payload for streak alerts and progress updates. */
export interface NotificationPayload {
  type: 'streak_alert' | 'progress_update' | 'streak_reminder';
  recipientId: string;
  channel: 'push' | 'email';
  data: Record<string, unknown>;
}
