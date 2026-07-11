/**
 * Unit tests for Pronunciation Practice Service.
 * Tests: practice item extraction, score calculation,
 * color classification, recording duration validation,
 * and error handling.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import {
  extractPracticeItems,
  scorePronunciation,
  classifyColor,
  calculateTokenAccuracy,
  levenshteinDistance,
  tokenize,
  handlePronunciationAudioRequest,
  handlePronunciationScoreRequest,
  buildPronunciationAudioS3Key,
  MAX_RECORDING_DURATION_SECONDS,
  MIN_PRACTICE_ITEMS,
  MAX_PRACTICE_ITEMS,
} from './pronunciation';
import type {
  PronunciationAudioDeps,
  PronunciationScoreDeps,
  IWhisperClient,
} from './pronunciation';
import type { ITTSClient, IS3Client } from './explanation';

describe('Pronunciation Service', () => {
  describe('extractPracticeItems', () => {
    it('returns between 5 and 20 items from a long transcript', () => {
      const transcript =
        'The cat sat on the mat. ' +
        'A quick brown fox jumps over the lazy dog. ' +
        'Hello world this is a test sentence. ' +
        'Learning is fun and exciting. ' +
        'The sun rises in the east. ' +
        'Water flows downhill naturally. ' +
        'Birds fly south in winter. ' +
        'Trees grow tall over time. ' +
        'Fish swim in the ocean. ' +
        'Stars shine bright at night. ' +
        'Mountains stand tall and proud. ' +
        'Rivers flow to the sea.';

      const items = extractPracticeItems(transcript);
      expect(items.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);
      expect(items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
    });

    it('respects the count parameter clamped to [5, 20]', () => {
      const transcript =
        'Sentence one. Sentence two. Sentence three. Sentence four. ' +
        'Sentence five. Sentence six. Sentence seven. Sentence eight. ' +
        'Sentence nine. Sentence ten. Sentence eleven. Sentence twelve.';

      const items7 = extractPracticeItems(transcript, 7);
      expect(items7.length).toBeLessThanOrEqual(7);

      // Count below minimum is clamped to 5
      const itemsLow = extractPracticeItems(transcript, 2);
      expect(itemsLow.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);

      // Count above maximum is clamped to 20
      const itemsHigh = extractPracticeItems(transcript, 50);
      expect(itemsHigh.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
    });

    it('returns items from a transcript with few sentences', () => {
      const transcript = 'Hello. World. Test. Foo. Bar.';
      const items = extractPracticeItems(transcript);
      expect(items.length).toBeGreaterThanOrEqual(MIN_PRACTICE_ITEMS);
    });

    it('handles empty transcript gracefully', () => {
      const items = extractPracticeItems('');
      expect(items.length).toBe(0);
    });

    it('falls back to word grouping when no sentence delimiters exist', () => {
      const transcript = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15';
      const items = extractPracticeItems(transcript, 5);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('filters out items that are too short (< 2 chars)', () => {
      const transcript = 'A. B. Hello world. Good morning.';
      const items = extractPracticeItems(transcript, 5);
      // Single char items A and B should be filtered
      for (const item of items) {
        expect(item.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('scorePronunciation', () => {
    it('returns 100 for an exact match', () => {
      const result = scorePronunciation('hello world', 'hello world');
      expect(result.overallScore).toBe(100);
      expect(result.syllables).toHaveLength(2);
      expect(result.syllables[0].color).toBe('green');
      expect(result.syllables[1].color).toBe('green');
    });

    it('returns 0 for completely different text', () => {
      const result = scorePronunciation('hello', '');
      expect(result.overallScore).toBe(0);
    });

    it('overall score is between 0 and 100', () => {
      const result = scorePronunciation('the quick brown fox', 'the quik bron fax');
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('returns empty syllables for empty expected text', () => {
      const result = scorePronunciation('', 'hello');
      expect(result.overallScore).toBe(0);
      expect(result.syllables).toHaveLength(0);
    });

    it('each syllable accuracy is 0-100', () => {
      const result = scorePronunciation(
        'pronunciation practice',
        'pronunsiation praxtice'
      );
      for (const syllable of result.syllables) {
        expect(syllable.accuracy).toBeGreaterThanOrEqual(0);
        expect(syllable.accuracy).toBeLessThanOrEqual(100);
      }
    });

    it('handles case-insensitive comparison', () => {
      const result = scorePronunciation('Hello World', 'hello world');
      expect(result.overallScore).toBe(100);
    });
  });

  describe('classifyColor', () => {
    it('returns green for accuracy >= 80', () => {
      expect(classifyColor(80)).toBe('green');
      expect(classifyColor(100)).toBe('green');
      expect(classifyColor(95)).toBe('green');
    });

    it('returns yellow for accuracy 40-79', () => {
      expect(classifyColor(40)).toBe('yellow');
      expect(classifyColor(79)).toBe('yellow');
      expect(classifyColor(60)).toBe('yellow');
    });

    it('returns red for accuracy < 40', () => {
      expect(classifyColor(0)).toBe('red');
      expect(classifyColor(39)).toBe('red');
      expect(classifyColor(10)).toBe('red');
    });
  });

  describe('calculateTokenAccuracy', () => {
    it('returns 100 for identical tokens', () => {
      expect(calculateTokenAccuracy('hello', 'hello')).toBe(100);
    });

    it('returns 0 when one token is empty', () => {
      expect(calculateTokenAccuracy('hello', '')).toBe(0);
      expect(calculateTokenAccuracy('', 'hello')).toBe(0);
    });

    it('returns 100 for both empty', () => {
      expect(calculateTokenAccuracy('', '')).toBe(100);
    });

    it('returns partial accuracy for similar tokens', () => {
      const accuracy = calculateTokenAccuracy('hello', 'helo');
      expect(accuracy).toBeGreaterThan(0);
      expect(accuracy).toBeLessThan(100);
    });

    it('is case-insensitive', () => {
      expect(calculateTokenAccuracy('Hello', 'hello')).toBe(100);
    });
  });

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('abc', 'abc')).toBe(0);
    });

    it('returns length of other string when one is empty', () => {
      expect(levenshteinDistance('', 'abc')).toBe(3);
      expect(levenshteinDistance('abc', '')).toBe(3);
    });

    it('computes correct distance for known cases', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });
  });

  describe('tokenize', () => {
    it('splits text into words', () => {
      expect(tokenize('hello world')).toEqual(['hello', 'world']);
    });

    it('removes punctuation', () => {
      expect(tokenize('hello, world!')).toEqual(['hello', 'world']);
    });

    it('handles empty string', () => {
      expect(tokenize('')).toEqual([]);
    });

    it('preserves Unicode letters', () => {
      const tokens = tokenize('नमस्ते दुनिया');
      expect(tokens).toEqual(['नमस्ते', 'दुनिया']);
    });
  });

  describe('handlePronunciationScoreRequest', () => {
    const mockWhisperClient: IWhisperClient = {
      transcribe: jest.fn().mockResolvedValue({
        text: 'hello world',
        segments: [
          { text: 'hello', start: 0, end: 0.5, confidence: 0.95 },
          { text: 'world', start: 0.5, end: 1.0, confidence: 0.92 },
        ],
      }),
    };

    const deps: PronunciationScoreDeps = {
      whisperClient: mockWhisperClient,
    };

    it('rejects recordings exceeding 30 seconds', async () => {
      await expect(
        handlePronunciationScoreRequest(
          {
            expectedText: 'hello world',
            audioBuffer: Buffer.from('audio'),
            durationSeconds: 31,
          },
          deps
        )
      ).rejects.toThrow(`Recording duration 31s exceeds maximum of ${MAX_RECORDING_DURATION_SECONDS}s`);
    });

    it('rejects recordings with zero or negative duration', async () => {
      await expect(
        handlePronunciationScoreRequest(
          {
            expectedText: 'hello world',
            audioBuffer: Buffer.from('audio'),
            durationSeconds: 0,
          },
          deps
        )
      ).rejects.toThrow('Recording duration must be greater than 0');
    });

    it('accepts recordings at exactly 30 seconds', async () => {
      const result = await handlePronunciationScoreRequest(
        {
          expectedText: 'hello world',
          audioBuffer: Buffer.from('audio'),
          durationSeconds: 30,
        },
        deps
      );
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    });

    it('returns a valid PronunciationScore', async () => {
      const result = await handlePronunciationScoreRequest(
        {
          expectedText: 'hello world',
          audioBuffer: Buffer.from('audio'),
          durationSeconds: 5,
        },
        deps
      );
      expect(result.overallScore).toBe(100);
      expect(result.syllables).toHaveLength(2);
      expect(result.syllables[0].text).toBe('hello');
      expect(result.syllables[1].text).toBe('world');
    });
  });

  describe('handlePronunciationAudioRequest', () => {
    const mockTtsClient: ITTSClient = {
      synthesize: jest.fn().mockResolvedValue(Buffer.from('audio-data')),
    };

    const mockS3Client: IS3Client = {
      upload: jest.fn().mockResolvedValue('https://s3.example.com/audio.mp3'),
    };

    const deps: PronunciationAudioDeps = {
      ttsClient: mockTtsClient,
      s3Client: mockS3Client,
    };

    it('generates audio for extracted practice items', async () => {
      const result = await handlePronunciationAudioRequest(
        {
          chapterId: 'chapter-1',
          learnerId: 'learner-1',
          transcript:
            'The cat sat on the mat. A quick brown fox. Hello world. ' +
            'Good morning everyone. Learning is fun. The sun rises.',
          language: 'en',
          count: 5,
        },
        deps
      );

      expect(result.items.length).toBeGreaterThanOrEqual(1);
      expect(result.items.length).toBeLessThanOrEqual(MAX_PRACTICE_ITEMS);
      for (const item of result.items) {
        expect(item.text.length).toBeGreaterThan(0);
        expect(item.audioUrl).toBe('https://s3.example.com/audio.mp3');
      }
    });

    it('calls TTS for each practice item', async () => {
      (mockTtsClient.synthesize as jest.Mock).mockClear();
      (mockS3Client.upload as jest.Mock).mockClear();

      await handlePronunciationAudioRequest(
        {
          chapterId: 'chapter-1',
          learnerId: 'learner-1',
          transcript: 'One. Two. Three. Four. Five. Six.',
          language: 'hi',
          count: 5,
        },
        deps
      );

      expect(mockTtsClient.synthesize).toHaveBeenCalled();
      expect(mockS3Client.upload).toHaveBeenCalled();
    });
  });

  describe('buildPronunciationAudioS3Key', () => {
    it('builds correct S3 key', () => {
      const key = buildPronunciationAudioS3Key('ch-1', 'learner-1', 3);
      expect(key).toBe('audio/pronunciation/ch-1/learner-1/item-3.mp3');
    });
  });
});
