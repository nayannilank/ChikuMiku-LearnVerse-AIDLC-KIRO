/**
 * Services barrel — Re-exports all API service modules.
 *
 * Usage:
 *   import { authApi, contentApi, learningApi, aiApi, exportApi } from '../services';
 */
export { apiClient, getAccessToken, setTokens, clearTokens } from './apiClient';
export type { ApiResponse, ApiClientError, RequestOptions } from './apiClient';

export { authApi } from './authApi';
export type {
  LoginResponse,
  RegisterResponse,
  ForgotPasswordResponse,
  VerifyOtpResponse,
  ResetPasswordResponse,
} from './authApi';

export { contentApi } from './contentApi';
export type {
  Subject,
  Book,
  Chapter,
  CreateChapterResponse,
  PageUploadResponse,
  OcrStatusResponse,
  SaveTranscriptResponse,
} from './contentApi';

export { learningApi } from './learningApi';
export type {
  LearnerProfile,
  UpdateLearnerRequest,
  DashboardSummary,
  WeakAreaRecommendation,
} from './learningApi';

export { aiApi } from './aiApi';
export type {
  QAResponse,
  GrammarExercise,
  GrammarSubmitResponse,
  RevisionQuestion,
  RevisionQuizResponse,
  QuizSubmitResponse,
  PronunciationAudioResponse,
} from './aiApi';

export { exportApi } from './exportApi';
export type {
  ExportResponse,
  ExportStatusResponse,
  ParentProfile,
  NotificationPrefs,
} from './exportApi';
