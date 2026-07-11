/**
 * @chikumiku/validation - Shared validation logic for ChikuMiku LearnVerse
 */
export {
  validateUsername,
  validateFullName,
  validatePhone,
  validateEmail,
  validatePassword,
  validateBookName,
  validateChapterName,
  validateSubjectName,
  validateSchoolName,
} from './validators';
export { validateFileUpload } from './file-validator';
export { validateQuestionLength } from './question-validator';
export { validateTimer } from './timer-validator';
export { aggregateProgress } from './progress-aggregator';
export type { QuizAttempt, ProgressSummary } from './progress-aggregator';
export {
  calculateParentCompletion,
  calculateExerciseCompletion,
} from './parent-dashboard-calculator';
export { calculateStreak, shouldReset, shouldIncrement } from './streak-calculator';
export { calculateScorePercentage } from './score-calculator';
export {
  calculateLearnerCompletion,
  calculatePagesLeft,
} from './learner-dashboard-calculator';
