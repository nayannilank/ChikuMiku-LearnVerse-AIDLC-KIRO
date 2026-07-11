/**
 * Unit tests for POST /export/report handler.
 * Requirements: 17.5, 20.4
 */

import {
  handleExportReport,
  validateExportRequest,
  generateCsvReport,
  generatePdfReport,
} from './export-report';
import type {
  AuthContext,
  ExportReportDeps,
  LearnerProgressData,
  LearnerProgressRepository,
  ReportStorageClient,
} from './export-report';
import type { APIError } from '@chikumiku/types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

const now = new Date('2024-06-15T10:05:00.000Z');
const recentVerification = new Date(now.getTime() - 2 * 60_000); // 2 minutes ago (within window)
const expiredVerification = new Date(now.getTime() - 6 * 60_000); // 6 minutes ago (outside window)

const parentAuth: AuthContext = {
  userId: 'parent-123',
  username: 'testparent',
  role: 'parent',
};

const learnerAuth: AuthContext = {
  userId: 'learner-456',
  username: 'testlearner',
  role: 'learner',
};

const sampleProgress: LearnerProgressData[] = [
  {
    learnerId: 'learner-1',
    learnerName: 'Alice',
    overallCompletion: 75,
    subjects: [
      {
        subjectName: 'Mathematics',
        averageScore: 85,
        completionPercentage: 80,
        chaptersCompleted: 8,
        totalChapters: 10,
      },
      {
        subjectName: 'English',
        averageScore: 90,
        completionPercentage: 70,
        chaptersCompleted: 7,
        totalChapters: 10,
      },
    ],
    activityHistory: [
      {
        date: '2024-06-14',
        type: 'quiz',
        subjectName: 'Mathematics',
        chapterName: 'Algebra Basics',
        score: 88,
        durationMinutes: 15,
      },
      {
        date: '2024-06-13',
        type: 'reading',
        subjectName: 'English',
        chapterName: 'Grammar Rules',
        durationMinutes: 20,
      },
    ],
  },
];

function createMockDeps(overrides?: Partial<ExportReportDeps>): ExportReportDeps {
  const mockRepository: LearnerProgressRepository = {
    getLearnerIdsByParent: jest.fn().mockResolvedValue(['learner-1']),
    getProgressForLearners: jest.fn().mockResolvedValue(sampleProgress),
  };

  const mockStorage: ReportStorageClient = {
    uploadReport: jest.fn().mockResolvedValue('exports/parent-123/report.csv'),
    getPresignedUrl: jest.fn().mockResolvedValue('https://s3.amazonaws.com/bucket/report.csv?signed=true'),
  };

  return {
    learnerProgressRepository: mockRepository,
    reportStorageClient: mockStorage,
    isSensitiveActionAuthorized: (lastVerifiedAt, currentTime) => {
      if (lastVerifiedAt === null) return false;
      const elapsed = currentTime.getTime() - lastVerifiedAt.getTime();
      return elapsed >= 0 && elapsed < 5 * 60 * 1000;
    },
    ...overrides,
  };
}

// ─── Validation Tests ────────────────────────────────────────────────────────

describe('validateExportRequest', () => {
  it('should return error when body is null', () => {
    const result = validateExportRequest(null);
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
    expect(result!.message).toContain('Request body is required');
  });

  it('should return error when body is not an object', () => {
    const result = validateExportRequest('invalid');
    expect(result).not.toBeNull();
    expect(result!.statusCode).toBe(400);
  });

  it('should return error when parentId is missing', () => {
    const result = validateExportRequest({ format: 'csv' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('parentId is required');
  });

  it('should return error when parentId is empty', () => {
    const result = validateExportRequest({ parentId: '  ', format: 'csv' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('parentId is required');
  });

  it('should return error when format is missing', () => {
    const result = validateExportRequest({ parentId: 'parent-123' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('format must be');
  });

  it('should return error when format is invalid', () => {
    const result = validateExportRequest({ parentId: 'parent-123', format: 'docx' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('format must be "pdf" or "csv"');
  });

  it('should return error when learnerIds is not an array', () => {
    const result = validateExportRequest({ parentId: 'parent-123', format: 'csv', learnerIds: 'not-array' });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('learnerIds must be an array');
  });

  it('should return error when learnerIds contains empty strings', () => {
    const result = validateExportRequest({ parentId: 'parent-123', format: 'csv', learnerIds: ['id1', ''] });
    expect(result).not.toBeNull();
    expect(result!.message).toContain('non-empty string');
  });

  it('should return null for valid request without learnerIds', () => {
    const result = validateExportRequest({ parentId: 'parent-123', format: 'pdf' });
    expect(result).toBeNull();
  });

  it('should return null for valid request with learnerIds', () => {
    const result = validateExportRequest({ parentId: 'parent-123', format: 'csv', learnerIds: ['l1', 'l2'] });
    expect(result).toBeNull();
  });
});

// ─── Report Generation Tests ─────────────────────────────────────────────────

describe('generateCsvReport', () => {
  it('should generate CSV with header and subject rows', () => {
    const csv = generateCsvReport(sampleProgress);
    const lines = csv.split('\n');

    expect(lines[0]).toBe('Learner Name,Subject,Average Score,Completion %,Chapters Completed,Total Chapters');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('Mathematics');
    expect(lines[1]).toContain('85');
  });

  it('should include activity history section', () => {
    const csv = generateCsvReport(sampleProgress);
    expect(csv).toContain('Activity History');
    expect(csv).toContain('Algebra Basics');
  });

  it('should handle empty data', () => {
    const csv = generateCsvReport([]);
    const lines = csv.split('\n');
    // Should still have headers
    expect(lines[0]).toContain('Learner Name');
  });

  it('should escape values containing commas', () => {
    const data: LearnerProgressData[] = [{
      learnerId: 'l1',
      learnerName: 'Smith, John',
      overallCompletion: 50,
      subjects: [{
        subjectName: 'Math',
        averageScore: 70,
        completionPercentage: 60,
        chaptersCompleted: 3,
        totalChapters: 5,
      }],
      activityHistory: [],
    }];

    const csv = generateCsvReport(data);
    expect(csv).toContain('"Smith, John"');
  });
});

describe('generatePdfReport', () => {
  it('should generate a formatted text report', () => {
    const pdf = generatePdfReport(sampleProgress);
    expect(pdf).toContain('LEARNER PROGRESS REPORT');
    expect(pdf).toContain('Alice');
    expect(pdf).toContain('Mathematics');
    expect(pdf).toContain('75% complete');
  });

  it('should include activity section', () => {
    const pdf = generatePdfReport(sampleProgress);
    expect(pdf).toContain('Recent Activity');
    expect(pdf).toContain('Algebra Basics');
  });

  it('should handle empty data', () => {
    const pdf = generatePdfReport([]);
    expect(pdf).toContain('LEARNER PROGRESS REPORT');
  });
});

// ─── Handler Tests ───────────────────────────────────────────────────────────

describe('handleExportReport', () => {
  it('should return validation error for invalid body', async () => {
    const deps = createMockDeps();
    const result = await handleExportReport(null, parentAuth, recentVerification, deps, now);

    expect((result as APIError).statusCode).toBe(400);
  });

  it('should return 403 when caller is a learner', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    const result = await handleExportReport(body, learnerAuth, recentVerification, deps, now);

    expect((result as APIError).statusCode).toBe(403);
    expect((result as APIError).message).toContain('Only parent accounts');
  });

  it('should return 403 when parentId does not match auth context', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'other-parent', format: 'csv' };

    const result = await handleExportReport(body, parentAuth, recentVerification, deps, now);

    expect((result as APIError).statusCode).toBe(403);
    expect((result as APIError).message).toContain('Cannot export reports for another parent');
  });

  it('should return 403 REAUTHENTICATION_REQUIRED when not recently verified', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    const result = await handleExportReport(body, parentAuth, expiredVerification, deps, now);

    expect((result as APIError).statusCode).toBe(403);
    expect((result as APIError).errorCode).toBe('REAUTHENTICATION_REQUIRED');
    expect((result as APIError).retryable).toBe(true);
  });

  it('should return 403 REAUTHENTICATION_REQUIRED when lastVerifiedAt is null', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    const result = await handleExportReport(body, parentAuth, null, deps, now);

    expect((result as APIError).statusCode).toBe(403);
    expect((result as APIError).errorCode).toBe('REAUTHENTICATION_REQUIRED');
  });

  it('should return 404 when parent has no learners', async () => {
    const mockRepo: LearnerProgressRepository = {
      getLearnerIdsByParent: jest.fn().mockResolvedValue([]),
      getProgressForLearners: jest.fn().mockResolvedValue([]),
    };
    const deps = createMockDeps({ learnerProgressRepository: mockRepo });
    const body = { parentId: 'parent-123', format: 'csv' };

    const result = await handleExportReport(body, parentAuth, recentVerification, deps, now);

    expect((result as APIError).statusCode).toBe(404);
    expect((result as APIError).errorCode).toBe('NO_LEARNERS');
  });

  it('should use specified learnerIds when provided', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv', learnerIds: ['learner-1', 'learner-2'] };

    await handleExportReport(body, parentAuth, recentVerification, deps, now);

    expect(deps.learnerProgressRepository.getProgressForLearners).toHaveBeenCalledWith(['learner-1', 'learner-2']);
    expect(deps.learnerProgressRepository.getLearnerIdsByParent).not.toHaveBeenCalled();
  });

  it('should fetch all learner IDs when learnerIds not provided', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    await handleExportReport(body, parentAuth, recentVerification, deps, now);

    expect(deps.learnerProgressRepository.getLearnerIdsByParent).toHaveBeenCalledWith('parent-123');
  });

  it('should generate CSV report and upload to S3', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    const result = await handleExportReport(body, parentAuth, recentVerification, deps, now);

    expect('downloadUrl' in result).toBe(true);
    const success = result as { downloadUrl: string; format: string; generatedAt: string; expiresInSeconds: number };
    expect(success.format).toBe('csv');
    expect(success.downloadUrl).toContain('signed=true');
    expect(success.expiresInSeconds).toBe(3600);

    expect(deps.reportStorageClient.uploadReport).toHaveBeenCalledWith(
      expect.stringContaining('report.csv'),
      expect.any(Buffer),
      'text/csv'
    );
  });

  it('should generate PDF report and upload to S3', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'pdf' };

    const result = await handleExportReport(body, parentAuth, recentVerification, deps, now);

    expect('downloadUrl' in result).toBe(true);
    const success = result as { downloadUrl: string; format: string; generatedAt: string; expiresInSeconds: number };
    expect(success.format).toBe('pdf');

    expect(deps.reportStorageClient.uploadReport).toHaveBeenCalledWith(
      expect.stringContaining('report.pdf'),
      expect.any(Buffer),
      'application/pdf'
    );
  });

  it('should include correct S3 key with parent ID and timestamp', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    await handleExportReport(body, parentAuth, recentVerification, deps, now);

    const uploadCall = (deps.reportStorageClient.uploadReport as jest.Mock).mock.calls[0];
    const key = uploadCall[0] as string;
    expect(key).toContain('exports/parent-123/');
    expect(key).toContain('2024-06-15');
  });

  it('should return generatedAt timestamp in ISO format', async () => {
    const deps = createMockDeps();
    const body = { parentId: 'parent-123', format: 'csv' };

    const result = await handleExportReport(body, parentAuth, recentVerification, deps, now);

    const success = result as { generatedAt: string };
    expect(success.generatedAt).toBe('2024-06-15T10:05:00.000Z');
  });
});
