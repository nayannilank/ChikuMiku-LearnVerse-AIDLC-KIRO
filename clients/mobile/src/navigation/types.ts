/**
 * Navigation type definitions for React Navigation
 *
 * Defines the screen parameter lists for type-safe navigation.
 */

export type RootStackParamList = {
  Landing: undefined;
  Login: undefined;
  ParentRegistration: undefined;
  LearnerRegistration: undefined;
  ForgotPassword: undefined;
  ParentDashboard: undefined;
  LearnerDashboard: undefined;
  ChapterCreation: undefined;
  PageCapture: { chapterId: string };
  OCRProcessing: { chapterId: string };
  TranscriptEditor: { chapterId: string };
  ChapterExplanation: { chapterId: string; pageNumber: number };
  PronunciationPractice: { chapterId: string; pageNumber: number };
  GrammarExercise: { chapterId: string };
  ChapterQA: { chapterId: string };
  RevisionQuiz: { chapterId: string };
  ManageLearners: undefined;
  ParentSettings: undefined;
};
