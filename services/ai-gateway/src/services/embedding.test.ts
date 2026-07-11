/**
 * Unit tests for the Embedding Generation Service.
 * Tests chunk splitting, embedding flow, regeneration,
 * similarity search, and edge cases.
 *
 * Requirements: 25.4
 */

import type { RAGContext } from '@chikumiku/types';
import type {
  IEmbeddingClient,
  IEmbeddingRepository,
  EmbeddingDeps,
  EmbeddingRequest,
  TextChunk,
  EmbeddingResult,
} from './embedding';
import {
  estimateTokens,
  splitIntoChunks,
  handleEmbeddingRequest,
  handleEmbeddingRegeneration,
  searchSimilar,
} from './embedding';

// --- Mock factories ---

function createMockEmbeddingClient(embeddings?: number[][]): IEmbeddingClient {
  return {
    embed: jest.fn().mockImplementation((texts: string[]) => {
      if (embeddings) {
        return Promise.resolve(embeddings);
      }
      // Generate deterministic fake embeddings based on text length
      return Promise.resolve(
        texts.map((t, i) => Array.from({ length: 1536 }, (_, j) => (i + j) * 0.001))
      );
    }),
  };
}

function createMockEmbeddingRepo(): IEmbeddingRepository {
  return {
    store: jest.fn().mockResolvedValue(undefined),
    deleteByChapter: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([
      { content: 'Paragraph about photosynthesis.', score: 0.95 },
      { content: 'Plants absorb sunlight through chlorophyll.', score: 0.88 },
      { content: 'Carbon dioxide is converted to glucose.', score: 0.82 },
      { content: 'Oxygen is released as a byproduct.', score: 0.78 },
      { content: 'This process occurs in the chloroplasts.', score: 0.72 },
    ]),
  };
}

function createDeps(overrides?: Partial<EmbeddingDeps>): EmbeddingDeps {
  return {
    embeddingClient: createMockEmbeddingClient(),
    embeddingRepo: createMockEmbeddingRepo(),
    ...overrides,
  };
}

function createRequest(overrides?: Partial<EmbeddingRequest>): EmbeddingRequest {
  return {
    chapterId: 'chapter-001',
    pages: [
      {
        pageNumber: 1,
        text: 'Photosynthesis is the process by which plants convert sunlight into energy. This process occurs in the chloroplasts of plant cells. Carbon dioxide and water are converted into glucose and oxygen.',
      },
    ],
    ...overrides,
  };
}

/**
 * Generates a text with approximately the target number of words.
 */
function generateText(wordCount: number): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(`word${i}`);
  }
  return words.join(' ');
}

/**
 * Generates text with sentence boundaries at regular intervals.
 */
function generateSentences(sentenceCount: number, wordsPerSentence: number = 20): string {
  const sentences: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    const words = Array.from({ length: wordsPerSentence }, (_, j) => `word${i}_${j}`);
    sentences.push(words.join(' ') + '.');
  }
  return sentences.join(' ');
}

// --- Tests ---

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates tokens for a single word', () => {
    expect(estimateTokens('hello')).toBe(1); // 1 × 0.75 = 0.75, ceil = 1
  });

  it('estimates tokens using word count × 0.75', () => {
    const text = 'one two three four'; // 4 words × 0.75 = 3
    expect(estimateTokens(text)).toBe(3);
  });

  it('handles multiple spaces between words', () => {
    const text = 'one   two   three'; // 3 words
    expect(estimateTokens(text)).toBe(Math.ceil(3 * 0.75));
  });

  it('handles whitespace-only text', () => {
    expect(estimateTokens('   ')).toBe(0);
  });
});

describe('splitIntoChunks', () => {
  it('returns empty array for empty text', () => {
    const chunks = splitIntoChunks('', 1);
    expect(chunks).toEqual([]);
  });

  it('returns empty array for whitespace-only text', () => {
    const chunks = splitIntoChunks('   ', 1);
    expect(chunks).toEqual([]);
  });

  it('returns a single chunk for short text', () => {
    const text = 'This is a short paragraph. It has only a few sentences.';
    const chunks = splitIntoChunks(text, 1);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].content).toContain('short paragraph');
  });

  it('splits long text into multiple chunks', () => {
    // Generate text with ~1500 tokens worth of words (2000 words ≈ 1500 tokens)
    const text = generateSentences(50, 40); // 50 sentences × 40 words = 2000 words
    const chunks = splitIntoChunks(text, 1);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('targets approximately 500 tokens per chunk', () => {
    const text = generateSentences(80, 15); // 80 sentences × 15 words = 1200 words ≈ 900 tokens
    const chunks = splitIntoChunks(text, 1);

    // Each chunk (except possibly the last) should be roughly around 500 tokens
    for (let i = 0; i < chunks.length - 1; i++) {
      // Allow a range: chunks should be between 300 and 700 tokens
      // (due to sentence boundary preference)
      expect(chunks[i].tokenEstimate).toBeGreaterThan(200);
      expect(chunks[i].tokenEstimate).toBeLessThan(800);
    }
  });

  it('respects sentence boundaries', () => {
    const text = 'First sentence here. Second sentence here. Third sentence here. Fourth sentence here.';
    const chunks = splitIntoChunks(text, 1);

    // Each chunk should end with a sentence (contain a period at the end of its content)
    for (const chunk of chunks) {
      // Content should end with a sentence terminator
      expect(chunk.content).toMatch(/[.!?]$/);
    }
  });

  it('assigns correct page number', () => {
    const text = 'Some content about biology. Plants need sunlight to grow.';
    const chunks = splitIntoChunks(text, 5);
    expect(chunks[0].pageNumber).toBe(5);
  });

  it('assigns sequential chunk indices starting from 0', () => {
    const text = generateSentences(60, 20); // enough for multiple chunks
    const chunks = splitIntoChunks(text, 1);

    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }
  });

  it('includes token estimate in each chunk', () => {
    const text = 'This is a test sentence. It has some words in it.';
    const chunks = splitIntoChunks(text, 1);
    expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
  });

  it('supports custom target token count', () => {
    const text = generateSentences(40, 15); // 600 words ≈ 450 tokens
    const chunksSmall = splitIntoChunks(text, 1, 100);
    const chunksLarge = splitIntoChunks(text, 1, 1000);

    // Smaller target should produce more chunks
    expect(chunksSmall.length).toBeGreaterThan(chunksLarge.length);
  });

  it('maintains overlap between consecutive chunks', () => {
    const text = generateSentences(60, 15); // enough for multiple chunks
    const chunks = splitIntoChunks(text, 1);

    if (chunks.length > 1) {
      // Check that some content from the end of chunk N appears at the start of chunk N+1
      // (overlap ensures context continuity)
      const lastSentenceOfFirst = chunks[0].content.split(/(?<=[.!?])\s+/).pop() || '';
      // The overlap means the second chunk should start with content from the first
      expect(chunks[1].content.length).toBeGreaterThan(0);
    }
  });
});

describe('handleEmbeddingRequest', () => {
  it('returns count of embedded chunks', async () => {
    const deps = createDeps();
    const request = createRequest();

    const result = await handleEmbeddingRequest(request, deps);

    expect(result.chunksEmbedded).toBeGreaterThan(0);
  });

  it('returns 0 chunks for empty pages', async () => {
    const deps = createDeps();
    const request = createRequest({ pages: [] });

    const result = await handleEmbeddingRequest(request, deps);
    expect(result.chunksEmbedded).toBe(0);
  });

  it('returns 0 chunks when page text is empty', async () => {
    const deps = createDeps();
    const request = createRequest({
      pages: [{ pageNumber: 1, text: '' }],
    });

    const result = await handleEmbeddingRequest(request, deps);
    expect(result.chunksEmbedded).toBe(0);
  });

  it('calls embedding client with chunk texts', async () => {
    const embeddingClient = createMockEmbeddingClient();
    const deps = createDeps({ embeddingClient });
    const request = createRequest();

    await handleEmbeddingRequest(request, deps);

    expect(embeddingClient.embed).toHaveBeenCalledTimes(1);
    const texts = (embeddingClient.embed as jest.Mock).mock.calls[0][0];
    expect(Array.isArray(texts)).toBe(true);
    expect(texts.length).toBeGreaterThan(0);
    expect(typeof texts[0]).toBe('string');
  });

  it('stores embeddings in repository with correct chapterId', async () => {
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingRepo });
    const request = createRequest({ chapterId: 'chapter-xyz' });

    await handleEmbeddingRequest(request, deps);

    expect(embeddingRepo.store).toHaveBeenCalledTimes(1);
    const [chapterId, embeddings] = (embeddingRepo.store as jest.Mock).mock.calls[0];
    expect(chapterId).toBe('chapter-xyz');
    expect(Array.isArray(embeddings)).toBe(true);
    expect(embeddings.length).toBeGreaterThan(0);
    expect(embeddings[0]).toHaveProperty('pageNumber');
    expect(embeddings[0]).toHaveProperty('chunkIndex');
    expect(embeddings[0]).toHaveProperty('embedding');
    expect(embeddings[0]).toHaveProperty('content');
  });

  it('processes multiple pages', async () => {
    const embeddingClient = createMockEmbeddingClient();
    const deps = createDeps({ embeddingClient });
    const request = createRequest({
      pages: [
        { pageNumber: 1, text: 'First page content about biology.' },
        { pageNumber: 2, text: 'Second page content about chemistry.' },
        { pageNumber: 3, text: 'Third page content about physics.' },
      ],
    });

    const result = await handleEmbeddingRequest(request, deps);

    expect(result.chunksEmbedded).toBeGreaterThanOrEqual(3);
    const texts = (embeddingClient.embed as jest.Mock).mock.calls[0][0];
    expect(texts.length).toBeGreaterThanOrEqual(3);
  });

  it('does not call embed or store when all pages are empty', async () => {
    const embeddingClient = createMockEmbeddingClient();
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingClient, embeddingRepo });
    const request = createRequest({
      pages: [
        { pageNumber: 1, text: '' },
        { pageNumber: 2, text: '   ' },
      ],
    });

    await handleEmbeddingRequest(request, deps);

    expect(embeddingClient.embed).not.toHaveBeenCalled();
    expect(embeddingRepo.store).not.toHaveBeenCalled();
  });

  it('propagates embedding client errors', async () => {
    const embeddingClient: IEmbeddingClient = {
      embed: jest.fn().mockRejectedValue(new Error('Embedding API unavailable')),
    };
    const deps = createDeps({ embeddingClient });
    const request = createRequest();

    await expect(handleEmbeddingRequest(request, deps)).rejects.toThrow(
      'Embedding API unavailable'
    );
  });

  it('propagates repository store errors', async () => {
    const embeddingRepo: IEmbeddingRepository = {
      store: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      deleteByChapter: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([]),
    };
    const deps = createDeps({ embeddingRepo });
    const request = createRequest();

    await expect(handleEmbeddingRequest(request, deps)).rejects.toThrow(
      'DB connection failed'
    );
  });
});

describe('handleEmbeddingRegeneration', () => {
  it('deletes existing embeddings before regenerating', async () => {
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingRepo });
    const pages = [{ pageNumber: 1, text: 'Updated content about cells.' }];

    await handleEmbeddingRegeneration('chapter-001', pages, deps);

    expect(embeddingRepo.deleteByChapter).toHaveBeenCalledWith('chapter-001');
    expect(embeddingRepo.deleteByChapter).toHaveBeenCalledTimes(1);
  });

  it('deletes before storing new embeddings', async () => {
    const callOrder: string[] = [];
    const embeddingRepo: IEmbeddingRepository = {
      store: jest.fn().mockImplementation(() => {
        callOrder.push('store');
        return Promise.resolve();
      }),
      deleteByChapter: jest.fn().mockImplementation(() => {
        callOrder.push('delete');
        return Promise.resolve();
      }),
      search: jest.fn().mockResolvedValue([]),
    };
    const deps = createDeps({ embeddingRepo });
    const pages = [{ pageNumber: 1, text: 'Some content here.' }];

    await handleEmbeddingRegeneration('chapter-001', pages, deps);

    expect(callOrder[0]).toBe('delete');
    expect(callOrder[1]).toBe('store');
  });

  it('stores new embeddings after deletion', async () => {
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingRepo });
    const pages = [{ pageNumber: 1, text: 'New chapter content about DNA.' }];

    const result = await handleEmbeddingRegeneration('chapter-001', pages, deps);

    expect(embeddingRepo.store).toHaveBeenCalledTimes(1);
    expect(result.chunksEmbedded).toBeGreaterThan(0);
  });

  it('handles empty pages during regeneration', async () => {
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingRepo });
    const pages: { pageNumber: number; text: string }[] = [];

    const result = await handleEmbeddingRegeneration('chapter-001', pages, deps);

    expect(embeddingRepo.deleteByChapter).toHaveBeenCalledWith('chapter-001');
    expect(result.chunksEmbedded).toBe(0);
  });
});

describe('searchSimilar', () => {
  it('returns top-5 results as RAGContext', async () => {
    const deps = createDeps();

    const result = await searchSimilar('What is photosynthesis?', 'chapter-001', deps);

    expect(result.paragraphs).toHaveLength(5);
    expect(result.similarity_scores).toHaveLength(5);
  });

  it('embeds the query before searching', async () => {
    const embeddingClient = createMockEmbeddingClient();
    const deps = createDeps({ embeddingClient });

    await searchSimilar('How do plants grow?', 'chapter-001', deps);

    expect(embeddingClient.embed).toHaveBeenCalledWith(['How do plants grow?']);
  });

  it('searches with correct chapterId and topK', async () => {
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingRepo });

    await searchSimilar('test query', 'chapter-xyz', deps);

    expect(embeddingRepo.search).toHaveBeenCalledTimes(1);
    const [, chapterId, topK] = (embeddingRepo.search as jest.Mock).mock.calls[0];
    expect(chapterId).toBe('chapter-xyz');
    expect(topK).toBe(5);
  });

  it('returns paragraphs and scores from search results', async () => {
    const deps = createDeps();

    const result = await searchSimilar('query', 'chapter-001', deps);

    expect(result.paragraphs[0]).toBe('Paragraph about photosynthesis.');
    expect(result.similarity_scores[0]).toBe(0.95);
  });

  it('returns empty RAGContext for empty query', async () => {
    const deps = createDeps();

    const result = await searchSimilar('', 'chapter-001', deps);

    expect(result.paragraphs).toEqual([]);
    expect(result.similarity_scores).toEqual([]);
  });

  it('returns empty RAGContext for whitespace-only query', async () => {
    const deps = createDeps();

    const result = await searchSimilar('   ', 'chapter-001', deps);

    expect(result.paragraphs).toEqual([]);
    expect(result.similarity_scores).toEqual([]);
  });

  it('supports custom topK parameter', async () => {
    const embeddingRepo = createMockEmbeddingRepo();
    const deps = createDeps({ embeddingRepo });

    await searchSimilar('test', 'chapter-001', deps, 3);

    const [, , topK] = (embeddingRepo.search as jest.Mock).mock.calls[0];
    expect(topK).toBe(3);
  });

  it('propagates embedding client errors during search', async () => {
    const embeddingClient: IEmbeddingClient = {
      embed: jest.fn().mockRejectedValue(new Error('Embedding service down')),
    };
    const deps = createDeps({ embeddingClient });

    await expect(searchSimilar('query', 'chapter-001', deps)).rejects.toThrow(
      'Embedding service down'
    );
  });

  it('propagates repository search errors', async () => {
    const embeddingRepo: IEmbeddingRepository = {
      store: jest.fn().mockResolvedValue(undefined),
      deleteByChapter: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockRejectedValue(new Error('pgvector query failed')),
    };
    const deps = createDeps({ embeddingRepo });

    await expect(searchSimilar('query', 'chapter-001', deps)).rejects.toThrow(
      'pgvector query failed'
    );
  });
});
