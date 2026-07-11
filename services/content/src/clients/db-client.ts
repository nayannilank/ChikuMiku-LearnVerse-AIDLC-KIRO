/**
 * Database client interface for the content service.
 * Abstracts database operations for testability.
 */

export interface BookRecord {
  id: string;
  learnerId: string;
  subjectId: string;
  name: string;
  createdAt: string;
}

export interface ChapterRecord {
  id: string;
  bookId: string;
  chapterNumber: number;
  chapterName: string;
  aiAssetsGenerated: boolean;
  academicYear: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageRecord {
  id: string;
  chapterId: string;
  pageNumber: number;
  classification: 'content' | 'exercise';
  imageS3Key: string;
  transcriptText: string | null;
  detectedLanguage: string | null;
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt: string | null;
}

export interface ChapterWithPages extends ChapterRecord {
  pages: PageRecord[];
  bookName: string;
  subjectId: string;
}

export interface DBClient {
  /**
   * Get all books for a given subject belonging to a learner.
   */
  getBooksBySubject(subjectId: string, learnerId: string): Promise<BookRecord[]>;

  /**
   * Get all chapters for a given book.
   */
  getChaptersByBook(bookId: string): Promise<ChapterRecord[]>;

  /**
   * Check if a chapter number already exists within a book.
   */
  chapterNumberExists(bookId: string, chapterNumber: number): Promise<boolean>;

  /**
   * Create a new chapter record. Creates the book if it doesn't exist.
   * Returns the created chapter record.
   */
  createChapter(params: {
    id: string;
    bookId: string;
    bookName: string;
    subjectId: string;
    learnerId: string;
    chapterNumber: number;
    chapterName: string;
    academicYear: string;
  }): Promise<ChapterRecord>;

  /**
   * Get a chapter by ID including its pages and AI status.
   */
  getChapterById(chapterId: string): Promise<ChapterWithPages | null>;

  /**
   * Find or create a book by name within a subject for a learner.
   * Returns the book record.
   */
  findOrCreateBook(params: {
    subjectId: string;
    learnerId: string;
    bookName: string;
    bookId: string;
  }): Promise<BookRecord>;

  /**
   * Get all pages for a given chapter, ordered by page number.
   */
  getPagesByChapter(chapterId: string): Promise<PageRecord[]>;

  /**
   * Create a new page record.
   */
  createPage(page: {
    id: string;
    chapterId: string;
    pageNumber: number;
    classification: 'content' | 'exercise';
    imageS3Key: string;
  }): Promise<PageRecord>;

  /**
   * Update page ordering for a chapter.
   */
  updatePageOrder(chapterId: string, pages: { pageId: string; pageNumber: number }[]): Promise<void>;

  /**
   * Delete a page by its ID.
   */
  deletePage(pageId: string): Promise<void>;

  /**
   * Update a page's classification.
   */
  updatePageClassification(pageId: string, classification: 'content' | 'exercise'): Promise<void>;

  /**
   * Update a page's S3 image key (used for recapture).
   */
  updatePageImage(pageId: string, imageS3Key: string): Promise<void>;

  /**
   * Update the OCR status of a page.
   * Optionally set transcript text and detected language on completion.
   */
  updatePageOcrStatus(
    pageId: string,
    status: PageRecord['ocrStatus'],
    transcriptText?: string,
    detectedLanguage?: string
  ): Promise<void>;

  /**
   * Atomically save transcript text for all pages of a chapter.
   * All pages save or none — provides transactional guarantee.
   */
  saveTranscriptAtomic(
    chapterId: string,
    pages: { pageNumber: number; text: string; language: string }[]
  ): Promise<void>;

  /**
   * Reset the aiAssetsGenerated flag to false for a chapter.
   * Used when transcript is edited after AI generation to trigger regeneration.
   */
  resetAiAssetsFlag(chapterId: string): Promise<void>;

  /**
   * Get the AI asset generation status for a chapter.
   */
  getChapterAiStatus(chapterId: string): Promise<{ aiAssetsGenerated: boolean }>;
}
