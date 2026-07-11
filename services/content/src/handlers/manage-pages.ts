/**
 * Manage Pages Handler
 * Page operations: reorder, delete, recapture, toggle classification.
 *
 * Requirements: 7.4, 7.5, 7.6, 7.7
 */
import { PageUpload, APIError } from '@chikumiku/types';
import { validateFileUpload } from '@chikumiku/validation';
import { DBClient, PageRecord } from '../clients/db-client';
import { S3Client } from '../clients/s3-client';
import { buildS3Key } from './upload-pages';

/** Maximum content pages per chapter */
const MAX_CONTENT_PAGES = 50;

/** Maximum exercise pages per chapter */
const MAX_EXERCISE_PAGES = 20;

/** Minimum pages required for a chapter (enforced on delete) */
const MIN_PAGES_PER_CHAPTER = 1;

export interface ManagePagesDependencies {
  dbClient: DBClient;
  s3Client: S3Client;
}

export interface ReorderRequest {
  pageId: string;
  pageNumber: number;
}

/**
 * Reorder pages within a chapter.
 * Updates the page ordering as specified.
 */
export async function reorderPages(
  chapterId: string,
  newOrder: ReorderRequest[],
  deps: ManagePagesDependencies
): Promise<{ success: true } | APIError> {
  if (!newOrder || newOrder.length === 0) {
    return {
      statusCode: 400,
      errorCode: 'INVALID_ORDER',
      message: 'New page order must be provided',
      retryable: false,
    };
  }

  // Verify all pages belong to this chapter
  const existingPages = await deps.dbClient.getPagesByChapter(chapterId);
  const existingPageIds = new Set(existingPages.map(p => p.id));

  for (const item of newOrder) {
    if (!existingPageIds.has(item.pageId)) {
      return {
        statusCode: 404,
        errorCode: 'PAGE_NOT_FOUND',
        message: `Page ${item.pageId} does not belong to chapter ${chapterId}`,
        retryable: false,
      };
    }
  }

  await deps.dbClient.updatePageOrder(
    chapterId,
    newOrder.map(item => ({ pageId: item.pageId, pageNumber: item.pageNumber }))
  );

  return { success: true };
}

/**
 * Delete a page from a chapter.
 * Removes the S3 image and the DB record.
 * Enforces minimum 1 page per chapter.
 */
export async function deletePage(
  chapterId: string,
  pageId: string,
  deps: ManagePagesDependencies
): Promise<{ success: true } | APIError> {
  const existingPages = await deps.dbClient.getPagesByChapter(chapterId);

  // Find the page to delete
  const pageToDelete = existingPages.find(p => p.id === pageId);
  if (!pageToDelete) {
    return {
      statusCode: 404,
      errorCode: 'PAGE_NOT_FOUND',
      message: `Page ${pageId} not found in chapter ${chapterId}`,
      retryable: false,
    };
  }

  // Enforce minimum page count (Req 7.4)
  if (existingPages.length <= MIN_PAGES_PER_CHAPTER) {
    return {
      statusCode: 409,
      errorCode: 'MINIMUM_PAGES_REQUIRED',
      message: `Cannot delete page. Minimum of ${MIN_PAGES_PER_CHAPTER} page required per chapter.`,
      retryable: false,
    };
  }

  // Delete from S3 and DB
  await deps.s3Client.deleteImage(pageToDelete.imageS3Key);
  await deps.dbClient.deletePage(pageId);

  return { success: true };
}

/**
 * Recapture a page — replace an existing page image with a new one.
 * Deletes old S3 image, uploads new image, updates DB record.
 */
export async function recapturePage(
  chapterId: string,
  pageId: string,
  newImage: PageUpload,
  deps: ManagePagesDependencies
): Promise<{ success: true; page: PageRecord } | APIError> {
  // Validate the new image
  const validation = validateFileUpload(newImage.format, newImage.sizeBytes);
  if (!validation.valid) {
    return {
      statusCode: 400,
      errorCode: 'INVALID_FILE',
      message: Object.values(validation.errors).join('. '),
      details: validation.errors,
      retryable: false,
    };
  }

  // Find the existing page
  const existingPages = await deps.dbClient.getPagesByChapter(chapterId);
  const existingPage = existingPages.find(p => p.id === pageId);

  if (!existingPage) {
    return {
      statusCode: 404,
      errorCode: 'PAGE_NOT_FOUND',
      message: `Page ${pageId} not found in chapter ${chapterId}`,
      retryable: false,
    };
  }

  // Delete old image from S3
  await deps.s3Client.deleteImage(existingPage.imageS3Key);

  // Upload new image
  const newS3Key = buildS3Key(
    chapterId,
    existingPage.pageNumber,
    existingPage.classification,
    newImage.format
  );
  await deps.s3Client.uploadImage(newS3Key, newImage.imageData, newImage.format);

  // Update DB record with new S3 key
  await deps.dbClient.updatePageImage(pageId, newS3Key);

  // Return updated page record
  const updatedPage: PageRecord = {
    ...existingPage,
    imageS3Key: newS3Key,
  };

  return { success: true, page: updatedPage };
}

/**
 * Toggle a page's classification between 'content' and 'exercise'.
 * Enforces page limits after toggle.
 */
export async function toggleClassification(
  chapterId: string,
  pageId: string,
  deps: ManagePagesDependencies
): Promise<{ success: true; newClassification: 'content' | 'exercise' } | APIError> {
  const existingPages = await deps.dbClient.getPagesByChapter(chapterId);
  const page = existingPages.find(p => p.id === pageId);

  if (!page) {
    return {
      statusCode: 404,
      errorCode: 'PAGE_NOT_FOUND',
      message: `Page ${pageId} not found in chapter ${chapterId}`,
      retryable: false,
    };
  }

  const newClassification: 'content' | 'exercise' =
    page.classification === 'content' ? 'exercise' : 'content';

  // Check if the toggle would violate limits
  const contentCount = existingPages.filter(p => p.classification === 'content').length;
  const exerciseCount = existingPages.filter(p => p.classification === 'exercise').length;

  if (newClassification === 'exercise' && exerciseCount + 1 > MAX_EXERCISE_PAGES) {
    return {
      statusCode: 409,
      errorCode: 'EXERCISE_PAGE_LIMIT_REACHED',
      message: `Cannot toggle to exercise. Maximum of ${MAX_EXERCISE_PAGES} exercise pages allowed per chapter.`,
      retryable: false,
    };
  }

  if (newClassification === 'content' && contentCount + 1 > MAX_CONTENT_PAGES) {
    return {
      statusCode: 409,
      errorCode: 'CONTENT_PAGE_LIMIT_REACHED',
      message: `Cannot toggle to content. Maximum of ${MAX_CONTENT_PAGES} content pages allowed per chapter.`,
      retryable: false,
    };
  }

  await deps.dbClient.updatePageClassification(pageId, newClassification);

  return { success: true, newClassification };
}
