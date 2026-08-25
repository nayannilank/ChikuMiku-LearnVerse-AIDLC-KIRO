/**
 * Unit tests for the per-user reset rate limit enforced in the lambda
 * forgot-password route, focusing on the window boundary.
 *
 * The shared @chikumiku/db pool is mocked so the route's NeonOTPRepository /
 * NeonUserRepository queries hit a controllable fake. The rate-limit window
 * defaults to 30 minutes (RESET_REQUEST_WINDOW_MINUTES unset).
 */

import type { APIGatewayProxyEvent } from 'aws-lambda';

const queryMock = jest.fn();

jest.mock('@chikumiku/db', () => ({
  getPool: jest.fn(async () => ({ query: (...args: unknown[]) => queryMock(...args) })),
  withTransaction: jest.fn(),
  toIso: (v: unknown) => v,
  toVector: jest.fn(),
  query: jest.fn(),
  closePool: jest.fn(),
}));

// Imported after the mock is registered.
import { handler } from './lambda';

const WINDOW_MS = 30 * 60 * 1000;

function forgotEvent(username: string): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/auth/forgot-password',
    body: JSON.stringify({ username }),
  } as unknown as APIGatewayProxyEvent;
}

/**
 * Makes the fake pool report `lastRequestedAt` for the getMostRecentCreatedAt
 * query, and "no rows" for everything else (so an un-limited request resolves
 * to a not-found user and a generic 200 without touching SES/SNS).
 */
function primePool(lastRequestedAt: Date | null): void {
  queryMock.mockImplementation(async (sql: string) => {
    if (/SELECT created_at\s+FROM otp_record/.test(sql)) {
      return { rows: lastRequestedAt ? [{ created_at: lastRequestedAt }] : [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  });
}

describe('forgot-password reset rate limit', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns 429 when a request was made just inside the window', async () => {
    primePool(new Date(Date.now() - (WINDOW_MS - 5000))); // ~29m55s ago
    const res = await handler(forgotEvent('alice'));

    expect(res.statusCode).toBe(429);
    expect(JSON.parse(res.body).errorCode).toBe('RATE_LIMITED');
  });

  it('does NOT rate limit when the last request is just outside the window', async () => {
    primePool(new Date(Date.now() - (WINDOW_MS + 5000))); // ~30m05s ago
    const res = await handler(forgotEvent('alice'));

    // Not limited -> handler runs; unknown user -> generic 200 (no 429).
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });

  it('does NOT rate limit when the user has never requested a reset', async () => {
    primePool(null);
    const res = await handler(forgotEvent('alice'));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});
