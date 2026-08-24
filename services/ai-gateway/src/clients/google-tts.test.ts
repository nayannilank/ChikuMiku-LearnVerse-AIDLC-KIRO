/**
 * Unit tests for the Google Cloud Text-to-Speech client.
 * Mocks fetch to verify request shape, voice mapping, response decoding,
 * and error handling — without real API calls.
 */

import { GoogleTTSClient, resolveVoice, DEFAULT_VOICE_MAP } from './google-tts';

// --- Test helpers ---

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function audioResponse(buffer: Buffer): Response {
  return jsonResponse({ audioContent: buffer.toString('base64') });
}

// --- Tests ---

describe('GoogleTTSClient', () => {
  it('synthesizes MP3 audio and decodes it to a Buffer', async () => {
    const expected = Buffer.from('mp3-audio-bytes');
    const fetchImpl = jest.fn().mockResolvedValue(audioResponse(expected));

    const client = new GoogleTTSClient({ apiKey: 'tts-key', fetchImpl });
    const audio = await client.synthesize('Hello', 'en');

    expect(Buffer.isBuffer(audio)).toBe(true);
    expect(audio.equals(expected)).toBe(true);
  });

  it('sends the API key, text, MP3 encoding, and mapped voice', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(audioResponse(Buffer.from('x')));
    const client = new GoogleTTSClient({ apiKey: 'tts-key', fetchImpl });

    await client.synthesize('नमस्ते', 'hi');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('key=tts-key');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.input.text).toBe('नमस्ते');
    expect(body.audioConfig.audioEncoding).toBe('MP3');
    expect(body.voice.languageCode).toBe('hi-IN');
  });

  it('throws an auth error for an empty API key without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = new GoogleTTSClient({ apiKey: '', fetchImpl });

    await expect(client.synthesize('hi', 'en')).rejects.toThrow(
      'Invalid API key: authentication failed'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws an auth error on 401 responses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = new GoogleTTSClient({ apiKey: 'bad', fetchImpl });

    await expect(client.synthesize('hi', 'en')).rejects.toThrow(
      'Invalid API key: authentication failed'
    );
  });

  it('throws when the response has no audio content', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}));
    const client = new GoogleTTSClient({ apiKey: 'key', fetchImpl });

    await expect(client.synthesize('hi', 'en')).rejects.toThrow(/no audio content/);
  });

  it('wraps network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('timeout'));
    const client = new GoogleTTSClient({ apiKey: 'key', fetchImpl });

    await expect(client.synthesize('hi', 'en')).rejects.toThrow(
      /Google TTS request failed: timeout/
    );
  });
});

describe('resolveVoice', () => {
  it('resolves exact language codes', () => {
    expect(resolveVoice('kn', DEFAULT_VOICE_MAP).languageCode).toBe('kn-IN');
  });

  it('resolves by primary subtag (e.g. en-US -> en)', () => {
    expect(resolveVoice('en-US', DEFAULT_VOICE_MAP).languageCode).toBe('en-IN');
  });

  it('falls back to English for unknown languages', () => {
    expect(resolveVoice('xyz', DEFAULT_VOICE_MAP).languageCode).toBe('en-IN');
  });

  it('falls back to English for empty input', () => {
    expect(resolveVoice('', DEFAULT_VOICE_MAP).languageCode).toBe('en-IN');
  });
});
