/**
 * Integration tests for S3 upload/download operations.
 * Tests the full flow of image uploads, audio downloads, pre-signed URLs,
 * and file size constraint enforcement.
 *
 * Validates: Requirements 19.1, 24.1–24.12
 */

import { validateFileUpload } from '@chikumiku/validation';
import type { S3Client } from '../../content/src/clients/s3-client';
import type { PageUpload } from '@chikumiku/types';
import { handleUploadPages, buildS3Key } from '../../content/src/handlers/upload-pages';

// --- Mock S3 Service ---

interface StoredObject {
  key: string;
  data: Buffer;
  contentType: string;
  uploadedAt: string;
  sizeBytes: number;
}

/**
 * In-memory S3 bucket simulator for integration testing.
 * Tracks all uploads, supports retrieval and pre-signed URL generation.
 */
function createMockS3Bucket() {
  const objects = new Map<string, StoredObject>();

  return {
    objects,

    /** Upload an object to the mock bucket. */
    async upload(key: string, data: Buffer, format: string): Promise<string> {
      const contentType = format === 'jpeg' ? 'image/jpeg' :
        format === 'png' ? 'image/png' :
          format === 'heic' ? 'image/heic' : 'application/octet-stream';

      objects.set(key, {
        key,
        data,
        contentType,
        uploadedAt: new Date().toISOString(),
        sizeBytes: data.length,
      });
      return key;
    },

    /** Download (get) an object from the mock bucket. */
    async download(key: string): Promise<{ data: Buffer; contentType: string } | null> {
      const obj = objects.get(key);
      if (!obj) return null;
      return { data: obj.data, contentType: obj.contentType };
    },

    /** Delete an object from the mock bucket. */
    async deleteObject(key: string): Promise<void> {
      objects.delete(key);
    },

    /** Generate a mock pre-signed URL. */
    async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
      if (!objects.has(key)) {
        throw new Error(`Object not found: ${key}`);
      }
      const expiry = Date.now() + expiresInSeconds * 1000;
      return `https://mock-bucket.s3.amazonaws.com/${key}?X-Amz-Expires=${expiresInSeconds}&X-Amz-Date=${new Date().toISOString()}&expires=${expiry}`;
    },

    getObjectCount(): number {
      return objects.size;
    },
  };
}

/** Creates mock S3Client that uses the mock bucket. */
function createMockS3Client(bucket: ReturnType<typeof createMockS3Bucket>): S3Client {
  return {
    async uploadImage(key: string, data: Buffer, format: string): Promise<string> {
      return bucket.upload(key, data, format);
    },
    async deleteImage(key: string): Promise<void> {
      return bucket.deleteObject(key);
    },
    async getSignedUrl(key: string): Promise<string> {
      return bucket.getPresignedUrl(key);
    },
  };
}

// --- Mock DB Client for upload handler ---

function createMockDBForUpload() {
  const pages: Array<{ id: string; chapterId: string; pageNumber: number; classification: string; imageS3Key: string; ocrStatus: string }> = [];

  return {
    pages,
    async getPagesByChapter(_chapterId: string) {
      return pages.filter(p => p.chapterId === _chapterId);
    },
    async createPage(data: { id: string; chapterId: string; pageNumber: number; classification: string; imageS3Key: string }) {
      const page = { ...data, ocrStatus: 'pending' };
      pages.push(page);
      return page;
    },
  };
}

// --- Tests ---

describe('S3 Operations Integration Tests', () => {
  describe('Page image upload (JPEG/PNG/HEIC)', () => {
    it('uploads JPEG images and stores them with correct S3 key', async () => {
      const bucket = createMockS3Bucket();
      const s3Client = createMockS3Client(bucket);
      const dbClient = createMockDBForUpload();
      let idCounter = 0;

      const uploads: PageUpload[] = [
        {
          format: 'jpeg',
          sizeBytes: 2 * 1024 * 1024, // 2MB
          imageData: Buffer.alloc(100, 'j'),
          classification: 'content',
          pageOrder: 1,
        },
      ];

      const result = await handleUploadPages('ch-upload-001', uploads, {
        dbClient: dbClient as any,
        s3Client,
        generateId: () => `page-${++idCounter}`,
      });

      expect(result).toHaveProperty('success', true);
      if ('pages' in result) {
        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].imageS3Key).toBe('pages/ch-upload-001/1_content.jpeg');
      }

      // Verify object stored in S3
      expect(bucket.getObjectCount()).toBe(1);
      const stored = bucket.objects.get('pages/ch-upload-001/1_content.jpeg');
      expect(stored).toBeDefined();
      expect(stored!.contentType).toBe('image/jpeg');
    });

    it('uploads PNG images successfully', async () => {
      const bucket = createMockS3Bucket();
      const s3Client = createMockS3Client(bucket);
      const dbClient = createMockDBForUpload();
      let idCounter = 0;

      const uploads: PageUpload[] = [
        {
          format: 'png',
          sizeBytes: 5 * 1024 * 1024, // 5MB
          imageData: Buffer.alloc(100, 'p'),
          classification: 'exercise',
          pageOrder: 1,
        },
      ];

      const result = await handleUploadPages('ch-upload-002', uploads, {
        dbClient: dbClient as any,
        s3Client,
        generateId: () => `page-${++idCounter}`,
      });

      expect(result).toHaveProperty('success', true);
      const stored = bucket.objects.get('pages/ch-upload-002/1_exercise.png');
      expect(stored).toBeDefined();
      expect(stored!.contentType).toBe('image/png');
    });

    it('uploads HEIC images successfully', async () => {
      const bucket = createMockS3Bucket();
      const s3Client = createMockS3Client(bucket);
      const dbClient = createMockDBForUpload();
      let idCounter = 0;

      const uploads: PageUpload[] = [
        {
          format: 'heic',
          sizeBytes: 3 * 1024 * 1024, // 3MB
          imageData: Buffer.alloc(100, 'h'),
          classification: 'content',
          pageOrder: 1,
        },
      ];

      const result = await handleUploadPages('ch-upload-003', uploads, {
        dbClient: dbClient as any,
        s3Client,
        generateId: () => `page-${++idCounter}`,
      });

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('File size constraint enforcement', () => {
    it('rejects upload when file exceeds 10MB limit', async () => {
      const bucket = createMockS3Bucket();
      const s3Client = createMockS3Client(bucket);
      const dbClient = createMockDBForUpload();
      let idCounter = 0;

      const uploads: PageUpload[] = [
        {
          format: 'jpeg',
          sizeBytes: 11 * 1024 * 1024, // 11MB - exceeds limit
          imageData: Buffer.alloc(100),
          classification: 'content',
          pageOrder: 1,
        },
      ];

      const result = await handleUploadPages('ch-size-001', uploads, {
        dbClient: dbClient as any,
        s3Client,
        generateId: () => `page-${++idCounter}`,
      });

      expect(result).toHaveProperty('statusCode', 400);
      expect(result).toHaveProperty('errorCode', 'INVALID_FILE');
      // Nothing should be stored in S3
      expect(bucket.getObjectCount()).toBe(0);
    });

    it('rejects upload with invalid format via shared validator', () => {
      // validateFileUpload accepts string, allowing us to test invalid formats
      const validation = validateFileUpload('gif', 1 * 1024 * 1024);
      expect(validation.valid).toBe(false);
    });

    it('accepts file at exactly 10MB boundary', () => {
      const maxSize = 10 * 1024 * 1024; // Exactly 10MB
      const validation = validateFileUpload('jpeg', maxSize);
      expect(validation.valid).toBe(true);
    });

    it('rejects file at 10MB + 1 byte', () => {
      const overSize = 10 * 1024 * 1024 + 1;
      const validation = validateFileUpload('jpeg', overSize);
      expect(validation.valid).toBe(false);
    });
  });

  describe('Audio asset download', () => {
    it('downloads audio asset from S3 by key', async () => {
      const bucket = createMockS3Bucket();
      const audioData = Buffer.from('mock-audio-mp3-data');
      await bucket.upload('audio/ch-001/explanation_page_1.mp3', audioData, 'mp3');

      const result = await bucket.download('audio/ch-001/explanation_page_1.mp3');

      expect(result).not.toBeNull();
      expect(result!.data).toEqual(audioData);
    });

    it('returns null for non-existent audio asset', async () => {
      const bucket = createMockS3Bucket();

      const result = await bucket.download('audio/non-existent/file.mp3');

      expect(result).toBeNull();
    });
  });

  describe('Pre-signed URL generation for export files', () => {
    it('generates pre-signed URL for existing export file', async () => {
      const bucket = createMockS3Bucket();
      const exportData = Buffer.from('mock-pdf-export-data');
      await bucket.upload('exports/parent-001/progress-report.pdf', exportData, 'pdf');

      const url = await bucket.getPresignedUrl('exports/parent-001/progress-report.pdf', 300);

      expect(url).toContain('mock-bucket.s3.amazonaws.com');
      expect(url).toContain('exports/parent-001/progress-report.pdf');
      expect(url).toContain('X-Amz-Expires=300');
    });

    it('throws error when generating URL for non-existent file', async () => {
      const bucket = createMockS3Bucket();

      await expect(
        bucket.getPresignedUrl('exports/non-existent/file.pdf')
      ).rejects.toThrow('Object not found');
    });

    it('generates URLs with configurable expiry', async () => {
      const bucket = createMockS3Bucket();
      await bucket.upload('exports/parent-001/data.csv', Buffer.from('csv'), 'csv');

      const shortUrl = await bucket.getPresignedUrl('exports/parent-001/data.csv', 60);
      const longUrl = await bucket.getPresignedUrl('exports/parent-001/data.csv', 7200);

      expect(shortUrl).toContain('X-Amz-Expires=60');
      expect(longUrl).toContain('X-Amz-Expires=7200');
    });
  });

  describe('S3 key construction', () => {
    it('builds correct S3 keys for content pages', () => {
      const key = buildS3Key('ch-100', 5, 'content', 'jpeg');
      expect(key).toBe('pages/ch-100/5_content.jpeg');
    });

    it('builds correct S3 keys for exercise pages', () => {
      const key = buildS3Key('ch-200', 3, 'exercise', 'png');
      expect(key).toBe('pages/ch-200/3_exercise.png');
    });

    it('handles HEIC format in S3 keys', () => {
      const key = buildS3Key('ch-300', 1, 'content', 'heic');
      expect(key).toBe('pages/ch-300/1_content.heic');
    });
  });
});
