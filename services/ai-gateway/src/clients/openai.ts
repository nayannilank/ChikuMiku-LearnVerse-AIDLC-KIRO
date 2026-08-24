/**
 * OpenAI clients.
 *
 * Concrete implementations of `ILLMClient` (GPT-5 Mini chat completions) and
 * `IEmbeddingClient` (text-embedding-3-small) used by the explanation, Q&A,
 * grammar, revision, and embedding services.
 *
 * Auth: REST + API key (`Authorization: Bearer <key>`), matching the codebase's
 * injected-key convention (key sourced from Secrets Manager). Uses native
 * `fetch` (Node 22) to avoid bundling the OpenAI SDK into the Lambda artifact.
 *
 * Notes:
 * - GPT-5 models expect `max_completion_tokens` (not the legacy `max_tokens`)
 *   on the Chat Completions endpoint; the service layer passes `maxTokens`,
 *   which we translate accordingly.
 * - Embeddings request `encoding_format: 'float'` explicitly so the response
 *   is a numeric array rather than a base64 string.
 *
 * Requirements: 9.1, 9.2, 25.4
 */

import type { ILLMClient, LLMOptions } from '../services/explanation';
import type { IEmbeddingClient } from '../services/embedding';

const DEFAULT_CHAT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_EMBEDDINGS_ENDPOINT = 'https://api.openai.com/v1/embeddings';

/** Default chat model when the caller does not specify one. */
export const DEFAULT_CHAT_MODEL = 'gpt-5-mini';
/** Embedding model used for RAG. */
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

// --- Chat completions (ILLMClient) ---

/** Minimal shape of the Chat Completions response we consume. */
interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; type?: string; code?: string };
}

/** Options for constructing the OpenAI LLM client. */
export interface OpenAILLMClientOptions {
  apiKey: string;
  /** Default model (overridable per-call via LLMOptions.model). */
  model?: string;
  endpoint?: string;
  /** Injectable fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch;
}

/**
 * GPT-5 Mini chat client backed by the Chat Completions REST API.
 */
export class OpenAILLMClient implements ILLMClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAILLMClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_CHAT_MODEL;
    this.endpoint = options.endpoint ?? DEFAULT_CHAT_ENDPOINT;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Invalid API key: authentication failed');
    }

    const requestBody: Record<string, unknown> = {
      model: options?.model ?? this.model,
      messages: [{ role: 'user', content: prompt }],
    };

    if (options?.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      // GPT-5 / reasoning models use max_completion_tokens.
      requestBody.max_completion_tokens = options.maxTokens;
    }

    const payload = (await this.postJson(
      this.endpoint,
      requestBody,
      'OpenAI chat'
    )) as ChatCompletionResponse;

    if (payload.error && (payload.error.message || payload.error.code)) {
      throw new Error(payload.error.message ?? 'Unknown OpenAI error');
    }

    const content = payload.choices?.[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error('OpenAI response contained no message content');
    }

    return content;
  }

  private postJson(
    url: string,
    body: unknown,
    label: string
  ): Promise<unknown> {
    return postJsonWithAuth(this.fetchImpl, url, body, this.apiKey, label);
  }
}

// --- Embeddings (IEmbeddingClient) ---

/** Minimal shape of the Embeddings response we consume. */
interface EmbeddingsResponse {
  data?: Array<{ embedding?: number[]; index?: number }>;
  error?: { message?: string; type?: string; code?: string };
}

/** Options for constructing the OpenAI embedding client. */
export interface OpenAIEmbeddingClientOptions {
  apiKey: string;
  model?: string;
  endpoint?: string;
  /** Optional output dimensionality (text-embedding-3+ only). */
  dimensions?: number;
  fetchImpl?: typeof fetch;
}

/**
 * text-embedding-3-small client backed by the Embeddings REST API.
 */
export class OpenAIEmbeddingClient implements IEmbeddingClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;
  private readonly dimensions?: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIEmbeddingClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_EMBEDDING_MODEL;
    this.endpoint = options.endpoint ?? DEFAULT_EMBEDDINGS_ENDPOINT;
    this.dimensions = options.dimensions;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      throw new Error('Invalid API key: authentication failed');
    }

    if (texts.length === 0) {
      return [];
    }

    const requestBody: Record<string, unknown> = {
      model: this.model,
      input: texts,
      encoding_format: 'float',
    };
    if (this.dimensions !== undefined) {
      requestBody.dimensions = this.dimensions;
    }

    const payload = (await postJsonWithAuth(
      this.fetchImpl,
      this.endpoint,
      requestBody,
      this.apiKey,
      'OpenAI embeddings'
    )) as EmbeddingsResponse;

    if (payload.error && (payload.error.message || payload.error.code)) {
      throw new Error(payload.error.message ?? 'Unknown OpenAI embeddings error');
    }

    if (!payload.data || payload.data.length === 0) {
      throw new Error('OpenAI embeddings response contained no data');
    }

    // Preserve input order using the returned index, then map to vectors.
    const ordered = [...payload.data].sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0)
    );

    return ordered.map((item) => {
      if (!item.embedding) {
        throw new Error('OpenAI embeddings response contained a missing vector');
      }
      return item.embedding;
    });
  }
}

// --- Shared HTTP helper ---

/**
 * POSTs a JSON body with bearer auth and returns the parsed JSON response.
 * Normalizes auth (401/403) and network errors to stable messages.
 */
async function postJsonWithAuth(
  fetchImpl: typeof fetch,
  url: string,
  body: unknown,
  apiKey: string,
  label: string
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'network error';
    throw new Error(`${label} request failed: ${message}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('Invalid API key: authentication failed');
  }

  if (response.status === 429) {
    throw new Error(`${label} rate limited (HTTP 429)`);
  }

  if (!response.ok) {
    const text = await safeReadText(response);
    throw new Error(`${label} request failed with status ${response.status}: ${text}`);
  }

  return response.json();
}

/** Reads a response body as text without throwing. */
async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '<unreadable response body>';
  }
}
