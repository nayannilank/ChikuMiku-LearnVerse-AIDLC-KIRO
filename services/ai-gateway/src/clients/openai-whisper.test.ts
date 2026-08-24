/**
 * Unit tests for the OpenAI Whisper STT client.
 * Stubs fetch to verify the multipart request shape, response mapping, and
 * error handling — without real API calls.
 */

import { OpenAIWhisperClient, logprobToConfidence } from './openai-whisper';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('logprobToConfidence', () => {
  it('maps 0 -> 1 and undefined -> 0, clamping to [0,1]', () => {
    expect(logprobToConfidence(0)).toBe(1);
    expect(logprobToConfidence(undefined)).toBe(0);
    expect(logprobToConfidence(-Infinity)).toBe(0);
    expect(logprobToConfidence(-0.7)).toBeCloseTo(Math.exp(-0.7), 5);
  });
});

describe('OpenAIWhisperClient', () => {
  it('posts multipart form-data with bearer auth and maps segments', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        text: 'hello world',
        segments: [
          { text: 'hello', start: 0, end: 0.5, avg_logprob: -0.1 },
          { text: 'world', start: 0.5, end: 1.0, avg_logprob: -0.2 },
        ],
      })
    );

    const client = new OpenAIWhisperClient({ apiKey: 'sk-test', fetchImpl });
    const result = await client.transcribe(Buffer.from('audio-bytes'), 'en');

    expect(result.text).toBe('hello world');
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0]).toEqual({
      text: 'hello',
      start: 0,
      end: 0.5,
      confidence: expect.closeTo(Math.exp(-0.1), 5),
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/audio/transcriptions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    // Content-Type must NOT be set manually (fetch adds the multipart boundary).
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('model')).toBe('whisper-1');
    expect((init.body as FormData).get('response_format')).toBe('verbose_json');
    expect((init.body as FormData).get('language')).toBe('en');
  });

  it('returns empty segments when none are present', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ text: 'hi' }));
    const client = new OpenAIWhisperClient({ apiKey: 'k', fetchImpl });
    const result = await client.transcribe(Buffer.from('x'));
    expect(result).toEqual({ text: 'hi', segments: [] });
  });

  it('throws an auth error for an empty key without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = new OpenAIWhisperClient({ apiKey: '', fetchImpl });
    await expect(client.transcribe(Buffer.from('x'))).rejects.toThrow(
      'Invalid API key: authentication failed'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an empty audio buffer without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = new OpenAIWhisperClient({ apiKey: 'k', fetchImpl });
    await expect(client.transcribe(Buffer.alloc(0))).rejects.toThrow(
      /non-empty audio buffer/
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps 401 to an auth error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = new OpenAIWhisperClient({ apiKey: 'bad', fetchImpl });
    await expect(client.transcribe(Buffer.from('x'))).rejects.toThrow(
      'Invalid API key: authentication failed'
    );
  });

  it('maps 429 to a rate-limit error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    const client = new OpenAIWhisperClient({ apiKey: 'k', fetchImpl });
    await expect(client.transcribe(Buffer.from('x'))).rejects.toThrow(/rate limited/);
  });

  it('wraps network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    const client = new OpenAIWhisperClient({ apiKey: 'k', fetchImpl });
    await expect(client.transcribe(Buffer.from('x'))).rejects.toThrow(
      /OpenAI Whisper request failed: ETIMEDOUT/
    );
  });
});
