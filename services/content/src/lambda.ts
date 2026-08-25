/**
 * Content service Lambda entrypoint.
 *
 * Constructs the dependency graph once per execution environment (warm-container
 * reuse), then routes each HTTP request to a content handler and maps the
 * handler result (a success object or an {@link APIError}) to an
 * APIGatewayProxyResult.
 *
 * Wired end-to-end:
 *   POST   /content/chapters                     → handleCreateChapter
 *   GET    /content/chapters/:id                 → handleGetChapter
 *   POST   /content/chapters/:id/pages           → handleUploadPages
 *   GET    /content/chapters/:id/ocr-status      → handleOCRProgress
 *   PUT    /content/chapters/:id/transcript      → handleSaveTranscript
 *
 * Environment variables (provided by the content CDK stack):
 *   PAGE_IMAGES_BUCKET — S3 bucket holding page images (used by AwsS3Client)
 *   plus the @chikumiku/db connection variables consumed by NeonDBClient.
 */

import { randomUUID } from 'node:crypto';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { APIError, PageUpload, TranscriptPage } from '@chikumiku/types';

import { NeonDBClient } from './clients/neon-db-client';
import { AwsS3Client } from './clients/aws-s3-client';
import type { DBClient } from './clients/db-client';
import type { S3Client } from './clients/s3-client';
import { handleCreateChapter } from './handlers/create-chapter';
import { handleGetChapter } from './handlers/get-chapter';
import { handleUploadPages } from './handlers/upload-pages';
import { handleOCRProgress } from './handlers/ocr-progress';
import { handleSaveTranscript } from './handlers/save-transcript';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
  'Content-Type': 'application/json',
};

/** Dependency graph shared across warm invocations. */
interface ContentDeps {
  dbClient: DBClient;
  s3Client: S3Client;
  generateId: () => string;
  getAcademicYear: () => string;
}

/**
 * Determines the Indian academic year string for a date (April–March):
 * Jan–Mar → (prevYear)-(currentYear); Apr–Dec → (currentYear)-(nextYear).
 * Kept local so the content service does not depend on the learning service.
 */
function determineAcademicYear(currentDate: Date): string {
  const month = currentDate.getMonth(); // 0-indexed: 0=Jan, 2=Mar, 3=Apr
  const year = currentDate.getFullYear();
  if (month < 3) {
    return `${year - 1}-${year}`;
  }
  return `${year}-${year + 1}`;
}

/** Builds the dependency graph from environment configuration. */
function buildDeps(): ContentDeps {
  return {
    dbClient: new NeonDBClient(),
    s3Client: new AwsS3Client(),
    generateId: () => randomUUID(),
    getAcademicYear: () => determineAcademicYear(new Date()),
  };
}

// Lazily initialized so a missing env var surfaces as a per-request 500 rather
// than crashing module load (which would fail every invocation opaquely).
let cachedDeps: ContentDeps | null = null;

function getDeps(): ContentDeps {
  if (!cachedDeps) {
    cachedDeps = buildDeps();
  }
  return cachedDeps;
}

/** A handler result carries a numeric `statusCode` only when it is an APIError. */
function isApiError(result: unknown): result is APIError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'statusCode' in result &&
    typeof (result as { statusCode: unknown }).statusCode === 'number'
  );
}

/** Maps a handler result to an APIGatewayProxyResult (APIError → its status, else 200). */
function toResponse(result: object): APIGatewayProxyResult {
  if (isApiError(result)) {
    return {
      statusCode: result.statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: result.message,
        code: result.errorCode,
        details: result.details,
        retryable: result.retryable,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(result),
  };
}

/** Coerces a raw request upload into a PageUpload, decoding base64 image data. */
function toPageUpload(raw: Record<string, unknown>): PageUpload {
  const imageData = raw.imageData;
  const buffer = Buffer.isBuffer(imageData)
    ? imageData
    : Buffer.from(typeof imageData === 'string' ? imageData : '', 'base64');

  return {
    imageData: buffer,
    format: raw.format as PageUpload['format'],
    sizeBytes: typeof raw.sizeBytes === 'number' ? raw.sizeBytes : buffer.length,
    pageOrder: typeof raw.pageOrder === 'number' ? raw.pageOrder : 0,
    classification: raw.classification as PageUpload['classification'],
  };
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { httpMethod, path } = event;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // Parse the request body once (empty object for bodyless requests).
  let body: Record<string, unknown>;
  try {
    body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Request body must be valid JSON' }),
    };
  }

  try {
    const deps = getDeps();

    // Route: POST /content/chapters
    if (httpMethod === 'POST' && path === '/content/chapters') {
      const learnerId = String(body.learnerId ?? '');
      const result = await handleCreateChapter(
        {
          subjectId: String(body.subjectId ?? ''),
          bookName: String(body.bookName ?? ''),
          chapterNumber: Number(body.chapterNumber),
          chapterName: String(body.chapterName ?? ''),
        },
        learnerId,
        {
          dbClient: deps.dbClient,
          generateId: deps.generateId,
          getAcademicYear: deps.getAcademicYear,
        }
      );
      return toResponse(result);
    }

    // Route: GET /content/chapters/:id
    const getChapterMatch = path.match(/^\/content\/chapters\/([^/]+)$/);
    if (httpMethod === 'GET' && getChapterMatch) {
      const result = await handleGetChapter(getChapterMatch[1], {
        dbClient: deps.dbClient,
      });
      return toResponse(result);
    }

    // Route: POST /content/chapters/:id/pages
    const uploadPagesMatch = path.match(/^\/content\/chapters\/([^/]+)\/pages$/);
    if (httpMethod === 'POST' && uploadPagesMatch) {
      const rawUploads = Array.isArray(body.uploads)
        ? body.uploads
        : Array.isArray(body.pages)
          ? body.pages
          : [];
      const uploads = rawUploads.map((u) => toPageUpload(u as Record<string, unknown>));
      const result = await handleUploadPages(uploadPagesMatch[1], uploads, {
        dbClient: deps.dbClient,
        s3Client: deps.s3Client,
        generateId: deps.generateId,
      });
      return toResponse(result);
    }

    // Route: GET /content/chapters/:id/ocr-status
    const ocrStatusMatch = path.match(/^\/content\/chapters\/([^/]+)\/ocr-status$/);
    if (httpMethod === 'GET' && ocrStatusMatch) {
      const result = await handleOCRProgress(ocrStatusMatch[1], {
        dbClient: deps.dbClient,
      });
      return toResponse(result);
    }

    // Route: PUT /content/chapters/:id/transcript
    const transcriptMatch = path.match(/^\/content\/chapters\/([^/]+)\/transcript$/);
    if (httpMethod === 'PUT' && transcriptMatch) {
      const pages = Array.isArray(body.pages) ? (body.pages as TranscriptPage[]) : [];
      const result = await handleSaveTranscript(
        transcriptMatch[1],
        { pages },
        { dbClient: deps.dbClient }
      );
      return toResponse(result);
    }

    // No matching route
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Not found', path, method: httpMethod }),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: message }),
    };
  }
}
