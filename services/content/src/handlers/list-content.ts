/**
 * Content listing handlers (read-only).
 *
 * Back the content-management browse flow:
 *   GET /content/subjects?learnerId=      → handleListSubjects
 *   GET /content/subjects/:id/books?learnerId=  → handleListBooks
 *   GET /content/books/:id/chapters       → handleListChapters
 *   GET /content/chapters/:id/transcript  → handleGetTranscript
 *
 * Requirements: 6.1, 6.2, 6.3, 8.6
 */
import type { APIError } from '@chikumiku/types';
import type {
  BookRecord,
  ChapterRecord,
  DBClient,
  SubjectRecord,
  TranscriptPageRecord,
} from '../clients/db-client';

export interface ListContentDependencies {
  dbClient: DBClient;
}

export interface ListSubjectsResponse {
  success: true;
  subjects: SubjectRecord[];
}

export interface ListBooksResponse {
  success: true;
  books: BookRecord[];
}

export interface ListChaptersResponse {
  success: true;
  chapters: ChapterRecord[];
}

export interface GetTranscriptResponse {
  success: true;
  pages: TranscriptPageRecord[];
}

/** Validation error for a missing/blank required value. */
function requireNonEmpty(value: string, field: string): APIError | null {
  if (!value || value.trim().length === 0) {
    return {
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      message: `${field} is required`,
      retryable: false,
    };
  }
  return null;
}

/** GET /content/subjects?learnerId= — the learner's enrolled subjects. */
export async function handleListSubjects(
  learnerId: string,
  deps: ListContentDependencies
): Promise<ListSubjectsResponse | APIError> {
  const err = requireNonEmpty(learnerId, 'learnerId');
  if (err) return err;

  const subjects = await deps.dbClient.listSubjectsByLearner(learnerId);
  return { success: true, subjects };
}

/** GET /content/subjects/:id/books?learnerId= — books under a subject. */
export async function handleListBooks(
  subjectId: string,
  learnerId: string,
  deps: ListContentDependencies
): Promise<ListBooksResponse | APIError> {
  const subjErr = requireNonEmpty(subjectId, 'subjectId');
  if (subjErr) return subjErr;
  const learnerErr = requireNonEmpty(learnerId, 'learnerId');
  if (learnerErr) return learnerErr;

  const books = await deps.dbClient.getBooksBySubject(subjectId, learnerId);
  return { success: true, books };
}

/** GET /content/books/:id/chapters — chapters in a book. */
export async function handleListChapters(
  bookId: string,
  deps: ListContentDependencies
): Promise<ListChaptersResponse | APIError> {
  const err = requireNonEmpty(bookId, 'bookId');
  if (err) return err;

  const chapters = await deps.dbClient.getChaptersByBook(bookId);
  return { success: true, chapters };
}

/** GET /content/chapters/:id/transcript — a chapter's per-page transcript. */
export async function handleGetTranscript(
  chapterId: string,
  deps: ListContentDependencies
): Promise<GetTranscriptResponse | APIError> {
  const err = requireNonEmpty(chapterId, 'chapterId');
  if (err) return err;

  const pages = await deps.dbClient.getTranscriptByChapter(chapterId);
  return { success: true, pages };
}
