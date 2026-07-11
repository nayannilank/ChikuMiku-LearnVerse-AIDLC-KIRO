import {
  handleCreateChapter,
  validateChapterCreation,
  CreateChapterDependencies,
  CreateChapterResponse,
} from './create-chapter';
import { ChapterCreateRequest, APIError } from '@chikumiku/types';
import { DBClient, BookRecord, ChapterRecord } from '../clients/db-client';

// Helper to create a valid chapter creation request
function validRequest(overrides: Partial<ChapterCreateRequest> = {}): ChapterCreateRequest {
  return {
    subjectId: 'subject-123',
    bookName: 'Mathematics Part 1',
    chapterNumber: 1,
    chapterName: 'Introduction to Algebra',
    ...overrides,
  };
}

// Helper to create a mock book record
function mockBook(overrides: Partial<BookRecord> = {}): BookRecord {
  return {
    id: 'book-123',
    learnerId: 'learner-123',
    subjectId: 'subject-123',
    name: 'Mathematics Part 1',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock chapter record
function mockChapter(overrides: Partial<ChapterRecord> = {}): ChapterRecord {
  return {
    id: 'chapter-123',
    bookId: 'book-123',
    chapterNumber: 1,
    chapterName: 'Introduction to Algebra',
    aiAssetsGenerated: false,
    academicYear: '2024-2025',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock dependencies
function createMockDeps(overrides: Partial<CreateChapterDependencies> = {}): CreateChapterDependencies {
  return {
    dbClient: {
      getBooksBySubject: jest.fn().mockResolvedValue([mockBook()]),
      getChaptersByBook: jest.fn().mockResolvedValue([]),
      chapterNumberExists: jest.fn().mockResolvedValue(false),
      createChapter: jest.fn().mockResolvedValue(mockChapter()),
      getChapterById: jest.fn().mockResolvedValue(null),
      findOrCreateBook: jest.fn().mockResolvedValue(mockBook()),
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
    generateId: () => 'generated-uuid',
    getAcademicYear: () => '2024-2025',
    ...overrides,
  };
}

function isAPIError(response: CreateChapterResponse | APIError): response is APIError {
  return 'statusCode' in response;
}

describe('validateChapterCreation', () => {
  it('returns valid for a correct request', () => {
    const result = validateChapterCreation(validRequest());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it('returns error for empty subjectId', () => {
    const result = validateChapterCreation(validRequest({ subjectId: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.subjectId).toBeDefined();
  });

  it('returns error for book name too short', () => {
    const result = validateChapterCreation(validRequest({ bookName: 'AB' }));
    expect(result.valid).toBe(false);
    expect(result.errors.bookName).toBeDefined();
  });

  it('returns error for book name too long', () => {
    const result = validateChapterCreation(validRequest({ bookName: 'A'.repeat(51) }));
    expect(result.valid).toBe(false);
    expect(result.errors.bookName).toBeDefined();
  });

  it('returns error for book name with invalid characters', () => {
    const result = validateChapterCreation(validRequest({ bookName: 'Book @#$' }));
    expect(result.valid).toBe(false);
    expect(result.errors.bookName).toBeDefined();
  });

  it('returns error for chapter number below 1', () => {
    const result = validateChapterCreation(validRequest({ chapterNumber: 0 }));
    expect(result.valid).toBe(false);
    expect(result.errors.chapterNumber).toBeDefined();
  });

  it('returns error for chapter number above 999', () => {
    const result = validateChapterCreation(validRequest({ chapterNumber: 1000 }));
    expect(result.valid).toBe(false);
    expect(result.errors.chapterNumber).toBeDefined();
  });

  it('returns error for non-integer chapter number', () => {
    const result = validateChapterCreation(validRequest({ chapterNumber: 1.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.chapterNumber).toBeDefined();
  });

  it('returns error for chapter name too short', () => {
    const result = validateChapterCreation(validRequest({ chapterName: 'AB' }));
    expect(result.valid).toBe(false);
    expect(result.errors.chapterName).toBeDefined();
  });

  it('returns error for chapter name too long', () => {
    const result = validateChapterCreation(validRequest({ chapterName: 'A'.repeat(101) }));
    expect(result.valid).toBe(false);
    expect(result.errors.chapterName).toBeDefined();
  });

  it('accepts valid book name with colons and hyphens', () => {
    const result = validateChapterCreation(validRequest({ bookName: 'Science: Part-1' }));
    expect(result.valid).toBe(true);
  });

  it('accepts chapter number at boundary 1', () => {
    const result = validateChapterCreation(validRequest({ chapterNumber: 1 }));
    expect(result.valid).toBe(true);
  });

  it('accepts chapter number at boundary 999', () => {
    const result = validateChapterCreation(validRequest({ chapterNumber: 999 }));
    expect(result.valid).toBe(true);
  });
});

describe('handleCreateChapter', () => {
  const learnerId = 'learner-123';

  it('returns success on valid chapter creation', async () => {
    const deps = createMockDeps();
    const response = await handleCreateChapter(validRequest(), learnerId, deps);

    expect(isAPIError(response)).toBe(false);
    const successResponse = response as CreateChapterResponse;
    expect(successResponse.success).toBe(true);
    expect(successResponse.chapter).toBeDefined();
  });

  it('returns validation error for invalid fields without hitting DB', async () => {
    const deps = createMockDeps();
    const response = await handleCreateChapter(validRequest({ bookName: 'AB' }), learnerId, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(400);
    expect(errorResponse.errorCode).toBe('VALIDATION_ERROR');
    expect(errorResponse.details?.bookName).toBeDefined();
    expect(deps.dbClient.getBooksBySubject).not.toHaveBeenCalled();
  });

  it('returns error when book limit per subject is reached', async () => {
    // Generate 50 existing books (none matching the request book name)
    const existingBooks = Array.from({ length: 50 }, (_, i) =>
      mockBook({ id: `book-${i}`, name: `Existing Book ${i}` })
    );
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue(existingBooks),
        getChaptersByBook: jest.fn().mockResolvedValue([]),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(mockChapter()),
        getChapterById: jest.fn().mockResolvedValue(null),
        findOrCreateBook: jest.fn().mockResolvedValue(mockBook()),
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

    const response = await handleCreateChapter(
      validRequest({ bookName: 'Brand New Book' }),
      learnerId,
      deps,
    );

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(409);
    expect(errorResponse.errorCode).toBe('BOOK_LIMIT_REACHED');
  });

  it('allows adding chapter to existing book even when at book limit', async () => {
    // 50 books exist, but one matches the requested book name
    const existingBooks = Array.from({ length: 50 }, (_, i) =>
      mockBook({ id: `book-${i}`, name: i === 0 ? 'Mathematics Part 1' : `Existing Book ${i}` })
    );
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue(existingBooks),
        getChaptersByBook: jest.fn().mockResolvedValue([]),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(mockChapter()),
        getChapterById: jest.fn().mockResolvedValue(null),
        findOrCreateBook: jest.fn().mockResolvedValue(mockBook({ id: 'book-0' })),
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

    const response = await handleCreateChapter(validRequest(), learnerId, deps);
    expect(isAPIError(response)).toBe(false);
  });

  it('returns error when chapter limit per book is reached', async () => {
    const existingChapters = Array.from({ length: 100 }, (_, i) =>
      mockChapter({ id: `chapter-${i}`, chapterNumber: i + 1 })
    );
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue([mockBook()]),
        getChaptersByBook: jest.fn().mockResolvedValue(existingChapters),
        chapterNumberExists: jest.fn().mockResolvedValue(false),
        createChapter: jest.fn().mockResolvedValue(mockChapter()),
        getChapterById: jest.fn().mockResolvedValue(null),
        findOrCreateBook: jest.fn().mockResolvedValue(mockBook()),
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

    const response = await handleCreateChapter(validRequest(), learnerId, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(409);
    expect(errorResponse.errorCode).toBe('CHAPTER_LIMIT_REACHED');
  });

  it('returns error when duplicate chapter number exists in book', async () => {
    const deps = createMockDeps({
      dbClient: {
        getBooksBySubject: jest.fn().mockResolvedValue([mockBook()]),
        getChaptersByBook: jest.fn().mockResolvedValue([mockChapter()]),
        chapterNumberExists: jest.fn().mockResolvedValue(true),
        createChapter: jest.fn().mockResolvedValue(mockChapter()),
        getChapterById: jest.fn().mockResolvedValue(null),
        findOrCreateBook: jest.fn().mockResolvedValue(mockBook()),
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

    const response = await handleCreateChapter(validRequest(), learnerId, deps);

    expect(isAPIError(response)).toBe(true);
    const errorResponse = response as APIError;
    expect(errorResponse.statusCode).toBe(409);
    expect(errorResponse.errorCode).toBe('DUPLICATE_CHAPTER_NUMBER');
    expect(errorResponse.details?.chapterNumber).toBeDefined();
  });

  it('uses generateId for the chapter ID', async () => {
    const deps = createMockDeps({ generateId: () => 'custom-id-456' });
    await handleCreateChapter(validRequest(), learnerId, deps);

    expect(deps.dbClient.createChapter).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'custom-id-456' })
    );
  });

  it('uses getAcademicYear for the academic year field', async () => {
    const deps = createMockDeps({ getAcademicYear: () => '2025-2026' });
    await handleCreateChapter(validRequest(), learnerId, deps);

    expect(deps.dbClient.createChapter).toHaveBeenCalledWith(
      expect.objectContaining({ academicYear: '2025-2026' })
    );
  });
});
