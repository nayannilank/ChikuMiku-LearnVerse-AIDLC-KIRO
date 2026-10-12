/**
 * Unit tests for the edit-chapter handler.
 */
import {
  handleEditChapter,
  type EditChapterDependencies,
} from './edit-chapter';
import type { APIError } from '@chikumiku/types';
import type { ChapterRecord, ChapterWithPages } from '../clients/db-client';

function isError(result: unknown): result is APIError {
  return typeof result === 'object' && result !== null && 'statusCode' in result;
}

function chapterRecord(overrides?: Partial<ChapterRecord>): ChapterRecord {
  return {
    id: 'c-1',
    bookId: 'b-1',
    chapterNumber: 1,
    chapterName: 'Intro',
    aiAssetsGenerated: false,
    academicYear: '2025-2026',
    createdAt: 'x',
    updatedAt: 'y',
    ...overrides,
  };
}

function chapterWithPages(overrides?: Partial<ChapterWithPages>): ChapterWithPages {
  return {
    ...chapterRecord(),
    bookName: 'NCERT',
    subjectId: 's-1',
    pages: [],
    ...overrides,
  };
}

function makeDeps(overrides?: Partial<EditChapterDependencies['dbClient']>): EditChapterDependencies {
  return {
    dbClient: {
      getChapterById: jest.fn().mockResolvedValue(chapterWithPages()),
      chapterNumberExistsExcluding: jest.fn().mockResolvedValue(false),
      updateChapter: jest.fn().mockResolvedValue(chapterRecord({ chapterName: 'Updated' })),
      // Unused by this handler; present to satisfy the DBClient type.
      listSubjectsByLearner: jest.fn(),
      getTranscriptByChapter: jest.fn(),
      getBooksBySubject: jest.fn(),
      findOrCreateBook: jest.fn(),
      getChaptersByBook: jest.fn(),
      chapterNumberExists: jest.fn(),
      createChapter: jest.fn(),
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
    } as EditChapterDependencies['dbClient'],
  };
}

describe('handleEditChapter', () => {
  it('returns 400 when chapterId is missing', async () => {
    const result = await handleEditChapter('', { chapterName: 'X' }, makeDeps());
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.statusCode).toBe(400);
  });

  it('returns 400 when no fields are provided', async () => {
    const result = await handleEditChapter('c-1', {}, makeDeps());
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.statusCode).toBe(400);
  });

  it('returns 400 for an invalid chapter name', async () => {
    const result = await handleEditChapter('c-1', { chapterName: 'A' }, makeDeps());
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for an out-of-range chapter number', async () => {
    const result = await handleEditChapter('c-1', { chapterNumber: 1000 }, makeDeps());
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.errorCode).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when the chapter does not exist', async () => {
    const deps = makeDeps({ getChapterById: jest.fn().mockResolvedValue(null) });
    const result = await handleEditChapter('missing', { chapterName: 'Valid Name' }, deps);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.statusCode).toBe(404);
  });

  it('returns 409 when the new chapter number clashes within the book', async () => {
    const deps = makeDeps({
      getChapterById: jest.fn().mockResolvedValue(chapterWithPages({ chapterNumber: 1 })),
      chapterNumberExistsExcluding: jest.fn().mockResolvedValue(true),
    });
    const result = await handleEditChapter('c-1', { chapterNumber: 2 }, deps);
    expect(isError(result)).toBe(true);
    if (isError(result)) expect(result.statusCode).toBe(409);
  });

  it('does not check for a clash when the number is unchanged', async () => {
    const deps = makeDeps({
      getChapterById: jest.fn().mockResolvedValue(chapterWithPages({ chapterNumber: 3 })),
    });
    await handleEditChapter('c-1', { chapterNumber: 3, chapterName: 'New Name' }, deps);
    expect(deps.dbClient.chapterNumberExistsExcluding).not.toHaveBeenCalled();
  });

  it('updates and returns the chapter on success', async () => {
    const deps = makeDeps();
    const result = await handleEditChapter('c-1', { chapterName: 'Updated Name' }, deps);
    expect(isError(result)).toBe(false);
    expect(deps.dbClient.updateChapter).toHaveBeenCalledWith('c-1', {
      chapterName: 'Updated Name',
      chapterNumber: undefined,
    });
  });
});
