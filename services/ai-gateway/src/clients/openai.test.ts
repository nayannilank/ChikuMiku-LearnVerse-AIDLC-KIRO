/**
 * Unit tests for the OpenAI clients (chat completions + embeddings).
 * Stubs fetch to verify request shape, response mapping, and error handling.
 */

import { OpenAILLMClient, OpenAIEmbeddingClient } from './openai';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('OpenAILLMClient', () => {
  it('sends a chat completion with bearer auth and returns the content', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'the answer' } }] })
    );

    const client = new OpenAILLMClient({ apiKey: 'sk-test', fetchImpl });
    const out = await client.generate('a prompt', { temperature: 0.3, maxTokens: 512 });

    expect(out).toBe('the answer');

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-test');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('gpt-5-mini');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'a prompt' });
    expect(body.temperature).toBe(0.3);
    // GPT-5 models use max_completion_tokens, not max_tokens.
    expect(body.max_completion_tokens).toBe(512);
    expect(body.max_tokens).toBeUndefined();
  });

  it('honors a per-call model override', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: 'x' } }] })
    );
    const client = new OpenAILLMClient({ apiKey: 'sk', fetchImpl });

    await client.generate('p', { model: 'gpt-5' });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.model).toBe('gpt-5');
  });

  it('throws an auth error for an empty key without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = new OpenAILLMClient({ apiKey: '', fetchImpl });
    await expect(client.generate('p')).rejects.toThrow('Invalid API key: authentication failed');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('maps 401 to an auth error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 401));
    const client = new OpenAILLMClient({ apiKey: 'bad', fetchImpl });
    await expect(client.generate('p')).rejects.toThrow('Invalid API key: authentication failed');
  });

  it('maps 429 to a rate-limit error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 429));
    const client = new OpenAILLMClient({ apiKey: 'k', fetchImpl });
    await expect(client.generate('p')).rejects.toThrow(/rate limited/);
  });

  it('throws when the response has no content', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ choices: [{}] }));
    const client = new OpenAILLMClient({ apiKey: 'k', fetchImpl });
    await expect(client.generate('p')).rejects.toThrow(/no message content/);
  });

  it('wraps network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const client = new OpenAILLMClient({ apiKey: 'k', fetchImpl });
    await expect(client.generate('p')).rejects.toThrow(/OpenAI chat request failed: ECONNRESET/);
  });
});

describe('OpenAIEmbeddingClient', () => {
  it('embeds texts and returns vectors in input order', async () => {
    // Return out of order to verify index-based sorting.
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        data: [
          { index: 1, embedding: [0.4, 0.5, 0.6] },
          { index: 0, embedding: [0.1, 0.2, 0.3] },
        ],
      })
    );

    const client = new OpenAIEmbeddingClient({ apiKey: 'sk', fetchImpl });
    const vectors = await client.embed(['first', 'second']);

    expect(vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('/embeddings');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('text-embedding-3-small');
    expect(body.input).toEqual(['first', 'second']);
    expect(body.encoding_format).toBe('float');
  });

  it('returns an empty array for empty input without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = new OpenAIEmbeddingClient({ apiKey: 'sk', fetchImpl });
    expect(await client.embed([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('includes dimensions when configured', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ data: [{ index: 0, embedding: [1] }] })
    );
    const client = new OpenAIEmbeddingClient({ apiKey: 'sk', fetchImpl, dimensions: 256 });
    await client.embed(['x']);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).dimensions).toBe(256);
  });

  it('throws when the response has no data', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));
    const client = new OpenAIEmbeddingClient({ apiKey: 'sk', fetchImpl });
    await expect(client.embed(['x'])).rejects.toThrow(/no data/);
  });
});
