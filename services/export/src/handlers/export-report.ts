/**
 * Export report handler for POST /export/report.
 *
 * Generates a PDF or CSV progress report for a parent's learners,
 * stores it in S3, and returns a pre-signed download URL.
 *
 * Requirements: 17.5, 20.4
 */

import type { ExportRequest, APIError } from '@chikumiku/types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** Authenticated context from JWT middleware. */
export interface AuthContext {
  userId: string;
  username: string;
  role: 'parent' | 'learner';
}

/** A single learner's progress data. */
export interface LearnerProgressData {
  learnerId: string;
  learnerName: string;
  subjects: SubjectProgress[];
  overallCompletion: number; // 0-100
  activityHistory: ActivityEntry[];
}

/** Subject-level progress. */
export interface SubjectProgress {
  subjectName: string;
  averageScore: number; // 0-100
  completionPercentage: number; // 0-100
  chaptersCompleted: number;
  totalChapters: number;
}

/** A single activity record. */
export interface ActivityEntry {
  date: string; // ISO date string
  type: 'quiz' | 'pronunciation' | 'grammar' | 'qa' | 'reading';
  subjectName: string;
  chapterName: string;
  score?: number;
  durationMinutes: number;
}

/** Repository for fetching learner progress data. */
export interface LearnerProgressRepository {
  /** Get all learner IDs linked to a parent. */
  getLearnerIdsByParent(parentId: string): Promise<string[]>;
  /** Get full progress data for a list of learners. */
  getProgressForLearners(learnerIds: string[]): Promise<LearnerProgressData[]>;
}

/** S3 client interface for report storage. */
export interface ReportStorageClient {
  /** Upload a file buffer to S3 and return the object key. */
  uploadReport(key: string, content: Buffer, contentType: string): Promise<string>;
  /** Generate a pre-signed URL for downloading the report. */
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}

/** Dependencies required by the export report handler. */
export interface ExportReportDeps {
  learnerProgressRepository: LearnerProgressRepository;
  reportStorageClient: ReportStorageClient;
  /** Check if sensitive action is authorized (re-auth within 5 min). */
  isSensitiveActionAuthorized: (lastVerifiedAt: Date | null, now: Date) => boolean;
}

/** Successful export response. */
export interface ExportReportSuccessResponse {
  downloadUrl: string;
  format: 'pdf' | 'csv';
  generatedAt: string;
  expiresInSeconds: number;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates the export request body.
 */
export function validateExportRequest(body: unknown): APIError | null {
  if (!body || typeof body !== 'object') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Request body is required',
      retryable: false,
    };
  }

  const { parentId, format, learnerIds } = body as Partial<ExportRequest>;

  if (!parentId || typeof parentId !== 'string' || parentId.trim() === '') {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'parentId is required',
      details: { parentId: 'parentId is required' },
      retryable: false,
    };
  }

  if (!format || (format !== 'pdf' && format !== 'csv')) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'format must be "pdf" or "csv"',
      details: { format: 'format must be "pdf" or "csv"' },
      retryable: false,
    };
  }

  if (learnerIds !== undefined) {
    if (!Array.isArray(learnerIds)) {
      return {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'learnerIds must be an array of strings',
        details: { learnerIds: 'learnerIds must be an array of strings' },
        retryable: false,
      };
    }
    if (learnerIds.some((id) => typeof id !== 'string' || id.trim() === '')) {
      return {
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Each learnerIds entry must be a non-empty string',
        details: { learnerIds: 'Each learnerIds entry must be a non-empty string' },
        retryable: false,
      };
    }
  }

  return null;
}

// ─── Report Generation ───────────────────────────────────────────────────────

/**
 * Generates a CSV report from learner progress data.
 */
export function generateCsvReport(data: LearnerProgressData[]): string {
  const lines: string[] = [];

  // Header
  lines.push('Learner Name,Subject,Average Score,Completion %,Chapters Completed,Total Chapters');

  for (const learner of data) {
    for (const subject of learner.subjects) {
      lines.push(
        [
          escapeCsv(learner.learnerName),
          escapeCsv(subject.subjectName),
          subject.averageScore.toString(),
          subject.completionPercentage.toString(),
          subject.chaptersCompleted.toString(),
          subject.totalChapters.toString(),
        ].join(',')
      );
    }
  }

  // Activity history section
  lines.push('');
  lines.push('Activity History');
  lines.push('Learner Name,Date,Type,Subject,Chapter,Score,Duration (min)');

  for (const learner of data) {
    for (const activity of learner.activityHistory) {
      lines.push(
        [
          escapeCsv(learner.learnerName),
          activity.date,
          activity.type,
          escapeCsv(activity.subjectName),
          escapeCsv(activity.chapterName),
          activity.score?.toString() ?? '',
          activity.durationMinutes.toString(),
        ].join(',')
      );
    }
  }

  return lines.join('\n');
}

/**
 * Generates a simple text-based PDF report (plain text table format).
 * In production, this would use a PDF library; for now, it generates
 * a structured text representation suitable for PDF rendering.
 */
export function generatePdfReport(data: LearnerProgressData[]): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('                    LEARNER PROGRESS REPORT                    ');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  for (const learner of data) {
    lines.push(`┌─── ${learner.learnerName} (Overall: ${learner.overallCompletion}% complete) ───`);
    lines.push('│');
    lines.push('│  Subject Scores:');
    lines.push('│  ────────────────────────────────────────────────────');
    lines.push('│  Subject                | Score | Completion | Progress');

    for (const subject of learner.subjects) {
      const subjectPadded = subject.subjectName.padEnd(22);
      const scorePadded = `${subject.averageScore}%`.padStart(5);
      const completionPadded = `${subject.completionPercentage}%`.padStart(10);
      const progress = `${subject.chaptersCompleted}/${subject.totalChapters}`;
      lines.push(`│  ${subjectPadded} | ${scorePadded} | ${completionPadded} | ${progress}`);
    }

    lines.push('│');
    lines.push('│  Recent Activity:');
    lines.push('│  ────────────────────────────────────────────────────');

    const recentActivities = learner.activityHistory.slice(0, 10);
    for (const activity of recentActivities) {
      const scoreStr = activity.score !== undefined ? ` Score: ${activity.score}%` : '';
      lines.push(
        `│  ${activity.date} | ${activity.type.padEnd(13)} | ${activity.subjectName} - ${activity.chapterName}${scoreStr} (${activity.durationMinutes} min)`
      );
    }

    lines.push('│');
    lines.push('└───────────────────────────────────────────────────────────');
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`Generated: ${new Date().toISOString()}`);

  return lines.join('\n');
}

// ─── Handler ─────────────────────────────────────────────────────────────────

/**
 * Handles POST /export/report.
 *
 * Flow:
 * 1. Validate request body
 * 2. Ensure caller is a parent and matches the parentId
 * 3. Check re-authentication (sensitive action guard)
 * 4. Resolve learner IDs (all or specified subset)
 * 5. Fetch progress data for learners
 * 6. Generate report (PDF or CSV)
 * 7. Upload to S3
 * 8. Return pre-signed download URL
 */
export async function handleExportReport(
  body: unknown,
  authContext: AuthContext,
  lastVerifiedAt: Date | null,
  deps: ExportReportDeps,
  now: Date = new Date()
): Promise<ExportReportSuccessResponse | APIError> {
  // Step 1: Validate request body
  const validationError = validateExportRequest(body);
  if (validationError) {
    return validationError;
  }

  const request = body as ExportRequest;

  // Step 2: Ensure caller is a parent and owns the request
  if (authContext.role !== 'parent') {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Only parent accounts can export reports',
      retryable: false,
    };
  }

  if (authContext.userId !== request.parentId) {
    return {
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      message: 'Cannot export reports for another parent',
      retryable: false,
    };
  }

  // Step 3: Re-authentication check (requirement 20.4)
  if (!deps.isSensitiveActionAuthorized(lastVerifiedAt, now)) {
    return {
      statusCode: 403,
      errorCode: 'REAUTHENTICATION_REQUIRED',
      message: 'Re-authentication required. Please verify your password before exporting.',
      retryable: true,
      retryAfterSeconds: 0,
    };
  }

  // Step 4: Resolve learner IDs
  let learnerIds: string[];
  if (request.learnerIds && request.learnerIds.length > 0) {
    learnerIds = request.learnerIds;
  } else {
    learnerIds = await deps.learnerProgressRepository.getLearnerIdsByParent(request.parentId);
  }

  if (learnerIds.length === 0) {
    return {
      statusCode: 404,
      errorCode: 'NO_LEARNERS',
      message: 'No learners found for this parent',
      retryable: false,
    };
  }

  // Step 5: Fetch progress data
  const progressData = await deps.learnerProgressRepository.getProgressForLearners(learnerIds);

  // Step 6: Generate report
  let reportContent: string;
  let contentType: string;
  let fileExtension: string;

  if (request.format === 'csv') {
    reportContent = generateCsvReport(progressData);
    contentType = 'text/csv';
    fileExtension = 'csv';
  } else {
    reportContent = generatePdfReport(progressData);
    contentType = 'application/pdf';
    fileExtension = 'pdf';
  }

  // Step 7: Upload to S3
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const key = `exports/${request.parentId}/${timestamp}-report.${fileExtension}`;
  const buffer = Buffer.from(reportContent, 'utf-8');

  await deps.reportStorageClient.uploadReport(key, buffer, contentType);

  // Step 8: Generate pre-signed download URL (valid for 1 hour)
  const expiresInSeconds = 3600;
  const downloadUrl = await deps.reportStorageClient.getPresignedUrl(key, expiresInSeconds);

  return {
    downloadUrl,
    format: request.format,
    generatedAt: now.toISOString(),
    expiresInSeconds,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape a value for CSV (wraps in quotes if it contains comma, quote, or newline). */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
