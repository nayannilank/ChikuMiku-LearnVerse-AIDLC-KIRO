/**
 * Transcript Organizer
 *
 * Pure function for organizing transcript pages with sequential markers
 * and separating content pages from exercise pages.
 *
 * Requirements: 8.4
 */
import { TranscriptPage } from '@chikumiku/types';

/** Organized transcript with content/exercise separation and page markers. */
export interface OrganizedTranscript {
  contentPages: TranscriptPage[];
  exercisePages: TranscriptPage[];
  pageMarkers: string[];
}

/**
 * Organize transcript pages by classification and add sequential markers.
 *
 * - Adds "Page 1", "Page 2", etc. markers matching original page order
 * - Separates content pages from exercise pages based on classification
 * - Preserves original text exactly (no modification)
 * - Pages are sorted by pageNumber within each group
 */
export function organizeTranscript(pages: TranscriptPage[]): OrganizedTranscript {
  // Sort all pages by pageNumber to ensure consistent ordering
  const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  // Generate sequential markers for all pages in order
  const pageMarkers = sorted.map((_, index) => `Page ${index + 1}`);

  // Separate by classification, preserving sort order within each group
  const contentPages = sorted.filter(p => p.classification === 'content');
  const exercisePages = sorted.filter(p => p.classification === 'exercise');

  return {
    contentPages,
    exercisePages,
    pageMarkers,
  };
}
