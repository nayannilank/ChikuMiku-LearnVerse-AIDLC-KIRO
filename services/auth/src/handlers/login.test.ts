/**
 * Unit tests for the login handler.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 20.3
 */

import {
  handleLogin,
  validateLoginRequest,
  LoginHandlerDeps,
  IUserRepository,
  ICognitoClient,
  IPasswordHasher,
  UserRecord,
} from './login';

// --- Test helpers ---

function createMockDeps(overrides?: Partial<LoginHandlerDeps>): LoginHandlerDeps {
  const userRepository: IUserRepository = {
    findByUsernameAndRole: jest.fn().mockResolvedValue(null),
  };

  const cognitoClient: ICognitoClient = {
    createSession: jest.fn().mockResolvedValue({
      accessToken: 'mock-jwt-token',
      expiresIn: 3600,
      sessionId: 'mock-session-id',
    }),
  };

  const passwordHasher: IPasswordHasher = {
    compare: jest.fn().mockResolvedValue(false),
  };

  return { userRepository, cognitoClient, passwordHasher, ...overrides };
}

const validParentUser: UserRecord = {
  id: 'user-123',
  username: 'parentuser',
  role: 'parent',
  passwordHash: '$2b$10$hashedpassword',
};

const validLearnerUser: UserRecord = {
  id: 'learner-456',
  username: 'learneruser',
  role: 'learner',
  passwordHash: '$2b$10$hashedpassword',
};

// --- validateLoginRequest tests ---

describe('validateLoginRequest', () => {
  it('returns null for valid request with parent role', () => {
    const result = validateLoginRequest({
      role: 'parent',
      username: 'testuser',
      password: 'Password1!',
    });
    expect(result).toBeNull();
  });

  it('returns null for valid request with learner role', () => {
    const result = validateLoginRequest({
      role: 'learner',
      username: 'testlearner',
      password: 'Password1!',
    });
    expect(result).toBeNull();
  });

  it('returns error when body is null', () => {
    const result = validateLoginRequest(null);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
    expect(result!.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns error when body is undefined', () => {
    const result = validateLoginRequest(undefined);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('returns error when role is missing', () => {
    const result = validateLoginRequest({ username: 'test', password: 'pass' });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('role');
  });

  it('returns error when role is invalid value', () => {
    const result = validateLoginRequest({
      role: 'admin',
      username: 'test',
      password: 'pass',
    });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('role');
  });

  it('returns error when username is missing', () => {
    const result = validateLoginRequest({ role: 'parent', password: 'pass' });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('username');
  });

  it('returns error when username is empty string', () => {
    const result = validateLoginRequest({
      role: 'parent',
      username: '',
      password: 'pass',
    });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('username');
  });

  it('returns error when username is whitespace only', () => {
    const result = validateLoginRequest({
      role: 'parent',
      username: '   ',
      password: 'pass',
    });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('username');
  });

  it('returns error when password is missing', () => {
    const result = validateLoginRequest({ role: 'parent', username: 'test' });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('password');
  });

  it('returns error when password is empty string', () => {
    const result = validateLoginRequest({
      role: 'parent',
      username: 'test',
      password: '',
    });
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('password');
  });

  it('returns errors for multiple missing fields', () => {
    const result = validateLoginRequest({});
    expect(result).not.toBeNull();
    expect(result!.details).toHaveProperty('role');
    expect(result!.details).toHaveProperty('username');
    expect(result!.details).toHaveProperty('password');
  });
});

// --- handleLogin tests ---

describe('handleLogin', () => {
  describe('validation failures', () => {
    it('returns 400 when request body is invalid', async () => {
      const deps = createMockDeps();
      const result = await handleLogin(null, deps);

      expect('success' in result).toBe(false);
      expect((result as any).statusCode).toBe(400);
    });

    it('returns 400 when required fields are missing', async () => {
      const deps = createMockDeps();
      const result = await handleLogin({ role: 'parent' }, deps);

      expect('success' in result).toBe(false);
      expect((result as any).statusCode).toBe(400);
      expect((result as any).errorCode).toBe('VALIDATION_ERROR');
    });

    it('does not call database when validation fails', async () => {
      const deps = createMockDeps();
      await handleLogin({}, deps);

      expect(deps.userRepository.findByUsernameAndRole).not.toHaveBeenCalled();
    });
  });

  describe('authentication failures', () => {
    it('returns generic error when user not found', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(null);

      const result = await handleLogin(
        { role: 'parent', username: 'nonexistent', password: 'Pass1!' },
        deps
      );

      expect('success' in result).toBe(false);
      expect((result as any).statusCode).toBe(401);
      expect((result as any).message).toBe('Invalid credentials');
      expect((result as any).details).toBeUndefined();
    });

    it('returns generic error when password is wrong', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validParentUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(false);

      const result = await handleLogin(
        { role: 'parent', username: 'parentuser', password: 'WrongPass1!' },
        deps
      );

      expect('success' in result).toBe(false);
      expect((result as any).statusCode).toBe(401);
      expect((result as any).message).toBe('Invalid credentials');
    });

    it('does not reveal whether username or password is incorrect', async () => {
      const deps = createMockDeps();
      // User not found
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(null);
      const resultNoUser = await handleLogin(
        { role: 'parent', username: 'nouser', password: 'Pass1!' },
        deps
      );

      // Wrong password
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validParentUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(false);
      const resultBadPass = await handleLogin(
        { role: 'parent', username: 'parentuser', password: 'Wrong1!' },
        deps
      );

      // Both should produce identical error structure
      expect((resultNoUser as any).message).toBe((resultBadPass as any).message);
      expect((resultNoUser as any).statusCode).toBe((resultBadPass as any).statusCode);
      expect((resultNoUser as any).errorCode).toBe((resultBadPass as any).errorCode);
    });

    it('returns generic error when role does not match', async () => {
      const deps = createMockDeps();
      // findByUsernameAndRole returns null because role doesn't match
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(null);

      const result = await handleLogin(
        { role: 'learner', username: 'parentuser', password: 'Pass1!' },
        deps
      );

      expect('success' in result).toBe(false);
      expect((result as any).statusCode).toBe(401);
      expect((result as any).message).toBe('Invalid credentials');
    });
  });

  describe('successful authentication', () => {
    it('returns success with token for parent login', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validParentUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      const result = await handleLogin(
        { role: 'parent', username: 'parentuser', password: 'ValidPass1!' },
        deps
      );

      expect((result as any).success).toBe(true);
      expect((result as any).token).toBe('mock-jwt-token');
      expect((result as any).expiresIn).toBe(3600);
      expect((result as any).role).toBe('parent');
      expect((result as any).userId).toBe('user-123');
    });

    it('returns success with token for learner login', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validLearnerUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      const result = await handleLogin(
        { role: 'learner', username: 'learneruser', password: 'ValidPass1!' },
        deps
      );

      expect((result as any).success).toBe(true);
      expect((result as any).token).toBe('mock-jwt-token');
      expect((result as any).role).toBe('learner');
      expect((result as any).userId).toBe('learner-456');
    });

    it('creates Cognito session with 30-day persistence and 60-min token expiry', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validParentUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      await handleLogin(
        { role: 'parent', username: 'parentuser', password: 'ValidPass1!' },
        deps
      );

      expect(deps.cognitoClient.createSession).toHaveBeenCalledWith(
        'user-123',
        'parent',
        { sessionDurationDays: 30, tokenExpiryMinutes: 60 }
      );
    });

    it('looks up user with correct username and role', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validLearnerUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      await handleLogin(
        { role: 'learner', username: 'learneruser', password: 'ValidPass1!' },
        deps
      );

      expect(deps.userRepository.findByUsernameAndRole).toHaveBeenCalledWith(
        'learneruser',
        'learner'
      );
    });

    it('compares provided password against stored hash', async () => {
      const deps = createMockDeps();
      (deps.userRepository.findByUsernameAndRole as jest.Mock).mockResolvedValue(validParentUser);
      (deps.passwordHasher.compare as jest.Mock).mockResolvedValue(true);

      await handleLogin(
        { role: 'parent', username: 'parentuser', password: 'MySecret1!' },
        deps
      );

      expect(deps.passwordHasher.compare).toHaveBeenCalledWith(
        'MySecret1!',
        '$2b$10$hashedpassword'
      );
    });
  });
});
