/**
 * Unit tests for the learner registration handler.
 * Tests validation, business rules, and the full registration flow.
 */

import {
  validateLearnerRegistration,
  handleRegisterLearner,
  LearnerRepository,
  PasswordHasher,
  AuthContext,
  RegisterLearnerDeps,
  MAX_LEARNERS_PER_PARENT,
  MAX_CUSTOM_SUBJECTS,
} from './register-learner';
import { LearnerRegistrationRequest } from '@chikumiku/types';
import { ConsentRepository } from './parental-consent';

// --- Test helpers ---

function validRequest(overrides?: Partial<LearnerRegistrationRequest>): LearnerRegistrationRequest {
  return {
    parentUsername: 'parent-user',
    username: 'learner-01',
    name: 'Test Learner',
    password: 'Pass1234!',
    gender: 'male',
    relationship: 'son',
    grade: '5th',
    schoolName: 'Delhi Public School',
    subjectIds: ['math-101'],
    customSubjects: [],
    ...overrides,
  };
}

function mockRepository(overrides?: Partial<LearnerRepository>): LearnerRepository {
  return {
    isUsernameTaken: jest.fn().mockResolvedValue(false),
    countLearnersByParent: jest.fn().mockResolvedValue(0),
    createLearner: jest.fn().mockResolvedValue('learner-uuid-123'),
    ...overrides,
  };
}

function mockHasher(): PasswordHasher {
  return {
    hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  };
}

function mockConsentRepository(overrides?: Partial<ConsentRepository>): ConsentRepository {
  return {
    hasActiveConsent: jest.fn().mockResolvedValue(true),
    getConsentStatus: jest.fn().mockResolvedValue({ hasConsented: true, consentedAt: '2024-01-01T00:00:00Z', consentVersion: '1.0' }),
    storeConsent: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockDeps(overrides?: { repository?: LearnerRepository; passwordHasher?: PasswordHasher; consentRepository?: ConsentRepository }): RegisterLearnerDeps {
  return {
    repository: overrides?.repository ?? mockRepository(),
    passwordHasher: overrides?.passwordHasher ?? mockHasher(),
    consentRepository: overrides?.consentRepository ?? mockConsentRepository(),
  };
}

const authContext: AuthContext = { parentUsername: 'parent-user', parentId: 'parent-id-123' };

// --- Validation tests ---

describe('validateLearnerRegistration', () => {
  it('accepts a valid request', () => {
    const result = validateLearnerRegistration(validRequest());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('rejects username too short', () => {
    const result = validateLearnerRegistration(validRequest({ username: 'short' }));
    expect(result.valid).toBe(false);
    expect(result.errors.username).toBeDefined();
  });

  it('rejects username too long', () => {
    const result = validateLearnerRegistration(validRequest({ username: 'a'.repeat(16) }));
    expect(result.valid).toBe(false);
    expect(result.errors.username).toBeDefined();
  });

  it('rejects username with uppercase', () => {
    const result = validateLearnerRegistration(validRequest({ username: 'Learner01' }));
    expect(result.valid).toBe(false);
    expect(result.errors.username).toBeDefined();
  });

  it('rejects name too short', () => {
    const result = validateLearnerRegistration(validRequest({ name: 'Ab' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rejects name with numbers', () => {
    const result = validateLearnerRegistration(validRequest({ name: 'Test Learner2' }));
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rejects weak password (no uppercase)', () => {
    const result = validateLearnerRegistration(validRequest({ password: 'pass1234!' }));
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it('rejects weak password (no special char)', () => {
    const result = validateLearnerRegistration(validRequest({ password: 'Pass1234x' }));
    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();
  });

  it('rejects invalid gender', () => {
    const result = validateLearnerRegistration(validRequest({ gender: 'unknown' as any }));
    expect(result.valid).toBe(false);
    expect(result.errors.gender).toBeDefined();
  });

  it('rejects invalid relationship', () => {
    const result = validateLearnerRegistration(validRequest({ relationship: 'cousin' as any }));
    expect(result.valid).toBe(false);
    expect(result.errors.relationship).toBeDefined();
  });

  it('rejects invalid grade', () => {
    const result = validateLearnerRegistration(validRequest({ grade: '13th' }));
    expect(result.valid).toBe(false);
    expect(result.errors.grade).toBeDefined();
  });

  it('accepts all valid grades', () => {
    const grades = ['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    for (const grade of grades) {
      const result = validateLearnerRegistration(validRequest({ grade }));
      expect(result.errors.grade).toBeUndefined();
    }
  });

  it('rejects school name too short', () => {
    const result = validateLearnerRegistration(validRequest({ schoolName: 'ABC' }));
    expect(result.valid).toBe(false);
    expect(result.errors.schoolName).toBeDefined();
  });

  it('rejects empty subject list', () => {
    const result = validateLearnerRegistration(validRequest({ subjectIds: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.subjectIds).toBeDefined();
  });

  it('rejects more than 5 custom subjects', () => {
    const customSubjects = Array.from({ length: 6 }, (_, i) => `Subject ${i + 1}`);
    const result = validateLearnerRegistration(validRequest({ customSubjects }));
    expect(result.valid).toBe(false);
    expect(result.errors.customSubjects).toBeDefined();
  });

  it('accepts exactly 5 custom subjects', () => {
    const customSubjects = Array.from({ length: 5 }, (_, i) => `Subject ${i + 1}`);
    const result = validateLearnerRegistration(validRequest({ customSubjects }));
    expect(result.errors.customSubjects).toBeUndefined();
  });

  it('rejects custom subject with empty name', () => {
    const result = validateLearnerRegistration(validRequest({ customSubjects: [''] }));
    expect(result.valid).toBe(false);
    expect(result.errors.customSubjects).toBeDefined();
  });

  it('rejects custom subject exceeding 50 chars', () => {
    const result = validateLearnerRegistration(validRequest({ customSubjects: ['A'.repeat(51)] }));
    expect(result.valid).toBe(false);
    expect(result.errors.customSubjects).toBeDefined();
  });

  it('collects multiple errors at once', () => {
    const result = validateLearnerRegistration(validRequest({
      username: 'x',
      name: 'AB',
      password: '123',
      gender: 'invalid' as any,
      subjectIds: [],
    }));
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(4);
  });
});

// --- Handler integration tests ---

describe('handleRegisterLearner', () => {
  it('creates learner successfully with valid request', async () => {
    const repo = mockRepository();
    const hasher = mockHasher();
    const deps = mockDeps({ repository: repo, passwordHasher: hasher });

    const result = await handleRegisterLearner(validRequest(), authContext, deps);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.learnerId).toBe('learner-uuid-123');
      expect(result.message).toContain('successfully');
    }
    expect(hasher.hash).toHaveBeenCalledWith('Pass1234!');
    expect(repo.createLearner).toHaveBeenCalledWith(
      expect.objectContaining({
        parentUsername: 'parent-user',
        username: 'learner-01',
        name: 'Test Learner',
        passwordHash: '$2b$10$hashedpassword',
      })
    );
  });

  it('pre-fills parent username from auth context', async () => {
    const repo = mockRepository();
    const deps = mockDeps({ repository: repo });
    const request = validRequest({ parentUsername: 'should-be-overridden' });

    await handleRegisterLearner(request, authContext, deps);

    expect(repo.createLearner).toHaveBeenCalledWith(
      expect.objectContaining({ parentUsername: 'parent-user' })
    );
  });

  it('returns validation error for invalid fields', async () => {
    const repo = mockRepository();
    const deps = mockDeps({ repository: repo });

    const result = await handleRegisterLearner(
      validRequest({ username: 'x' }),
      authContext,
      deps
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.statusCode).toBe(400);
      expect(result.error.errorCode).toBe('VALIDATION_ERROR');
      expect(result.error.details?.username).toBeDefined();
    }
    expect(repo.createLearner).not.toHaveBeenCalled();
  });

  it('returns error when max learners exceeded', async () => {
    const repo = mockRepository({
      countLearnersByParent: jest.fn().mockResolvedValue(MAX_LEARNERS_PER_PARENT),
    });
    const deps = mockDeps({ repository: repo });

    const result = await handleRegisterLearner(validRequest(), authContext, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.statusCode).toBe(400);
      expect(result.error.errorCode).toBe('MAX_LEARNERS_EXCEEDED');
    }
    expect(repo.createLearner).not.toHaveBeenCalled();
  });

  it('returns error when username is already taken', async () => {
    const repo = mockRepository({
      isUsernameTaken: jest.fn().mockResolvedValue(true),
    });
    const deps = mockDeps({ repository: repo });

    const result = await handleRegisterLearner(validRequest(), authContext, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.statusCode).toBe(409);
      expect(result.error.errorCode).toBe('USERNAME_TAKEN');
      expect(result.error.details?.username).toBeDefined();
    }
    expect(repo.createLearner).not.toHaveBeenCalled();
  });

  it('does not check DB if validation fails', async () => {
    const repo = mockRepository();
    const deps = mockDeps({ repository: repo });

    await handleRegisterLearner(
      validRequest({ subjectIds: [] }),
      authContext,
      deps
    );

    expect(repo.isUsernameTaken).not.toHaveBeenCalled();
    expect(repo.countLearnersByParent).not.toHaveBeenCalled();
  });

  it('checks max learners before username uniqueness', async () => {
    const callOrder: string[] = [];
    const repo: LearnerRepository = {
      isUsernameTaken: jest.fn().mockImplementation(async () => {
        callOrder.push('isUsernameTaken');
        return true;
      }),
      countLearnersByParent: jest.fn().mockImplementation(async () => {
        callOrder.push('countLearnersByParent');
        return MAX_LEARNERS_PER_PARENT;
      }),
      createLearner: jest.fn().mockResolvedValue('id'),
    };
    const deps = mockDeps({ repository: repo });

    const result = await handleRegisterLearner(validRequest(), authContext, deps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errorCode).toBe('MAX_LEARNERS_EXCEEDED');
    }
    // countLearnersByParent should be called first
    expect(callOrder[0]).toBe('countLearnersByParent');
  });

  it('stores custom subjects in learner record', async () => {
    const repo = mockRepository();
    const deps = mockDeps({ repository: repo });
    const customSubjects = ['Robotics', 'Vedic Maths'];

    await handleRegisterLearner(
      validRequest({ customSubjects }),
      authContext,
      deps
    );

    expect(repo.createLearner).toHaveBeenCalledWith(
      expect.objectContaining({ customSubjects })
    );
  });

  it('defaults customSubjects to empty array when not provided', async () => {
    const repo = mockRepository();
    const deps = mockDeps({ repository: repo });

    await handleRegisterLearner(
      validRequest({ customSubjects: undefined }),
      authContext,
      deps
    );

    expect(repo.createLearner).toHaveBeenCalledWith(
      expect.objectContaining({ customSubjects: [] })
    );
  });
});
