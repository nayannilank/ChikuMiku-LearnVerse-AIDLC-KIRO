import {
  handleSaveTranscript,
  validateTranscriptRequest,
  SaveTranscriptRequest,
  SaveTranscriptResponse,
  SaveTranscriptDependencies,
} from './save-transcript';
import { TranscriptPage, APIError } from '@chikumiku/types';
import { DBClient, ChapterWithPages } from '../clients/db-client';

function makePage(overrides: Partial<TranscriptPage> = {}): TranscriptPage {
  return {
    pageNumber: 1,
    classification: 'content',
    text: 'Sample transcript text for page.',
    language: 'en',
    ...overrides,
  };
}

function makeChapterWithPages(overrides: Partial<ChapterWithPages> = {}): ChapterWithPages {
  return {
    id: 'chapter-123',
    bookId: 'book-123',
    bookName: 'Test Book',
    subjectId: 'subject-123',
    chapterNumber: 1,
    chapterName: 'Chapter One',
    aiAssetsGenerated: false,
    academicYear: '2024-2025',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [],
    ...overrides,
  };
}

function createMockDbClient(overrides: Partial<DBClient> = {}): DBClient {
  return {
    getBooksBySubject: jest.fn().mockResolvedValue([]),
    getChaptersByBook: jest.fn().mockResolvedValue([]),
    chapterNumberExists: jest.fn().mockResolvedValue(false),
    createChapter: jest.fn(),
    getChapterById: jest.fn().mockResolvedValue(makeChapterWithPages()),
    findOrCreateBook: jest.fn(),
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
    ...overrides,
  };
}

function createMockDeps(overrides: Partial<SaveTranscriptDependencies> = {}): SaveTranscriptDependencies {
  return {
    dbClient: createMockDbClient(),
    ...overrides,
  };
}

function isAPIError(response: SaveTranscriptResponse | APIError): response is APIError {
  return 'statusCode' in response;
}

describe('validateTranscriptRequest', () => {
  it('returns valid for a correct request', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1 }), makePage({ pageNumber: 2 })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('returns error for empty pages array', () => {
    const request: SaveTranscriptRequest = { pages: [] };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errors.pages).toBeDefined();
  });

  it('returns error for page with empty text', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1, text: '' })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errors.page_1).toBeDefined();
  });

  it('returns error for page with whitespace-only text', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1, text: '   ' })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errors.page_1).toBeDefined();
  });

  it('returns error for invalid classification', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1, classification: 'invalid' as any })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errors.page_1_classification).toBeDefined();
  });

  it('returns error for non-positive page number', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 0 })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
  });

  it('returns error for duplicate page numbers', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1 }), makePage({ pageNumber: 1 })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errors.pageNumbers).toBeDefined();
  });

  it('returns error for missing language', () => {
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1, language: '' })],
    };
    const result = validateTranscriptRequest(request);
    expect(result.valid).toBe(false);
    expect(result.errors.page_1_language).toBeDefined();
  });
});

describe('handleSaveTranscript', () => {
  it('returns success on valid save', async () => {
    const deps = createMockDeps();
    const request: SaveTranscriptRequest = {
      pages: [
        makePage({ pageNumber: 1, classification: 'content' }),
        makePage({ pageNumber: 2, classification: 'exercise' }),
      ],
    };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as SaveTranscriptResponse;
    expect(successResponse.success).toBe(true);
    expect(successResponse.organized.contentPages).toHaveLength(1);
    expect(successResponse.organized.exercisePages).toHaveLength(1);
    expect(successResponse.organized.pageMarkers).toEqual(['Page 1', 'Page 2']);
  });

  it('returns validation error for empty chapter ID', async () => {
    const deps = createMockDeps();
    const request: SaveTranscriptRequest = { pages: [makePage()] };

    const response = await handleSaveTranscript('', request, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns validation error for pages with empty text', async () => {
    const deps = createMockDeps();
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1, text: '' })],
    };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.details?.page_1).toBeDefined();
  });

  it('returns 404 when chapter does not exist', async () => {
    const dbClient = createMockDbClient({
      getChapterById: jest.fn().mockResolvedValue(null),
    });
    const deps = createMockDeps({ dbClient });
    const request: SaveTranscriptRequest = { pages: [makePage()] };

    const response = await handleSaveTranscript('nonexistent-id', request, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(404);
    expect(errorResponse.errorCode).toBe('CHAPTER_NOT_FOUND');
  });

  it('calls saveTranscriptAtomic with correct data', async () => {
    const dbClient = createMockDbClient();
    const deps = createMockDeps({ dbClient });
    const request: SaveTranscriptRequest = {
      pages: [
        makePage({ pageNumber: 1, text: 'Hello world', language: 'en' }),
        makePage({ pageNumber: 2, text: 'Namaste', language: 'hi' }),
      ],
    };

    await handleSaveTranscript('chapter-123', request, deps);

    expect(dbClient.saveTranscriptAtomic).toHaveBeenCalledWith('chapter-123', [
      { pageNumber: 1, text: 'Hello world', language: 'en' },
      { pageNumber: 2, text: 'Namaste', language: 'hi' },
    ]);
  });

  it('resets AI flag when aiAssetsGenerated is true (Req 25.2)', async () => {
    const dbClient = createMockDbClient({
      getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: true }),
    });
    const deps = createMockDeps({ dbClient });
    const request: SaveTranscriptRequest = { pages: [makePage()] };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as SaveTranscriptResponse;
    expect(successResponse.aiAssetsReset).toBe(true);
    expect(dbClient.resetAiAssetsFlag).toHaveBeenCalledWith('chapter-123');
  });

  it('does not reset AI flag when aiAssetsGenerated is false', async () => {
    const dbClient = createMockDbClient({
      getChapterAiStatus: jest.fn().mockResolvedValue({ aiAssetsGenerated: false }),
    });
    const deps = createMockDeps({ dbClient });
    const request: SaveTranscriptRequest = { pages: [makePage()] };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as SaveTranscriptResponse;
    expect(successResponse.aiAssetsReset).toBe(false);
    expect(dbClient.resetAiAssetsFlag).not.toHaveBeenCalled();
  });

  it('does not call DB when validation fails', async () => {
    const dbClient = createMockDbClient();
    const deps = createMockDeps({ dbClient });
    const request: SaveTranscriptRequest = { pages: [] };

    await handleSaveTranscript('chapter-123', request, deps);

    expect(dbClient.getChapterById).not.toHaveBeenCalled();
    expect(dbClient.saveTranscriptAtomic).not.toHaveBeenCalled();
  });

  it('rejects duplicate page numbers at handler level', async () => {
    const deps = createMockDeps();
    const request: SaveTranscriptRequest = {
      pages: [
        makePage({ pageNumber: 3, text: 'Page A text' }),
        makePage({ pageNumber: 3, text: 'Page B text' }),
      ],
    };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.errorCode).toBe('VALIDATION_ERROR');
    expect(errorResponse.details?.pageNumbers).toBeDefined();
  });

  it('rejects invalid classification at handler level', async () => {
    const deps = createMockDeps();
    const request: SaveTranscriptRequest = {
      pages: [makePage({ pageNumber: 1, classification: 'homework' as any })],
    };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.errorCode).toBe('VALIDATION_ERROR');
  });

  it('persists atomically — saveTranscriptAtomic called exactly once', async () => {
    const dbClient = createMockDbClient();
    const deps = createMockDeps({ dbClient });
    const request: SaveTranscriptRequest = {
      pages: [
        makePage({ pageNumber: 1, text: 'Page 1 text', language: 'en' }),
        makePage({ pageNumber: 2, text: 'Page 2 text', language: 'en' }),
        makePage({ pageNumber: 3, text: 'Page 3 text', language: 'hi' }),
      ],
    };

    const response = await handleSaveTranscript('chapter-123', request, deps);

    expect(isAPIError(response)).toBe(false);
    // Atomic save: single call with all pages, not individual page saves
    expect(dbClient.saveTranscriptAtomic).toHaveBeenCalledTimes(1);
    expect(dbClient.saveTranscriptAtomic).toHaveBeenCalledWith('chapter-123', [
      { pageNumber: 1, text: 'Page 1 text', language: 'en' },
      { pageNumber: 2, text: 'Page 2 text', language: 'en' },
      { pageNumber: 3, text: 'Page 3 text', language: 'hi' },
    ]);
  });
});
