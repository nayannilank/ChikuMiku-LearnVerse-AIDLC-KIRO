/**
 * @chikumiku/service-learning - Learning progress and dashboard service Lambda handlers
 */
export {
  handleParentDashboard,
  handleLearnerDashboard,
  handleRecordActivity,
  validateActivityRecord,
  handleGetStreak,
  handleGetProgress,
  handleGetRecommendations,
  generateRecommendations,
  hasDeclineInScores,
  daysSinceActivity,
  handleGetChapterAccessMode,
  handleStartQuiz,
  handleSubmitQuiz,
  handleGetQuizResults,
  handleGetQuizAttempts,
} from './handlers';

export type {
  ParentDashboardResponse,
  ParentDashboardDeps,
  LearnerDashboardResponse,
  LearnerDashboardDeps,
  RecordActivityDeps,
  RecordActivityResponse,
  IActivityRepository,
  ILearnerRepository,
  LearnerStreakRecord,
  GetStreakDeps,
  GetStreakResponse,
  IProgressRepository,
  ChapterProgressRecord,
  ChapterProgressSummary,
  ProgressResponse,
  ProgressHandlerDeps,
  IRecommendationRepository,
  ChapterRecommendationData,
  Recommendation,
  RecommendationType,
  RecommendationsResponse,
  RecommendationsHandlerDeps,
  IChapterRepository,
  ChapterAccessModeDeps,
  ChapterAccessModeResponse,
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
} from './handlers';

export {
  determineAcademicYear,
  getAcademicYearForGrade,
  getAccessMode,
  isCurrentYear,
} from './academic-year';

export type {
  ILearningRepository,
  LearnerRecord,
  SubjectRecord,
  BookRecord,
  ChapterRecord,
  ExerciseRecord,
  QuizAttemptRecord,
} from './repositories/learning-repository';

export { sendNotification } from './notifications';

export {
  publishStreakAlert,
  publishProgressUpdate,
  publishStreakReminder,
  createPublisherConfigFromEnv,
  isSuccessResult,
} from './notifications';

export type {
  ParentNotificationPreferences,
  ISNSClient,
  IParentPreferencesRepository,
  NotificationTopicConfig,
  NotificationServiceDeps,
  NotificationResult,
  NotificationSuppressedResult,
  StreakAlertData,
  ProgressUpdateData,
  StreakReminderData,
  NotificationPublisherConfig,
  PublishResult,
} from './notifications';
