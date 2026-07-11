/**
 * Authentication-related type definitions.
 * Covers parent/learner registration, login, and validation.
 */

/** Parent registration request payload. */
export interface ParentRegistrationRequest {
  /** 8-15 chars, [a-z0-9_-] */
  username: string;
  /** 5-20 chars, [a-zA-Z ] */
  fullName: string;
  /** Exactly 10 digits */
  phone: string;
  /** Valid email, max 30 chars */
  email: string;
  /** 8-20 chars, 1 upper, 1 lower, 1 digit, 1 special */
  password: string;
}

/** Learner registration request payload (created by authenticated parent). */
export interface LearnerRegistrationRequest {
  /** Pre-filled from authenticated session */
  parentUsername: string;
  /** 8-15 chars, [a-z0-9_-] */
  username: string;
  /** 5-20 chars, [a-zA-Z ] */
  name: string;
  /** 8-20 chars, 1 upper, 1 lower, 1 digit, 1 special */
  password: string;
  gender: 'male' | 'female' | 'other';
  relationship: 'son' | 'daughter' | 'other';
  /** LKG through Twelfth */
  grade: string;
  /** 5-30 chars, [a-zA-Z0-9, -] */
  schoolName: string;
  /** Min 1 subject required */
  subjectIds: string[];
  /** 1-50 chars each, max 5 per learner */
  customSubjects?: string[];
}

/** Login request payload with role selection. */
export interface LoginRequest {
  role: 'parent' | 'learner';
  username: string;
  password: string;
}

/** Result of field validation. */
export interface ValidationResult {
  valid: boolean;
  /** field name -> error message */
  errors: Record<string, string>;
}
