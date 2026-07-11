/**
 * Unit tests for the Explanation Generation Service.
 * Tests prompt construction, output validation, TTS/S3 integration,
 * error handling, and multi-page processing.
 *
 * Requirements: 9.1, 9.2, 9.6, 9.7
 */

import type { ExplanationResult } from '@chikumiku/types';
import type {
  ILLMClient,
  ITTSClient,
  IS3Client,
  ExplanationDeps,
  ExplanationRequest,
  ParsedExplanation,
} from './explanation';
import {
  getComplexityLevel,
  buildExplanationPrompt,
  parseLLMResponse,
  validateAndNormalizeExplanation,
  buildAudioS3Key,
  handleExplanationRequest,
} from './explanation';

// --- Mock factories ---

function createMockLLMClient(response?: string): ILLMClient {
  const defaultResponse = JSON.stringify({
    summary: 'This is a test summary about photosynthesis. Plants use sunlight to make food.',
    keywords: ['photosynthesis', 'sunlight', 'plants', 'chlorophyll'],
    concepts: ['Energy conversion in plants', 'Role of chlorophyll'],
  });

  return {
    generate: jest.fn().mockResolvedValue(response ?? defaultResponse),
  };
}

function createMockTTSClient(): ITTSClient {
  return {
    synthesize: jest.fn().mockResolvedValue(Buffer.from('fake-audio-data')),
  };
}

function createMockS3Client(url?: string): IS3Client {
  return {
    upload: jest.fn().mockResolvedValue(url ?? 'https://s3.amazonaws.com/bucket/audio/test.mp3'),
  };
}

function createDeps(overrides?: Partial<ExplanationDeps>): ExplanationDeps {
  return {
    llmClient: createMockLLMClient(),
    ttsClient: createMockTTSClient(),
    s3Client: createMockS3Client(),
    ...overrides,
  };
}

function createRequest(overrides?: Partial<ExplanationRequest>): ExplanationRequest {
  return {
    chapterId: 'chapter-001',
    learnerId: 'learner-001',
    gradeLevel: '5th',
    pages: [
      { pageNumber: 1, text: 'Photosynthesis is the process by which plants make food using sunlight.' },
    ],
    ...overrides,
  };
}

// --- Tests ---

describe('getComplexityLevel', () => {
  it('returns simple for LKG', () => {
    expect(getComplexityLevel('LKG')).toBe('simple');
  });

  it('returns simple for UKG', () => {
    expect(getComplexityLevel('UKG')).toBe('simple');
  });

  it('returns simple for 1st grade', () => {
    expect(getComplexityLevel('1st')).toBe('simple');
  });

  it('returns simple for 2nd grade', () => {
    expect(getComplexityLevel('2nd')).toBe('simple');
  });

  it('returns moderate for 3rd grade', () => {
    expect(getComplexityLevel('3rd')).toBe('moderate');
  });

  it('returns moderate for 4th grade', () => {
    expect(getComplexityLevel('4th')).toBe('moderate');
  });

  it('returns moderate for 5th grade', () => {
    expect(getComplexityLevel('5th')).toBe('moderate');
  });

  it('returns advanced for 6th grade', () => {
    expect(getComplexityLevel('6th')).toBe('advanced');
  });

  it('returns advanced for 10th grade', () => {
    expect(getComplexityLevel('10th')).toBe('advanced');
  });

  it('returns advanced for 12th grade', () => {
    expect(getComplexityLevel('12th')).toBe('advanced');
  });

  it('handles case-insensitive input', () => {
    expect(getComplexityLevel('lkg')).toBe('simple');
    expect(getComplexityLevel('LKG')).toBe('simple');
  });

  it('handles whitespace in input', () => {
    expect(getComplexityLevel('  3rd  ')).toBe('moderate');
  });
});

describe('buildExplanationPrompt', () => {
  it('includes the page text in the prompt', () => {
    const prompt = buildExplanationPrompt('Hello world content', '5th');
    expect(prompt).toContain('Hello world content');
  });

  it('includes grade level in the prompt', () => {
    const prompt = buildExplanationPrompt('Content', '3rd');
    expect(prompt).toContain('3rd');
  });

  it('includes simple language instructions for young grades', () => {
    const prompt = buildExplanationPrompt('Content', 'LKG');
    expect(prompt).toContain('simple words');
    expect(prompt).toContain('young children');
  });

  it('includes moderate language instructions for middle grades', () => {
    const prompt = buildExplanationPrompt('Content', '4th');
    expect(prompt).toContain('clear and straightforward');
  });

  it('includes advanced language instructions for higher grades', () => {
    const prompt = buildExplanationPrompt('Content', '10th');
    expect(prompt).toContain('academic language');
  });

  it('includes subject context when provided', () => {
    const prompt = buildExplanationPrompt('Content', '5th', 'Science');
    expect(prompt).toContain('Subject: Science');
  });

  it('does not include subject line when not provided', () => {
    const prompt = buildExplanationPrompt('Content', '5th');
    expect(prompt).not.toContain('Subject:');
  });

  it('requests JSON format output', () => {
    const prompt = buildExplanationPrompt('Content', '5th');
    expect(prompt).toContain('JSON format');
    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"keywords"');
    expect(prompt).toContain('"concepts"');
  });

  it('specifies max 200 words for summary', () => {
    const prompt = buildExplanationPrompt('Content', '5th');
    expect(prompt).toContain('maximum 200 words');
  });

  it('specifies 3 to 10 keywords', () => {
    const prompt = buildExplanationPrompt('Content', '5th');
    expect(prompt).toContain('3 and 10 keywords');
  });

  it('specifies 1 to 5 concepts', () => {
    const prompt = buildExplanationPrompt('Content', '5th');
    expect(prompt).toContain('1 and 5 concepts');
  });
});

describe('parseLLMResponse', () => {
  it('parses valid JSON response', () => {
    const response = JSON.stringify({
      summary: 'A summary',
      keywords: ['key1', 'key2', 'key3'],
      concepts: ['concept1'],
    });

    const result = parseLLMResponse(response);
    expect(result.summary).toBe('A summary');
    expect(result.keywords).toEqual(['key1', 'key2', 'key3']);
    expect(result.concepts).toEqual(['concept1']);
  });

  it('handles response wrapped in markdown code fences', () => {
    const response = '```json\n{"summary":"test","keywords":["a","b","c"],"concepts":["x"]}\n```';

    const result = parseLLMResponse(response);
    expect(result.summary).toBe('test');
    expect(result.keywords).toEqual(['a', 'b', 'c']);
    expect(result.concepts).toEqual(['x']);
  });

  it('handles response wrapped in code fences without json tag', () => {
    const response = '```\n{"summary":"test","keywords":["a","b","c"],"concepts":["x"]}\n```';

    const result = parseLLMResponse(response);
    expect(result.summary).toBe('test');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseLLMResponse('not valid json')).toThrow();
  });

  it('throws on missing summary field', () => {
    const response = JSON.stringify({
      keywords: ['a', 'b', 'c'],
      concepts: ['x'],
    });
    expect(() => parseLLMResponse(response)).toThrow('Invalid LLM response structure');
  });

  it('throws on missing keywords field', () => {
    const response = JSON.stringify({
      summary: 'test',
      concepts: ['x'],
    });
    expect(() => parseLLMResponse(response)).toThrow('Invalid LLM response structure');
  });

  it('throws on missing concepts field', () => {
    const response = JSON.stringify({
      summary: 'test',
      keywords: ['a', 'b', 'c'],
    });
    expect(() => parseLLMResponse(response)).toThrow('Invalid LLM response structure');
  });

  it('converts non-string values to strings', () => {
    const response = JSON.stringify({
      summary: 123,
      keywords: [1, 2, 3],
      concepts: [true],
    });

    const result = parseLLMResponse(response);
    expect(result.summary).toBe('123');
    expect(result.keywords).toEqual(['1', '2', '3']);
    expect(result.concepts).toEqual(['true']);
  });
});

describe('validateAndNormalizeExplanation', () => {
  it('passes through a valid explanation unchanged', () => {
    const input: ParsedExplanation = {
      summary: 'A valid summary with enough words.',
      keywords: ['word1', 'word2', 'word3', 'word4'],
      concepts: ['concept1', 'concept2'],
    };

    const result = validateAndNormalizeExplanation(input);
    expect(result.summary).toBe(input.summary);
    expect(result.keywords).toEqual(input.keywords);
    expect(result.concepts).toEqual(input.concepts);
  });

  it('truncates summary exceeding 200 words', () => {
    const words = Array.from({ length: 250 }, (_, i) => `word${i}`);
    const input: ParsedExplanation = {
      summary: words.join(' '),
      keywords: ['a', 'b', 'c'],
      concepts: ['x'],
    };

    const result = validateAndNormalizeExplanation(input);
    const resultWords = result.summary.split(/\s+/);
    expect(resultWords.length).toBeLessThanOrEqual(200);
  });

  it('allows summary with exactly 200 words', () => {
    const words = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const input: ParsedExplanation = {
      summary: words.join(' '),
      keywords: ['a', 'b', 'c'],
      concepts: ['x'],
    };

    const result = validateAndNormalizeExplanation(input);
    const resultWords = result.summary.split(/\s+/).filter(w => w.length > 0);
    expect(resultWords.length).toBe(200);
  });

  it('truncates keywords exceeding 10 items', () => {
    const input: ParsedExplanation = {
      summary: 'Summary text.',
      keywords: Array.from({ length: 15 }, (_, i) => `keyword${i}`),
      concepts: ['x'],
    };

    const result = validateAndNormalizeExplanation(input);
    expect(result.keywords.length).toBe(10);
  });

  it('pads keywords when fewer than 3', () => {
    const input: ParsedExplanation = {
      summary: 'This is a summary with several different words included.',
      keywords: ['only_one'],
      concepts: ['x'],
    };

    const result = validateAndNormalizeExplanation(input);
    expect(result.keywords.length).toBeGreaterThanOrEqual(3);
  });

  it('truncates concepts exceeding 5 items', () => {
    const input: ParsedExplanation = {
      summary: 'Summary.',
      keywords: ['a', 'b', 'c'],
      concepts: Array.from({ length: 8 }, (_, i) => `concept${i}`),
    };

    const result = validateAndNormalizeExplanation(input);
    expect(result.concepts.length).toBe(5);
  });

  it('adds a default concept when none provided', () => {
    const input: ParsedExplanation = {
      summary: 'Summary.',
      keywords: ['a', 'b', 'c'],
      concepts: [],
    };

    const result = validateAndNormalizeExplanation(input);
    expect(result.concepts.length).toBe(1);
  });
});

describe('buildAudioS3Key', () => {
  it('builds correct S3 key format', () => {
    const key = buildAudioS3Key('chapter-001', 3, 'learner-001');
    expect(key).toBe('audio/explanations/chapter-001/learner-001/page-3.mp3');
  });

  it('uses page number in key', () => {
    const key = buildAudioS3Key('ch-1', 42, 'lr-1');
    expect(key).toContain('page-42');
  });
});

describe('handleExplanationRequest', () => {
  it('returns an ExplanationResult for each page', async () => {
    const deps = createDeps();
    const request = createRequest({
      pages: [
        { pageNumber: 1, text: 'Page 1 content' },
        { pageNumber: 2, text: 'Page 2 content' },
      ],
    });

    const results = await handleExplanationRequest(request, deps);

    expect(results).toHaveLength(2);
    expect(results[0].pageNumber).toBe(1);
    expect(results[1].pageNumber).toBe(2);
  });

  it('calls LLM client for each page', async () => {
    const llmClient = createMockLLMClient();
    const deps = createDeps({ llmClient });
    const request = createRequest({
      pages: [
        { pageNumber: 1, text: 'Page 1' },
        { pageNumber: 2, text: 'Page 2' },
      ],
    });

    await handleExplanationRequest(request, deps);

    expect(llmClient.generate).toHaveBeenCalledTimes(2);
  });

  it('calls TTS client for each page summary', async () => {
    const ttsClient = createMockTTSClient();
    const deps = createDeps({ ttsClient });
    const request = createRequest();

    await handleExplanationRequest(request, deps);

    expect(ttsClient.synthesize).toHaveBeenCalledTimes(1);
    // Verify summary text is passed to TTS
    const callArgs = (ttsClient.synthesize as jest.Mock).mock.calls[0];
    expect(typeof callArgs[0]).toBe('string');
    expect(callArgs[0].length).toBeGreaterThan(0);
  });

  it('calls S3 client to upload audio', async () => {
    const s3Client = createMockS3Client();
    const deps = createDeps({ s3Client });
    const request = createRequest();

    await handleExplanationRequest(request, deps);

    expect(s3Client.upload).toHaveBeenCalledTimes(1);
    const callArgs = (s3Client.upload as jest.Mock).mock.calls[0];
    expect(callArgs[0]).toContain('audio/explanations');
    expect(callArgs[2]).toBe('audio/mpeg');
  });

  it('returns audio URL from S3 in results', async () => {
    const expectedUrl = 'https://s3.amazonaws.com/bucket/audio/explanation.mp3';
    const s3Client = createMockS3Client(expectedUrl);
    const deps = createDeps({ s3Client });
    const request = createRequest();

    const results = await handleExplanationRequest(request, deps);

    expect(results[0].audioUrl).toBe(expectedUrl);
  });

  it('adapts prompt complexity based on grade level', async () => {
    const llmClient = createMockLLMClient();
    const deps = createDeps({ llmClient });

    // Test with a young grade
    const request = createRequest({ gradeLevel: 'LKG' });
    await handleExplanationRequest(request, deps);

    const prompt = (llmClient.generate as jest.Mock).mock.calls[0][0];
    expect(prompt).toContain('simple words');
  });

  it('passes correct LLM options', async () => {
    const llmClient = createMockLLMClient();
    const deps = createDeps({ llmClient });
    const request = createRequest();

    await handleExplanationRequest(request, deps);

    const options = (llmClient.generate as jest.Mock).mock.calls[0][1];
    expect(options).toEqual({
      temperature: 0.3,
      maxTokens: 1024,
      model: 'gpt-5-mini',
    });
  });

  it('uses page-level language for TTS when available', async () => {
    const ttsClient = createMockTTSClient();
    const deps = createDeps({ ttsClient });
    const request = createRequest({
      pages: [{ pageNumber: 1, text: 'Content', language: 'hi' }],
    });

    await handleExplanationRequest(request, deps);

    const callArgs = (ttsClient.synthesize as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toBe('hi');
  });

  it('falls back to request-level language for TTS', async () => {
    const ttsClient = createMockTTSClient();
    const deps = createDeps({ ttsClient });
    const request = createRequest({
      language: 'kn',
      pages: [{ pageNumber: 1, text: 'Content' }],
    });

    await handleExplanationRequest(request, deps);

    const callArgs = (ttsClient.synthesize as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toBe('kn');
  });

  it('defaults to English for TTS when no language specified', async () => {
    const ttsClient = createMockTTSClient();
    const deps = createDeps({ ttsClient });
    const request = createRequest({
      pages: [{ pageNumber: 1, text: 'Content' }],
    });

    await handleExplanationRequest(request, deps);

    const callArgs = (ttsClient.synthesize as jest.Mock).mock.calls[0];
    expect(callArgs[1]).toBe('en');
  });

  it('propagates LLM client errors', async () => {
    const llmClient: ILLMClient = {
      generate: jest.fn().mockRejectedValue(new Error('LLM service unavailable')),
    };
    const deps = createDeps({ llmClient });
    const request = createRequest();

    await expect(handleExplanationRequest(request, deps)).rejects.toThrow(
      'LLM service unavailable'
    );
  });

  it('propagates TTS client errors', async () => {
    const ttsClient: ITTSClient = {
      synthesize: jest.fn().mockRejectedValue(new Error('TTS synthesis failed')),
    };
    const deps = createDeps({ ttsClient });
    const request = createRequest();

    await expect(handleExplanationRequest(request, deps)).rejects.toThrow(
      'TTS synthesis failed'
    );
  });

  it('propagates S3 upload errors', async () => {
    const s3Client: IS3Client = {
      upload: jest.fn().mockRejectedValue(new Error('S3 upload failed')),
    };
    const deps = createDeps({ s3Client });
    const request = createRequest();

    await expect(handleExplanationRequest(request, deps)).rejects.toThrow(
      'S3 upload failed'
    );
  });

  it('validates explanation output structure', async () => {
    const deps = createDeps();
    const request = createRequest();

    const results = await handleExplanationRequest(request, deps);

    expect(results[0]).toMatchObject({
      pageNumber: expect.any(Number),
      summary: expect.any(String),
      keywords: expect.any(Array),
      concepts: expect.any(Array),
      audioUrl: expect.any(String),
    });

    // Check structural constraints
    const wordCount = results[0].summary.split(/\s+/).filter(w => w.length > 0).length;
    expect(wordCount).toBeLessThanOrEqual(200);
    expect(results[0].keywords.length).toBeGreaterThanOrEqual(3);
    expect(results[0].keywords.length).toBeLessThanOrEqual(10);
    expect(results[0].concepts.length).toBeGreaterThanOrEqual(1);
    expect(results[0].concepts.length).toBeLessThanOrEqual(5);
  });

  it('supports all default subjects', async () => {
    const subjects = ['English', 'Hindi', 'Kannada', 'Maths', 'Science', 'EVS', 'Computers'];
    const deps = createDeps();

    for (const subject of subjects) {
      const request = createRequest({ subject });
      const results = await handleExplanationRequest(request, deps);
      expect(results).toHaveLength(1);
      expect(results[0].summary).toBeDefined();
    }
  });

  it('supports custom subjects', async () => {
    const deps = createDeps();
    const request = createRequest({ subject: 'Sanskrit' });

    const results = await handleExplanationRequest(request, deps);
    expect(results).toHaveLength(1);

    const prompt = (deps.llmClient.generate as jest.Mock).mock.calls[0][0];
    expect(prompt).toContain('Subject: Sanskrit');
  });
});
