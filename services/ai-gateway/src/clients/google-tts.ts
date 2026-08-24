/**
 * Google Cloud Text-to-Speech client.
 *
 * Concrete implementation of `ITTSClient` (see services/explanation.ts) that
 * calls the Cloud Text-to-Speech REST API using an API key and returns MP3
 * audio bytes as a Buffer.
 *
 * Why REST + API key (instead of @google-cloud/text-to-speech):
 * - Matches the codebase's API-key auth (keys stored in Secrets Manager),
 *   whereas the official SDK expects service-account / ADC credentials.
 * - Keeps the Lambda bundle small.
 *
 * The `ITTSClient.synthesize(text, language)` contract does not pass a key, so
 * the API key is supplied at construction time (resolved from Secrets Manager
 * by the caller).
 *
 * Requirements: 9.1, 9.2, 10.2, 25.6
 */

import type { ITTSClient } from '../services/explanation';

/** Minimal shape of the Cloud TTS `text:synthesize` response we consume. */
interface TTSSynthesizeResponse {
  /** Base64-encoded audio bytes. */
  audioContent?: string;
  error?: { code?: number; message?: string; status?: string };
}

/** Options for constructing the TTS client. */
export interface GoogleTTSClientOptions {
  apiKey: string;
  /** Override the endpoint (useful for tests / regional endpoints). */
  endpoint?: string;
  /** Injectable fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch;
  /**
   * Optional override mapping of language code -> Google voice config.
   * Merged over the built-in defaults.
   */
  voiceOverrides?: Record<string, VoiceConfig>;
}

/** Google voice selection for a language. */
export interface VoiceConfig {
  languageCode: string;
  name?: string;
  ssmlGender?: 'NEUTRAL' | 'MALE' | 'FEMALE';
}

const DEFAULT_TTS_ENDPOINT =
  'https://texttospeech.googleapis.com/v1/text:synthesize';

/**
 * Maps the app's short language codes to Google TTS voice configs.
 * Covers the platform's supported subjects: English, Hindi, Kannada.
 * Unknown languages fall back to English.
 */
export const DEFAULT_VOICE_MAP: Record<string, VoiceConfig> = {
  en: { languageCode: 'en-IN', ssmlGender: 'FEMALE' },
  hi: { languageCode: 'hi-IN', ssmlGender: 'FEMALE' },
  kn: { languageCode: 'kn-IN', ssmlGender: 'FEMALE' },
};

const FALLBACK_VOICE: VoiceConfig = { languageCode: 'en-IN', ssmlGender: 'FEMALE' };

/**
 * Resolves a language code (e.g. "en", "hi-IN") to a Google voice config.
 * Tries an exact match, then the primary subtag, then falls back to English.
 */
export function resolveVoice(
  language: string,
  voiceMap: Record<string, VoiceConfig>
): VoiceConfig {
  if (!language) {
    return FALLBACK_VOICE;
  }

  const normalized = language.toLowerCase();

  if (voiceMap[normalized]) {
    return voiceMap[normalized];
  }

  const primary = normalized.split('-')[0];
  if (voiceMap[primary]) {
    return voiceMap[primary];
  }

  return FALLBACK_VOICE;
}

/**
 * Cloud Text-to-Speech client backed by the REST API.
 */
export class GoogleTTSClient implements ITTSClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;
  private readonly voiceMap: Record<string, VoiceConfig>;

  constructor(options: GoogleTTSClientOptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint ?? DEFAULT_TTS_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.voiceMap = { ...DEFAULT_VOICE_MAP, ...(options.voiceOverrides ?? {}) };
  }

  async synthesize(text: string, language: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('Invalid API key: authentication failed');
    }

    const voice = resolveVoice(language, this.voiceMap);

    const requestBody = {
      input: { text },
      voice: {
        languageCode: voice.languageCode,
        ...(voice.name ? { name: voice.name } : {}),
        ...(voice.ssmlGender ? { ssmlGender: voice.ssmlGender } : {}),
      },
      audioConfig: { audioEncoding: 'MP3' },
    };

    const url = `${this.endpoint}?key=${encodeURIComponent(this.apiKey)}`;

    let httpResponse: Response;
    try {
      httpResponse = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'network error';
      throw new Error(`Google TTS request failed: ${message}`);
    }

    if (httpResponse.status === 401 || httpResponse.status === 403) {
      throw new Error('Invalid API key: authentication failed');
    }

    if (!httpResponse.ok) {
      const bodyText = await safeReadText(httpResponse);
      throw new Error(
        `Google TTS request failed with status ${httpResponse.status}: ${bodyText}`
      );
    }

    const payload = (await httpResponse.json()) as TTSSynthesizeResponse;

    if (payload.error && (payload.error.code || payload.error.message)) {
      throw new Error(payload.error.message ?? 'Unknown Google TTS error');
    }

    if (!payload.audioContent) {
      throw new Error('Google TTS returned no audio content');
    }

    return Buffer.from(payload.audioContent, 'base64');
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
