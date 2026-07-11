/**
 * Design System Tokens for ChikuMiku LearnVerse
 *
 * Defines all design primitives: colors, typography, spacing, radii, breakpoints.
 * Validates: Requirements 22.1, 22.2, 22.3, 22.4, 23.1, 23.2, 23.3, 23.4, 23.5, 23.6
 */

// --- Color Palette (Requirement 23.1) ---

export const colors = {
  primary: '#E94F9B',       // Primary Pink
  secondary: '#9B59B6',     // Secondary Purple
  accent: '#5DADE2',        // Accent Blue
  warning: '#F7C948',       // Warning Gold
  success: '#27AE60',       // Success Green
  error: '#E74C3C',         // Error Red
  dark: '#2C2341',          // Dark
  background: '#F8F5FF',    // Page Background
  border: '#E0D8EC',        // Border

  // Subject-specific colors
  hindiGold: '#E5A100',
  computersIndigo: '#4A6CF7',
  evsOrange: '#E67E22',
  customSubjectTeal: '#1ABC9C',

  // Utility colors
  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#2C2341',
  textSecondary: '#5A4E6F',
  textMuted: '#8B7FA8',
} as const;

// --- High Contrast Color Overrides (Requirement 22.2 — 7:1 contrast ratio) ---

export const highContrastColors = {
  primary: '#C42077',
  secondary: '#7B2D96',
  accent: '#1B7AB3',
  warning: '#B8900A',
  success: '#1A7A3E',
  error: '#C0392B',
  dark: '#1A0F2E',
  background: '#FFFFFF',
  border: '#4A3D5C',

  hindiGold: '#8B6508',
  computersIndigo: '#2B3D8F',
  evsOrange: '#A85C18',
  customSubjectTeal: '#0E7C64',

  white: '#FFFFFF',
  black: '#000000',
  textPrimary: '#000000',
  textSecondary: '#1A0F2E',
  textMuted: '#3D3352',
} as const;

// --- Typography (Requirements 23.2, 22.1) ---

export const typography = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

  // Base body font sizes (Requirement 23.2)
  bodyFontSize: {
    mobile: '14px',
    web: '16px',
  },

  // Minimum rendered font size
  minFontSize: '12px',

  // Grade-based font sizes (Requirement 22.1)
  gradeFontSize: {
    // LKG to 2nd Grade
    early: { mobile: '18px', web: '20px' },
    // 3rd to 5th Grade
    middle: { mobile: '16px', web: '18px' },
    // 6th to 12th Grade
    senior: { mobile: '14px', web: '16px' },
  },

  // Font weights
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  // Line heights
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

// --- Border Radius (Requirement 23.3) ---

export const radii = {
  button: '22px',       // Pill-shaped buttons (20-22px)
  card: '16px',         // Primary content cards
  badge: '10px',        // Tags, badges, inline info boxes
  input: '8px',         // Form inputs
  small: '4px',         // Small elements
} as const;

// --- Spacing ---

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

// --- Breakpoints (Requirement 23.4) ---

export const breakpoints = {
  mobileMin: '360px',     // Minimum mobile viewport width
  tablet: '768px',        // Tablet breakpoint
  webMaxContent: '960px', // Web content max-width
} as const;

// --- Layout (Requirement 23.4) ---

export const layout = {
  mobileMinWidth: 360,
  mobileMinHeight: 720,
  webMaxContentWidth: 960,
  touchTargetMin: 48,       // Minimum touch target size (48x48dp) — Requirement 22.4
} as const;

// --- Logo Watermark (Requirement 23.5) ---

export const watermark = {
  widthPercent: 75,         // 75% of screen width
  opacityMin: 0.07,         // 7% opacity
  opacityMax: 0.10,         // 10% opacity
  opacity: 0.08,            // Default 8% (midpoint)
} as const;

// --- Contrast Ratios (Requirement 23.6) ---

export const contrast = {
  normalText: 4.5,          // Minimum 4.5:1 for text below 18px
  largeText: 3.0,           // Minimum 3:1 for text 18px and above
  highContrast: 7.0,        // High contrast mode minimum (Requirement 22.2)
} as const;

// --- Combined Theme Object ---

export interface Theme {
  colors: typeof colors | typeof highContrastColors;
  typography: typeof typography;
  radii: typeof radii;
  spacing: typeof spacing;
  breakpoints: typeof breakpoints;
  layout: typeof layout;
  watermark: typeof watermark;
  contrast: typeof contrast;
  isHighContrast: boolean;
}

export const defaultTheme: Theme = {
  colors,
  typography,
  radii,
  spacing,
  breakpoints,
  layout,
  watermark,
  contrast,
  isHighContrast: false,
};

export const highContrastTheme: Theme = {
  colors: highContrastColors,
  typography,
  radii,
  spacing,
  breakpoints,
  layout,
  watermark,
  contrast,
  isHighContrast: true,
};
