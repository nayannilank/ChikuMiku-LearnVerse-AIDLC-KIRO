/**
 * Unit tests for the concrete AWS Cognito client.
 * Verifies createUser issues AdminCreateUser with the right params and returns
 * the cognito user id, plus the refresh/sign-out behaviors, using an injected
 * fake SDK client (no real AWS calls).
 */

import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AwsCognitoClient } from './aws-cognito-client';

// Minimal fake of the SDK client: records send() calls and returns a canned
// response supplied per-test.
function createFakeSdkClient(response: unknown = {}) {
  const send = jest.fn().mockResolvedValue(response);
  return {
    client: { send } as unknown as import('@aws-sdk/client-cognito-identity-provider').CognitoIdentityProviderClient,
    send,
  };
}

const USER_POOL_ID = 'us-east-1_pool123';
const CLIENT_ID = 'app-client-abc';

describe('AwsCognitoClient.createUser', () => {
  it('issues AdminCreateUser with the right params and returns the cognitoUserId', async () => {
    const { client, send } = createFakeSdkClient({
      User: {
        Username: 'testparent1',
        Attributes: [{ Name: 'sub', Value: 'cognito-sub-uuid' }],
      },
    });

    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    const result = await cognito.createUser({
      username: 'testparent1',
      email: 'test@example.com',
      phone: '9876543210',
      password: 'Str0ngPass!',
      role: 'parent',
      appUserId: 'parent-db-uuid',
    });

    expect(result).toEqual({ cognitoUserId: 'cognito-sub-uuid' });

    // Two commands: AdminCreateUser, then AdminSetUserPassword (permanent).
    expect(send).toHaveBeenCalledTimes(2);
    const createCommand = send.mock.calls[0][0];
    expect(createCommand).toBeInstanceOf(AdminCreateUserCommand);
    expect(createCommand.input).toEqual({
      UserPoolId: USER_POOL_ID,
      Username: 'testparent1',
      MessageAction: 'SUPPRESS',
      UserAttributes: [
        { Name: 'email', Value: 'test@example.com' },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'phone_number', Value: '9876543210' },
        { Name: 'custom:role', Value: 'parent' },
        { Name: 'custom:appUserId', Value: 'parent-db-uuid' },
      ],
    });

    const pwCommand = send.mock.calls[1][0];
    expect(pwCommand).toBeInstanceOf(AdminSetUserPasswordCommand);
    expect(pwCommand.input).toEqual({
      UserPoolId: USER_POOL_ID,
      Username: 'testparent1',
      Password: 'Str0ngPass!',
      Permanent: true,
    });
  });

  it('omits email/phone attributes for a username-only (learner) account', async () => {
    const { client, send } = createFakeSdkClient({
      User: { Attributes: [{ Name: 'sub', Value: 'learner-sub' }] },
    });
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    await cognito.createUser({
      username: 'kiddo',
      password: 'Str0ngPass!',
      role: 'learner',
      appUserId: 'learner-db-uuid',
    });

    const createCommand = send.mock.calls[0][0];
    expect(createCommand).toBeInstanceOf(AdminCreateUserCommand);
    // No email / email_verified / phone_number for a username-only learner.
    expect(createCommand.input.UserAttributes).toEqual([
      { Name: 'custom:role', Value: 'learner' },
      { Name: 'custom:appUserId', Value: 'learner-db-uuid' },
    ]);
  });

  it('falls back to the returned Username when no sub attribute is present', async () => {
    const { client } = createFakeSdkClient({ User: { Username: 'fallback-user' } });
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, client });

    const result = await cognito.createUser({
      username: 'fallback-user',
      email: 'a@b.com',
      phone: '1112223333',
      password: 'Str0ngPass!',
      role: 'learner',
      appUserId: 'learner-db-uuid',
    });

    expect(result).toEqual({ cognitoUserId: 'fallback-user' });
  });

  it('reads the User Pool id from COGNITO_USER_POOL_ID when not passed', async () => {
    const { client, send } = createFakeSdkClient({ User: { Attributes: [{ Name: 'sub', Value: 's' }] } });
    const prev = process.env.COGNITO_USER_POOL_ID;
    process.env.COGNITO_USER_POOL_ID = 'env-pool-id';
    try {
      const cognito = new AwsCognitoClient({ client });
      await cognito.createUser({ username: 'u', email: 'e@x.com', phone: '1234567890', password: 'Str0ngPass!', role: 'parent', appUserId: 'id-1' });
      expect(send.mock.calls[0][0].input.UserPoolId).toBe('env-pool-id');
    } finally {
      process.env.COGNITO_USER_POOL_ID = prev;
    }
  });

  it('throws a clear error when the User Pool id is not configured', async () => {
    const { client } = createFakeSdkClient();
    const prev = process.env.COGNITO_USER_POOL_ID;
    delete process.env.COGNITO_USER_POOL_ID;
    try {
      const cognito = new AwsCognitoClient({ client });
      await expect(
        cognito.createUser({ username: 'u', email: 'e@x.com', phone: '1234567890', password: 'Str0ngPass!', role: 'parent', appUserId: 'id-1' })
      ).rejects.toThrow(/User Pool id is not configured/);
    } finally {
      if (prev !== undefined) process.env.COGNITO_USER_POOL_ID = prev;
    }
  });

  it('throws when AdminCreateUser returns no user id', async () => {
    const { client } = createFakeSdkClient({ User: {} });
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, client });

    await expect(
      cognito.createUser({ username: 'u', email: 'e@x.com', phone: '1234567890', password: 'Str0ngPass!', role: 'parent', appUserId: 'id-1' })
    ).rejects.toThrow(/did not return a user id/);
  });
});

describe('AwsCognitoClient.authenticate', () => {
  it('issues InitiateAuth USER_PASSWORD_AUTH and returns the tokens', async () => {
    const { client, send } = createFakeSdkClient({
      AuthenticationResult: {
        IdToken: 'id-token',
        AccessToken: 'access-token',
        RefreshToken: 'refresh-token',
        ExpiresIn: 3600,
      },
    });
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    const tokens = await cognito.authenticate('alice', 'Str0ngPass!');

    expect(tokens).toEqual({
      idToken: 'id-token',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(InitiateAuthCommand);
    expect(command.input).toEqual({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: { USERNAME: 'alice', PASSWORD: 'Str0ngPass!' },
    });
  });

  it('returns null when the result is missing tokens', async () => {
    const { client } = createFakeSdkClient({ AuthenticationResult: {} });
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });
    expect(await cognito.authenticate('alice', 'x')).toBeNull();
  });

  it('returns null when the SDK call throws (invalid credentials)', async () => {
    const send = jest.fn().mockRejectedValue(new Error('NotAuthorizedException'));
    const client = { send } as unknown as import('@aws-sdk/client-cognito-identity-provider').CognitoIdentityProviderClient;
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });
    expect(await cognito.authenticate('alice', 'wrong')).toBeNull();
  });
});

describe('AwsCognitoClient.refreshSession', () => {
  it('issues InitiateAuth REFRESH_TOKEN_AUTH and returns the new token', async () => {
    const { client, send } = createFakeSdkClient({
      AuthenticationResult: { AccessToken: 'new-access-token', ExpiresIn: 3600 },
    });
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    const result = await cognito.refreshSession('refresh-token-xyz');

    expect(result).toEqual({ accessToken: 'new-access-token', expiresIn: 3600 });
    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(InitiateAuthCommand);
    expect(command.input).toEqual({
      ClientId: CLIENT_ID,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: 'refresh-token-xyz' },
    });
  });

  it('returns null when the refresh yields no authentication result', async () => {
    const { client } = createFakeSdkClient({});
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    expect(await cognito.refreshSession('rt')).toBeNull();
  });

  it('returns null when the SDK call throws (expired/invalid token)', async () => {
    const send = jest.fn().mockRejectedValue(new Error('NotAuthorizedException'));
    const client = { send } as unknown as import('@aws-sdk/client-cognito-identity-provider').CognitoIdentityProviderClient;
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    expect(await cognito.refreshSession('rt')).toBeNull();
  });
});

describe('AwsCognitoClient.terminateSession', () => {
  it('issues GlobalSignOut with the access token', async () => {
    const { client, send } = createFakeSdkClient({});
    const cognito = new AwsCognitoClient({ userPoolId: USER_POOL_ID, clientId: CLIENT_ID, client });

    await cognito.terminateSession('access-token-abc');

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(GlobalSignOutCommand);
    expect(command.input).toEqual({ AccessToken: 'access-token-abc' });
  });
});
