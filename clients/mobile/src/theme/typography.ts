/**
 * Typography configuration for ChikuMiku LearnVerse Mobile
 *
 * Uses system font stack appropriate for React Native on Android.
 * Grade-based font sizes are defined in fonts.ts.
 *
 * Validates: Requirements 23.2, 22.1
 */

export const typography = {
  /**
   * System font stack for React Native.
   * On Android, 'System' resolves to Roboto.
   * On iOS, it resolves to San Francisco.
   */
  fontFamily: 'System',

  /** Base body font size for mobile */
  bodyFontSize: 14,

  /** Minimum rendered font size in dp */
  minFontSize: 12,

  /** Font weights */
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },

  /** Line height multipliers */
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  /** Heading sizes in dp */
  heading: {
    h1: 28,
    h2: 22,
    h3: 18,
    h4: 16,
  },
} as const;
