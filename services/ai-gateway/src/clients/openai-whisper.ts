/**
 * OpenAI Whisper speech-to-text client.
 *
 * Concrete implementation of `IWhisperClient` (see services/pronunciation.ts)
 * that transcribes a learner's audio recording so their pronunciation can be
 * scored against the expected text.
 *
 * Auth: REST + API key (`Authorization: Bearer <key>`). The request is
 * `multipart/form-data` (unlike the JSON chat/embeddings endpoints) because the
 * audio file is uploaded as a part. Node 22 provides global `FormData`/`Blob`
 * and `fetch`, so no SDK or extra dependency is needed.
 *
 * We request `response_format=verbose_json` to receive timed `segments`; each
 * Whisper segment reports `avg_logprob` (a log-probability), which we convert
 * to a 0–1 confidence via `exp(avg_logprob)`.
 *
 * Requirements: 10.3, 10.4, 25.6
 */

import type {
  IWhisperClient,
  TranscriptionResult,
  TranscriptionSegment,
} from '../services/pronunciation';

const DEFAULT_TRANSCRIPTIONS_ENDPOINT =
  'https://api.openai.com/v1/audio/transcriptions';

/** Default Whisper model. */
export const DEFAULT_WHISPER_MODEL = 'whisper-1';

/** Minimal shape of the verbose_json transcription response we consume. */
interface WhisperVerboseResponse {
  text?: string;
  segments?: Array<{
    text?: string;
    start?: number;
    end?: number;
    /** Average log-probability of the segment's tokens. */
    avg_logprob?: number;
  }>;
  error?: { message?: string; type?: string; code?: string };
}

/** Options for constructing the Whisper client. */
export interface OpenAIWhisperClientOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  /** Injectable fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

/**
 * Converts a Whisper `avg_logprob` to an approximate 0–1 confidence.
 * avg_logprob is <= 0; exp maps 0 -> 1 and increasingly negative values
 * toward 0. Clamped to [0, 1]. Missing values default to 0.
 */
export function logprobToConfidence(avgLogprob: number | undefined): number {
  if (avgLogprob === undefined || Number.isNaN(avgLogprob)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Math.exp(avgLogprob)));
}

/**
 * Whisper transcription client backed by the OpenAI REST API.
 */
export class OpenAIWhisperClient implements IWhisperClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIWhisperClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_WHISPER_MODEL;
    this.endpoint = options.endpoint ?? DEFAULT_TRANSCRIPTIONS_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async transcribe(
    audioBuffer: Buffer,
    language?: string
  ): Promise<TranscriptionResult> {
    if (!this.apiKey) {
      throw new Error('Invalid API key: authentication failed');
    }
    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Whisper transcription requires a non-empty audio buffer');
    }

    const form = new FormData();
    // Whisper infers the format from the file; a generic audio blob works for
    // the common encodings (mp3/mp4/m4a/wav/webm). Name it accordingly.
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: 'audio/mpeg' });
    form.append('file', blob, 'recording.mp3');
    form.append('model', this.model);
    form.append('response_format', 'verbose_json');
    if (language) {
      form.append('language', language);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        // Do NOT set Content-Type manually — fetch sets the multipart boundary.
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      throw new Error(`OpenAI Whisper request failed: ${message}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid API key: authentication failed');
    }
    if (response.status === 429) {
      throw new Error('OpenAI Whisper rate limited (HTTP 429)');
    }
    if (!response.ok) {
      const text = await safeReadText(response);
      throw new Error(
        `OpenAI Whisper request failed with status ${response.status}: ${text}`
      );
    }

    const payload = (await response.json()) as WhisperVerboseResponse;

    if (payload.error && (payload.error.message || payload.error.code)) {
      throw new Error(payload.error.message ?? 'Unknown OpenAI Whisper error');
    }

    const segments: TranscriptionSegment[] = (payload.segments ?? []).map(
      (seg) => ({
        text: seg.text ?? '',
        start: seg.start ?? 0,
        end: seg.end ?? 0,
        confidence: logprobToConfidence(seg.avg_logprob),
      })
    );

    return {
      text: payload.text ?? '',
      segments,
    };
  }
}

/** Reads a response body as text without throwing. */
async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable response body>';
  }
}
