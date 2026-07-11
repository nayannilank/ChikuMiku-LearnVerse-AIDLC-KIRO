/**
 * ChikuMiku LearnVerse Mobile — Design System Theme
 *
 * Exports all design tokens as a unified, StyleSheet-compatible theme object.
 * Mirrors the web client's design system for cross-platform consistency.
 *
 * Validates: Requirements 22.1, 22.2, 22.4, 23.1, 23.2, 23.3, 23.4, 23.5
 */

export { colors, highContrastColors, type ColorPalette } from './colors';
export { typography } from './typography';
export { spacing } from './spacing';
export { borderRadii } from './borderRadii';
export { layout, watermark } from './layout';
export {
  gradeFontSizes,
  getGradeCategory,
  getFontSizeForGrade,
  type GradeCategory,
} from './fonts';

import { colors, highContrastColors, type ColorPalette } from './colors';
import { typography } from './typography';
import { spacing } from './spacing';
import { borderRadii } from './borderRadii';
import { layout, watermark } from './layout';

export interface Theme {
  colors: ColorPalette;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadii: typeof borderRadii;
  layout: typeof layout;
  watermark: typeof watermark;
  isHighContrast: boolean;
}

export const defaultTheme: Theme = {
  colors,
  typography,
  spacing,
  borderRadii,
  layout,
  watermark,
  isHighContrast: false,
};

export const highContrastTheme: Theme = {
  colors: highContrastColors,
  typography,
  spacing,
  borderRadii,
  layout,
  watermark,
  isHighContrast: true,
};
