/**
 * Layout constants for ChikuMiku LearnVerse Mobile
 *
 * Validates: Requirements 22.4, 23.4, 23.5
 */

export const layout = {
  /** Minimum touch target size in dp (48×48) — Requirement 22.4 */
  touchTargetMin: 48,

  /** Minimum mobile viewport width in dp */
  mobileMinWidth: 360,

  /** Minimum mobile viewport height in dp */
  mobileMinHeight: 720,
} as const;

export const watermark = {
  /** Logo watermark width as percentage of screen width */
  widthPercent: 75,
  /** Opacity for background watermark (~8%) */
  opacity: 0.08,
} as const;
