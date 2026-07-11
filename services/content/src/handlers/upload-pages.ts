/**
 * Upload Pages Handler
 * POST /content/chapters/:id/pages
 *
 * Accepts image uploads (JPEG/PNG/HEIC, max 10MB), validates each file,
 * enforces page limits (max 50 content + 20 exercise pages per chapter),
 * stores images in S3, and creates page records.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9
 */
import { PageUpload, APIError } from '@chikumiku/types';
import { validateFileUpload } from '@chikumiku/validation';
import { DBClient, PageRecord } from '../clients/db-client';
import { S3Client } from '../clients/s3-client';

/** Maximum content pages per chapter */
const MAX_CONTENT_PAGES = 50;

/** Maximum exercise pages per chapter */
const MAX_EXERCISE_PAGES = 20;

export interface UploadPagesResponse {
  success: true;
  pages: PageRecord[];
}

export interface UploadPagesDependencies {
  dbClient: DBClient;
  s3Client: S3Client;
  generateId: () => string;
}

/**
 * Build the S3 key for a page image.
 * Format: pages/{chapterId}/{pageNumber}_{classification}.{format}
 */
export function buildS3Key(
  chapterId: string,
  pageNumber: number,
  classification: 'content' | 'exercise',
  format: string
): string {
  return `pages/${chapterId}/${pageNumber}_${classification}.${format}`;
}

/**
 * Handle page upload request for a chapter.
 * Validates files, enforces limits, stores in S3, creates DB records.
 */
export async function handleUploadPages(
  chapterId: string,
  uploads: PageUpload[],
  deps: UploadPagesDependencies
): Promise<UploadPagesResponse | APIError> {
  // 1. Validate that at least one upload is provided
  if (!uploads || uploads.length === 0) {
    return {
      statusCode: 400,
      errorCode: 'NO_PAGES_PROVIDED',
      message: 'At least 1 page image is required',
      retryable: false,
    };
  }

  // 2. Validate each file using shared file validator (Req 7.2, 7.3)
  for (let i = 0; i < uploads.length; i++) {
    const upload = uploads[i];
    const validation = validateFileUpload(upload.format, upload.sizeBytes);
    if (!validation.valid) {
      return {
        statusCode: 400,
        errorCode: 'INVALID_FILE',
        message: `Page ${i + 1}: ${Object.values(validation.errors).join('. ')}`,
        details: validation.errors,
        retryable: false,
      };
    }
  }

  // 3. Get existing pages to enforce limits (Req 7.4, 7.5)
  const existingPages = await deps.dbClient.getPagesByChapter(chapterId);

  const existingContentCount = existingPages.filter(p => p.classification === 'content').length;
  const existingExerciseCount = existingPages.filter(p => p.classification === 'exercise').length;

  // Count new pages by classification (default to 'content' if not specified)
  const newContentCount = uploads.filter(u => (u.classification || 'content') === 'content').length;
  const newExerciseCount = uploads.filter(u => u.classification === 'exercise').length;

  const totalContentAfter = existingContentCount + newContentCount;
  const totalExerciseAfter = existingExerciseCount + newExerciseCount;

  if (totalContentAfter > MAX_CONTENT_PAGES) {
    return {
      statusCode: 409,
      errorCode: 'CONTENT_PAGE_LIMIT_REACHED',
      message: `Cannot add pages. Maximum of ${MAX_CONTENT_PAGES} content pages allowed per chapter. Currently ${existingContentCount}, attempting to add ${newContentCount}.`,
      retryable: false,
    };
  }

  if (totalExerciseAfter > MAX_EXERCISE_PAGES) {
    return {
      statusCode: 409,
      errorCode: 'EXERCISE_PAGE_LIMIT_REACHED',
      message: `Cannot add pages. Maximum of ${MAX_EXERCISE_PAGES} exercise pages allowed per chapter. Currently ${existingExerciseCount}, attempting to add ${newExerciseCount}.`,
      retryable: false,
    };
  }

  // 4. Upload images to S3 and create page records
  const createdPages: PageRecord[] = [];
  const nextPageNumber = existingPages.length > 0
    ? Math.max(...existingPages.map(p => p.pageNumber)) + 1
    : 1;

  for (let i = 0; i < uploads.length; i++) {
    const upload = uploads[i];
    const classification = upload.classification || 'content';
    const pageNumber = nextPageNumber + i;

    // Build S3 key and upload image
    const s3Key = buildS3Key(chapterId, pageNumber, classification, upload.format);
    await deps.s3Client.uploadImage(s3Key, upload.imageData, upload.format);

    // Create page record in DB
    const pageId = deps.generateId();
    const page = await deps.dbClient.createPage({
      id: pageId,
      chapterId,
      pageNumber,
      classification,
      imageS3Key: s3Key,
    });

    createdPages.push(page);
  }

  return {
    success: true,
    pages: createdPages,
  };
}
