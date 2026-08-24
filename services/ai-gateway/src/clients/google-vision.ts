/**
 * Google Cloud Vision OCR client.
 *
 * Concrete implementation of `IGoogleVisionClient` (see services/ocr.ts) that
 * calls the Cloud Vision REST API using an API key. The image bytes are read
 * from S3 via an injected fetcher, base64-encoded, and sent to the
 * `images:annotate` endpoint with `DOCUMENT_TEXT_DETECTION`.
 *
 * Why REST + API key (instead of @google-cloud/vision):
 * - The existing DI contract passes an `apiKey` string (sourced from Secrets
 *   Manager), matching Vision's `?key=` auth. The official SDK is built around
 *   service-account / ADC credentials, which this codebase does not use.
 * - Keeps the Lambda bundle small and avoids a heavy transitive dependency.
 *
 * Requirements: 8.1, 8.3, 8.7, 19.4, 25.6
 */

import type { IGoogleVisionClient, OCRResult } from '../services/ocr';

/**
 * Fetches the raw bytes of an image identified by an S3 key.
 * Injected so the client stays unit-testable and matches the codebase's
 * dependency-injection convention (no hard-wired AWS SDK import here).
 */
export interface ImageByteFetcher {
  getImageBytes(imageS3Key: string): Promise<Buffer>;
}

/** Minimal shape of the Cloud Vision `images:annotate` response we consume. */
interface VisionAnnotateResponse {
  responses?: Array<{
    error?: { code?: number; message?: string };
    fullTextAnnotation?: {
      text?: string;
      pages?: Array<{
        confidence?: number;
        property?: {
          detectedLanguages?: Array<{ languageCode?: string; confidence?: number }>;
        };
      }>;
    };
    textAnnotations?: Array<{
      description?: string;
      locale?: string;
    }>;
  }>;
}

/** Options for constructing the Vision client. */
export interface GoogleVisionClientOptions {
  imageFetcher: ImageByteFetcher;
  /** Override the endpoint (useful for tests / regional endpoints). */
  endpoint?: string;
  /** Injectable fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

const DEFAULT_VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';

/**
 * Cloud Vision OCR client backed by the REST API.
 */
export class GoogleVisionClient implements IGoogleVisionClient {
  private readonly imageFetcher: ImageByteFetcher;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GoogleVisionClientOptions) {
    this.imageFetcher = options.imageFetcher;
    this.endpoint = options.endpoint ?? DEFAULT_VISION_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async detectText(imageS3Key: string, apiKey: string): Promise<OCRResult> {
    if (!apiKey) {
      throw new Error('Invalid API key: authentication failed');
    }

    const imageBytes = await this.imageFetcher.getImageBytes(imageS3Key);
    const base64Content = imageBytes.toString('base64');

    const requestBody = {
      requests: [
        {
          image: { content: base64Content },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };

    const url = `${this.endpoint}?key=${encodeURIComponent(apiKey)}`;

    let httpResponse: Response;
    try {
      httpResponse = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      throw new Error(`Google Vision request failed: ${message}`);
    }

    if (httpResponse.status === 401 || httpResponse.status === 403) {
      throw new Error('Invalid API key: authentication failed');
    }

    if (!httpResponse.ok) {
      const bodyText = await safeReadText(httpResponse);
      throw new Error(
        `Google Vision request failed with status ${httpResponse.status}: ${bodyText}`
      );
    }

    const payload = (await httpResponse.json()) as VisionAnnotateResponse;
    return mapVisionResponse(payload, imageS3Key);
  }
}

/**
 * Maps a Cloud Vision annotate response to our internal `OCRResult`.
 * Throws for per-image API errors (e.g. corrupt image) so the OCR handler can
 * mark the page as failed.
 */
export function mapVisionResponse(
  payload: VisionAnnotateResponse,
  imageS3Key: string
): OCRResult {
  const first = payload.responses?.[0];

  if (!first) {
    throw new Error(`No OCR response returned for image: ${imageS3Key}`);
  }

  if (first.error && (first.error.code || first.error.message)) {
    const message = first.error.message ?? 'Unknown Vision API error';
    // Normalize known corrupt-image errors to a stable message.
    if (/corrupt|invalid image|bad image|cannot decode/i.test(message)) {
      throw new Error('Image is corrupted or unreadable');
    }
    throw new Error(message);
  }

  const fullText = first.fullTextAnnotation?.text;
  const fallbackText = first.textAnnotations?.[0]?.description;
  const text = (fullText ?? fallbackText ?? '').trim();

  const page = first.fullTextAnnotation?.pages?.[0];
  const detected = page?.property?.detectedLanguages?.[0];
  const language =
    detected?.languageCode ?? first.textAnnotations?.[0]?.locale ?? 'und';

  // Vision returns a page-level confidence in [0,1]; fall back to the
  // detected-language confidence, then to 0 when nothing is provided.
  const confidence = page?.confidence ?? detected?.confidence ?? 0;

  return { text, language, confidence };
}

/** Reads a response body as text without throwing. */
async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable response body>';
  }
}
