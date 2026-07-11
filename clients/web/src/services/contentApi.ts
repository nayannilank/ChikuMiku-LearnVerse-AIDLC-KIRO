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

export interface Book {
  id: string;
  name: string;
  subjectId: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterNumber: number;
  chapterName: string;
  pageCount: number;
  createdAt: string;
}

export interface CreateChapterResponse {
  chapterId: string;
  message: string;
}

export interface PageUploadResponse {
  pageId: string;
  pageNumber: number;
  ocrStatus: 'queued' | 'processing' | 'completed' | 'failed';
}

export interface OcrStatusResponse {
  pageId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  text?: string;
  language?: string;
  confidence?: number;
}

export interface SaveTranscriptResponse {
  success: boolean;
  message: string;
}

// ─── Content API Service ─────────────────────────────────────────────────────

export const contentApi = {
  /**
   * Get the learner's enrolled subjects.
   */
  async getEnrolledSubjects(): Promise<Subject[]> {
    const { data } = await apiClient.get<Subject[]>('/content/subjects');
    return data;
  },

  /**
   * Get existing books for a given subject.
   */
  async getBooksForSubject(subjectId: string): Promise<Book[]> {
    const { data } = await apiClient.get<Book[]>(`/content/subjects/${subjectId}/books`);
    return data;
  },

  /**
   * Get existing chapters for a given book.
   */
  async getChaptersForBook(bookId: string): Promise<Chapter[]> {
    const { data } = await apiClient.get<Chapter[]>(`/content/books/${bookId}/chapters`);
    return data;
  },

  /**
   * Create a new chapter (Req 6.1, 6.3).
   */
  async createChapter(request: ChapterCreateRequest): Promise<CreateChapterResponse> {
    const { data } = await apiClient.post<CreateChapterResponse>(
      '/content/chapters',
      request,
    );
    return data;
  },

  /**
   * Upload a page image to a chapter for OCR processing (Req 7.2).
   * Uses multipart/form-data for the image upload.
   */
  async uploadPage(
    chapterId: string,
    imageFile: File,
    pageOrder: number,
    classification: 'content' | 'exercise',
  ): Promise<PageUploadResponse> {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('pageOrder', String(pageOrder));
    formData.append('classification', classification);

    // Use fetch directly for multipart — apiClient sets Content-Type to JSON
    const token = localStorage.getItem('chikumiku_access_token');
    const { API_BASE_URL } = await import('../config/environment');
    const response = await fetch(`${API_BASE_URL}/content/chapters/${chapterId}/pages`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw {
        status: response.status,
        message: (err as { message?: string }).message || 'Page upload failed',
        retryable: response.status >= 500,
      };
    }

    return (await response.json()) as PageUploadResponse;
  },

  /**
   * Check OCR processing status for a page.
   */
  async getOcrStatus(chapterId: string, pageId: string): Promise<OcrStatusResponse> {
    const { data } = await apiClient.get<OcrStatusResponse>(
      `/content/chapters/${chapterId}/pages/${pageId}/ocr-status`,
    );
    return data;
  },

  /**
   * Get the full transcript for a chapter (all pages).
   */
  async getTranscript(chapterId: string): Promise<TranscriptPage[]> {
    const { data } = await apiClient.get<TranscriptPage[]>(
      `/content/chapters/${chapterId}/transcript`,
    );
    return data;
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
