/**
 * Neon-backed DBClient for the content service.
 *
 * Concrete implementation of `DBClient` (see db-client.ts) against the `book`,
 * `chapter`, and `page` tables. Uses the shared @chikumiku/db connection pool
 * and transaction helper.
 */

import {
  getPool,
  withTransaction,
  toIso,
  toIsoOrNull,
  toNumber,
  type Pool,
  type PoolClient,
} from '@chikumiku/db';
import type {
  BookRecord,
  ChapterRecord,
  ChapterWithPages,
  DBClient,
  PageRecord,
} from './db-client';

/** Options for the Neon content DB client (test seam). */
export interface NeonDBClientOptions {
  /** Inject a pool/client for testing; defaults to the shared pool. */
  pool?: Pool | PoolClient;
}

/** Column layout returned when selecting from `book`. */
interface BookRow {
  id: string;
  learner_id: string;
  subject_id: string;
  name: string;
  created_at: Date | string;
}

/** Column layout returned when selecting from `chapter`. */
interface ChapterRow {
  id: string;
  book_id: string;
  chapter_number: number | string;
  chapter_name: string;
  ai_assets_generated: boolean;
  academic_year: string;
  created_at: Date | string;
  updated_at: Date | string;
}

/** `chapter` joined to `book` for {@link ChapterWithPages}. */
interface ChapterWithBookRow extends ChapterRow {
  book_name: string;
  subject_id: string;
}

/** Column layout returned when selecting from `page`. */
interface PageRow {
  id: string;
  chapter_id: string;
  page_number: number | string;
  classification: 'content' | 'exercise';
  image_s3_key: string;
  transcript_text: string | null;
  detected_language: string | null;
  ocr_status: PageRecord['ocrStatus'];
  processed_at: Date | string | null;
}

/** Explicit column list shared by book SELECT/RETURNING clauses. */
const BOOK_COLUMNS = 'id, learner_id, subject_id, name, created_at';

/** Explicit column list shared by chapter SELECT/RETURNING clauses. */
const CHAPTER_COLUMNS =
  'id, book_id, chapter_number, chapter_name, ai_assets_generated, academic_year, created_at, updated_at';

/** Explicit column list shared by page SELECT/RETURNING clauses. */
const PAGE_COLUMNS =
  'id, chapter_id, page_number, classification, image_s3_key, transcript_text, detected_language, ocr_status, processed_at';

/**
 * Content service database client backed by Neon PostgreSQL.
 */
export class NeonDBClient implements DBClient {
  private readonly injectedPool?: Pool | PoolClient;

  constructor(options?: NeonDBClientOptions) {
    this.injectedPool = options?.pool;
  }

  private async db(): Promise<Pool | PoolClient> {
    return this.injectedPool ?? (await getPool());
  }

  // ---- row -> record mappers -------------------------------------------

  private mapBook(row: BookRow): BookRecord {
    return {
      id: row.id,
      learnerId: row.learner_id,
      subjectId: row.subject_id,
      name: row.name,
      createdAt: toIso(row.created_at),
    };
  }

  private mapChapter(row: ChapterRow): ChapterRecord {
    return {
      id: row.id,
      bookId: row.book_id,
      chapterNumber: toNumber(row.chapter_number),
      chapterName: row.chapter_name,
      aiAssetsGenerated: row.ai_assets_generated,
      academicYear: row.academic_year,
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
    };
  }

  private mapPage(row: PageRow): PageRecord {
    return {
      id: row.id,
      chapterId: row.chapter_id,
      pageNumber: toNumber(row.page_number),
      classification: row.classification,
      imageS3Key: row.image_s3_key,
      transcriptText: row.transcript_text,
      detectedLanguage: row.detected_language,
      ocrStatus: row.ocr_status,
      processedAt: toIsoOrNull(row.processed_at),
    };
  }

  // ---- books -----------------------------------------------------------

  async getBooksBySubject(
    subjectId: string,
    learnerId: string
  ): Promise<BookRecord[]> {
    const db = await this.db();
    const result = await db.query<BookRow>(
      `SELECT ${BOOK_COLUMNS} FROM book
       WHERE subject_id = $1 AND learner_id = $2
       ORDER BY created_at`,
      [subjectId, learnerId] as never[]
    );
    return result.rows.map((row) => this.mapBook(row));
  }

  async findOrCreateBook(params: {
    subjectId: string;
    learnerId: string;
    bookName: string;
    bookId: string;
  }): Promise<BookRecord> {
    const db = await this.db();
    const existing = await db.query<BookRow>(
      `SELECT ${BOOK_COLUMNS} FROM book
       WHERE subject_id = $1 AND learner_id = $2 AND name = $3
       LIMIT 1`,
      [params.subjectId, params.learnerId, params.bookName] as never[]
    );
    if (existing.rows.length > 0) {
      return this.mapBook(existing.rows[0]);
    }

    const created = await db.query<BookRow>(
      `INSERT INTO book (id, learner_id, subject_id, name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${BOOK_COLUMNS}`,
      [
        params.bookId,
        params.learnerId,
        params.subjectId,
        params.bookName,
      ] as never[]
    );
    return this.mapBook(created.rows[0]);
  }

  // ---- chapters --------------------------------------------------------

  async getChaptersByBook(bookId: string): Promise<ChapterRecord[]> {
    const db = await this.db();
    const result = await db.query<ChapterRow>(
      `SELECT ${CHAPTER_COLUMNS} FROM chapter
       WHERE book_id = $1
       ORDER BY chapter_number`,
      [bookId] as never[]
    );
    return result.rows.map((row) => this.mapChapter(row));
  }

  async chapterNumberExists(
    bookId: string,
    chapterNumber: number
  ): Promise<boolean> {
    const db = await this.db();
    const result = await db.query(
      `SELECT 1 FROM chapter
       WHERE book_id = $1 AND chapter_number = $2
       LIMIT 1`,
      [bookId, chapterNumber] as never[]
    );
    return result.rows.length > 0;
  }

  async createChapter(params: {
    id: string;
    bookId: string;
    bookName: string;
    subjectId: string;
    learnerId: string;
    chapterNumber: number;
    chapterName: string;
    academicYear: string;
  }): Promise<ChapterRecord> {
    // Book creation and chapter insertion happen atomically: if the chapter
    // insert fails (e.g. duplicate chapter_number), we do not leave an orphan
    // book behind.
    return withTransaction(async (client) => {
      // Find an existing book by name within the (subject, learner) scope,
      // otherwise create it using the caller-supplied bookId.
      const existing = await client.query<BookRow>(
        `SELECT ${BOOK_COLUMNS} FROM book
         WHERE subject_id = $1 AND learner_id = $2 AND name = $3
         LIMIT 1`,
        [params.subjectId, params.learnerId, params.bookName] as never[]
      );

      let bookId: string;
      if (existing.rows.length > 0) {
        bookId = existing.rows[0].id;
      } else {
        const createdBook = await client.query<BookRow>(
          `INSERT INTO book (id, learner_id, subject_id, name)
           VALUES ($1, $2, $3, $4)
           RETURNING ${BOOK_COLUMNS}`,
          [
            params.bookId,
            params.learnerId,
            params.subjectId,
            params.bookName,
          ] as never[]
        );
        bookId = createdBook.rows[0].id;
      }

      const chapter = await client.query<ChapterRow>(
        `INSERT INTO chapter (id, book_id, chapter_number, chapter_name, academic_year)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${CHAPTER_COLUMNS}`,
        [
          params.id,
          bookId,
          params.chapterNumber,
          params.chapterName,
          params.academicYear,
        ] as never[]
      );
      return this.mapChapter(chapter.rows[0]);
    });
  }

  async getChapterById(chapterId: string): Promise<ChapterWithPages | null> {
    const db = await this.db();
    const chapterResult = await db.query<ChapterWithBookRow>(
      `SELECT c.id, c.book_id, c.chapter_number, c.chapter_name,
              c.ai_assets_generated, c.academic_year, c.created_at, c.updated_at,
              b.name AS book_name, b.subject_id AS subject_id
       FROM chapter c
       JOIN book b ON b.id = c.book_id
       WHERE c.id = $1`,
      [chapterId] as never[]
    );

    if (chapterResult.rows.length === 0) {
      return null;
    }

    const row = chapterResult.rows[0];

    const pagesResult = await db.query<PageRow>(
      `SELECT ${PAGE_COLUMNS} FROM page
       WHERE chapter_id = $1
       ORDER BY page_number`,
      [chapterId] as never[]
    );

    return {
      ...this.mapChapter(row),
      bookName: row.book_name,
      subjectId: row.subject_id,
      pages: pagesResult.rows.map((p) => this.mapPage(p)),
    };
  }

  async getChapterAiStatus(
    chapterId: string
  ): Promise<{ aiAssetsGenerated: boolean }> {
    const db = await this.db();
    const result = await db.query<{ ai_assets_generated: boolean }>(
      `SELECT ai_assets_generated FROM chapter WHERE id = $1`,
      [chapterId] as never[]
    );
    if (result.rows.length === 0) {
      throw new Error(`Chapter not found: ${chapterId}`);
    }
    return { aiAssetsGenerated: result.rows[0].ai_assets_generated };
  }

  async resetAiAssetsFlag(chapterId: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE chapter
       SET ai_assets_generated = false, updated_at = NOW()
       WHERE id = $1`,
      [chapterId] as never[]
    );
  }

  // ---- pages -----------------------------------------------------------

  async getPagesByChapter(chapterId: string): Promise<PageRecord[]> {
    const db = await this.db();
    const result = await db.query<PageRow>(
      `SELECT ${PAGE_COLUMNS} FROM page
       WHERE chapter_id = $1
       ORDER BY page_number`,
      [chapterId] as never[]
    );
    return result.rows.map((row) => this.mapPage(row));
  }

  async createPage(page: {
    id: string;
    chapterId: string;
    pageNumber: number;
    classification: 'content' | 'exercise';
    imageS3Key: string;
  }): Promise<PageRecord> {
    const db = await this.db();
    const result = await db.query<PageRow>(
      `INSERT INTO page (id, chapter_id, page_number, classification, image_s3_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PAGE_COLUMNS}`,
      [
        page.id,
        page.chapterId,
        page.pageNumber,
        page.classification,
        page.imageS3Key,
      ] as never[]
    );
    return this.mapPage(result.rows[0]);
  }

  async updatePageOrder(
    chapterId: string,
    pages: { pageId: string; pageNumber: number }[]
  ): Promise<void> {
    // One UPDATE per page inside a single transaction so the reorder is
    // all-or-nothing. chapter_id scopes each update defensively.
    await withTransaction(async (client) => {
      for (const page of pages) {
        await client.query(
          `UPDATE page SET page_number = $1
           WHERE id = $2 AND chapter_id = $3`,
          [page.pageNumber, page.pageId, chapterId] as never[]
        );
      }
    });
  }

  async deletePage(pageId: string): Promise<void> {
    const db = await this.db();
    await db.query(`DELETE FROM page WHERE id = $1`, [pageId] as never[]);
  }

  async updatePageClassification(
    pageId: string,
    classification: 'content' | 'exercise'
  ): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE page SET classification = $1 WHERE id = $2`,
      [classification, pageId] as never[]
    );
  }

  async updatePageImage(pageId: string, imageS3Key: string): Promise<void> {
    const db = await this.db();
    await db.query(
      `UPDATE page SET image_s3_key = $1 WHERE id = $2`,
      [imageS3Key, pageId] as never[]
    );
  }

  async updatePageOcrStatus(
    pageId: string,
    status: PageRecord['ocrStatus'],
    transcriptText?: string,
    detectedLanguage?: string
  ): Promise<void> {
    const setClauses: string[] = ['ocr_status = $1'];
    const params: unknown[] = [status];
    let idx = 2;

    if (transcriptText !== undefined) {
      setClauses.push(`transcript_text = $${idx}`);
      params.push(transcriptText);
      idx += 1;
    }
    if (detectedLanguage !== undefined) {
      setClauses.push(`detected_language = $${idx}`);
      params.push(detectedLanguage);
      idx += 1;
    }
    // Stamp the processing time when OCR reaches a terminal success state.
    if (status === 'completed') {
      setClauses.push('processed_at = NOW()');
    }

    params.push(pageId);
    const db = await this.db();
    await db.query(
      `UPDATE page SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params as never[]
    );
  }

  async saveTranscriptAtomic(
    chapterId: string,
    pages: { pageNumber: number; text: string; language: string }[]
  ): Promise<void> {
    // All page transcripts commit together or none do.
    await withTransaction(async (client) => {
      for (const page of pages) {
        await client.query(
          `UPDATE page
           SET transcript_text = $1, detected_language = $2
           WHERE chapter_id = $3 AND page_number = $4`,
          [page.text, page.language, chapterId, page.pageNumber] as never[]
        );
      }
    });
  }
}
