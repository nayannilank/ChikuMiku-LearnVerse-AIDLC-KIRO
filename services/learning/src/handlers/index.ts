/**
 * Learning service handler exports.
 */
export { handleParentDashboard } from './parent-dashboard';
export type { ParentDashboardResponse, ParentDashboardDeps } from './parent-dashboard';

export { handleLearnerDashboard } from './learner-dashboard';
export type { LearnerDashboardResponse, LearnerDashboardDeps } from './learner-dashboard';

export { handleRecordActivity, validateActivityRecord } from './record-activity';
export type {
  RecordActivityDeps,
  RecordActivityResponse,
  IActivityRepository,
  ILearnerRepository,
  LearnerStreakRecord,
} from './record-activity';

export { handleGetStreak } from './get-streak';
export type { GetStreakDeps, GetStreakResponse } from './get-streak';

export { handleGetProgress } from './progress';
export type {
  IProgressRepository,
  ChapterProgressRecord,
  ChapterProgressSummary,
  ProgressResponse,
  ProgressHandlerDeps,
} from './progress';

export {
  handleGetRecommendations,
  generateRecommendations,
  hasDeclineInScores,
  daysSinceActivity,
} from './recommendations';
export type {
  IRecommendationRepository,
  ChapterRecommendationData,
  Recommendation,
  RecommendationType,
  RecommendationsResponse,
  RecommendationsHandlerDeps,
} from './recommendations';

export { handleGetChapterAccessMode } from './chapter-access-mode';
export type {
  IChapterRepository,
  ChapterAccessModeDeps,
  ChapterAccessModeResponse,
} from './chapter-access-mode';

export { handleStartQuiz, handleSubmitQuiz, handleGetQuizResults, handleGetQuizAttempts } from './quiz-session';
export type {
  QuizDifficulty,
  StartQuizRequest,
  QuizQuestion,
  QuizSessionRecord,
  QuizAnswer,
  SubmitQuizRequest,
  QuestionBreakdown,
  QuizAttemptResult,
  StartQuizResponse,
  SubmitQuizResponse,
  QuizResultsResponse,
  QuizAttemptsResponse,
  IQuizSessionRepository,
  QuizSessionDeps,
} from './quiz-session';
