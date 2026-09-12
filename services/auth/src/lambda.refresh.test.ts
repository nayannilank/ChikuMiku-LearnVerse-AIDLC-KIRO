/**
 * Unit tests for the POST /auth/refresh route.
 *
 * AwsCognitoClient is mocked so `refreshSession` resolves to a controllable
 * fake — no real Cognito calls are made.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';

const refreshSessionMock = jest.fn();

jest.mock('./clients/aws-cognito-client', () => ({
  AwsCognitoClient: jest.fn().mockImplementation(() => ({
    refreshSession: (...args: unknown[]) => refreshSessionMock(...args),
  })),
}));

// Imported after the mock is registered.
import { handler } from './lambda';

function refreshEvent(body: unknown): APIGatewayProxyEvent {
  return {
    httpMethod: 'POST',
    path: '/auth/refresh',
    body: JSON.stringify(body),
  } as unknown as APIGatewayProxyEvent;
}

describe('POST /auth/refresh', () => {
  beforeEach(() => {
    refreshSessionMock.mockReset();
  });

  it('returns 400 when refreshToken is missing', async () => {
    const res = await handler(refreshEvent({}));

    expect(res.statusCode).toBe(400);
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('returns 400 when refreshToken is an empty string', async () => {
    const res = await handler(refreshEvent({ refreshToken: '' }));

    expect(res.statusCode).toBe(400);
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });

  it('returns a fresh ID token + access token on success', async () => {
    refreshSessionMock.mockResolvedValue({
      idToken: 'new-id-token',
      accessToken: 'new-access-token',
      expiresIn: 3600,
    });

    const res = await handler(refreshEvent({ refreshToken: 'rt-123' }));

    expect(refreshSessionMock).toHaveBeenCalledWith('rt-123');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      token: 'new-id-token',
      accessToken: 'new-access-token',
      expiresIn: 3600,
    });
  });

  it('returns 401 when the refresh token is invalid or expired', async () => {
    refreshSessionMock.mockResolvedValue(null);

    const res = await handler(refreshEvent({ refreshToken: 'bad-token' }));

    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).errorCode).toBe('INVALID_REFRESH_TOKEN');
  });
});
