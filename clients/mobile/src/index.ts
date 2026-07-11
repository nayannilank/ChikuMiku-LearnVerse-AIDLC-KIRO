/**
 * @chikumiku/client-mobile - React Native Android app for ChikuMiku LearnVerse
 *
 * Exports theme, services, context, and navigation types for the mobile app.
 * The actual app entry point is App.tsx (registered with AppRegistry at runtime).
 */

// Theme
export {
  colors,
  highContrastColors,
  typography,
  spacing,
  borderRadii,
  layout,
  watermark,
  gradeFontSizes,
  getGradeCategory,
  getFontSizeForGrade,
  defaultTheme,
  highContrastTheme,
  type Theme,
  type ColorPalette,
  type GradeCategory,
} from './theme';

// Services
export {
  storeAccessToken,
  getAccessToken,
  storeRefreshToken,
  getRefreshToken,
  storeUserSession,
  getUserSession,
  clearAuthStorage,
  type UserSession,
} from './services/secureStorage';

export {
  apiClient,
  setAccessToken,
  type ApiError,
  type ApiResponse,
} from './services/api';

// Context
export { AuthProvider, useAuth, type UserRole } from './context/AuthContext';

// Navigation types
export type { RootStackParamList } from './navigation/types';
