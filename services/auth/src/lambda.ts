import { randomUUID } from 'crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { LearnerRegistrationRequest, ParentRegistrationRequest } from '@chikumiku/types';

import { handleRegisterParent, type RegisterParentDependencies } from './handlers/register-parent';
import {
  handleRegisterLearner,
  type AuthContext,
  type RegisterLearnerDeps,
} from './handlers/register-learner';
import { handleLogout } from './handlers/logout';
import { handleForgotPassword } from './handlers/forgot-password';
import { handleVerifyOTP } from './handlers/verify-otp';
import { handleResetPassword } from './handlers/reset-password';
import { NeonDBClient } from './clients/neon-db-client';
import { AwsCognitoClient } from './clients/aws-cognito-client';
import { BcryptPasswordHasher } from './clients/bcrypt-password-hasher';
import { NeonLearnerRepository } from './clients/neon-learner-repository';
import { NeonConsentRepository } from './clients/neon-consent-repository';
import { NeonUserRepository } from './clients/neon-user-repository';
import { NeonOTPRepository } from './clients/neon-otp-repository';
import { NeonResetTokenRepository } from './clients/neon-reset-token-repository';
import { AwsNotificationService } from './clients/aws-notification-service';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

/**
 * Builds the parent-registration dependency graph. Constructed once per
 * execution environment and reused across warm invocations, following the
 * lazy-deps pattern in the AI Gateway lambda so a missing config surfaces as a
 * per-request 500 rather than crashing module load.
 */
function buildRegisterParentDeps(): RegisterParentDependencies {
  return {
    dbClient: new NeonDBClient(),
    cognitoClient: new AwsCognitoClient(),
    generateId: () => randomUUID(),
  };
}

let cachedRegisterParentDeps: RegisterParentDependencies | null = null;

function getRegisterParentDeps(): RegisterParentDependencies {
  if (!cachedRegisterParentDeps) {
    cachedRegisterParentDeps = buildRegisterParentDeps();
  }
  return cachedRegisterParentDeps;
}

/**
 * Builds the learner-registration dependency graph. Constructed once per
 * execution environment and reused across warm invocations, mirroring the
 * parent-registration lazy-deps pattern above.
 */
function buildRegisterLearnerDeps(): RegisterLearnerDeps {
  return {
    repository: new NeonLearnerRepository(),
    passwordHasher: new BcryptPasswordHasher(),
    consentRepository: new NeonConsentRepository(),
    cognitoClient: getCognitoClient(),
  };
}

let cachedRegisterLearnerDeps: RegisterLearnerDeps | null = null;

function getRegisterLearnerDeps(): RegisterLearnerDeps {
  if (!cachedRegisterLearnerDeps) {
    cachedRegisterLearnerDeps = buildRegisterLearnerDeps();
  }
  return cachedRegisterLearnerDeps;
}

/**
 * Extracts the authenticated parent context from the API Gateway authorizer
 * claims. The Cognito authorizer places verified JWT claims on
 * `event.requestContext.authorizer.claims`. Learner registration requires an
 * authenticated *parent*; returns null when the caller is unauthenticated or
 * is not a parent, which the route maps to 401.
 */
function getParentAuthContext(event: APIGatewayProxyEvent): AuthContext | null {
  const claims = event.requestContext?.authorizer?.claims as
    | Record<string, string | undefined>
    | undefined;
  if (!claims) {
    return null;
  }

  // Prefer the application DB id (custom:appUserId) over the Cognito sub —
  // consent and learner rows are keyed by parent.id, not the Cognito sub.
  const parentId = claims['custom:appUserId'] ?? claims.sub;
  const parentUsername = claims['cognito:username'];
  const role = claims['custom:role'];

  if (role !== 'parent' || !parentId || !parentUsername) {
    return null;
  }

  return { parentId, parentUsername };
}

let cachedCognitoClient: AwsCognitoClient | null = null;

/** Shared Cognito client, reused across warm invocations. */
function getCognitoClient(): AwsCognitoClient {
  if (!cachedCognitoClient) {
    cachedCognitoClient = new AwsCognitoClient();
  }
  return cachedCognitoClient;
}

// ── Password-reset flow configuration ───────────────────────────────────────

/**
 * Per-user reset rate limit: at most one forgot-password request per user per
 * this window. Overridable via RESET_REQUEST_WINDOW_MINUTES; defaults to 30.
 * Parsed once at module load; a non-numeric/absent value falls back to 30.
 */
const RESET_REQUEST_WINDOW_MINUTES = (() => {
  const parsed = Number(process.env.RESET_REQUEST_WINDOW_MINUTES);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
})();

/** Lifetime of a reset token issued after OTP verification (15 minutes). */
const RESET_TOKEN_TTL_MINUTES = 15;

let cachedUserRepository: NeonUserRepository | null = null;
function getUserRepository(): NeonUserRepository {
  if (!cachedUserRepository) {
    cachedUserRepository = new NeonUserRepository();
  }
  return cachedUserRepository;
}

let cachedOtpRepository: NeonOTPRepository | null = null;
function getOtpRepository(): NeonOTPRepository {
  if (!cachedOtpRepository) {
    cachedOtpRepository = new NeonOTPRepository();
  }
  return cachedOtpRepository;
}

let cachedResetTokenRepository: NeonResetTokenRepository | null = null;
function getResetTokenRepository(): NeonResetTokenRepository {
  if (!cachedResetTokenRepository) {
    cachedResetTokenRepository = new NeonResetTokenRepository();
  }
  return cachedResetTokenRepository;
}

let cachedNotificationService: AwsNotificationService | null = null;
function getNotificationService(): AwsNotificationService {
  if (!cachedNotificationService) {
    cachedNotificationService = new AwsNotificationService();
  }
  return cachedNotificationService;
}

/**
 * Enforces the per-user reset rate limit. Returns true when the user has made
 * a reset request within RESET_REQUEST_WINDOW_MINUTES.
 *
 * No-enumeration tradeoff: the check reads otp_record, which only has rows for
 * usernames that have actually requested a reset. Non-existent users therefore
 * never trip the limit, so a 429 does reveal that a recent request exists for
 * that username. We accept this narrow leak because the task requires a 429
 * response for rate-limited requests; the fresh-request path still returns the
 * same generic message for existing and non-existent users alike.
 */
async function isResetRateLimited(username: string): Promise<boolean> {
  const lastRequestedAt = await getOtpRepository().getMostRecentCreatedAt(username);
  if (!lastRequestedAt) {
    return false;
  }
  const windowMs = RESET_REQUEST_WINDOW_MINUTES * 60 * 1000;
  return Date.now() - lastRequestedAt.getTime() < windowMs;
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Route: POST /auth/register/parent — wired to real business logic.
    if (httpMethod === 'POST' && path === '/auth/register/parent') {
      const request = JSON.parse(event.body || '{}') as ParentRegistrationRequest;
      const result = await handleRegisterParent(request, getRegisterParentDeps());

      // handleRegisterParent returns either a success response or an APIError
      // (discriminated by the presence of a statusCode field).
      if ('statusCode' in result) {
        return {
          statusCode: result.statusCode,
          headers: CORS_HEADERS,
          body: JSON.stringify(result),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(result),
      };
    }

    // Route: POST /auth/register/learner — authenticated parent only.
    if (httpMethod === 'POST' && path === '/auth/register/learner') {
      const authContext = getParentAuthContext(event);
      if (!authContext) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 401,
            errorCode: 'UNAUTHORIZED',
            message: 'Authenticated parent session is required',
            retryable: false,
          }),
        };
      }

      const request = JSON.parse(event.body || '{}') as LearnerRegistrationRequest;
      const result = await handleRegisterLearner(
        request,
        authContext,
        getRegisterLearnerDeps()
      );

      // handleRegisterLearner returns a discriminated result: success or an
      // APIError carrying its own statusCode.
      if (!result.success) {
        return {
          statusCode: result.error.statusCode,
          headers: CORS_HEADERS,
          body: JSON.stringify(result.error),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(result),
      };
    }

    // Route: POST /auth/login — authenticates against Cognito and returns the
    // issued ID token. The ID token carries custom:role / custom:appUserId and
    // validates against the API Gateway Cognito authorizer on protected routes.
    if (httpMethod === 'POST' && path === '/auth/login') {
      const body = JSON.parse(event.body || '{}');
      const { username, password } = body;

      if (!username || !password) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'username and password are required' }),
        };
      }

      const tokens = await getCognitoClient().authenticate(username, password);
      if (!tokens) {
        return {
          statusCode: 401,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            errorCode: 'INVALID_CREDENTIALS',
            message: 'Invalid username or password',
          }),
        };
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          token: tokens.idToken,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        }),
      };
    }

    // Route: POST /auth/forgot-password — rate-limit check, then issue an OTP.
    if (httpMethod === 'POST' && path === '/auth/forgot-password') {
      const request = JSON.parse(event.body || '{}');
      const username = typeof request.username === 'string' ? request.username.trim() : '';

      // Enforce the per-user rate limit before doing any work. Skip when the
      // username is absent/empty and let the handler return its 400.
      if (username.length > 0 && (await isResetRateLimited(username))) {
        return {
          statusCode: 429,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            statusCode: 429,
            errorCode: 'RATE_LIMITED',
            message: `A reset request was made recently. Please wait up to ${RESET_REQUEST_WINDOW_MINUTES} minutes before trying again.`,
            retryable: true,
          }),
        };
      }

      const result = await handleForgotPassword(request, {
        userRepository: getUserRepository(),
        otpRepository: getOtpRepository(),
        notificationService: getNotificationService(),
      });

      if (!result.success) {
        return { statusCode: result.error.statusCode, headers: CORS_HEADERS, body: JSON.stringify(result.error) };
      }
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
    }

    // Route: POST /auth/verify-otp — verify the OTP, then persist the reset
    // token so reset-password can validate it (the handler returns the token
    // string but does not persist it).
    if (httpMethod === 'POST' && path === '/auth/verify-otp') {
      const request = JSON.parse(event.body || '{}');
      const result = await handleVerifyOTP(request, { otpRepository: getOtpRepository() });

      if (!result.success) {
        return { statusCode: result.error.statusCode, headers: CORS_HEADERS, body: JSON.stringify(result.error) };
      }

      // Persist the issued reset token with a bounded lifetime.
      if (result.data.resetToken) {
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
        await getResetTokenRepository().store(
          String(request.username).trim(),
          result.data.resetToken,
          expiresAt
        );
      }

      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
    }

    // Route: POST /auth/reset-password — validate token and set new password.
    if (httpMethod === 'POST' && path === '/auth/reset-password') {
      const request = JSON.parse(event.body || '{}');
      const result = await handleResetPassword(request, {
        userRepository: getUserRepository(),
        resetTokenRepository: getResetTokenRepository(),
      });

      if (!result.success) {
        return { statusCode: result.error.statusCode, headers: CORS_HEADERS, body: JSON.stringify(result.error) };
      }
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
    }

    // Route: POST /auth/logout — terminates the Cognito session.
    if (httpMethod === 'POST' && path === '/auth/logout') {
      const body = JSON.parse(event.body || '{}');
      const result = await handleLogout(body, { cognitoClient: getCognitoClient() });
      if ('statusCode' in result) {
        return { statusCode: result.statusCode, headers: CORS_HEADERS, body: JSON.stringify(result) };
      }
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) };
    }

    // No matching route
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Not found', path, method: httpMethod }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const statusCode = message.includes('Validation') || message.includes('required') ? 400 : 500;
    return {
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
}
