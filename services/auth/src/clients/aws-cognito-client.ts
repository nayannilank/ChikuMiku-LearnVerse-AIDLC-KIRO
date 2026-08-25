/**
 * AWS Cognito client (concrete CognitoClient).
 *
 * Implements the auth service's `CognitoClient` interface against a Cognito
 * User Pool using @aws-sdk/client-cognito-identity-provider:
 *
 *   createUser        -> AdminCreateUser (admin-provisioned account, invite
 *                        email suppressed since we drive our own flow)
 *   refreshSession    -> InitiateAuth with the REFRESH_TOKEN_AUTH flow, where
 *                        the passed sessionId is the Cognito refresh token
 *   terminateSession  -> GlobalSignOut, where the passed sessionId is the
 *                        user's access token
 *
 * The User Pool id and app client id come from the constructor or, when
 * omitted, the COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID environment variables
 * (wired by the auth CDK stack). The underlying SDK client is injectable as a
 * test seam, matching the constructor style in the AI Gateway's
 * AwsSecretsManagerClient.
 *
 * Requirements: 20.2
 */

import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { CognitoClient, AuthTokens } from './cognito-client';

/** Options for constructing the AWS Cognito client. */
export interface AwsCognitoClientOptions {
  /** Cognito User Pool id. Defaults to the COGNITO_USER_POOL_ID env var. */
  userPoolId?: string;
  /** Cognito app client id. Defaults to the COGNITO_CLIENT_ID env var. */
  clientId?: string;
  /** Injectable underlying SDK client (defaults to a new client). */
  client?: CognitoIdentityProviderClient;
}

/**
 * Concrete Cognito client backed by a User Pool. Provisions users for session
 * management and supports refresh/sign-out. Reads pool/client configuration
 * from the constructor or environment; resolves the SDK client lazily so the
 * constructor stays side-effect free.
 */
export class AwsCognitoClient implements CognitoClient {
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId?: string;
  private readonly clientId?: string;

  constructor(options: AwsCognitoClientOptions = {}) {
    this.userPoolId = options.userPoolId ?? process.env.COGNITO_USER_POOL_ID;
    this.clientId = options.clientId ?? process.env.COGNITO_CLIENT_ID;
    this.client = options.client ?? new CognitoIdentityProviderClient({});
  }

  async createUser(params: {
    username: string;
    email?: string;
    phone?: string;
    password: string;
    role: 'parent' | 'learner';
    appUserId: string;
  }): Promise<{ cognitoUserId: string }> {
    const userPoolId = this.requireUserPoolId();

    // Email/phone are optional: parents provide them, learners are
    // username-only. Omit the corresponding attributes when absent.
    const userAttributes: { Name: string; Value: string }[] = [];
    if (params.email) {
      userAttributes.push({ Name: 'email', Value: params.email });
      userAttributes.push({ Name: 'email_verified', Value: 'true' });
    }
    if (params.phone) {
      userAttributes.push({ Name: 'phone_number', Value: params.phone });
    }
    userAttributes.push({ Name: 'custom:role', Value: params.role });
    // Links the Cognito identity to the application DB row. The JWT authorizer
    // surfaces this as the `custom:appUserId` claim, which downstream services
    // use for DB lookups (the Cognito `sub` is a different value from the DB id).
    userAttributes.push({ Name: 'custom:appUserId', Value: params.appUserId });

    const response = await this.client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: params.username,
        // We own the verification/notification flow, so suppress the default
        // Cognito invitation email.
        MessageAction: 'SUPPRESS',
        UserAttributes: userAttributes,
      })
    );

    // The immutable Cognito user id is the `sub` attribute; fall back to the
    // username Cognito echoes back if `sub` is somehow absent.
    const sub = response.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
    const cognitoUserId = sub ?? response.User?.Username;

    if (!cognitoUserId) {
      throw new Error('AdminCreateUser did not return a user id (sub/Username)');
    }

    // Set the password as PERMANENT so the account is immediately usable for
    // USER_PASSWORD_AUTH login (AdminCreateUser alone leaves the user in
    // FORCE_CHANGE_PASSWORD with no usable password).
    await this.client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: params.username,
        Password: params.password,
        Permanent: true,
      })
    );

    return { cognitoUserId };
  }

  async authenticate(
    username: string,
    password: string
  ): Promise<AuthTokens | null> {
    const clientId = this.requireClientId();

    try {
      const response = await this.client.send(
        new InitiateAuthCommand({
          ClientId: clientId,
          AuthFlow: 'USER_PASSWORD_AUTH',
          AuthParameters: { USERNAME: username, PASSWORD: password },
        })
      );

      const result = response.AuthenticationResult;
      if (!result?.IdToken || !result.AccessToken || result.ExpiresIn == null) {
        return null;
      }

      return {
        idToken: result.IdToken,
        accessToken: result.AccessToken,
        refreshToken: result.RefreshToken,
        expiresIn: result.ExpiresIn,
      };
    } catch {
      // Invalid credentials / unconfirmed user are normal auth failures, not
      // error conditions — surface as null so the route returns 401.
      return null;
    }
  }

  async refreshSession(
    sessionId: string
  ): Promise<{ accessToken: string; expiresIn: number } | null> {
    const clientId = this.requireClientId();

    try {
      const response = await this.client.send(
        new InitiateAuthCommand({
          ClientId: clientId,
          AuthFlow: 'REFRESH_TOKEN_AUTH',
          AuthParameters: { REFRESH_TOKEN: sessionId },
        })
      );

      const result = response.AuthenticationResult;
      if (!result?.AccessToken || result.ExpiresIn == null) {
        return null;
      }

      return { accessToken: result.AccessToken, expiresIn: result.ExpiresIn };
    } catch {
      // A failed/expired refresh is a normal outcome, not an error condition.
      return null;
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    // `sessionId` is the user's access token; GlobalSignOut invalidates all
    // refresh tokens issued to that user.
    await this.client.send(
      new GlobalSignOutCommand({ AccessToken: sessionId })
    );
  }

  private requireUserPoolId(): string {
    if (!this.userPoolId) {
      throw new Error(
        'Cognito User Pool id is not configured (set COGNITO_USER_POOL_ID or pass userPoolId)'
      );
    }
    return this.userPoolId;
  }

  private requireClientId(): string {
    if (!this.clientId) {
      throw new Error(
        'Cognito app client id is not configured (set COGNITO_CLIENT_ID or pass clientId)'
      );
    }
    return this.clientId;
  }
}
