/**
 * Unit tests for the OCR service integration (Google Vision).
 * Tests: successful extraction, language auto-detection, timeout handling,
 * error handling for failed/corrupt pages, and proper error messages.
 *
 * Requirements: 8.1, 8.3, 8.7, 19.4, 25.6
 */

import type { IGoogleVisionClient, OCRHandlerDeps, OCRResult, OCRRequestPayload } from './ocr';
import { handleOCRRequest, processPage, withTimeout, DEFAULT_PAGE_TIMEOUT_MS } from './ocr';

// --- Test helpers ---

function createMockVisionClient(responses?: Map<string, OCRResult>): IGoogleVisionClient {
  const defaultResponse: OCRResult = {
    text: 'Extracted text content from the page.',
    language: 'en',
    confidence: 0.95,
  };

  return {
    async detectText(imageS3Key: string, _apiKey: string): Promise<OCRResult> {
      return responses?.get(imageS3Key) ?? defaultResponse;
    },
  };
}

function createFailingVisionClient(errorMessage: string): IGoogleVisionClient {
  return {
    async detectText(_imageS3Key: string, _apiKey: string): Promise<OCRResult> {
      throw new Error(errorMessage);
    },
  };
}

function createSlowVisionClient(delayMs: number): IGoogleVisionClient {
  return {
    async detectText(_imageS3Key: string, _apiKey: string): Promise<OCRResult> {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return { text: 'Slow result', language: 'en', confidence: 0.9 };
    },
  };
}

function createDeps(overrides?: Partial<OCRHandlerDeps>): OCRHandlerDeps {
  return {
    visionClient: createMockVisionClient(),
    apiKey: 'test-google-vision-api-key',
    timeoutMs: 15_000,
    ...overrides,
  };
}

// --- Tests ---

describe('OCR Service', () => {
  describe('processPage', () => {
    it('successfully extracts text from a page image', async () => {
      const deps = createDeps();
      const result = await processPage('chapters/ch-1/pages/page-1.jpg', deps);

      expect(result.text).toBe('Extracted text content from the page.');
      expect(result.language).toBe('en');
      expect(result.confidence).toBe(0.95);
    });

    it('returns language metadata for auto-detected language', async () => {
      const responses = new Map<string, OCRResult>();
      responses.set('pages/hindi-page.jpg', {
        text: 'हिंदी पाठ',
        language: 'hi',
        confidence: 0.92,
      });

      const deps = createDeps({
        visionClient: createMockVisionClient(responses),
      });

      const result = await processPage('pages/hindi-page.jpg', deps);

      expect(result.text).toBe('हिंदी पाठ');
      expect(result.language).toBe('hi');
      expect(result.confidence).toBe(0.92);
    });

    it('detects Kannada script automatically', async () => {
      const responses = new Map<string, OCRResult>();
      responses.set('pages/kannada-page.png', {
        text: 'ಕನ್ನಡ ಪಠ್ಯ',
        language: 'kn',
        confidence: 0.88,
      });

      const deps = createDeps({
        visionClient: createMockVisionClient(responses),
      });

      const result = await processPage('pages/kannada-page.png', deps);

      expect(result.text).toBe('ಕನ್ನಡ ಪಠ್ಯ');
      expect(result.language).toBe('kn');
    });

    it('throws an error when OCR processing times out', async () => {
      const deps = createDeps({
        visionClient: createSlowVisionClient(100), // 100ms delay
        timeoutMs: 50, // 50ms timeout (shorter than delay)
      });

      await expect(processPage('pages/slow-page.jpg', deps)).rejects.toThrow(
        /timed out/
      );
    });

    it('throws an error for corrupted images', async () => {
      const deps = createDeps({
        visionClient: createFailingVisionClient('Image is corrupted or unreadable'),
      });

      await expect(processPage('pages/corrupt.jpg', deps)).rejects.toThrow(
        'Image is corrupted or unreadable'
      );
    });

    it('throws an error when API key is invalid', async () => {
      const deps = createDeps({
        visionClient: createFailingVisionClient('Invalid API key: authentication failed'),
      });

      await expect(processPage('pages/page-1.jpg', deps)).rejects.toThrow(
        'Invalid API key: authentication failed'
      );
    });
  });

  describe('handleOCRRequest', () => {
    it('processes multiple pages successfully', async () => {
      const responses = new Map<string, OCRResult>();
      responses.set('pages/page-1.jpg', { text: 'Page 1 content', language: 'en', confidence: 0.95 });
      responses.set('pages/page-2.jpg', { text: 'Page 2 content', language: 'en', confidence: 0.93 });
      responses.set('pages/page-3.jpg', { text: 'Page 3 content', language: 'en', confidence: 0.91 });

      const deps = createDeps({
        visionClient: createMockVisionClient(responses),
      });

      const payload: OCRRequestPayload = {
        imageS3Keys: ['pages/page-1.jpg', 'pages/page-2.jpg', 'pages/page-3.jpg'],
      };

      const response = await handleOCRRequest(payload, deps);

      expect(response.totalPages).toBe(3);
      expect(response.successCount).toBe(3);
      expect(response.failedCount).toBe(0);
      expect(response.pages).toHaveLength(3);
      expect(response.pages[0].status).toBe('success');
      expect(response.pages[0].result?.text).toBe('Page 1 content');
      expect(response.pages[1].pageNumber).toBe(2);
      expect(response.pages[2].pageNumber).toBe(3);
    });

    it('assigns sequential page numbers when not specified', async () => {
      const deps = createDeps();
      const payload: OCRRequestPayload = {
        imageS3Keys: ['page-a.jpg', 'page-b.jpg'],
      };

      const response = await handleOCRRequest(payload, deps);

      expect(response.pages[0].pageNumber).toBe(1);
      expect(response.pages[1].pageNumber).toBe(2);
    });

    it('uses provided page numbers when specified', async () => {
      const deps = createDeps();
      const payload: OCRRequestPayload = {
        imageS3Keys: ['page-a.jpg', 'page-b.jpg'],
        pageNumbers: [5, 10],
      };

      const response = await handleOCRRequest(payload, deps);

      expect(response.pages[0].pageNumber).toBe(5);
      expect(response.pages[1].pageNumber).toBe(10);
    });

    it('handles empty image list gracefully', async () => {
      const deps = createDeps();
      const payload: OCRRequestPayload = { imageS3Keys: [] };

      const response = await handleOCRRequest(payload, deps);

      expect(response.totalPages).toBe(0);
      expect(response.successCount).toBe(0);
      expect(response.failedCount).toBe(0);
      expect(response.pages).toHaveLength(0);
    });

    it('marks failed pages without affecting successful ones', async () => {
      let callCount = 0;
      const mixedClient: IGoogleVisionClient = {
        async detectText(imageS3Key: string, _apiKey: string): Promise<OCRResult> {
          callCount++;
          if (imageS3Key === 'pages/corrupt.jpg') {
            throw new Error('Image is corrupted or unreadable');
          }
          return { text: `Content for ${imageS3Key}`, language: 'en', confidence: 0.9 };
        },
      };

      const deps = createDeps({ visionClient: mixedClient });
      const payload: OCRRequestPayload = {
        imageS3Keys: ['pages/page-1.jpg', 'pages/corrupt.jpg', 'pages/page-3.jpg'],
      };

      const response = await handleOCRRequest(payload, deps);

      expect(response.totalPages).toBe(3);
      expect(response.successCount).toBe(2);
      expect(response.failedCount).toBe(1);

      // First page succeeds
      expect(response.pages[0].status).toBe('success');
      expect(response.pages[0].result?.text).toContain('page-1.jpg');

      // Second page fails
      expect(response.pages[1].status).toBe('failed');
      expect(response.pages[1].error).toBe('Image is corrupted or unreadable');
      expect(response.pages[1].result).toBeUndefined();

      // Third page still succeeds (failure doesn't affect others)
      expect(response.pages[2].status).toBe('success');
      expect(response.pages[2].result?.text).toContain('page-3.jpg');

      expect(callCount).toBe(3);
    });

    it('handles timeout per page without affecting other pages', async () => {
      let callCount = 0;
      const mixedTimingClient: IGoogleVisionClient = {
        async detectText(imageS3Key: string, _apiKey: string): Promise<OCRResult> {
          callCount++;
          if (imageS3Key === 'pages/slow.jpg') {
            // Simulate slow processing exceeding timeout
            await new Promise((resolve) => setTimeout(resolve, 200));
            return { text: 'Should not reach', language: 'en', confidence: 0.5 };
          }
          return { text: 'Fast result', language: 'en', confidence: 0.95 };
        },
      };

      const deps = createDeps({
        visionClient: mixedTimingClient,
        timeoutMs: 100, // 100ms timeout
      });

      const payload: OCRRequestPayload = {
        imageS3Keys: ['pages/fast.jpg', 'pages/slow.jpg', 'pages/fast2.jpg'],
      };

      const response = await handleOCRRequest(payload, deps);

      expect(response.successCount).toBe(2);
      expect(response.failedCount).toBe(1);
      expect(response.pages[0].status).toBe('success');
      expect(response.pages[1].status).toBe('failed');
      expect(response.pages[1].error).toMatch(/timed out/);
      expect(response.pages[2].status).toBe('success');
    });

    it('auto-detects different languages across pages', async () => {
      const responses = new Map<string, OCRResult>();
      responses.set('pages/en.jpg', { text: 'English text', language: 'en', confidence: 0.97 });
      responses.set('pages/hi.jpg', { text: 'हिंदी पाठ', language: 'hi', confidence: 0.94 });
      responses.set('pages/kn.jpg', { text: 'ಕನ್ನಡ', language: 'kn', confidence: 0.89 });

      const deps = createDeps({
        visionClient: createMockVisionClient(responses),
      });

      const payload: OCRRequestPayload = {
        imageS3Keys: ['pages/en.jpg', 'pages/hi.jpg', 'pages/kn.jpg'],
      };

      const response = await handleOCRRequest(payload, deps);

      expect(response.pages[0].result?.language).toBe('en');
      expect(response.pages[1].result?.language).toBe('hi');
      expect(response.pages[2].result?.language).toBe('kn');
    });

    it('returns only text data, not image references in results', async () => {
      const deps = createDeps();
      const payload: OCRRequestPayload = {
        imageS3Keys: ['pages/page-1.jpg'],
      };

      const response = await handleOCRRequest(payload, deps);

      const pageResult = response.pages[0];
      expect(pageResult.result).toBeDefined();
      expect(pageResult.result!.text).toBeDefined();
      expect(pageResult.result!.language).toBeDefined();
      expect(pageResult.result!.confidence).toBeDefined();
      // Ensure no image data leaks into the result
      expect((pageResult.result as any).imageData).toBeUndefined();
      expect((pageResult.result as any).imageS3Key).toBeUndefined();
    });
  });

  describe('withTimeout', () => {
    it('resolves when promise completes before timeout', async () => {
      const fastPromise = Promise.resolve('fast result');
      const result = await withTimeout(fastPromise, 1000, 'Timeout');
      expect(result).toBe('fast result');
    });

    it('rejects with timeout message when promise exceeds timeout', async () => {
      const slowPromise = new Promise<string>((resolve) =>
        setTimeout(() => resolve('slow'), 200)
      );

      await expect(
        withTimeout(slowPromise, 50, 'Operation timed out')
      ).rejects.toThrow('Operation timed out');
    });

    it('rejects with original error if promise fails before timeout', async () => {
      const failingPromise = Promise.reject(new Error('API error'));

      await expect(
        withTimeout(failingPromise, 5000, 'Timeout')
      ).rejects.toThrow('API error');
    });
  });

  describe('DEFAULT_PAGE_TIMEOUT_MS', () => {
    it('is set to 15 seconds', () => {
      expect(DEFAULT_PAGE_TIMEOUT_MS).toBe(15_000);
    });
  });
});
