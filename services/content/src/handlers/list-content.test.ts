/**
 * Unit tests for the content listing handlers.
 */
import {
  handleListSubjects,
  handleListBooks,
  handleListChapters,
  handleGetTranscript,
  type ListContentDependencies,
} from './list-content';
import type { APIError } from '@chikumiku/types';

function isError(result: unknown): result is APIError {
  return typeof result === 'object' && result !== null && 'statusCode' in result;
}

function makeDeps(overrides?: Partial<ListContentDependencies['dbClient']>): ListContentDependencies {
  return {
    dbClient: {
      listSubjectsByLearner: jest.fn().mockResolvedValue([]),
      getBooksBySubject: jest.fn().mockResolvedValue([]),
      getChaptersByBook: jest.fn().mockResolvedValue([]),
      getTranscriptByChapter: jest.fn().mockResolvedValue([]),
      // Unused by these handlers; present to satisfy the DBClient type.
      findOrCreateBook: jest.fn(),
      chapterNumberExists: jest.fn(),
      createChapter: jest.fn(),
      getChapterById: jest.fn(),
      getPagesByChapter: jest.fn(),
      createPage: jest.fn(),
      updatePageOrder: jest.fn(),
      deletePage: jest.fn(),
      updatePageClassification: jest.fn(),
      updatePageImage: jest.fn(),
      updatePageOcrStatus: jest.fn(),
      saveTranscriptAtomic: jest.fn(),
      resetAiAssetsFlag: jest.fn(),
      getChapterAiStatus: jest.fn(),
      ...overrides,
    } as ListContentDependencies['dbClient'],
  };
}

describe('handleListSubjects', () => {
  it('returns 400 when learnerId is missing', async () => {
    const result = await handleListSubjects('', makeDeps());
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.statusCode).toBe(400);
  });

  it('returns the learner subjects', async () => {
    const deps = makeDeps({
      listSubjectsByLearner: jest
        .fn()
        .mockResolvedValue([{ id: 's-1', name: 'Maths' }]),
    });
    const result = await handleListSubjects('l-1', deps);
    expect(result).toEqual({ success: true, subjects: [{ id: 's-1', name: 'Maths' }] });
    expect(deps.dbClient.listSubjectsByLearner).toHaveBeenCalledWith('l-1');
  });
});

describe('handleListBooks', () => {
  it('returns 400 when subjectId is missing', async () => {
    const result = await handleListBooks('', 'l-1', makeDeps());
    expect(isError(result)).toBe(true);
  });

  it('returns 400 when learnerId is missing', async () => {
    const result = await handleListBooks('s-1', '', makeDeps());
    expect(isError(result)).toBe(true);
  });

  it('returns the books for a subject + learner', async () => {
    const book = { id: 'b-1', learnerId: 'l-1', subjectId: 's-1', name: 'NCERT', createdAt: 'x' };
    const deps = makeDeps({ getBooksBySubject: jest.fn().mockResolvedValue([book]) });
    const result = await handleListBooks('s-1', 'l-1', deps);
    expect(result).toEqual({ success: true, books: [book] });
    expect(deps.dbClient.getBooksBySubject).toHaveBeenCalledWith('s-1', 'l-1');
  });
});

describe('handleListChapters', () => {
  it('returns 400 when bookId is missing', async () => {
    const result = await handleListChapters('', makeDeps());
    expect(isError(result)).toBe(true);
  });

  it('returns the chapters for a book', async () => {
    const chapter = {
      id: 'c-1', bookId: 'b-1', chapterNumber: 1, chapterName: 'Intro',
      aiAssetsGenerated: false, academicYear: '2025-2026', createdAt: 'x', updatedAt: 'y',
    };
    const deps = makeDeps({ getChaptersByBook: jest.fn().mockResolvedValue([chapter]) });
    const result = await handleListChapters('b-1', deps);
    expect(result).toEqual({ success: true, chapters: [chapter] });
    expect(deps.dbClient.getChaptersByBook).toHaveBeenCalledWith('b-1');
  });
});

describe('handleGetTranscript', () => {
  it('returns 400 when chapterId is missing', async () => {
    const result = await handleGetTranscript('', makeDeps());
    expect(isError(result)).toBe(true);
  });

  it('returns the transcript pages', async () => {
    const pages = [{ pageNumber: 1, classification: 'content' as const, text: 'Hi', language: 'en' }];
    const deps = makeDeps({ getTranscriptByChapter: jest.fn().mockResolvedValue(pages) });
    const result = await handleGetTranscript('c-1', deps);
    expect(result).toEqual({ success: true, pages });
    expect(deps.dbClient.getTranscriptByChapter).toHaveBeenCalledWith('c-1');
  });
});
