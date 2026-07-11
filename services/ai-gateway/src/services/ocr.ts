/**
 * OCR Service Integration — Google Vision.
 * Handles text extraction from page images using Google Vision OCR.
 *
 * Flow:
 * 1. Accept page image S3 keys from the request payload
 * 2. Call Google Vision OCR (through DI interface) with image data
 * 3. Enforce a 15-second timeout per page
 * 4. Auto-detect language/script (returned by Google Vision)
 * 5. Return extracted text with language metadata
 * 6. Only text (not images) is passed to subsequent AI processing
 *
 * Requirements: 8.1, 8.3, 8.7, 19.4, 25.6
 */

/** Result of OCR processing for a single page. */
export interface OCRResult {
  text: string;
  language: string;
  confidence: number;
}

/** Result of processing multiple pages through OCR. */
export interface OCRPageResult {
  pageNumber: number;
  status: 'success' | 'failed';
  result?: OCRResult;
  error?: string;
}

/** Complete OCR processing response. */
export interface OCRResponse {
  pages: OCRPageResult[];
  totalPages: number;
  successCount: number;
  failedCount: number;
}

/** Request payload for OCR processing. */
export interface OCRRequestPayload {
  imageS3Keys: string[];
  pageNumbers?: number[];
}

/**
 * Interface for Google Vision OCR client (dependency injection).
 * Allows mock-friendly testing without real API calls.
 */
export interface IGoogleVisionClient {
  /**
   * Sends an image (identified by S3 key) to Google Vision OCR.
   * Returns the detected text, language, and confidence score.
   */
  detectText(imageS3Key: string, apiKey: string): Promise<OCRResult>;
}

/** Dependencies required by the OCR handler. */
export interface OCRHandlerDeps {
  visionClient: IGoogleVisionClient;
  apiKey: string;
  timeoutMs?: number;
}

/** Default timeout per page in milliseconds (15 seconds). */
export const DEFAULT_PAGE_TIMEOUT_MS = 15_000;

/**
 * Processes a single page through Google Vision OCR with a timeout.
 * Returns the OCR result or an error if the timeout is exceeded or the call fails.
 */
export async function processPage(
  imageS3Key: string,
  deps: OCRHandlerDeps
): Promise<OCRResult> {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_PAGE_TIMEOUT_MS;

  const result = await withTimeout(
    deps.visionClient.detectText(imageS3Key, deps.apiKey),
    timeoutMs,
    `OCR processing timed out after ${timeoutMs}ms for image: ${imageS3Key}`
  );

  return result;
}

/**
 * Handles a full OCR request for multiple page images.
 * Processes each page sequentially with a per-page timeout.
 * Returns results with per-page success/failure status.
 *
 * Only extracted text (not raw images) is returned for subsequent LLM processing.
 */
export async function handleOCRRequest(
  payload: OCRRequestPayload,
  deps: OCRHandlerDeps
): Promise<OCRResponse> {
  if (!payload.imageS3Keys || payload.imageS3Keys.length === 0) {
    return {
      pages: [],
      totalPages: 0,
      successCount: 0,
      failedCount: 0,
    };
  }

  const pages: OCRPageResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < payload.imageS3Keys.length; i++) {
    const imageS3Key = payload.imageS3Keys[i];
    const pageNumber = payload.pageNumbers?.[i] ?? i + 1;

    try {
      const result = await processPage(imageS3Key, deps);

      pages.push({
        pageNumber,
        status: 'success',
        result,
      });
      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown OCR processing error';

      pages.push({
        pageNumber,
        status: 'failed',
        error: errorMessage,
      });
      failedCount++;
    }
  }

  return {
    pages,
    totalPages: payload.imageS3Keys.length,
    successCount,
    failedCount,
  };
}

/**
 * Wraps a promise with a timeout.
 * If the promise does not resolve within the specified time, it rejects
 * with a timeout error.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
