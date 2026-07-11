export {
  handleRegisterParent,
  validateParentRegistration,
} from './register-parent';
export type {
  RegisterParentResponse,
  RegisterParentDependencies,
} from './register-parent';

export { handleLogout, validateLogoutRequest } from './logout';
export type {
  LogoutRequest,
  LogoutSuccessResponse,
  LogoutHandlerDeps,
} from './logout';

export {
  handleVerifyPassword,
  validateVerifyPasswordRequest,
} from './verify-password';
export type {
  AuthContext,
  ParentRepository,
  PasswordHasher,
  VerifyPasswordRequest,
  VerifyPasswordSuccessResponse,
  VerifyPasswordDeps,
} from './verify-password';

export {
  handleGetProfile,
  handleUpdateProfile,
  handleChangePassword,
  handleUpdateNotifications,
  handleAddCustomSubject,
  handleDeleteProfile,
} from './parent-profile';
export type {
  ParentProfile,
  UpdateProfileRequest,
  ChangePasswordRequest,
  UpdateNotificationsRequest,
  AddCustomSubjectRequest,
  DeleteProfileRequest,
  GetProfileResponse,
  UpdateProfileResponse,
  ChangePasswordResponse,
  UpdateNotificationsResponse,
  AddCustomSubjectResponse,
  DeleteProfileResponse,
  ParentProfileRepository,
  SubjectRepository,
  ProfilePasswordHasher,
  ParentProfileDeps,
} from './parent-profile';

export {
  handleListLearners,
  handleEditLearner,
  handleResetLearnerPassword,
  handleDeleteLearner,
  validateEditLearnerRequest,
} from './manage-learners';
export type {
  LearnerRecord,
  EditLearnerRequest,
  ResetLearnerPasswordRequest,
  ManageLearnerRepository,
  ManageLearnerPasswordHasher,
  ManageLearnerDeps,
  ListLearnersResult,
  EditLearnerResult,
  ResetPasswordResult,
  DeleteLearnerResult,
} from './manage-learners';

export {
  handleGrantConsent,
  handleCheckConsent,
  requireParentalConsent,
  CURRENT_CONSENT_VERSION,
  CONSENT_TEXT,
} from './parental-consent';
export type {
  ParentalConsentRequest,
  ConsentStatus,
  ConsentRecord,
  ConsentRepository,
  ParentalConsentDeps,
  ConsentGrantedResponse,
} from './parental-consent';

export {
  executePurge,
  handleCancelDeletion,
  calculateDeletionDate,
  DELETION_WINDOW_DAYS,
} from './data-deletion-scheduler';
export type {
  DeletionScheduleRecord,
  DeletionManifest,
  DeletionRepository,
  DeletionSchedulerDeps,
  PurgeResult,
} from './data-deletion-scheduler';

export { handleRegisterLearner, validateLearnerRegistration } from './register-learner';
export type {
  LearnerRepository,
  CreateLearnerData,
  RegisterLearnerDeps,
  RegisterLearnerResult,
} from './register-learner';
export type { AuthContext as RegisterLearnerAuthContext } from './register-learner';
