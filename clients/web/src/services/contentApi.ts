/**
 * Content API — Typed service layer for content management endpoints.
 *
 * Connects chapter CRUD, page uploads, OCR processing, and transcript
 * management to the backend Content Lambda via the API client.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 7.2, 8.6, 19.1, 19.2
 */
import { apiClient } from './apiClient';
import type {
  ChapterCreateRequest,
  TranscriptPage,
} from '@chikumiku/types';

// ─── Response Types ──────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  name: string;
}

/** Mirrors the content service's BookRecord. */
export interface Book {
  id: string;
  learnerId: string;
  subjectId: string;
  name: string;
  createdAt: string;
}

/** Mirrors the content service's ChapterRecord. */
export interface Chapter {
  id: string;
  bookId: string;
  chapterNumber: number;
  chapterName: string;
  aiAssetsGenerated: boolean;
  academicYear: string;
  createdAt: string;
  updatedAt: string;
}

/** POST /content/chapters response — the created chapter record. */
export interface CreateChapterResponse {
  success: boolean;
  chapter: Chapter;
}

/** GET /content/chapters/:id — chapter detail with page summaries. */
export interface ChapterDetail {
  id: string;
  bookId: string;
  bookName: string;
  subjectId: string;
  chapterNumber: number;
  chapterName: string;
  aiAssetsGenerated: boolean;
  academicYear: string;
  createdAt: string;
  updatedAt: string;
  pages: {
    id: string;
    pageNumber: number;
    classification: 'content' | 'exercise';
    ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
    hasTranscript: boolean;
    detectedLanguage: string | null;
  }[];
  totalContentPages: number;
  totalExercisePages: number;
}

/** A single page summary as returned inside the upload-pages response. */
export interface UploadedPage {
  id: string;
  chapterId: string;
  pageNumber: number;
  classification: 'content' | 'exercise';
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
}

/** POST /content/chapters/:id/pages response. */
export interface PageUploadResponse {
  success: boolean;
  pages: UploadedPage[];
}

/** GET /content/chapters/:id/ocr-status response (per-chapter aggregate). */
export interface OcrStatusResponse {
  success: boolean;
  chapterId: string;
  progress: {
    total: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
  };
  isComplete: boolean;
  pages: {
    pageId: string;
    pageNumber: number;
    ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
    detectedLanguage: string | null;
    hasTranscript: boolean;
  }[];
}

export interface SaveTranscriptResponse {
  success: boolean;
}

/** A single page upload the client submits (base64-encoded image). */
export interface PageUploadInput {
  /** Base64-encoded image bytes (no data: prefix). */
  imageData: string;
  format: 'jpeg' | 'png' | 'heic';
  sizeBytes: number;
  pageOrder: number;
  classification: 'content' | 'exercise';
}

// ─── Content API Service ─────────────────────────────────────────────────────

export const contentApi = {
  /**
   * Get a learner's enrolled subjects. `learnerId` identifies whose content
   * is being managed (parent or learner can manage any learner's content).
   */
  async getEnrolledSubjects(learnerId: string): Promise<Subject[]> {
    const { data } = await apiClient.get<{ success: boolean; subjects: Subject[] }>(
      `/content/subjects?learnerId=${encodeURIComponent(learnerId)}`,
    );
    return data.subjects;
  },

  /**
   * Get existing books for a given subject, scoped to a learner.
   */
  async getBooksForSubject(subjectId: string, learnerId: string): Promise<Book[]> {
    const { data } = await apiClient.get<{ success: boolean; books: Book[] }>(
      `/content/subjects/${subjectId}/books?learnerId=${encodeURIComponent(learnerId)}`,
    );
    return data.books;
  },

  /**
   * Get existing chapters for a given book.
   */
  async getChaptersForBook(bookId: string): Promise<Chapter[]> {
    const { data } = await apiClient.get<{ success: boolean; chapters: Chapter[] }>(
      `/content/books/${bookId}/chapters`,
    );
    return data.chapters;
  },

  /**
   * Create a new chapter (Req 6.1, 6.3). The backend find-or-creates the book
   * by name within the (subject, learner) scope and requires `learnerId` in
   * the body (the shared ChapterCreateRequest omits it, so it's added here).
   * Returns the created chapter record.
   */
  async createChapter(
    request: ChapterCreateRequest & { learnerId: string },
  ): Promise<CreateChapterResponse> {
    const { data } = await apiClient.post<CreateChapterResponse>(
      '/content/chapters',
      request,
    );
    return data;
  },

  /**
   * Upload one or more page images to a chapter for OCR processing (Req 7.2).
   * The content Lambda expects a JSON body with base64-encoded image data (NOT
   * multipart), under a `pages` array.
   */
  async uploadPages(
    chapterId: string,
    pages: PageUploadInput[],
  ): Promise<PageUploadResponse> {
    const { data } = await apiClient.post<PageUploadResponse>(
      `/content/chapters/${chapterId}/pages`,
      { pages },
    );
    return data;
  },

  /**
   * Edit an existing chapter's name and/or number.
   */
  async editChapter(
    chapterId: string,
    updates: { chapterName?: string; chapterNumber?: number },
  ): Promise<CreateChapterResponse> {
    const { data } = await apiClient.put<CreateChapterResponse>(
      `/content/chapters/${chapterId}`,
      updates,
    );
    return data;
  },

  /**
   * Get a single chapter's detail (name, number, book, pages, counts).
   */
  async getChapter(chapterId: string): Promise<ChapterDetail> {
    const { data } = await apiClient.get<{ success: boolean; chapter: ChapterDetail }>(
      `/content/chapters/${chapterId}`,
    );
    return data.chapter;
  },

  /**
   * Get the per-chapter OCR progress aggregate.
   */
  async getOcrStatus(chapterId: string): Promise<OcrStatusResponse> {
    const { data } = await apiClient.get<OcrStatusResponse>(
      `/content/chapters/${chapterId}/ocr-status`,
    );
    return data;
  },

  /**
   * Get the full transcript for a chapter (all pages).
   */
  async getTranscript(chapterId: string): Promise<TranscriptPage[]> {
    const { data } = await apiClient.get<{ success: boolean; pages: TranscriptPage[] }>(
      `/content/chapters/${chapterId}/transcript`,
    );
    return data.pages;
  },

  /**
   * Save edited transcript pages (Req 8.6).
   */
  async saveTranscript(
    chapterId: string,
    pages: TranscriptPage[],
  ): Promise<SaveTranscriptResponse> {
    const { data } = await apiClient.put<SaveTranscriptResponse>(
      `/content/chapters/${chapterId}/transcript`,
      { pages },
    );
    return data;
  },
};

/**
 * Reads a File into a base64 string (no `data:` prefix) plus its detected
 * image format, for submission to `uploadPages`. Throws for unsupported types.
 */
export async function fileToPageUploadData(
  file: File,
): Promise<{ imageData: string; format: PageUploadInput['format']; sizeBytes: number }> {
  const typeToFormat: Record<string, PageUploadInput['format']> = {
    'image/jpeg': 'jpeg',
    'image/jpg': 'jpeg',
    'image/png': 'png',
    'image/heic': 'heic',
  };
  const format = typeToFormat[file.type];
  if (!format) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return { imageData: btoa(binary), format, sizeBytes: file.size };
}
