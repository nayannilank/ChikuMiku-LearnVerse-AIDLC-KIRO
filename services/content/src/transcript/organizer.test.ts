import { organizeTranscript, OrganizedTranscript } from './organizer';
import { TranscriptPage } from '@chikumiku/types';

function makePage(overrides: Partial<TranscriptPage> = {}): TranscriptPage {
  return {
    pageNumber: 1,
    classification: 'content',
    text: 'Sample transcript text for the page.',
    language: 'en',
    ...overrides,
  };
}

describe('organizeTranscript', () => {
  it('generates sequential page markers based on sorted order', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 3 }),
      makePage({ pageNumber: 1 }),
      makePage({ pageNumber: 2 }),
    ];

    const result = organizeTranscript(pages);

    expect(result.pageMarkers).toEqual(['Page 1', 'Page 2', 'Page 3']);
  });

  it('separates content pages from exercise pages', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 1, classification: 'content' }),
      makePage({ pageNumber: 2, classification: 'exercise' }),
      makePage({ pageNumber: 3, classification: 'content' }),
      makePage({ pageNumber: 4, classification: 'exercise' }),
    ];

    const result = organizeTranscript(pages);

    expect(result.contentPages).toHaveLength(2);
    expect(result.exercisePages).toHaveLength(2);
    expect(result.contentPages[0].pageNumber).toBe(1);
    expect(result.contentPages[1].pageNumber).toBe(3);
    expect(result.exercisePages[0].pageNumber).toBe(2);
    expect(result.exercisePages[1].pageNumber).toBe(4);
  });

  it('preserves original text exactly without modification', () => {
    const originalText = '  Text with  extra   spaces and\nnewlines  ';
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 1, text: originalText }),
    ];

    const result = organizeTranscript(pages);

    expect(result.contentPages[0].text).toBe(originalText);
  });

  it('handles all content pages (no exercises)', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 1, classification: 'content' }),
      makePage({ pageNumber: 2, classification: 'content' }),
    ];

    const result = organizeTranscript(pages);

    expect(result.contentPages).toHaveLength(2);
    expect(result.exercisePages).toHaveLength(0);
    expect(result.pageMarkers).toEqual(['Page 1', 'Page 2']);
  });

  it('handles all exercise pages (no content)', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 1, classification: 'exercise' }),
      makePage({ pageNumber: 2, classification: 'exercise' }),
    ];

    const result = organizeTranscript(pages);

    expect(result.contentPages).toHaveLength(0);
    expect(result.exercisePages).toHaveLength(2);
  });

  it('sorts pages by pageNumber within each group', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 5, classification: 'content' }),
      makePage({ pageNumber: 2, classification: 'exercise' }),
      makePage({ pageNumber: 1, classification: 'content' }),
      makePage({ pageNumber: 4, classification: 'exercise' }),
    ];

    const result = organizeTranscript(pages);

    expect(result.contentPages[0].pageNumber).toBe(1);
    expect(result.contentPages[1].pageNumber).toBe(5);
    expect(result.exercisePages[0].pageNumber).toBe(2);
    expect(result.exercisePages[1].pageNumber).toBe(4);
  });

  it('handles a single page', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 1 }),
    ];

    const result = organizeTranscript(pages);

    expect(result.pageMarkers).toEqual(['Page 1']);
    expect(result.contentPages).toHaveLength(1);
    expect(result.exercisePages).toHaveLength(0);
  });

  it('handles empty pages array', () => {
    const result = organizeTranscript([]);

    expect(result.pageMarkers).toEqual([]);
    expect(result.contentPages).toEqual([]);
    expect(result.exercisePages).toEqual([]);
  });

  it('preserves language field for each page', () => {
    const pages: TranscriptPage[] = [
      makePage({ pageNumber: 1, language: 'hi' }),
      makePage({ pageNumber: 2, language: 'en' }),
    ];

    const result = organizeTranscript(pages);

    expect(result.contentPages[0].language).toBe('hi');
    expect(result.contentPages[1].language).toBe('en');
  });
});
