/**
 * Unit tests for the content NeonDBClient.
 *
 * Mocks the pg pool's query() for direct queries and mocks withTransaction()
 * (from @chikumiku/db) for the transactional methods by invoking the callback
 * with a fake client whose query() is a jest.fn. No real database is touched.
 * The real row mappers (toIso/toIsoOrNull/toNumber) are preserved.
 */

jest.mock('@chikumiku/db', () => {
  const actual = jest.requireActual('@chikumiku/db');
  return {
    ...actual,
    getPool: jest.fn(),
    withTransaction: jest.fn(),
  };
});

import { withTransaction } from '@chikumiku/db';
import type { Pool } from '@chikumiku/db';
import { NeonDBClient } from './neon-db-client';

const mockedWithTransaction = withTransaction as unknown as jest.Mock;

function mockPool(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as Pool & { query: jest.Mock };
}

/** A fake transaction client whose query() is a jest.fn. */
function fakeClient(queryImpl?: jest.Mock) {
  const query = queryImpl ?? jest.fn().mockResolvedValue({ rows: [] });
  return { query } as unknown as { query: jest.Mock };
}

const BOOK_ROW = {
  id: 'b-1',
  learner_id: 'l-1',
  subject_id: 's-1',
  name: 'Science',
  created_at: new Date('2026-01-02T03:04:05.000Z'),
};

const CHAPTER_ROW = {
  id: 'c-1',
  book_id: 'b-1',
  chapter_number: '3', // pg may return ints as strings
  chapter_name: 'Photosynthesis',
  ai_assets_generated: false,
  academic_year: '2025-2026',
  created_at: new Date('2026-01-02T03:04:05.000Z'),
  updated_at: new Date('2026-01-03T03:04:05.000Z'),
};

const PAGE_ROW = {
  id: 'pg-1',
  chapter_id: 'c-1',
  page_number: '1',
  classification: 'content',
  image_s3_key: 's3://key/1.png',
  transcript_text: null,
  detected_language: null,
  ocr_status: 'pending',
  processed_at: null,
};

beforeEach(() => {
  mockedWithTransaction.mockReset();
});

describe('content NeonDBClient', () => {
  describe('getBooksBySubject', () => {
    it('queries book by subject + learner and maps rows', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [BOOK_ROW] });
      const client = new NeonDBClient({ pool: mockPool(query) });

      const books = await client.getBooksBySubject('s-1', 'l-1');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM book');
      expect(sql).toContain('subject_id = $1');
      expect(sql).toContain('learner_id = $2');
      expect(params).toEqual(['s-1', 'l-1']);
      expect(books).toEqual([
        {
          id: 'b-1',
          learnerId: 'l-1',
          subjectId: 's-1',
          name: 'Science',
          createdAt: '2026-01-02T03:04:05.000Z',
        },
      ]);
    });
  });

  describe('findOrCreateBook', () => {
    it('returns the existing book when one is found', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [BOOK_ROW] });
      const client = new NeonDBClient({ pool: mockPool(query) });

      const book = await client.findOrCreateBook({
        subjectId: 's-1',
        learnerId: 'l-1',
        bookName: 'Science',
        bookId: 'b-new',
      });

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('SELECT');
      expect(sql).toContain('FROM book');
      expect(params).toEqual(['s-1', 'l-1', 'Science']);
      expect(book.id).toBe('b-1');
    });

    it('inserts a new book with the supplied id when none exists', async () => {
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // lookup miss
        .mockResolvedValueOnce({ rows: [{ ...BOOK_ROW, id: 'b-new' }] }); // insert
      const client = new NeonDBClient({ pool: mockPool(query) });

      const book = await client.findOrCreateBook({
        subjectId: 's-1',
        learnerId: 'l-1',
        bookName: 'Science',
        bookId: 'b-new',
      });

      expect(query).toHaveBeenCalledTimes(2);
      const [insertSql, insertParams] = query.mock.calls[1];
      expect(insertSql).toContain('INSERT INTO book');
      expect(insertSql).toContain('RETURNING');
      expect(insertParams).toEqual(['b-new', 'l-1', 's-1', 'Science']);
      expect(book.id).toBe('b-new');
    });
  });

  describe('getChaptersByBook', () => {
    it('queries chapter by book ordered by chapter_number and maps rows', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [CHAPTER_ROW] });
      const client = new NeonDBClient({ pool: mockPool(query) });

      const chapters = await client.getChaptersByBook('b-1');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM chapter');
      expect(sql).toContain('book_id = $1');
      expect(sql).toContain('ORDER BY chapter_number');
      expect(params).toEqual(['b-1']);
      expect(chapters[0]).toEqual({
        id: 'c-1',
        bookId: 'b-1',
        chapterNumber: 3, // coerced from string
        chapterName: 'Photosynthesis',
        aiAssetsGenerated: false,
        academicYear: '2025-2026',
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-01-03T03:04:05.000Z',
      });
    });
  });

  describe('chapterNumberExists', () => {
    it('returns true when a matching chapter row is found', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
      const client = new NeonDBClient({ pool: mockPool(query) });

      expect(await client.chapterNumberExists('b-1', 3)).toBe(true);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM chapter');
      expect(sql).toContain('chapter_number = $2');
      expect(params).toEqual(['b-1', 3]);
    });

    it('returns false when no chapter row is found', async () => {
      const client = new NeonDBClient({ pool: mockPool() });
      expect(await client.chapterNumberExists('b-1', 99)).toBe(false);
    });
  });

  describe('createChapter', () => {
    const params = {
      id: 'c-1',
      bookId: 'b-new',
      bookName: 'Science',
      subjectId: 's-1',
      learnerId: 'l-1',
      chapterNumber: 3,
      chapterName: 'Photosynthesis',
      academicYear: '2025-2026',
    };

    it('creates the book when missing, then inserts the chapter (atomic)', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [] }) // book lookup miss
        .mockResolvedValueOnce({ rows: [{ ...BOOK_ROW, id: 'b-new' }] }) // book insert
        .mockResolvedValueOnce({ rows: [CHAPTER_ROW] }); // chapter insert
      const client = fakeClient(clientQuery);
      mockedWithTransaction.mockImplementation(async (fn: any) => fn(client));

      const chapter = await new NeonDBClient().createChapter(params);

      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledTimes(3);

      const [bookInsertSql, bookInsertParams] = clientQuery.mock.calls[1];
      expect(bookInsertSql).toContain('INSERT INTO book');
      expect(bookInsertParams).toEqual(['b-new', 'l-1', 's-1', 'Science']);

      const [chapterSql, chapterParams] = clientQuery.mock.calls[2];
      expect(chapterSql).toContain('INSERT INTO chapter');
      expect(chapterSql).toContain('RETURNING');
      // uses the created book id, chapter number/name/year
      expect(chapterParams).toEqual([
        'c-1',
        'b-new',
        3,
        'Photosynthesis',
        '2025-2026',
      ]);
      expect(chapter.id).toBe('c-1');
      expect(chapter.chapterNumber).toBe(3);
    });

    it('reuses an existing book and does not insert a new one', async () => {
      const clientQuery = jest
        .fn()
        .mockResolvedValueOnce({ rows: [BOOK_ROW] }) // book lookup hit (id b-1)
        .mockResolvedValueOnce({ rows: [CHAPTER_ROW] }); // chapter insert
      const client = fakeClient(clientQuery);
      mockedWithTransaction.mockImplementation(async (fn: any) => fn(client));

      await new NeonDBClient().createChapter(params);

      expect(clientQuery).toHaveBeenCalledTimes(2);
      const [chapterSql, chapterParams] = clientQuery.mock.calls[1];
      expect(chapterSql).toContain('INSERT INTO chapter');
      // reuses the found book id b-1, not the supplied b-new
      expect(chapterParams[1]).toBe('b-1');
    });
  });

  describe('getChapterById', () => {
    it('returns null when the chapter does not exist', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      expect(await client.getChapterById('missing')).toBeNull();
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('joins book for bookName/subjectId and attaches ordered pages', async () => {
      const chapterRow = {
        ...CHAPTER_ROW,
        book_name: 'Science',
        subject_id: 's-1',
      };
      const query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [chapterRow] }) // chapter + book join
        .mockResolvedValueOnce({ rows: [PAGE_ROW] }); // pages
      const client = new NeonDBClient({ pool: mockPool(query) });

      const result = await client.getChapterById('c-1');

      const [chapterSql, chapterParams] = query.mock.calls[0];
      expect(chapterSql).toContain('FROM chapter');
      expect(chapterSql).toContain('JOIN book');
      expect(chapterSql).toContain('AS book_name');
      expect(chapterParams).toEqual(['c-1']);

      const [pageSql, pageParams] = query.mock.calls[1];
      expect(pageSql).toContain('FROM page');
      expect(pageSql).toContain('ORDER BY page_number');
      expect(pageParams).toEqual(['c-1']);

      expect(result).not.toBeNull();
      expect(result!.bookName).toBe('Science');
      expect(result!.subjectId).toBe('s-1');
      expect(result!.chapterNumber).toBe(3);
      expect(result!.pages).toHaveLength(1);
      expect(result!.pages[0]).toEqual({
        id: 'pg-1',
        chapterId: 'c-1',
        pageNumber: 1,
        classification: 'content',
        imageS3Key: 's3://key/1.png',
        transcriptText: null,
        detectedLanguage: null,
        ocrStatus: 'pending',
        processedAt: null,
      });
    });
  });

  describe('getPagesByChapter', () => {
    it('queries pages ordered by page_number and maps rows', async () => {
      const completedRow = {
        ...PAGE_ROW,
        transcript_text: 'hello',
        detected_language: 'en',
        ocr_status: 'completed',
        processed_at: new Date('2026-02-02T00:00:00.000Z'),
      };
      const query = jest.fn().mockResolvedValue({ rows: [completedRow] });
      const client = new NeonDBClient({ pool: mockPool(query) });

      const pages = await client.getPagesByChapter('c-1');

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('FROM page');
      expect(sql).toContain('chapter_id = $1');
      expect(sql).toContain('ORDER BY page_number');
      expect(params).toEqual(['c-1']);
      expect(pages[0].transcriptText).toBe('hello');
      expect(pages[0].detectedLanguage).toBe('en');
      expect(pages[0].processedAt).toBe('2026-02-02T00:00:00.000Z');
    });
  });

  describe('createPage', () => {
    it('inserts a page and maps the returned row', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [PAGE_ROW] });
      const client = new NeonDBClient({ pool: mockPool(query) });

      const page = await client.createPage({
        id: 'pg-1',
        chapterId: 'c-1',
        pageNumber: 1,
        classification: 'content',
        imageS3Key: 's3://key/1.png',
      });

      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('INSERT INTO page');
      expect(sql).toContain('RETURNING');
      expect(params).toEqual(['pg-1', 'c-1', 1, 'content', 's3://key/1.png']);
      expect(page.id).toBe('pg-1');
      expect(page.pageNumber).toBe(1);
    });
  });

  describe('updatePageOrder', () => {
    it('runs one UPDATE per page inside a transaction', async () => {
      const clientQuery = jest.fn().mockResolvedValue({ rows: [] });
      mockedWithTransaction.mockImplementation(async (fn: any) =>
        fn(fakeClient(clientQuery))
      );

      await new NeonDBClient().updatePageOrder('c-1', [
        { pageId: 'pg-1', pageNumber: 2 },
        { pageId: 'pg-2', pageNumber: 1 },
      ]);

      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledTimes(2);
      const [sql, params] = clientQuery.mock.calls[0];
      expect(sql).toContain('UPDATE page SET page_number = $1');
      expect(sql).toContain('chapter_id = $3');
      expect(params).toEqual([2, 'pg-1', 'c-1']);
      expect(clientQuery.mock.calls[1][1]).toEqual([1, 'pg-2', 'c-1']);
    });
  });

  describe('deletePage', () => {
    it('deletes a page by id', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      await client.deletePage('pg-1');
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('DELETE FROM page');
      expect(params).toEqual(['pg-1']);
    });
  });

  describe('updatePageClassification', () => {
    it('updates the classification column', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      await client.updatePageClassification('pg-1', 'exercise');
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE page SET classification = $1');
      expect(params).toEqual(['exercise', 'pg-1']);
    });
  });

  describe('updatePageImage', () => {
    it('updates the image_s3_key column', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      await client.updatePageImage('pg-1', 's3://new/key.png');
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE page SET image_s3_key = $1');
      expect(params).toEqual(['s3://new/key.png', 'pg-1']);
    });
  });

  describe('updatePageOcrStatus', () => {
    it('updates only ocr_status when no extras are given', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      await client.updatePageOcrStatus('pg-1', 'processing');
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('ocr_status = $1');
      expect(sql).not.toContain('transcript_text');
      expect(sql).not.toContain('processed_at');
      expect(sql).toContain('WHERE id = $2');
      expect(params).toEqual(['processing', 'pg-1']);
    });

    it('sets transcript, language and processed_at on completion', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      await client.updatePageOcrStatus('pg-1', 'completed', 'text', 'en');
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('ocr_status = $1');
      expect(sql).toContain('transcript_text = $2');
      expect(sql).toContain('detected_language = $3');
      expect(sql).toContain('processed_at = NOW()');
      expect(sql).toContain('WHERE id = $4');
      expect(params).toEqual(['completed', 'text', 'en', 'pg-1']);
    });
  });

  describe('saveTranscriptAtomic', () => {
    it('updates transcript + language per page by number within a transaction', async () => {
      const clientQuery = jest.fn().mockResolvedValue({ rows: [] });
      mockedWithTransaction.mockImplementation(async (fn: any) =>
        fn(fakeClient(clientQuery))
      );

      await new NeonDBClient().saveTranscriptAtomic('c-1', [
        { pageNumber: 1, text: 'a', language: 'en' },
        { pageNumber: 2, text: 'b', language: 'hi' },
      ]);

      expect(mockedWithTransaction).toHaveBeenCalledTimes(1);
      expect(clientQuery).toHaveBeenCalledTimes(2);
      const [sql, params] = clientQuery.mock.calls[0];
      expect(sql).toContain('UPDATE page');
      expect(sql).toContain('transcript_text = $1');
      expect(sql).toContain('detected_language = $2');
      expect(sql).toContain('chapter_id = $3');
      expect(sql).toContain('page_number = $4');
      expect(params).toEqual(['a', 'en', 'c-1', 1]);
      expect(clientQuery.mock.calls[1][1]).toEqual(['b', 'hi', 'c-1', 2]);
    });
  });

  describe('resetAiAssetsFlag', () => {
    it('sets ai_assets_generated=false and updated_at=NOW()', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      await client.resetAiAssetsFlag('c-1');
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('UPDATE chapter');
      expect(sql).toContain('ai_assets_generated = false');
      expect(sql).toContain('updated_at = NOW()');
      expect(params).toEqual(['c-1']);
    });
  });

  describe('getChapterAiStatus', () => {
    it('returns the ai flag for an existing chapter', async () => {
      const query = jest
        .fn()
        .mockResolvedValue({ rows: [{ ai_assets_generated: true }] });
      const client = new NeonDBClient({ pool: mockPool(query) });
      expect(await client.getChapterAiStatus('c-1')).toEqual({
        aiAssetsGenerated: true,
      });
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('ai_assets_generated');
      expect(sql).toContain('FROM chapter');
      expect(params).toEqual(['c-1']);
    });

    it('throws when the chapter is not found', async () => {
      const client = new NeonDBClient({ pool: mockPool() });
      await expect(client.getChapterAiStatus('missing')).rejects.toThrow(
        'Chapter not found: missing'
      );
    });
  });
});
