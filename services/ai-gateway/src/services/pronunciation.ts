/**
 * Pronunciation Practice Service.
 * Generates TTS audio for chapter content words/sentences and scores
 * learner pronunciation via Whisper transcription comparison.
 *
 * Features:
 * - Extract 5-20 practice items from chapter content
 * - Generate TTS audio for each practice item
 * - Transcribe learner recordings via Whisper
 * - Score pronunciation with per-syllable color coding
 * - Support all language subjects (auto-extend for new languages)
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import type { PronunciationScore, SyllableResult } from '@chikumiku/types';
import type { ITTSClient, IS3Client } from './explanation';

/** Interface for Whisper STT transcription. */
export interface IWhisperClient {
  transcribe(audioBuffer: Buffer, language?: string): Promise<TranscriptionResult>;
}

/** Result from Whisper transcription. */
export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
}

/** Individual segment from transcription. */
export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
  confidence: number;
}

/** Dependencies for the pronunciation audio handler. */
export interface PronunciationAudioDeps {
  ttsClient: ITTSClient;
  s3Client: IS3Client;
}

/** Dependencies for the pronunciation scoring handler. */
export interface PronunciationScoreDeps {
  whisperClient: IWhisperClient;
}

/** Request payload for pronunciation audio generation. */
export interface PronunciationAudioRequest {
  chapterId: string;
  learnerId: string;
  transcript: string;
  language: string;
  count?: number;
}

/** Response from pronunciation audio generation. */
export interface PronunciationAudioResponse {
  items: PracticeItem[];
}

/** A single practice item with its audio URL. */
export interface PracticeItem {
  text: string;
  audioUrl: string;
}

/** Request payload for pronunciation scoring. */
export interface PronunciationScoreRequest {
  expectedText: string;
  audioBuffer: Buffer;
  /** Duration in seconds of the recording. */
  durationSeconds: number;
  language?: string;
}

/** Maximum recording duration in seconds. */
export const MAX_RECORDING_DURATION_SECONDS = 30;

/** Minimum practice items per session. */
export const MIN_PRACTICE_ITEMS = 5;

/** Maximum practice items per session. */
export const MAX_PRACTICE_ITEMS = 20;

/** Default practice items if count not specified. */
export const DEFAULT_PRACTICE_ITEMS = 10;

/**
 * Extracts practice items (words/sentences) from a chapter transcript.
 * Splits transcript into sentences/phrases, filters for items suitable
 * for pronunciation practice (not too long, not too short), and clamps
 * count between 5 and 20.
 */
export function extractPracticeItems(transcript: string, count?: number): string[] {
  // Clamp count to [5, 20] range, default to 10
  const targetCount = Math.min(
    MAX_PRACTICE_ITEMS,
    Math.max(MIN_PRACTICE_ITEMS, count ?? DEFAULT_PRACTICE_ITEMS)
  );

  // Split transcript into sentences using common delimiters
  const sentences = transcript
    .split(/[.!?;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Filter for items suitable for pronunciation:
  // - At least 2 characters (meaningful word/phrase)
  // - At most 150 characters (not too long for a single recording)
  const suitable = sentences.filter(s => s.length >= 2 && s.length <= 150);

  if (suitable.length === 0) {
    // Fallback: split by words and group them
    const words = transcript.split(/\s+/).filter(w => w.length >= 2);
    const items: string[] = [];
    for (let i = 0; i < words.length && items.length < targetCount; i += 3) {
      const phrase = words.slice(i, i + 3).join(' ');
      if (phrase.length >= 2) {
        items.push(phrase);
      }
    }
    return items.slice(0, targetCount);
  }

  // If we have fewer suitable items than target, return all
  if (suitable.length <= targetCount) {
    return suitable.slice(0, Math.max(MIN_PRACTICE_ITEMS, suitable.length));
  }

  // Evenly distribute selections across the transcript
  const step = suitable.length / targetCount;
  const selected: string[] = [];
  for (let i = 0; i < targetCount; i++) {
    const index = Math.min(Math.floor(i * step), suitable.length - 1);
    if (!selected.includes(suitable[index])) {
      selected.push(suitable[index]);
    }
  }

  // If deduplication reduced count below minimum, fill from remaining
  if (selected.length < MIN_PRACTICE_ITEMS) {
    for (const item of suitable) {
      if (selected.length >= MIN_PRACTICE_ITEMS) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

/**
 * Generates the S3 key for a pronunciation audio file.
 */
export function buildPronunciationAudioS3Key(
  chapterId: string,
  learnerId: string,
  itemIndex: number
): string {
  return `audio/pronunciation/${chapterId}/${learnerId}/item-${itemIndex}.mp3`;
}

/**
 * Handles a pronunciation audio generation request.
 * Extracts practice items from transcript, generates TTS for each,
 * uploads to S3, and returns URLs.
 */
export async function handlePronunciationAudioRequest(
  payload: PronunciationAudioRequest,
  deps: PronunciationAudioDeps
): Promise<PronunciationAudioResponse> {
  const { chapterId, learnerId, transcript, language, count } = payload;

  // Extract practice items from transcript
  const practiceTexts = extractPracticeItems(transcript, count);

  const items: PracticeItem[] = [];

  for (let i = 0; i < practiceTexts.length; i++) {
    const text = practiceTexts[i];

    // Generate TTS audio
    const audioBuffer = await deps.ttsClient.synthesize(text, language);

    // Upload to S3
    const s3Key = buildPronunciationAudioS3Key(chapterId, learnerId, i);
    const audioUrl = await deps.s3Client.upload(s3Key, audioBuffer, 'audio/mpeg');

    items.push({ text, audioUrl });
  }

  return { items };
}

/**
 * Handles a pronunciation scoring request.
 * Validates recording duration, transcribes via Whisper,
 * compares against expected text, and returns scored results.
 */
export async function handlePronunciationScoreRequest(
  payload: PronunciationScoreRequest,
  deps: PronunciationScoreDeps
): Promise<PronunciationScore> {
  const { expectedText, audioBuffer, durationSeconds, language } = payload;

  // Validate recording duration
  if (durationSeconds > MAX_RECORDING_DURATION_SECONDS) {
    throw new Error(
      `Recording duration ${durationSeconds}s exceeds maximum of ${MAX_RECORDING_DURATION_SECONDS}s`
    );
  }

  if (durationSeconds <= 0) {
    throw new Error('Recording duration must be greater than 0');
  }

  // Transcribe via Whisper
  const transcription = await deps.whisperClient.transcribe(audioBuffer, language);

  // Score the pronunciation
  return scorePronunciation(expectedText, transcription.text);
}

/**
 * Scores pronunciation by comparing expected text against transcribed text.
 * Uses Levenshtein-based similarity per token to calculate accuracy.
 *
 * Returns PronunciationScore with:
 * - overallScore: 0-100 weighted average
 * - syllables: per-token breakdown with color classification
 */
export function scorePronunciation(
  expected: string,
  transcribed: string
): PronunciationScore {
  // Tokenize both texts (split on whitespace, normalize)
  const expectedTokens = tokenize(expected);
  const transcribedTokens = tokenize(transcribed);

  if (expectedTokens.length === 0) {
    return { overallScore: 0, syllables: [] };
  }

  // Align tokens using a simple sequential comparison
  const syllables: SyllableResult[] = [];
  let totalScore = 0;

  for (let i = 0; i < expectedTokens.length; i++) {
    const expectedToken = expectedTokens[i];
    const transcribedToken = i < transcribedTokens.length ? transcribedTokens[i] : '';

    // Calculate similarity using Levenshtein distance
    const accuracy = calculateTokenAccuracy(expectedToken, transcribedToken);
    const color = classifyColor(accuracy);

    syllables.push({
      text: expectedToken,
      accuracy,
      color,
    });

    totalScore += accuracy;
  }

  // Overall score as average of all token scores
  const overallScore = Math.round(totalScore / expectedTokens.length);

  return {
    overallScore: Math.min(100, Math.max(0, overallScore)),
    syllables,
  };
}

/**
 * Classifies accuracy into color code.
 * - green: accuracy >= 80
 * - yellow: accuracy 40-79
 * - red: accuracy < 40
 */
export function classifyColor(accuracy: number): 'green' | 'yellow' | 'red' {
  if (accuracy >= 80) return 'green';
  if (accuracy >= 40) return 'yellow';
  return 'red';
}

/**
 * Calculates accuracy (0-100) between two tokens using Levenshtein similarity.
 */
export function calculateTokenAccuracy(expected: string, transcribed: string): number {
  if (expected.length === 0 && transcribed.length === 0) return 100;
  if (expected.length === 0 || transcribed.length === 0) return 0;

  const normalizedExpected = expected.toLowerCase();
  const normalizedTranscribed = transcribed.toLowerCase();

  if (normalizedExpected === normalizedTranscribed) return 100;

  const distance = levenshteinDistance(normalizedExpected, normalizedTranscribed);
  const maxLen = Math.max(normalizedExpected.length, normalizedTranscribed.length);
  const similarity = 1 - distance / maxLen;

  return Math.round(similarity * 100);
}

/**
 * Computes the Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Use a single-row DP approach for space efficiency
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
      }
    }
    for (let j = 0; j <= n; j++) {
      prev[j] = curr[j];
    }
  }

  return prev[n];
}

/**
 * Tokenizes text into individual words/syllables for scoring.
 * Removes punctuation and normalizes whitespace.
 * Preserves Unicode letters, marks (combining characters like Devanagari matras), and numbers.
 */
export function tokenize(text: string): string[] {
  return text
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, '')
    .split(/\s+/)
    .filter(token => token.length > 0);
}
