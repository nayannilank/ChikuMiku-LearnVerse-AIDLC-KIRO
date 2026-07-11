/**
 * Color palette for ChikuMiku LearnVerse Mobile
 *
 * Matches the web client design system tokens exactly.
 *
 * Validates: Requirements 23.1, 22.2
 */

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  warning: string;
  success: string;
  error: string;
  dark: string;
  background: string;
  border: string;
  hindiGold: string;
  computersIndigo: string;
  evsOrange: string;
  customSubjectTeal: string;
  white: string;
  black: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export const colors: ColorPalette = {
  primary: '#E94F9B',
  secondary: '#9B59B6',
  accent: '#5DADE2',
  warning: '#F7C948',
  success: '#27AE60',
  error: '#E74C3C',
  dark: '#2C2341',
  background: '#F8F5FF',
  border: '#E0D8EC',

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
};

export const highContrastColors: ColorPalette = {
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
};
