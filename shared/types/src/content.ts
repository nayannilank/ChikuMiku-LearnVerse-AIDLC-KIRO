/**
 * Content ingestion type definitions.
 * Covers chapter creation, page uploads, and transcript pages.
 */

/** Request payload for creating a new chapter. */
export interface ChapterCreateRequest {
  subjectId: string;
  /** 3-50 chars, [a-zA-Z0-9 :-] */
  bookName: string;
  /** 1-999 */
  chapterNumber: number;
  /** 3-100 chars, [a-zA-Z0-9 :-] */
  chapterName: string;
}

/** Single page image upload payload. */
export interface PageUpload {
  imageData: Buffer;
  format: 'jpeg' | 'png' | 'heic';
  /** Max 10MB */
  sizeBytes: number;
  pageOrder: number;
  classification: 'content' | 'exercise';
}

/** Transcript representation of a single page after OCR. */
export interface TranscriptPage {
  pageNumber: number;
  classification: 'content' | 'exercise';
  text: string;
  /** Auto-detected language */
  language: string;
}
