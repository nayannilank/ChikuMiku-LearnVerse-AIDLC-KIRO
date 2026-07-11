import {
  handleRegisterParent,
  validateParentRegistration,
  RegisterParentDependencies,
  RegisterParentResponse,
} from './register-parent';
import { ParentRegistrationRequest, APIError } from '@chikumiku/types';
import * as bcrypt from 'bcrypt';

// Helper to create a valid registration request
function validRequest(overrides: Partial<ParentRegistrationRequest> = {}): ParentRegistrationRequest {
  return {
    username: 'testparent1',
    fullName: 'Test Parent',
    phone: '9876543210',
    email: 'test@example.com',
    password: 'Passw0rd!',
    ...overrides,
  };
}

// Helper to create mock dependencies
function createMockDeps(overrides: Partial<RegisterParentDependencies> = {}): RegisterParentDependencies {
  return {
    dbClient: {
      parentUsernameExists: jest.fn().mockResolvedValue(false),
      createParent: jest.fn().mockResolvedValue({
        id: 'mock-id',
        username: 'testparent1',
        fullName: 'Test Parent',
        phone: '9876543210',
        email: 'test@example.com',
        passwordHash: 'hashed',
        createdAt: new Date().toISOString(),
      }),
    },
    cognitoClient: {
      createUser: jest.fn().mockResolvedValue({ cognitoUserId: 'cognito-123' }),
      refreshSession: jest.fn().mockResolvedValue(null),
      terminateSession: jest.fn().mockResolvedValue(undefined),
    },
    generateId: () => 'generated-uuid',
    ...overrides,
  };
}

function isAPIError(response: RegisterParentResponse | APIError): response is APIError {
  return 'statusCode' in response;
}

describe('validateParentRegistration', () => {
  it('returns valid for a correct request', () => {
    const result = validateParentRegistration(validRequest());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('returns errors for invalid username', () => {
    const result = validateParentRegistration(validRequest({ username: 'ab' }));
    expect(result.valid).toBe(false);
    expect(result.errors.username).toBeDefined();
  });

  it('returns errors for invalid full name', () => {
    const result = validateParentRegistration(validRequest({ fullName: 'Hi' }));
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toBeDefined();
  });

  it('returns errors for invalid phone', () => {
    const result = validateParentRegistration(validRequest({ phone: '123' }));
    expect(result.valid).toBe(false);
    expect(result.errors.phone).toBeDefined();
  });

  it('returns errors for invalid email', () => {
    const result = validateParentRegistration(validRequest({ email: 'notanemail' }));
    expect(result.valid).toBe(false);
    expect(result.errors.email).toBeDefined();
  });

  it('returns errors for invalid password', () => {
    const result = validateParentRegistration(validRequest({ password: 'short' }));
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const result = validateParentRegistration(validRequest({
      username: 'ab',
      phone: '123',
      password: 'weak',
    }));
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(2);
  });
});

describe('handleRegisterParent', () => {
  it('returns success with redirect countdown on valid registration', async () => {
    const deps = createMockDeps();
    const response = await handleRegisterParent(validRequest(), deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as RegisterParentResponse;
    expect(successResponse.success).toBe(true);
    expect(successResponse.redirectTo).toBe('/login');
    expect(successResponse.redirectCountdownSeconds).toBe(5);
    expect(successResponse.message).toContain('Registration is complete');
  });

  it('returns validation error for invalid fields without hitting DB', async () => {
    const deps = createMockDeps();
    const response = await handleRegisterParent(validRequest({ username: 'ab' }), deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.errorCode).toBe('VALIDATION_ERROR');
    expect(errorResponse.details?.username).toBeDefined();
    expect(deps.dbClient.parentUsernameExists).not.toHaveBeenCalled();
  });

  it('returns field-specific error when username is taken', async () => {
    const deps = createMockDeps({
      dbClient: {
        parentUsernameExists: jest.fn().mockResolvedValue(true),
        createParent: jest.fn(),
      },
    });
    const response = await handleRegisterParent(validRequest(), deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(409);
    expect(errorResponse.errorCode).toBe('USERNAME_TAKEN');
    expect(errorResponse.details?.username).toBeDefined();
    expect(deps.dbClient.createParent).not.toHaveBeenCalled();
  });

  it('hashes password with bcrypt cost factor >= 10', async () => {
    const deps = createMockDeps();
    await handleRegisterParent(validRequest(), deps);

    const createParentCall = (deps.dbClient.createParent as jest.Mock).mock.calls[0][0];
    const passwordHash = createParentCall.passwordHash;

    // Verify bcrypt hash is valid and uses cost factor >= 10
    const isValid = await bcrypt.compare('Passw0rd!', passwordHash);
    expect(isValid).toBe(true);

    // bcrypt hash format: $2b$<cost>$...
    const costFactor = parseInt(passwordHash.split('$')[2], 10);
    expect(costFactor).toBeGreaterThanOrEqual(10);
  });

  it('creates parent record in the database with correct fields', async () => {
    const deps = createMockDeps();
    const request = validRequest();
    await handleRegisterParent(request, deps);

    expect(deps.dbClient.createParent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-uuid',
        username: request.username,
        fullName: request.fullName,
        phone: request.phone,
        email: request.email,
      })
    );
  });

  it('creates Cognito user for session management', async () => {
    const deps = createMockDeps();
    const request = validRequest();
    await handleRegisterParent(request, deps);

    expect(deps.cognitoClient.createUser).toHaveBeenCalledWith({
      username: request.username,
      email: request.email,
      phone: request.phone,
      role: 'parent',
    });
  });

  it('uses the generateId function for the parent id', async () => {
    const customId = 'custom-uuid-1234';
    const deps = createMockDeps({ generateId: () => customId });
    await handleRegisterParent(validRequest(), deps);

    const createParentCall = (deps.dbClient.createParent as jest.Mock).mock.calls[0][0];
    expect(createParentCall.id).toBe(customId);
  });
});
