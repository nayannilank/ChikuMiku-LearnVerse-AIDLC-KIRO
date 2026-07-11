/**
 * Root Navigator — Configures the main navigation stack for the mobile app.
 *
 * Uses React Navigation native-stack navigator with:
 * - Auth screens (Login, Registration, ForgotPassword) when unauthenticated
 * - Main screens (Dashboards, Chapters, Exercises) when authenticated
 *
 * Validates: Requirements 23.4
 */
import React from 'react';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './types';

// Type-only import for compile-time navigation typing.
// Actual navigator creation happens at runtime with the native module.
type NativeStackNavigatorProps = {
  screenOptions?: Record<string, unknown>;
  children: React.ReactNode;
};

type ScreenProps = {
  name: keyof RootStackParamList;
  component: React.ComponentType;
  options?: Record<string, unknown>;
};

/**
 * Placeholder screen components — will be replaced by actual screen implementations
 * in subsequent tasks. These satisfy TypeScript during project setup.
 */
function PlaceholderScreen() {
  return null;
}

/**
 * RootNavigator component.
 *
 * Note: This is a structural setup file. The actual createNativeStackNavigator()
 * call requires the native module to be linked. For TypeScript compilation in the
 * monorepo (without native binaries), we define the navigation structure as types
 * and export a component that will be connected to React Navigation at runtime.
 */
export function RootNavigator(): React.ReactElement {
  const { isAuthenticated, role } = useAuth();

  // This is the navigation configuration — the actual NavigationContainer
  // and createNativeStackNavigator are used in App.tsx at runtime.
  // For now, return a fragment representing the navigation intent.
  return React.createElement(React.Fragment, null);
}

/**
 * Screen configuration for the auth flow (unauthenticated users).
 */
export const AUTH_SCREENS: Array<{
  name: keyof RootStackParamList;
  options?: Record<string, unknown>;
}> = [
  { name: 'Landing', options: { headerShown: false } },
  { name: 'Login', options: { headerShown: false } },
  { name: 'ParentRegistration', options: { title: 'Create Account' } },
  { name: 'LearnerRegistration', options: { title: 'Add Learner' } },
  { name: 'ForgotPassword', options: { title: 'Reset Password' } },
];

/**
 * Screen configuration for the parent flow (authenticated parent).
 */
export const PARENT_SCREENS: Array<{
  name: keyof RootStackParamList;
  options?: Record<string, unknown>;
}> = [
  { name: 'ParentDashboard', options: { headerShown: false } },
  { name: 'ManageLearners', options: { title: 'Manage Learners' } },
  { name: 'ParentSettings', options: { title: 'Settings' } },
];

/**
 * Screen configuration for the learner flow (authenticated learner).
 */
export const LEARNER_SCREENS: Array<{
  name: keyof RootStackParamList;
  options?: Record<string, unknown>;
}> = [
  { name: 'LearnerDashboard', options: { headerShown: false } },
  { name: 'ChapterCreation', options: { title: 'New Chapter' } },
  { name: 'OCRProcessing', options: { title: 'Processing' } },
  { name: 'ChapterExplanation', options: { title: 'Explanation' } },
  { name: 'PronunciationPractice', options: { title: 'Pronunciation' } },
  { name: 'GrammarExercise', options: { title: 'Grammar' } },
  { name: 'ChapterQA', options: { title: 'Ask Questions' } },
  { name: 'RevisionQuiz', options: { title: 'Quiz' } },
];

/**
 * Default screen options applied to all screens in the stack.
 */
export const DEFAULT_SCREEN_OPTIONS = {
  headerStyle: {
    backgroundColor: colors.background,
  },
  headerTintColor: colors.dark,
  headerTitleStyle: {
    fontWeight: '600' as const,
  },
  contentStyle: {
    backgroundColor: colors.background,
  },
  animation: 'slide_from_right' as const,
} as const;

export type { RootStackParamList };
