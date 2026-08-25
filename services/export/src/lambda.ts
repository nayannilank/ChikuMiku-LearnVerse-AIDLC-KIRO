/**
 * Export service Lambda entrypoint.
 *
 * Constructs the export dependency graph once per execution environment
 * (warm-container reuse), then routes each HTTP request to the appropriate
 * handler and maps the result to an API Gateway response.
 *
 * Wired end-to-end:
 *   POST /export/report — generate a PDF/CSV progress report, store it in S3,
 *                         and return a pre-signed download URL.
 *   GET  /export/:id    — issue a pre-signed download URL for a stored report
 *                         (see the auth/ownership TODO on the route below).
 *
 * Environment variables (provided by the export CDK stack):
 *   EXPORT_FILES_BUCKET — S3 bucket for generated report files.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { APIError } from '@chikumiku/types';
import { isSensitiveActionAuthorized } from '@chikumiku/service-auth';

import {
  handleExportReport,
  type AuthContext,
  type ExportReportDeps,
} from './handlers/export-report';
import { NeonLearnerProgressRepository } from './clients/neon-learner-progress-repository';
import { AwsReportStorageClient } from './clients/aws-report-storage-client';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

/** Default pre-signed URL validity (1 hour), matching the report handler. */
const DOWNLOAD_URL_EXPIRY_SECONDS = 3600;

/**
 * Builds the export dependency graph. Called once and reused across warm
 * invocations. The concrete repository and S3 client read their own
 * configuration (connection pool, EXPORT_FILES_BUCKET) from the environment.
 */
function buildDeps(): ExportReportDeps {
  return {
    learnerProgressRepository: new NeonLearnerProgressRepository(),
    reportStorageClient: new AwsReportStorageClient(),
    // Single source of truth for the 5-minute re-auth window (auth service).
    isSensitiveActionAuthorized,
  };
}

// Lazily initialized so a missing env var (e.g. EXPORT_FILES_BUCKET) surfaces
// as a per-request 500 rather than crashing module load for every invocation.
let cachedDeps: ExportReportDeps | null = null;

function getDeps(): ExportReportDeps {
  if (!cachedDeps) {
    cachedDeps = buildDeps();
  }
  return cachedDeps;
}

/** Case-insensitive header lookup over the API Gateway event. */
function getHeader(event: APIGatewayProxyEvent, name: string): string | undefined {
  const headers = event.headers ?? {};
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value != null) {
      return value;
    }
  }
  return undefined;
}

/**
 * Extracts the authenticated caller from the API Gateway request context.
 *
 * We only trust identity that a gateway authorizer (Cognito JWT authorizer or
 * a custom Lambda authorizer) has already validated — never values from the
 * request body — so we never fabricate a parent identity here. Both the
 * Cognito `claims` shape and a flat Lambda-authorizer `context` shape are
 * supported.
 *
 * TODO(auth): the Cognito/JWT authorizer for this service is not fully wired
 * yet. Once it is, this reads the verified `sub` / username / role claims it
 * injects. Until then, requests without a validated authorizer context are
 * rejected with 401 (we do not guess a caller from the body).
 *
 * @returns the AuthContext, or null when no trusted identity is present.
 */
function extractAuthContext(event: APIGatewayProxyEvent): AuthContext | null {
  const authorizer = event.requestContext?.authorizer as
    | Record<string, unknown>
    | undefined
    | null;
  if (!authorizer) {
    return null;
  }

  // Cognito authorizer nests verified JWT claims under `claims`; a custom
  // Lambda authorizer exposes its context fields directly on `authorizer`.
  const claims = (authorizer.claims as Record<string, unknown> | undefined) ?? authorizer;

  const userId = asString(claims.sub) ?? asString(claims.userId);
  const username =
    asString(claims['cognito:username']) ??
    asString(claims.username) ??
    userId;
  const roleRaw = asString(claims['custom:role']) ?? asString(claims.role);

  if (!userId || !username || (roleRaw !== 'parent' && roleRaw !== 'learner')) {
    return null;
  }

  return { userId, username, role: roleRaw };
}

/**
 * Extracts the timestamp of the caller's last password re-verification, used
 * by the sensitive-action guard. Read from a validated `custom:lastVerifiedAt`
 * claim, falling back to an `X-Last-Verified-At` header (ISO 8601 or epoch ms).
 *
 * Returns null when absent — a safe default that causes the handler to require
 * re-authentication rather than allowing the sensitive export to proceed.
 */
function extractLastVerifiedAt(event: APIGatewayProxyEvent): Date | null {
  const authorizer = event.requestContext?.authorizer as
    | Record<string, unknown>
    | undefined
    | null;
  const claims = (authorizer?.claims as Record<string, unknown> | undefined) ?? authorizer ?? {};

  const raw =
    asString(claims['custom:lastVerifiedAt']) ??
    getHeader(event, 'X-Last-Verified-At');
  if (!raw) {
    return null;
  }

  // Accept epoch milliseconds or an ISO 8601 string.
  const asEpoch = Number(raw);
  const date = Number.isFinite(asEpoch) && raw.trim() !== '' ? new Date(asEpoch) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Narrows an unknown value to a non-empty string, else undefined. */
function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Type guard: an APIError carries a numeric `statusCode`. */
function isAPIError(result: unknown): result is APIError {
  return (
    typeof result === 'object' &&
    result !== null &&
    typeof (result as { statusCode?: unknown }).statusCode === 'number'
  );
}

/** Builds a JSON API Gateway response with CORS headers. */
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Route: POST /export/report
    if (httpMethod === 'POST' && path === '/export/report') {
      const authContext = extractAuthContext(event);
      if (!authContext) {
        return jsonResponse(401, {
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      let body: unknown;
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return jsonResponse(400, { error: 'Request body must be valid JSON' });
      }

      const lastVerifiedAt = extractLastVerifiedAt(event);
      const result = await handleExportReport(
        body,
        authContext,
        lastVerifiedAt,
        getDeps(),
        new Date()
      );

      if (isAPIError(result)) {
        return jsonResponse(result.statusCode, result);
      }
      return jsonResponse(200, result);
    }

    // Route: GET /export/:id
    if (httpMethod === 'GET' && /^\/export\/[^/]+$/.test(path)) {
      const authContext = extractAuthContext(event);
      if (!authContext) {
        return jsonResponse(401, {
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const id = decodeURIComponent(path.split('/').pop() ?? '');
      if (!id) {
        return jsonResponse(400, { error: 'Report id is required' });
      }

      // No dedicated get-report handler exists yet, so we issue a pre-signed
      // GET URL for the stored object, treating :id as the S3 object key.
      //
      // TODO(export): a future get-report handler should (1) map an opaque
      // report id to its stored S3 key and (2) verify the report belongs to
      // the authenticated caller before presigning. Upload keys are namespaced
      // as `exports/{parentId}/{timestamp}-report.{ext}`; per-object ownership
      // is NOT enforced here, so this route must not be exposed publicly until
      // that mapping/ownership check is in place.
      const downloadUrl = await getDeps().reportStorageClient.getPresignedUrl(
        id,
        DOWNLOAD_URL_EXPIRY_SECONDS
      );

      return jsonResponse(200, {
        downloadUrl,
        expiresInSeconds: DOWNLOAD_URL_EXPIRY_SECONDS,
      });
    }

    // No matching route
    return jsonResponse(404, { error: 'Not found', path, method: httpMethod });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse(500, { error: message });
  }
}
