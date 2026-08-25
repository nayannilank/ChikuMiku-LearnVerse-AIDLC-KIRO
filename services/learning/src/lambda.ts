/**
 * Learning service Lambda entrypoint.
 *
 * Constructs the stateless Neon-backed repositories once per execution
 * environment (warm-container reuse), then routes each HTTP request to the
 * matching handler and maps the result to an APIGatewayProxyResult.
 *
 * Handlers return either a success payload (`{ success: true, ... }`) or an
 * `APIError` carrying a numeric `statusCode`; the `isAPIError` guard maps the
 * latter through to the HTTP status, and success responses default to 200.
 *
 * The repositories are stateless and resolve the shared @chikumiku/db pool
 * lazily on first query (via `getPool()`), so constructing them at module
 * scope does not open a DB connection at cold start.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { APIError } from '@chikumiku/types';

import { handleRecordActivity } from './handlers/record-activity';
import { handleGetProgress } from './handlers/progress';
import { handleGetRecommendations } from './handlers/recommendations';
import { handleGetStreak } from './handlers/get-streak';
import { handleParentDashboard } from './handlers/parent-dashboard';
import { handleLearnerDashboard } from './handlers/learner-dashboard';
import { adaptParentTree, adaptLearnerTree } from './handlers/dashboard-adapter';

import { NeonActivityRepository } from './repositories/neon-activity-repository';
import { NeonLearnerRepository } from './repositories/neon-learner-repository';
import { NeonLearningRepository } from './repositories/neon-learning-repository';
import { NeonProgressRepository } from './repositories/neon-progress-repository';
import { NeonRecommendationRepository } from './repositories/neon-recommendation-repository';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

// Stateless repositories, built once and reused across warm invocations. The
// shared pool is resolved lazily inside each repository's first query, so no
// connection is opened at module load.
const activityRepository = new NeonActivityRepository();
const learnerRepository = new NeonLearnerRepository();
const learningRepository = new NeonLearningRepository();
const progressRepository = new NeonProgressRepository();
const recommendationRepository = new NeonRecommendationRepository();

/**
 * Cognito claims injected by the API Gateway authorizer. `sub` is the verified
 * user id; `cognito:username` is the display username; `custom:role` marks the
 * caller as a parent or learner.
 */
interface CognitoClaims {
  sub?: string;
  'cognito:username'?: string;
  'custom:role'?: 'parent' | 'learner' | string;
  /**
   * Application DB id (parent.id / learner.id), set at registration. This is
   * the value to use for DB lookups — the Cognito `sub` is a different id.
   */
  'custom:appUserId'?: string;
}

/**
 * Resolves the application DB user id from claims: prefers `custom:appUserId`
 * (the parent.id / learner.id set at registration) and falls back to `sub` for
 * resilience. Returns null when neither is present.
 */
function resolveAppUserId(claims: CognitoClaims | null): string | null {
  return claims?.['custom:appUserId'] ?? claims?.sub ?? null;
}

/**
 * Extracts the verified Cognito claims from the API Gateway authorizer context
 * (`event.requestContext.authorizer.claims`). Returns `null` when the
 * authorizer context is absent — callers MUST treat that as unauthenticated
 * (401) rather than fabricating an identity.
 */
function extractClaims(event: APIGatewayProxyEvent): CognitoClaims | null {
  const claims = event.requestContext?.authorizer?.claims as
    | CognitoClaims
    | undefined;
  return claims ?? null;
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

/**
 * Maps a handler result (success payload or APIError) to an HTTP response:
 * an APIError maps through its numeric `statusCode`; anything else is 200.
 */
function mapResult(result: unknown): APIGatewayProxyResult {
  if (isAPIError(result)) {
    return jsonResponse(result.statusCode, result);
  }
  return jsonResponse(200, result);
}

/**
 * Extracts the trailing `:id` path parameter from a route like
 * `/learn/progress/:id`, URL-decoding it. Returns an empty string if absent.
 */
function extractPathId(path: string): string {
  return decodeURIComponent(path.split('/').pop() ?? '');
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    // Route: GET /learn/dashboard/parent
    // Identity is the parent's own id (verified `claims.sub`); no path param.
    if (httpMethod === 'GET' && path === '/learn/dashboard/parent') {
      const claims = extractClaims(event);
      const parentId = resolveAppUserId(claims);
      if (!parentId) {
        return jsonResponse(401, {
          error: 'Unauthorized: missing authorizer identity',
        });
      }

      const result = await handleParentDashboard(parentId, {
        learningRepository,
      });
      if (isAPIError(result)) {
        return mapResult(result);
      }
      return jsonResponse(200, adaptParentTree(result.tree));
    }

    // Route: GET /learn/dashboard/learner
    // Identity is the learner's own id (verified `claims.sub`); no path param.
    if (httpMethod === 'GET' && path === '/learn/dashboard/learner') {
      const claims = extractClaims(event);
      const learnerId = resolveAppUserId(claims);
      if (!learnerId) {
        return jsonResponse(401, {
          error: 'Unauthorized: missing authorizer identity',
        });
      }

      const result = await handleLearnerDashboard(learnerId, {
        learningRepository,
      });
      if (isAPIError(result)) {
        return mapResult(result);
      }

      // `learnerName` and `streak` are not part of the dashboard tree.
      // `streak` comes from the denormalized streak fields on the learner
      // record; `learnerName` is the learner's real name from the DB. Fall back
      // to the verified Cognito username only if the name read returns nothing.
      const [streakRecord, dbName] = await Promise.all([
        learnerRepository.getStreakData(learnerId),
        learnerRepository.getName(learnerId),
      ]);
      const streak = streakRecord ? streakRecord.currentStreak : 0;
      const learnerName = dbName ?? claims?.['cognito:username'] ?? '';

      return jsonResponse(
        200,
        adaptLearnerTree(result.tree, learnerName, streak)
      );
    }

    // Route: POST /learn/activity
    if (httpMethod === 'POST' && path === '/learn/activity') {
      let body: unknown;
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch {
        return jsonResponse(400, { error: 'Request body must be valid JSON' });
      }

      const result = await handleRecordActivity(body, {
        activityRepository,
        learnerRepository,
      });
      return mapResult(result);
    }

    // Route: GET /learn/streak/:id
    if (httpMethod === 'GET' && /^\/learn\/streak\/[^/]+$/.test(path)) {
      const learnerId = extractPathId(path);
      const result = await handleGetStreak(learnerId, { learnerRepository });
      return mapResult(result);
    }

    // Route: GET /learn/progress/:id
    if (httpMethod === 'GET' && /^\/learn\/progress\/[^/]+$/.test(path)) {
      const learnerId = extractPathId(path);
      const result = await handleGetProgress(learnerId, { progressRepository });
      return mapResult(result);
    }

    // Route: GET /learn/recommendations/:id
    if (httpMethod === 'GET' && /^\/learn\/recommendations\/[^/]+$/.test(path)) {
      const learnerId = extractPathId(path);
      const result = await handleGetRecommendations(learnerId, {
        recommendationRepository,
      });
      return mapResult(result);
    }

    // No matching route
    return jsonResponse(404, { error: 'Not found', path, method: httpMethod });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse(500, { error: message });
  }
}
