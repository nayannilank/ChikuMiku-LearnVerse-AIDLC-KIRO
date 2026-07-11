import {
  handleGetChapter,
  GetChapterResponse,
  GetChapterDependencies,
} from './get-chapter';
import { APIError } from '@chikumiku/types';
import { ChapterWithPages, PageRecord } from '../clients/db-client';

// Helper to create a mock page record
function mockPage(overrides: Partial<PageRecord> = {}): PageRecord {
  return {
    id: 'page-1',
    chapterId: 'chapter-123',
    pageNumber: 1,
    classification: 'content',
    imageS3Key: 'images/page-1.jpg',
    transcriptText: 'Some transcript text',
    detectedLanguage: 'en',
    ocrStatus: 'completed',
    processedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock chapter with pages
function mockChapterWithPages(overrides: Partial<ChapterWithPages> = {}): ChapterWithPages {
  return {
    id: 'chapter-123',
    bookId: 'book-123',
    bookName: 'Mathematics Part 1',
    subjectId: 'subject-123',
    chapterNumber: 1,
    chapterName: 'Introduction to Algebra',
    aiAssetsGenerated: false,
    academicYear: '2024-2025',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [
      mockPage({ id: 'page-1', pageNumber: 1, classification: 'content' }),
      mockPage({ id: 'page-2', pageNumber: 2, classification: 'content' }),
      mockPage({ id: 'page-3', pageNumber: 3, classification: 'exercise' }),
    ],
    ...overrides,
  };
}

// Helper to create mock dependencies
function createMockDeps(overrides: Partial<GetChapterDependencies> = {}): GetChapterDependencies {
  return {
    dbClient: {
      getBooksBySubject: jest.fn().mockResolvedValue([]),
      getChaptersByBook: jest.fn().mockResolvedValue([]),
      chapterNumberExists: jest.fn().mockResolvedValue(false),
      createChapter: jest.fn().mockResolvedValue(null),
      getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages()),
      findOrCreateBook: jest.fn().mockResolvedValue(null),
      getPagesByChapter: jest.fn().mockResolvedValue([]),
      createPage: jest.fn(),
      updatePageOrder: jest.fn(),
      deletePage: jest.fn(),
      updatePageClassification: jest.fn(),
      updatePageImage: jest.fn(),
      updatePageOcrStatus: jest.fn(),
      saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
      resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
      getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
    },
    ...overrides,
  };
}

function isAPIError(response: GetChapterResponse | APIError): response is APIError {
  return 'statusCode' in response;
}

describe('handleGetChapter', () => {
  it('returns chapter details with pages on valid request', async () => {
    const deps = createMockDeps();
    const response = await handleGetChapter('chapter-123', deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as GetChapterResponse;
    expect(successResponse.success).toBe(true);
    expect(successResponse.chapter.id).toBe('chapter-123');
    expect(successResponse.chapter.chapterName).toBe('Introduction to Algebra');
    expect(successResponse.chapter.pages).toHaveLength(3);
  });

  it('returns correct page counts by classification', async () => {
    const deps = createMockDeps();
    const response = await handleGetChapter('chapter-123', deps);

    const successResponse = response as GetChapterResponse;
    expect(successResponse.chapter.totalContentPages).toBe(2);
    expect(successResponse.chapter.totalExercisePages).toBe(1);
  });

  it('returns hasTranscript correctly for pages', async () => {
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue([]),
        getChaptersByBook: jest.fn().mockResolvedValue([]),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(null),
        getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages({
          pages: [
            mockPage({ id: 'page-1', transcriptText: 'Has text' }),
            mockPage({ id: 'page-2', transcriptText: null }),
            mockPage({ id: 'page-3', transcriptText: '' }),
          ],
        })),
        findOrCreateBook: jest.fn().mockResolvedValue(null),
        getPagesByChapter: jest.fn().mockResolvedValue([]),
        createPage: jest.fn(),
        updatePageOrder: jest.fn(),
        deletePage: jest.fn(),
        updatePageClassification: jest.fn(),
        updatePageImage: jest.fn(),
        updatePageOcrStatus: jest.fn(),
        saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
        resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
        getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
      },
    });

    const response = await handleGetChapter('chapter-123', deps);
    const successResponse = response as GetChapterResponse;

    expect(successResponse.chapter.pages[0].hasTranscript).toBe(true);
    expect(successResponse.chapter.pages[1].hasTranscript).toBe(false);
    expect(successResponse.chapter.pages[2].hasTranscript).toBe(false);
  });

  it('includes AI assets generated status', async () => {
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue([]),
        getChaptersByBook: jest.fn().mockResolvedValue([]),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(null),
        getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages({ aiAssetsGenerated: true })),
        findOrCreateBook: jest.fn().mockResolvedValue(null),
        getPagesByChapter: jest.fn().mockResolvedValue([]),
        createPage: jest.fn(),
        updatePageOrder: jest.fn(),
        deletePage: jest.fn(),
        updatePageClassification: jest.fn(),
        updatePageImage: jest.fn(),
        updatePageOcrStatus: jest.fn(),
        saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
        resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
        getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: true }),
      },
    });

    const response = await handleGetChapter('chapter-123', deps);
    const successResponse = response as GetChapterResponse;
    expect(successResponse.chapter.aiAssetsGenerated).toBe(true);
  });

  it('returns 404 when chapter is not found', async () => {
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue([]),
        getChaptersByBook: jest.fn().mockResolvedValue([]),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(null),
        getChapterById: jest.fn().mockResolvedValue(null),
        findOrCreateBook: jest.fn().mockResolvedValue(null),
        getPagesByChapter: jest.fn().mockResolvedValue([]),
        createPage: jest.fn(),
        updatePageOrder: jest.fn(),
        deletePage: jest.fn(),
        updatePageClassification: jest.fn(),
        updatePageImage: jest.fn(),
        updatePageOcrStatus: jest.fn(),
        saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
        resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
        getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
      },
    });

    const response = await handleGetChapter('nonexistent-id', deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(404);
    expect(errorResponse.errorCode).toBe('CHAPTER_NOT_FOUND');
  });

  it('returns validation error for empty chapter ID', async () => {
    const deps = createMockDeps();
    const response = await handleGetChapter('', deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns validation error for whitespace-only chapter ID', async () => {
    const deps = createMockDeps();
    const response = await handleGetChapter('   ', deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
  });

  it('returns chapter with empty pages array when no pages exist', async () => {
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue([]),
        getChaptersByBook: jest.fn().mockResolvedValue([]),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(null),
        getChapterById: jest.fn().mockResolvedValue(mockChapterWithPages({ pages: [] })),
        findOrCreateBook: jest.fn().mockResolvedValue(null),
        getPagesByChapter: jest.fn().mockResolvedValue([]),
        createPage: jest.fn(),
        updatePageOrder: jest.fn(),
        deletePage: jest.fn(),
        updatePageClassification: jest.fn(),
        updatePageImage: jest.fn(),
        updatePageOcrStatus: jest.fn(),
        saveTranscriptAtomic: jest.fn().mockResolvedValue(undefined),
        resetAiAssetsFlag: jest.fn().mockResolvedValue(undefined),
        getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
      },
    });

    const response = await handleGetChapter('chapter-123', deps);
    const successResponse = response as GetChapterResponse;
    expect(successResponse.chapter.pages).toHaveLength(0);
    expect(successResponse.chapter.totalContentPages).toBe(0);
    expect(successResponse.chapter.totalExercisePages).toBe(0);
  });
});
