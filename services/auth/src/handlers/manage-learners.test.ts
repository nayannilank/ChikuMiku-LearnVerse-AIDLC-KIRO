/**
 * Unit tests for manage-learners handlers.
 * Tests validation, ownership checks, and business logic for all 4 endpoints.
 */

import {
  handleListLearners,
  handleEditLearner,
  handleResetLearnerPassword,
  handleDeleteLearner,
  validateEditLearnerRequest,
  ManageLearnerRepository,
  ManageLearnerPasswordHasher,
  ManageLearnerDeps,
  LearnerRecord,
  EditLearnerRequest,
  ResetLearnerPasswordRequest,
} from './manage-learners';
import type { APIError } from '@chikumiku/types';

// --- Test helpers ---

const PARENT_ID = 'parent-uuid-001';
const LEARNER_ID = 'learner-uuid-001';

function sampleLearner(overrides?: Partial<LearnerRecord & { parentId: string }>): LearnerRecord & { parentId: string } {
  return {
    id: LEARNER_ID,
    username: 'learner-01',
    name: 'Test Learner',
    gender: 'male',
    grade: '5th',
    schoolName: 'Delhi Public School',
    subjectIds: ['math-101', 'science-101'],
    customSubjects: [],
    parentId: PARENT_ID,
    ...overrides,
  };
}

function mockRepository(overrides?: Partial<ManageLearnerRepository>): ManageLearnerRepository {
  return {
    findLearnersByParentId: jest.fn().mockResolvedValue([sampleLearner()]),
    findLearnerById: jest.fn().mockResolvedValue(sampleLearner()),
    updateLearner: jest.fn().mockResolvedValue(undefined),
    updateLearnerPassword: jest.fn().mockResolvedValue(undefined),
    softDeleteLearner: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function mockPasswordHasher(): ManageLearnerPasswordHasher {
  return {
    hash: jest.fn().mockResolvedValue('$2b$10$newhashedpassword'),
  };
}

function makeDeps(overrides?: Partial<ManageLearnerDeps>): ManageLearnerDeps {
  return {
    repository: mockRepository(),
    passwordHasher: mockPasswordHasher(),
    ...overrides,
  };
}

function isError(result: unknown): result is APIError {
  return typeof result === 'object' && result !== null && 'statusCode' in result;
}

// --- validateEditLearnerRequest tests ---

describe('validateEditLearnerRequest', () => {
  it('accepts valid partial update with name only', () => {
    const result = validateEditLearnerRequest({ name: 'New Name' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('accepts valid update with all fields', () => {
    const result = validateEditLearnerRequest({
      name: 'Updated Name',
      grade: '8th',
      schoolName: 'New School Name',
      subjectIds: ['math-101'],
    });
    expect(result.valid).toBe(true);
  });

  it('accepts empty body (no fields to update)', () => {
    const result = validateEditLearnerRequest({});
    expect(result.valid).toBe(true);
  });

  it('rejects name too short', () => {
    const result = validateEditLearnerRequest({ name: 'Ab' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rejects name with numbers', () => {
    const result = validateEditLearnerRequest({ name: 'Name123' });
    expect(result.valid).toBe(false);
    expect(result.errors.name).toBeDefined();
  });

  it('rejects invalid grade', () => {
    const result = validateEditLearnerRequest({ grade: '13th' });
    expect(result.valid).toBe(false);
    expect(result.errors.grade).toBeDefined();
  });

  it('accepts all valid grades', () => {
    const grades = ['LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];
    for (const grade of grades) {
      const result = validateEditLearnerRequest({ grade });
      expect(result.errors.grade).toBeUndefined();
    }
  });

  it('rejects school name too short', () => {
    const result = validateEditLearnerRequest({ schoolName: 'ABC' });
    expect(result.valid).toBe(false);
    expect(result.errors.schoolName).toBeDefined();
  });

  it('rejects empty subject array (min 1 required)', () => {
    const result = validateEditLearnerRequest({ subjectIds: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.subjectIds).toBeDefined();
  });

  it('accepts subject array with 1 entry', () => {
    const result = validateEditLearnerRequest({ subjectIds: ['english-101'] });
    expect(result.valid).toBe(true);
  });

  it('collects multiple errors', () => {
    const result = validateEditLearnerRequest({
      name: 'x',
      grade: 'invalid',
      subjectIds: [],
    });
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors).length).toBe(3);
  });
});

// --- handleListLearners tests ---

describe('handleListLearners', () => {
  it('returns list of learners for parent', async () => {
    const deps = makeDeps();
    const result = await handleListLearners(PARENT_ID, deps);

    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.success).toBe(true);
      expect(result.learners).toHaveLength(1);
      expect(result.learners[0].name).toBe('Test Learner');
      expect(result.learners[0].gender).toBe('male');
      expect(result.learners[0].grade).toBe('5th');
    }
    expect(deps.repository.findLearnersByParentId).toHaveBeenCalledWith(PARENT_ID);
  });

  it('returns empty array when parent has no learners', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnersByParentId: jest.fn().mockResolvedValue([]),
      }),
    });
    const result = await handleListLearners(PARENT_ID, deps);

    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.learners).toHaveLength(0);
    }
  });
});

// --- handleEditLearner tests ---

describe('handleEditLearner', () => {
  it('updates learner name successfully', async () => {
    const deps = makeDeps();
    const body: EditLearnerRequest = { name: 'Updated Name' };

    const result = await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.success).toBe(true);
      expect(result.message).toContain('updated');
    }
    expect(deps.repository.updateLearner).toHaveBeenCalledWith(LEARNER_ID, { name: 'Updated Name' });
  });

  it('updates multiple fields at once', async () => {
    const deps = makeDeps();
    const body: EditLearnerRequest = {
      name: 'New Learner',
      grade: '8th',
      schoolName: 'Modern Academy',
      subjectIds: ['math-101', 'english-101'],
    };

    const result = await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(false);
    expect(deps.repository.updateLearner).toHaveBeenCalledWith(LEARNER_ID, body);
  });

  it('returns validation error for invalid name', async () => {
    const deps = makeDeps();
    const body: EditLearnerRequest = { name: 'Ab' };

    const result = await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(400);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.details?.name).toBeDefined();
    }
    expect(deps.repository.updateLearner).not.toHaveBeenCalled();
  });

  it('returns validation error for empty subjects', async () => {
    const deps = makeDeps();
    const body: EditLearnerRequest = { subjectIds: [] };

    const result = await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(400);
      expect(result.details?.subjectIds).toBeDefined();
    }
  });

  it('returns 404 when learner not found', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnerById: jest.fn().mockResolvedValue(null),
      }),
    });
    const body: EditLearnerRequest = { name: 'Valid Name' };

    const result = await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(404);
      expect(result.errorCode).toBe('NOT_FOUND');
    }
  });

  it('returns 403 when learner belongs to different parent', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnerById: jest.fn().mockResolvedValue(sampleLearner({ parentId: 'other-parent' })),
      }),
    });
    const body: EditLearnerRequest = { name: 'Valid Name' };

    const result = await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(403);
      expect(result.errorCode).toBe('FORBIDDEN');
    }
    expect(deps.repository.updateLearner).not.toHaveBeenCalled();
  });

  it('does not call repository if validation fails', async () => {
    const deps = makeDeps();
    const body: EditLearnerRequest = { name: 'x' };

    await handleEditLearner(LEARNER_ID, PARENT_ID, body, deps);

    expect(deps.repository.findLearnerById).not.toHaveBeenCalled();
  });
});

// --- handleResetLearnerPassword tests ---

describe('handleResetLearnerPassword', () => {
  it('resets password successfully with valid new password', async () => {
    const deps = makeDeps();
    const body: ResetLearnerPasswordRequest = { newPassword: 'NewPass1!' };

    const result = await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.success).toBe(true);
      expect(result.message).toContain('reset');
    }
    expect(deps.passwordHasher.hash).toHaveBeenCalledWith('NewPass1!', 10);
    expect(deps.repository.updateLearnerPassword).toHaveBeenCalledWith(
      LEARNER_ID,
      '$2b$10$newhashedpassword'
    );
  });

  it('returns generic validation error for weak password (no uppercase)', async () => {
    const deps = makeDeps();
    const body: ResetLearnerPasswordRequest = { newPassword: 'weakpass1!' };

    const result = await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(400);
      expect(result.errorCode).toBe('VALIDATION_ERROR');
      expect(result.message).toContain('password policy');
      // Requirement 16.3: single generic message, no field-specific details
      expect(result.details).toBeUndefined();
    }
  });

  it('returns generic validation error for password too short', async () => {
    const deps = makeDeps();
    const body: ResetLearnerPasswordRequest = { newPassword: 'Ab1!' };

    const result = await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('password policy');
    }
  });

  it('returns validation error when newPassword is empty', async () => {
    const deps = makeDeps();
    const body: ResetLearnerPasswordRequest = { newPassword: '' };

    const result = await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(400);
    }
  });

  it('returns 404 when learner not found', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnerById: jest.fn().mockResolvedValue(null),
      }),
    });
    const body: ResetLearnerPasswordRequest = { newPassword: 'ValidPass1!' };

    const result = await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(404);
    }
  });

  it('returns 403 when learner belongs to different parent', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnerById: jest.fn().mockResolvedValue(sampleLearner({ parentId: 'other-parent' })),
      }),
    });
    const body: ResetLearnerPasswordRequest = { newPassword: 'ValidPass1!' };

    const result = await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(403);
    }
    expect(deps.repository.updateLearnerPassword).not.toHaveBeenCalled();
  });

  it('does not query repository if password validation fails', async () => {
    const deps = makeDeps();
    const body: ResetLearnerPasswordRequest = { newPassword: 'weak' };

    await handleResetLearnerPassword(LEARNER_ID, PARENT_ID, body, deps);

    expect(deps.repository.findLearnerById).not.toHaveBeenCalled();
  });
});

// --- handleDeleteLearner tests ---

describe('handleDeleteLearner', () => {
  it('soft-deletes learner successfully', async () => {
    const deps = makeDeps();

    const result = await handleDeleteLearner(LEARNER_ID, PARENT_ID, deps);

    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.success).toBe(true);
      expect(result.message).toContain('removed');
    }
    expect(deps.repository.softDeleteLearner).toHaveBeenCalledWith(LEARNER_ID);
  });

  it('returns 404 when learner not found', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnerById: jest.fn().mockResolvedValue(null),
      }),
    });

    const result = await handleDeleteLearner(LEARNER_ID, PARENT_ID, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(404);
      expect(result.errorCode).toBe('NOT_FOUND');
    }
    expect(deps.repository.softDeleteLearner).not.toHaveBeenCalled();
  });

  it('returns 403 when learner belongs to different parent', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        findLearnerById: jest.fn().mockResolvedValue(sampleLearner({ parentId: 'other-parent' })),
      }),
    });

    const result = await handleDeleteLearner(LEARNER_ID, PARENT_ID, deps);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.statusCode).toBe(403);
      expect(result.errorCode).toBe('FORBIDDEN');
    }
    expect(deps.repository.softDeleteLearner).not.toHaveBeenCalled();
  });

  it('propagates repository errors (atomic failure)', async () => {
    const deps = makeDeps({
      repository: mockRepository({
        softDeleteLearner: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      }),
    });

    await expect(handleDeleteLearner(LEARNER_ID, PARENT_ID, deps)).rejects.toThrow('Transaction failed');
  });
});
