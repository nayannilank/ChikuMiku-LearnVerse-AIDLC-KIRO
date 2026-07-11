import {
  reorderPages,
  deletePage,
  recapturePage,
  toggleClassification,
  ManagePagesDependencies,
} from './manage-pages';
import { PageUpload, APIError } from '@chikumiku/types';
import { PageRecord } from '../clients/db-client';

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
function createMockDeps(
  existingPages: PageRecord[] = [mockPageRecord()]
): ManagePagesDependencies {
  return {
    dbClient: {
      getBooksBySubject: jest.fn().mockResolvedValue([]),
      getChaptersByBook: jest.fn().mockResolvedValue([]),
      chapterNumberExists: jest.fn().mockResolvedValue(false),
      createChapter: jest.fn().mockResolvedValue(null),
      getChapterById: jest.fn().mockResolvedValue(null),
      findOrCreateBook: jest.fn().mockResolvedValue(null),
      getPagesByChapter: jest.fn().mockResolvedValue(existingPages),
      createPage: jest.fn().mockResolvedValue(null),
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
      uploadImage: jest.fn().mockResolvedValue('new-key'),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://signed-url'),
    },
  };
}

function isAPIError(response: any): response is APIError {
  return 'statusCode' in response;
}

describe('reorderPages', () => {
  const chapterId = 'chapter-123';

  it('returns success when reordering valid pages', async () => {
    const pages = [
      mockPageRecord({ id: 'page-1', pageNumber: 1 }),
      mockPageRecord({ id: 'page-2', pageNumber: 2 }),
    ];
    const deps = createMockDeps(pages);

    const response = await reorderPages(
      chapterId,
      [
        { pageId: 'page-2', pageNumber: 1 },
        { pageId: 'page-1', pageNumber: 2 },
      ],
      deps
    );

    expect(isAPIError(response)).toBe(false);
    expect(response).toEqual({ success: true });
    expect(deps.dbClient.updatePageOrder).toHaveBeenCalledWith(chapterId, [
      { pageId: 'page-2', pageNumber: 1 },
      { pageId: 'page-1', pageNumber: 2 },
    ]);
  });

  it('returns error when no order provided', async () => {
    const deps = createMockDeps();

    const response = await reorderPages(chapterId, [], deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('INVALID_ORDER');
  });

  it('returns error when page does not belong to chapter', async () => {
    const pages = [mockPageRecord({ id: 'page-1' })];
    const deps = createMockDeps(pages);

    const response = await reorderPages(
      chapterId,
      [{ pageId: 'nonexistent-page', pageNumber: 1 }],
      deps
    );

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('PAGE_NOT_FOUND');
  });
});

describe('deletePage', () => {
  const chapterId = 'chapter-123';

  it('returns success when deleting a page with other pages remaining', async () => {
    const pages = [
      mockPageRecord({ id: 'page-1', pageNumber: 1 }),
      mockPageRecord({ id: 'page-2', pageNumber: 2 }),
    ];
    const deps = createMockDeps(pages);

    const response = await deletePage(chapterId, 'page-1', deps);

    expect(isAPIError(response)).toBe(false);
    expect(response).toEqual({ success: true });
    expect(deps.s3Client.deleteImage).toHaveBeenCalledWith('pages/chapter-123/1_content.jpeg');
    expect(deps.dbClient.deletePage).toHaveBeenCalledWith('page-1');
  });

  it('returns error when trying to delete the last page', async () => {
    const pages = [mockPageRecord({ id: 'page-1' })];
    const deps = createMockDeps(pages);

    const response = await deletePage(chapterId, 'page-1', deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('MINIMUM_PAGES_REQUIRED');
  });

  it('returns error when page not found', async () => {
    const pages = [mockPageRecord({ id: 'page-1' })];
    const deps = createMockDeps(pages);

    const response = await deletePage(chapterId, 'nonexistent', deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('PAGE_NOT_FOUND');
  });
});

describe('recapturePage', () => {
  const chapterId = 'chapter-123';

  it('returns success when recapturing with valid image', async () => {
    const pages = [mockPageRecord({ id: 'page-1', imageS3Key: 'pages/chapter-123/1_content.jpeg' })];
    const deps = createMockDeps(pages);

    const newImage: PageUpload = {
      imageData: Buffer.from('new-image-data'),
      format: 'png',
      sizeBytes: 2_000_000,
      pageOrder: 1,
      classification: 'content',
    };

    const response = await recapturePage(chapterId, 'page-1', newImage, deps);

    expect(isAPIError(response)).toBe(false);
    expect((response as any).success).toBe(true);
    expect((response as any).page.imageS3Key).toBe('pages/chapter-123/1_content.png');
    expect(deps.s3Client.deleteImage).toHaveBeenCalledWith('pages/chapter-123/1_content.jpeg');
    expect(deps.s3Client.uploadImage).toHaveBeenCalled();
    expect(deps.dbClient.updatePageImage).toHaveBeenCalledWith('page-1', 'pages/chapter-123/1_content.png');
  });

  it('returns error for invalid file format', async () => {
    const pages = [mockPageRecord({ id: 'page-1' })];
    const deps = createMockDeps(pages);

    const newImage: PageUpload = {
      imageData: Buffer.from('data'),
      format: 'bmp' as any,
      sizeBytes: 1_000_000,
      pageOrder: 1,
      classification: 'content',
    };

    const response = await recapturePage(chapterId, 'page-1', newImage, deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('INVALID_FILE');
  });

  it('returns error for file too large', async () => {
    const pages = [mockPageRecord({ id: 'page-1' })];
    const deps = createMockDeps(pages);

    const newImage: PageUpload = {
      imageData: Buffer.from('data'),
      format: 'jpeg',
      sizeBytes: 11_000_000,
      pageOrder: 1,
      classification: 'content',
    };

    const response = await recapturePage(chapterId, 'page-1', newImage, deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('INVALID_FILE');
  });

  it('returns error when page not found', async () => {
    const deps = createMockDeps([]);

    const newImage: PageUpload = {
      imageData: Buffer.from('data'),
      format: 'jpeg',
      sizeBytes: 1_000_000,
      pageOrder: 1,
      classification: 'content',
    };

    const response = await recapturePage(chapterId, 'nonexistent', newImage, deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('PAGE_NOT_FOUND');
  });
});

describe('toggleClassification', () => {
  const chapterId = 'chapter-123';

  it('toggles from content to exercise', async () => {
    const pages = [mockPageRecord({ id: 'page-1', classification: 'content' })];
    const deps = createMockDeps(pages);

    const response = await toggleClassification(chapterId, 'page-1', deps);

    expect(isAPIError(response)).toBe(false);
    expect((response as any).newClassification).toBe('exercise');
    expect(deps.dbClient.updatePageClassification).toHaveBeenCalledWith('page-1', 'exercise');
  });

  it('toggles from exercise to content', async () => {
    const pages = [mockPageRecord({ id: 'page-1', classification: 'exercise' })];
    const deps = createMockDeps(pages);

    const response = await toggleClassification(chapterId, 'page-1', deps);

    expect(isAPIError(response)).toBe(false);
    expect((response as any).newClassification).toBe('content');
    expect(deps.dbClient.updatePageClassification).toHaveBeenCalledWith('page-1', 'content');
  });

  it('returns error when toggling would exceed exercise limit', async () => {
    // 20 exercise pages already, try to toggle a content page to exercise
    const pages = [
      ...Array.from({ length: 20 }, (_, i) =>
        mockPageRecord({ id: `ex-${i}`, classification: 'exercise', pageNumber: i + 1 })
      ),
      mockPageRecord({ id: 'content-1', classification: 'content', pageNumber: 21 }),
    ];
    const deps = createMockDeps(pages);

    const response = await toggleClassification(chapterId, 'content-1', deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('EXERCISE_PAGE_LIMIT_REACHED');
  });

  it('returns error when toggling would exceed content limit', async () => {
    // 50 content pages already, try to toggle an exercise page to content
    const pages = [
      ...Array.from({ length: 50 }, (_, i) =>
        mockPageRecord({ id: `content-${i}`, classification: 'content', pageNumber: i + 1 })
      ),
      mockPageRecord({ id: 'ex-1', classification: 'exercise', pageNumber: 51 }),
    ];
    const deps = createMockDeps(pages);

    const response = await toggleClassification(chapterId, 'ex-1', deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('CONTENT_PAGE_LIMIT_REACHED');
  });

  it('returns error when page not found', async () => {
    const deps = createMockDeps([]);

    const response = await toggleClassification(chapterId, 'nonexistent', deps);

    expect(isAPIError(response)).toBe(true);
    expect((response as APIError).errorCode).toBe('PAGE_NOT_FOUND');
  });
});
