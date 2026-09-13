/**
 * Unit tests for the POST/GET /auth/consent routes.
 *
 * NeonConsentRepository is mocked so no real DB calls are made.
 */
import type { APIGatewayProxyEvent } from 'aws-lambda';

const hasActiveConsentMock = jest.fn();
const getConsentStatusMock = jest.fn();
const storeConsentMock = jest.fn();

jest.mock('./clients/neon-consent-repository', () => ({
  NeonConsentRepository: jest.fn().mockImplementation(() => ({
    hasActiveConsent: (...args: unknown[]) => hasActiveConsentMock(...args),
    getConsentStatus: (...args: unknown[]) => getConsentStatusMock(...args),
    storeConsent: (...args: unknown[]) => storeConsentMock(...args),
  })),
}));

// Imported after the mock is registered.
import { handler } from './lambda';

function consentEvent(
  method: 'GET' | 'POST',
  body?: unknown,
  claims?: Record<string, string>
): APIGatewayProxyEvent {
  return {
    httpMethod: method,
    path: '/auth/consent',
    body: body !== undefined ? JSON.stringify(body) : null,
    requestContext: claims
      ? { authorizer: { claims } }
      : {},
  } as unknown as APIGatewayProxyEvent;
}

const PARENT_CLAIMS = {
  'custom:appUserId': 'parent-db-id-1',
  'cognito:username': 'testparent',
  'custom:role': 'parent',
};

describe('POST /auth/consent', () => {
  beforeEach(() => {
    hasActiveConsentMock.mockReset();
    getConsentStatusMock.mockReset();
    storeConsentMock.mockReset();
  });

  it('returns 401 when there is no authenticated parent', async () => {
    const res = await handler(consentEvent('POST', { consentGranted: true }));

    expect(res.statusCode).toBe(401);
    expect(storeConsentMock).not.toHaveBeenCalled();
  });

  it('returns 400 when consentGranted is not explicitly true', async () => {
    const res = await handler(consentEvent('POST', { consentGranted: false }, PARENT_CLAIMS));

    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).errorCode).toBe('CONSENT_REQUIRED');
    expect(storeConsentMock).not.toHaveBeenCalled();
  });

  it('stores consent for the authenticated parent and returns 200', async () => {
    storeConsentMock.mockResolvedValue(undefined);

    const res = await handler(consentEvent('POST', { consentGranted: true }, PARENT_CLAIMS));

    expect(storeConsentMock).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'parent-db-id-1' })
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).success).toBe(true);
  });
});

describe('GET /auth/consent', () => {
  beforeEach(() => {
    hasActiveConsentMock.mockReset();
    getConsentStatusMock.mockReset();
    storeConsentMock.mockReset();
  });

  it('returns 401 when there is no authenticated parent', async () => {
    const res = await handler(consentEvent('GET', undefined));

    expect(res.statusCode).toBe(401);
    expect(getConsentStatusMock).not.toHaveBeenCalled();
  });

  it('returns the consent status for the authenticated parent', async () => {
    getConsentStatusMock.mockResolvedValue({
      hasConsented: true,
      consentedAt: '2026-01-01T00:00:00.000Z',
      consentVersion: '1.0',
    });

    const res = await handler(consentEvent('GET', undefined, PARENT_CLAIMS));

    expect(getConsentStatusMock).toHaveBeenCalledWith('parent-db-id-1');
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      hasConsented: true,
      consentedAt: '2026-01-01T00:00:00.000Z',
      consentVersion: '1.0',
    });
  });
});
