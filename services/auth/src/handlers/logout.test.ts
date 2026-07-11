/**
 * Unit tests for the logout handler.
 * Tests session termination, validation, and redirect response.
 * Validates: Requirements 3.6
 */

import { handleLogout, validateLogoutRequest, LogoutHandlerDeps } from './logout';
import type { CognitoClient } from '../clients/cognito-client';

// --- Test helpers ---

function createMockDeps(): LogoutHandlerDeps {
  const cognitoClient: CognitoClient = {
    createUser: jest.fn().mockResolvedValue({ cognitoUserId: 'mock-id' }),
    refreshSession: jest.fn().mockResolvedValue(null),
    terminateSession: jest.fn().mockResolvedValue(undefined),
  };

  return { cognitoClient };
}

// --- validateLogoutRequest tests ---

describe('validateLogoutRequest', () => {
  it('returns null for valid request with sessionId', () => {
    const result = validateLogoutRequest({ sessionId: 'session-123' });
    expect(result).toBeNull();
  });

  it('returns error when body is null', () => {
    const result = validateLogoutRequest(null);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
    expect(result!.message).toBe('Request body is required');
  });

  it('returns error when body is undefined', () => {
    const result = validateLogoutRequest(undefined);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns error when body is not an object', () => {
    const result = validateLogoutRequest('string');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns error when sessionId is missing', () => {
    const result = validateLogoutRequest({});
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
    expect(result!.message).toBe('Session ID is required');
  });

  it('returns error when sessionId is empty string', () => {
    const result = validateLogoutRequest({ sessionId: '' });
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns error when sessionId is whitespace only', () => {
    const result = validateLogoutRequest({ sessionId: '   ' });
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns error when sessionId is not a string', () => {
    const result = validateLogoutRequest({ sessionId: 12345 });
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });
});

// --- handleLogout tests ---

describe('handleLogout', () => {
  describe('validation failures', () => {
    it('returns validation error for invalid request', async () => {
      const deps = createMockDeps();
      const result = await handleLogout(null, deps);

      expect('statusCode' in result).toBe(true);
      expect((result as any).statusCode).toBe(400);
    });

    it('does not call terminateSession when validation fails', async () => {
      const deps = createMockDeps();
      await handleLogout({}, deps);

      expect(deps.cognitoClient.terminateSession).not.toHaveBeenCalled();
    });
  });

  describe('successful logout', () => {
    it('returns success with redirect to login', async () => {
      const deps = createMockDeps();
      const result = await handleLogout({ sessionId: 'session-123' }, deps);

      expect((result as any).success).toBe(true);
      expect((result as any).message).toBe('Logged out successfully');
      expect((result as any).redirectTo).toBe('/login');
    });

    it('calls terminateSession with the session ID', async () => {
      const deps = createMockDeps();
      await handleLogout({ sessionId: 'session-abc' }, deps);

      expect(deps.cognitoClient.terminateSession).toHaveBeenCalledWith('session-abc');
    });
  });

  describe('session termination failure (graceful)', () => {
    it('still returns success even if terminateSession throws', async () => {
      const deps = createMockDeps();
      (deps.cognitoClient.terminateSession as jest.Mock).mockRejectedValue(
        new Error('Session already expired')
      );

      const result = await handleLogout({ sessionId: 'expired-session' }, deps);

      expect((result as any).success).toBe(true);
      expect((result as any).message).toBe('Logged out successfully');
      expect((result as any).redirectTo).toBe('/login');
    });
  });
});
