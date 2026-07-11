/**
 * Parental Consent Handler
 *
 * Collects verifiable parental consent BEFORE storing any learner personal data.
 * This is required by child privacy laws (COPPA compliance).
 *
 * The consent must be recorded before:
 * - Learner registration (personal data storage)
 * - Any learner data processing
 *
 * Requirements: 20.5
 */

import type { APIError } from '@chikumiku/types';

/** Request body for granting parental consent. */
export interface ParentalConsentRequest {
  /** The parent granting consent. */
  parentId: string;
  /** Consent text the parent agreed to. */
  consentText: string;
  /** Whether the parent explicitly agreed. */
  consentGranted: boolean;
  /** The learner username consent is for (optional, for per-learner consent). */
  learnerUsername?: string;
}

/** Result of verifying consent status. */
export interface ConsentStatus {
  hasConsented: boolean;
  consentedAt: string | null;
  consentVersion: string | null;
}

/** Consent record stored in the database. */
export interface ConsentRecord {
  parentId: string;
  learnerUsername: string | null;
  consentVersion: string;
  consentedAt: string;
  consentText: string;
  ipAddress?: string;
}

/** Repository interface for consent data operations. */
export interface ConsentRepository {
  /** Check if a parent has active consent. */
  hasActiveConsent(parentId: string): Promise<boolean>;
  /** Get the consent status for a parent. */
  getConsentStatus(parentId: string): Promise<ConsentStatus>;
  /** Store a new consent record. */
  storeConsent(record: ConsentRecord): Promise<void>;
}

/** Current consent version — increment when consent text changes. */
export const CURRENT_CONSENT_VERSION = '1.0';

/** Consent text presented to parents. */
export const CONSENT_TEXT =
  'I consent to ChikuMiku LearnVerse collecting and processing my child\'s ' +
  'learning data (including name, grade, and academic progress) solely for ' +
  'educational purposes within this platform. I understand that no data will ' +
  'be shared with third parties, and I can request deletion of all data at any time.';

/** Dependencies for the consent handler. */
export interface ParentalConsentDeps {
  consentRepository: ConsentRepository;
  now?: Date;
}

/** Successful consent response. */
export interface ConsentGrantedResponse {
  success: true;
  message: string;
  consentedAt: string;
  consentVersion: string;
}

/**
 * Handles the parental consent grant request.
 * Must be called before learner data can be stored.
 */
export async function handleGrantConsent(
  request: ParentalConsentRequest,
  deps: ParentalConsentDeps
): Promise<ConsentGrantedResponse | APIError> {
  const now = deps.now ?? new Date();

  // Validate consent was explicitly granted
  if (!request.consentGranted) {
    return {
      statusCode: 400,
      errorCode: 'CONSENT_REQUIRED',
      message: 'Parental consent must be explicitly granted before learner data can be stored',
      retryable: false,
    };
  }

  if (!request.parentId || typeof request.parentId !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Parent identification is required',
      retryable: false,
    };
  }

  // Store the consent record
  const consentRecord: ConsentRecord = {
    parentId: request.parentId,
    learnerUsername: request.learnerUsername ?? null,
    consentVersion: CURRENT_CONSENT_VERSION,
    consentedAt: now.toISOString(),
    consentText: CONSENT_TEXT,
  };

  await deps.consentRepository.storeConsent(consentRecord);

  return {
    success: true,
    message: 'Parental consent recorded successfully',
    consentedAt: consentRecord.consentedAt,
    consentVersion: CURRENT_CONSENT_VERSION,
  };
}

/**
 * Checks if a parent has provided consent.
 * Returns the consent status without modifying any data.
 */
export async function handleCheckConsent(
  parentId: string,
  deps: ParentalConsentDeps
): Promise<ConsentStatus | APIError> {
  if (!parentId || typeof parentId !== 'string') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Parent identification is required',
      retryable: false,
    };
  }

  return deps.consentRepository.getConsentStatus(parentId);
}

/**
 * Middleware-style check: verifies consent before proceeding with learner data operations.
 * Returns an APIError if consent has not been granted, otherwise returns null.
 */
export async function requireParentalConsent(
  parentId: string,
  consentRepository: ConsentRepository
): Promise<APIError | null> {
  const hasConsent = await consentRepository.hasActiveConsent(parentId);

  if (!hasConsent) {
    return {
      statusCode: 403,
      errorCode: 'CONSENT_REQUIRED',
      message: 'Parental consent is required before storing learner data',
      retryable: false,
    };
  }

  return null;
}
