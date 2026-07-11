/**
 * Account lockout module — re-exports all lockout manager functions and constants.
 */
export {
  MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  isAccountLocked,
  recordFailedAttempt,
  resetAttempts,
  getLockoutMessage,
  getLockoutRemainingSeconds,
} from './lockout-manager';
