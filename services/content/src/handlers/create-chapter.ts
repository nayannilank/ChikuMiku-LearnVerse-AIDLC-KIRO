/**
 * Create Chapter Handler
 * POST /content/chapters
 *
 * Validates input fields, enforces hierarchical limits (books per subject,
 * chapters per book), rejects duplicate chapter numbers, and creates the chapter.
 *
 * Requirements: 6.1, 6.2, 6.3
 */
import {
  ChapterCreateRequest,
  ValidationResult,
  APIError,
} from '@chikumiku/types';
import {
  validateBookName,
  validateChapterName,
} from '@chikumiku/validation';
import { DBClient, ChapterRecord } from '../clients/db-client';

/** Maximum books allowed per subject */
const MAX_BOOKS_PER_SUBJECT = 50;

/** Maximum chapters allowed per book */
const MAX_CHAPTERS_PER_BOOK = 100;

/** Valid chapter number range */
const MIN_CHAPTER_NUMBER = 1;
const MAX_CHAPTER_NUMBER = 999;

export interface CreateChapterResponse {
  success: true;
  chapter: ChapterRecord;
}

export interface CreateChapterDependencies {
  dbClient: DBClient;
  generateId: () => string;
  getAcademicYear: () => string;
}

/**
 * Validate all fields of the chapter creation request.
 * Returns a combined ValidationResult with all field errors.
 */
export function validateChapterCreation(
  request: ChapterCreateRequest
): ValidationResult {
  const errors: Record<string, string> = {};

  // Validate subjectId presence
  if (!request.subjectId || request.subjectId.trim().length === 0) {
    errors.subjectId = 'Subject selection is required';
  }

  // Validate book name using shared validator
  const bookNameResult = validateBookName(request.bookName);
  Object.assign(errors, bookNameResult.errors);

  // Validate chapter number range
  if (
    !Number.isInteger(request.chapterNumber) ||
    request.chapterNumber < MIN_CHAPTER_NUMBER ||
    request.chapterNumber > MAX_CHAPTER_NUMBER
  ) {
    errors.chapterNumber = 'Chapter number must be an integer between 1 and 999';
  }

  // Validate chapter name using shared validator
  const chapterNameResult = validateChapterName(request.chapterName);
  Object.assign(errors, chapterNameResult.errors);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Handle chapter creation request.
 * Returns either a success response or an API error.
 */
export async function handleCreateChapter(
  request: ChapterCreateRequest,
  learnerId: string,
  deps: CreateChapterDependencies
): Promise<CreateChapterResponse | APIError> {
  // 1. Validate input fields (Req 6.1)
  const validation = validateChapterCreation(request);
  if (!validation.valid) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: 'Chapter creation form contains invalid field values',
      details: validation.errors,
      retryable: false,
    };
  }

  // 2. Enforce books-per-subject limit (Req 6.2)
  const books = await deps.dbClient.getBooksBySubject(request.subjectId, learnerId);
  const existingBook = books.find(b => b.name === request.bookName);

  if (!existingBook && books.length >= MAX_BOOKS_PER_SUBJECT) {
    return {
      statusCode: 409,
      errorCode: 'BOOK_LIMIT_REACHED',
      message: `Maximum of ${MAX_BOOKS_PER_SUBJECT} books allowed per subject`,
      details: { bookName: `Cannot create a new book. Limit of ${MAX_BOOKS_PER_SUBJECT} books per subject reached.` },
      retryable: false,
    };
  }

  // 3. Determine or create the book
  const bookId = existingBook ? existingBook.id : deps.generateId();
  const book = await deps.dbClient.findOrCreateBook({
    subjectId: request.subjectId,
    learnerId,
    bookName: request.bookName,
    bookId,
  });

  // 4. Enforce chapters-per-book limit (Req 6.2)
  const chapters = await deps.dbClient.getChaptersByBook(book.id);
  if (chapters.length >= MAX_CHAPTERS_PER_BOOK) {
    return {
      statusCode: 409,
      errorCode: 'CHAPTER_LIMIT_REACHED',
      message: `Maximum of ${MAX_CHAPTERS_PER_BOOK} chapters allowed per book`,
      details: { chapterNumber: `Cannot create a new chapter. Limit of ${MAX_CHAPTERS_PER_BOOK} chapters per book reached.` },
      retryable: false,
    };
  }

  // 5. Reject duplicate chapter numbers within same book (Req 6.3)
  const duplicateExists = await deps.dbClient.chapterNumberExists(book.id, request.chapterNumber);
  if (duplicateExists) {
    return {
      statusCode: 409,
      errorCode: 'DUPLICATE_CHAPTER_NUMBER',
      message: 'Chapter number is already in use within this book',
      details: { chapterNumber: 'This chapter number already exists in the selected book. Please choose a different number.' },
      retryable: false,
    };
  }

  // 6. Create the chapter
  const chapterId = deps.generateId();
  const academicYear = deps.getAcademicYear();

  const chapter = await deps.dbClient.createChapter({
    id: chapterId,
    bookId: book.id,
    bookName: request.bookName,
    subjectId: request.subjectId,
    learnerId,
    chapterNumber: request.chapterNumber,
    chapterName: request.chapterName,
    academicYear,
  });

  return {
    success: true,
    chapter,
  };
}
