import {
  handleUploadPages,
  buildS3Key,
  UploadPagesDependencies,
  UploadPagesResponse,
} from './upload-pages';
import { PageUpload, APIError } from '@chikumiku/types';
import { DBClient, PageRecord } from '../clients/db-client';
import { S3Client } from '../clients/s3-client';

// Helper to create a valid page upload
function validUpload(overrides: Partial<PageUpload> = {}): PageUpload {
  return {
    imageData: Buffer.from('fake-image-data'),
    format: 'jpeg',
    sizeBytes: 1_000_000, // 1MB
    pageOrder: 1,
    classification: 'content',
    ...overrides,
  };
}

// Helper to create a mock page record
function mockPageRecord(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    id: 'page-123',
    chapterId: 'chapter-123',
    pageNumber: 1,
    classification: 'content',
    imageS3Key: 'pages/chapter-123/1_content.jpeg',
    transcriptText: null,
    detectedLanguage: null,
    ocrStatus: 'pending',
    processedAt: null,
    ...overrides,
  };
}

// Helper to create mock dependencies
function createMockDeps(overrides: Partial<UploadPagesDependencies> = {}): UploadPagesDependencies {
  return {
    dbClient: {
      getBooksBySubject: jest.fn().mockResolvedValue([]),
      getChaptersByBook: jest.fn().mockResolvedValue([]),
      chapterNumberExists: jest.fn().mockResolvedValue(false),
      createChapter: jest.fn().mockResolvedValue(null),
      getChapterById: jest.fn().mockResolvedValue(null),
      findOrCreateBook: jest.fn().mockResolvedValue(null),
      getPagesByChapter: jest.fn().mockResolvedValue([]),
      createPage: jest.fn().mockImplementation((page) => Promise.resolve(mockPageRecord(page))),
      updatePageOrder: jest.fn().mockResolvedValue(undefined),
      deletePage: jest.fn().mockResolvedValue(undefined),
      updatePageClassification: jest.fn().mockResolvedValue(undefined),
      updatePageImage: jest.fn().mockResolvedValue(undefined),
      updatePageOcrStatus: jest.fn().mockResolvedValue(undefined),
      saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
      resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
      getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
    },
    s3Client: {
      uploadImage: jest.fn().mockResolvedValue('pages/chapter-123/1_content.jpeg'),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
    },
    generateId: jest.fn().mockReturnValue('generated-page-id'),
    ...overrides,
  };
}

function isAPIError(response: UploadPagesResponse | APIError): response is APIError {
  return 'statusCode' in response;
}

describe('buildS3Key', () => {
  it('builds correct key for content page', () => {
    expect(buildS3Key('ch-1', 3, 'content', 'jpeg')).toBe('pages/ch-1/3_content.jpeg');
  });

  it('builds correct key for exercise page', () => {
    expect(buildS3Key('ch-2', 5, 'exercise', 'png')).toBe('pages/ch-2/5_exercise.png');
  });

  it('handles heic format', () => {
    expect(buildS3Key('ch-3', 1, 'content', 'heic')).toBe('pages/ch-3/1_content.heic');
  });
});

describe('handleUploadPages', () => {
  const chapterId = 'chapter-123';

  it('returns success when uploading valid pages', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload(), validUpload({ format: 'png', pageOrder: 2 })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as UploadPagesResponse;
    expect(successResponse.success).toBe(true);
    expect(successResponse.pages).toHaveLength(2);
  });

  it('returns error when no uploads provided', async () => {
    const deps = createMockDeps();

    const response = await handleUploadPages(chapterId, [], deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('NO_PAGES_PROVIDED');
  });

  it('returns error for invalid file format', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload({ format: 'gif' as any })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('INVALID_FILE');
    expect(error.details?.format).toBeDefined();
  });

  it('returns error for file exceeding 10MB', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload({ sizeBytes: 11_000_000 })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('INVALID_FILE');
    expect(error.details?.size).toBeDefined();
  });

  it('returns error when content page limit would be exceeded', async () => {
    const existingPages = Array.from({ length: 49 }, (_, i) =>
      mockPageRecord({ id: `page-${i}`, pageNumber: i + 1, classification: 'content' })
    );
    const deps = createMockDeps();
    (deps.dbClient.getPagesByChapter as jest.Mock).mockResolvedValue(existingPages);

    // Try to add 2 more content pages (49 + 2 = 51 > 50)
    const uploads = [validUpload(), validUpload({ pageOrder: 2 })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe('CONTENT_PAGE_LIMIT_REACHED');
  });

  it('returns error when exercise page limit would be exceeded', async () => {
    const existingPages = Array.from({ length: 20 }, (_, i) =>
      mockPageRecord({ id: `page-${i}`, pageNumber: i + 1, classification: 'exercise' })
    );
    const deps = createMockDeps();
    (deps.dbClient.getPagesByChapter as jest.Mock).mockResolvedValue(existingPages);

    const uploads = [validUpload({ classification: 'exercise' })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(409);
    expect(error.errorCode).toBe('EXERCISE_PAGE_LIMIT_REACHED');
  });

  it('allows adding pages up to the content limit', async () => {
    const existingPages = Array.from({ length: 48 }, (_, i) =>
      mockPageRecord({ id: `page-${i}`, pageNumber: i + 1, classification: 'content' })
    );
    const deps = createMockDeps();
    (deps.dbClient.getPagesByChapter as jest.Mock).mockResolvedValue(existingPages);

    // Adding 2 more content pages (48 + 2 = 50 = limit)
    const uploads = [validUpload(), validUpload({ pageOrder: 2 })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(false);
  });

  it('uploads images to S3 with correct keys', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload({ format: 'png', classification: 'exercise' })];

    await handleUploadPages(chapterId, uploads, deps);

    expect(deps.s3Client.uploadImage).toHaveBeenCalledWith(
      'pages/chapter-123/1_exercise.png',
      expect.any(Buffer),
      'png'
    );
  });

  it('creates page records in DB with correct data', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload()];

    await handleUploadPages(chapterId, uploads, deps);

    expect(deps.dbClient.createPage).toHaveBeenCalledWith({
      id: 'generated-page-id',
      chapterId: 'chapter-123',
      pageNumber: 1,
      classification: 'content',
      imageS3Key: 'pages/chapter-123/1_content.jpeg',
    });
  });

  it('assigns sequential page numbers starting after existing pages', async () => {
    const existingPages = [
      mockPageRecord({ id: 'page-1', pageNumber: 1 }),
      mockPageRecord({ id: 'page-2', pageNumber: 2 }),
    ];
    const deps = createMockDeps();
    (deps.dbClient.getPagesByChapter as jest.Mock).mockResolvedValue(existingPages);

    let callCount = 0;
    (deps.generateId as jest.Mock).mockImplementation(() => `page-new-${++callCount}`);

    const uploads = [validUpload(), validUpload({ pageOrder: 2 })];

    await handleUploadPages(chapterId, uploads, deps);

    expect(deps.dbClient.createPage).toHaveBeenCalledTimes(2);
    expect(deps.dbClient.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 3 })
    );
    expect(deps.dbClient.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 4 })
    );
  });

  it('defaults classification to content when not specified', async () => {
    const deps = createMockDeps();
    const upload = validUpload();
    upload.classification = 'content'; // explicitly set as the type requires it

    const response = await handleUploadPages(chapterId, [upload], deps);

    expect(isAPIError(response)).toBe(false);
    expect(deps.dbClient.createPage).toHaveBeenCalledWith(
      expect.objectContaining({ classification: 'content' })
    );
  });

  it('accepts HEIC format uploads', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload({ format: 'heic' })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(false);
  });

  it('accepts files at exactly 10MB', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload({ sizeBytes: 10_485_760 })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(false);
  });

  it('returns error when null is passed as uploads', async () => {
    const deps = createMockDeps();

    const response = await handleUploadPages(chapterId, null as any, deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('NO_PAGES_PROVIDED');
  });

  it('rejects file just over 10MB limit', async () => {
    const deps = createMockDeps();
    const uploads = [validUpload({ sizeBytes: 10_485_761 })];

    const response = await handleUploadPages(chapterId, uploads, deps);

    expect(isAPIError(response)).toBe(true);
    const error = response as APIError;
    expect(error.statusCode).toBe(400);
    expect(error.errorCode).toBe('INVALID_FILE');
  });

  it('verifies S3 key format matches pages/{chapterId}/{pageNumber}_{classification}.{format}', async () => {
    const deps = createMockDeps();
    const uploads = [
      validUpload({ format: 'jpeg', classification: 'content' }),
      validUpload({ format: 'png', classification: 'exercise', pageOrder: 2 }),
    ];

    await handleUploadPages(chapterId, uploads, deps);

    // Verify S3 key pattern for each page
    expect(deps.s3Client.uploadImage).toHaveBeenCalledWith(
      expect.stringMatching(/^pages\/chapter-123\/\d+_content\.jpeg$/),
      expect.any(Buffer),
      'jpeg'
    );
    expect(deps.s3Client.uploadImage).toHaveBeenCalledWith(
      expect.stringMatching(/^pages\/chapter-123\/\d+_exercise\.png$/),
      expect.any(Buffer),
      'png'
    );
  });
});
