/**
 * Unit tests for the AIServiceClient adapter.
 * Verifies routing of ocr/tts to the concrete clients and clear errors for
 * not-yet-implemented service types. Uses a fake image fetcher and stubs
 * global fetch so no real Google/AWS calls are made.
 */

import { AIServiceClient } from './ai-service-client';
import type { ImageByteFetcher } from '../clients/google-vision';
import type { IS3Client } from '../services/explanation';

function fakeImageFetcher(): ImageByteFetcher {
  return { getImageBytes: jest.fn().mockResolvedValue(Buffer.from('img')) };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('AIServiceClient', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('routes ocr requests through Google Vision and returns page results', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        responses: [{ fullTextAnnotation: { text: 'page text' } }],
      })
    ) as unknown as typeof fetch;

    const client = new AIServiceClient({ imageFetcher: fakeImageFetcher() });

    const result = (await client.invoke(
      'ocr',
      { imageS3Keys: ['pages/p1.jpg'] },
      'vision-key'
    )) as { successCount: number; pages: Array<{ status: string }> };

    expect(result.successCount).toBe(1);
    expect(result.pages[0].status).toBe('success');
  });

  it('rejects ocr requests without imageS3Keys', async () => {
    const client = new AIServiceClient({ imageFetcher: fakeImageFetcher() });
    await expect(client.invoke('ocr', {}, 'key')).rejects.toThrow(/imageS3Keys/);
  });

  it('routes tts requests and uploads audio when an S3 key is provided', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ audioContent: Buffer.from('mp3').toString('base64') })
    ) as unknown as typeof fetch;

    const s3Client: IS3Client = {
      upload: jest.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/audio.mp3'),
    };
    const client = new AIServiceClient({ imageFetcher: fakeImageFetcher(), s3Client });

    const result = (await client.invoke(
      'tts',
      { text: 'hello', language: 'en', s3Key: 'audio/x.mp3' },
      'tts-key'
    )) as { audioUrl: string };

    expect(result.audioUrl).toContain('audio.mp3');
    expect(s3Client.upload).toHaveBeenCalledWith('audio/x.mp3', expect.any(Buffer), 'audio/mpeg');
  });

  it('returns base64 audio when no S3 key is provided', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({ audioContent: Buffer.from('mp3').toString('base64') })
    ) as unknown as typeof fetch;

    const client = new AIServiceClient({ imageFetcher: fakeImageFetcher() });

    const result = (await client.invoke('tts', { text: 'hi' }, 'tts-key')) as {
      audioBase64: string;
      encoding: string;
    };

    expect(result.encoding).toBe('mp3');
    expect(Buffer.from(result.audioBase64, 'base64').toString()).toBe('mp3');
  });

  it('rejects tts requests without text', async () => {
    const client = new AIServiceClient({ imageFetcher: fakeImageFetcher() });
    await expect(client.invoke('tts', {}, 'key')).rejects.toThrow(/text/);
  });

  it('routes embed requests through the embedding client + repository', async () => {
    const embed = jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);
    const store = jest.fn().mockResolvedValue(undefined);
    const embeddingRepo = { store, deleteByChapter: jest.fn(), search: jest.fn() };

    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      embeddingRepo,
      embeddingClientFactory: () => ({ embed }),
    });

    const result = (await client.invoke(
      'embed',
      { chapterId: 'c1', pages: [{ pageNumber: 1, text: 'Some sentence to embed.' }] },
      'openai-key'
    )) as { chunksEmbedded: number };

    expect(result.chunksEmbedded).toBeGreaterThan(0);
    expect(embed).toHaveBeenCalled();
    expect(store).toHaveBeenCalledWith('c1', expect.any(Array));
  });

  it('rejects embed requests without pages', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      embeddingRepo: { store: jest.fn(), deleteByChapter: jest.fn(), search: jest.fn() },
      embeddingClientFactory: () => ({ embed: jest.fn() }),
    });
    await expect(client.invoke('embed', {}, 'key')).rejects.toThrow(/pages/);
  });

  it('rejects embed requests when no repository is configured', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      embeddingClientFactory: () => ({ embed: jest.fn() }),
    });
    await expect(
      client.invoke('embed', { chapterId: 'c', pages: [{ pageNumber: 1, text: 'x' }] }, 'key')
    ).rejects.toThrow(/embedding repository/);
  });

  it('routes qa requests through RAG search + LLM and builds a learner-scoped session repo', async () => {
    const embed = jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]);
    const search = jest
      .fn()
      .mockResolvedValue([{ content: 'relevant paragraph', score: 0.9 }]);
    const embeddingRepo = { store: jest.fn(), deleteByChapter: jest.fn(), search };
    const generate = jest.fn().mockResolvedValue('An answer.');
    const sessionRepo = {
      getSession: jest.fn().mockResolvedValue(null),
      updateSession: jest.fn().mockResolvedValue(undefined),
    };
    const sessionRepoFactory = jest.fn().mockReturnValue(sessionRepo);

    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      embeddingRepo,
      embeddingClientFactory: () => ({ embed }),
      llmClientFactory: () => ({ generate }),
      sessionRepoFactory,
    });

    const result = (await client.invoke(
      'qa',
      {
        chapterId: 'c1',
        learnerId: 'l1',
        question: 'What is this about?',
        sessionContext: [],
        gradeLevel: '5th',
      },
      'openai-key'
    )) as { answer: string };

    expect(result.answer).toBe('An answer.');
    expect(search).toHaveBeenCalled();
    expect(generate).toHaveBeenCalled();
    expect(sessionRepoFactory).toHaveBeenCalledWith('l1');
    expect(sessionRepo.updateSession).toHaveBeenCalled();
  });

  it('rejects qa requests without a learnerId', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      embeddingRepo: { store: jest.fn(), deleteByChapter: jest.fn(), search: jest.fn() },
      embeddingClientFactory: () => ({ embed: jest.fn() }),
      llmClientFactory: () => ({ generate: jest.fn() }),
      sessionRepoFactory: () => ({ getSession: jest.fn(), updateSession: jest.fn() }),
    });
    await expect(
      client.invoke('qa', { chapterId: 'c', question: 'q?', sessionContext: [], gradeLevel: '5th' }, 'key')
    ).rejects.toThrow(/learnerId/);
  });

  it('surfaces a QA handler error (no content) as a thrown error', async () => {
    const embeddingRepo = {
      store: jest.fn(),
      deleteByChapter: jest.fn(),
      // Empty search -> handler returns NO_CONTENT.
      search: jest.fn().mockResolvedValue([]),
    };
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      embeddingRepo,
      embeddingClientFactory: () => ({ embed: jest.fn().mockResolvedValue([[0.1]]) }),
      llmClientFactory: () => ({ generate: jest.fn() }),
      sessionRepoFactory: () => ({
        getSession: jest.fn().mockResolvedValue(null),
        updateSession: jest.fn(),
      }),
    });

    await expect(
      client.invoke(
        'qa',
        { chapterId: 'c1', learnerId: 'l1', question: 'q?', sessionContext: [], gradeLevel: '5th' },
        'key'
      )
    ).rejects.toThrow(/Q&A failed/);
  });

  it('routes stt requests through Whisper transcription + scoring', async () => {
    const transcribe = jest.fn().mockResolvedValue({
      text: 'the cat sat',
      segments: [],
    });
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      whisperClientFactory: () => ({ transcribe }),
    });

    const result = (await client.invoke(
      'stt',
      {
        expectedText: 'the cat sat',
        audioBase64: Buffer.from('audio').toString('base64'),
        durationSeconds: 3,
        language: 'en',
      },
      'openai-key'
    )) as { overallScore: number };

    expect(transcribe).toHaveBeenCalledTimes(1);
    // Passed the decoded audio buffer through to the transcriber.
    const [audioArg] = transcribe.mock.calls[0];
    expect(Buffer.isBuffer(audioArg)).toBe(true);
    expect(audioArg.toString()).toBe('audio');
    // Perfect match -> top score.
    expect(result.overallScore).toBe(100);
  });

  it('rejects stt requests without audioBase64', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      whisperClientFactory: () => ({ transcribe: jest.fn() }),
    });
    await expect(
      client.invoke('stt', { expectedText: 'hi', durationSeconds: 2 }, 'key')
    ).rejects.toThrow(/audioBase64/);
  });

  it('rejects stt requests without a numeric durationSeconds', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      whisperClientFactory: () => ({ transcribe: jest.fn() }),
    });
    await expect(
      client.invoke(
        'stt',
        { expectedText: 'hi', audioBase64: Buffer.from('a').toString('base64') },
        'key'
      )
    ).rejects.toThrow(/durationSeconds/);
  });

  it('routes grammar requests through the injected LLM client', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        exercises: [
          {
            type: 'fill_in_blank',
            question: 'The ___ is blue.',
            correctAnswer: 'sky',
            grammarRule: 'nouns',
          },
        ],
      })
    );
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      llmClientFactory: () => ({ generate }),
    });

    await client.invoke(
      'grammar',
      { chapterId: 'c1', learnerId: 'l1', gradeLevel: '5th', transcript: 'Some text.', language: 'en' },
      'openai-key'
    );

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('routes revision requests through the injected LLM client', async () => {
    const generate = jest.fn().mockResolvedValue(
      JSON.stringify({
        questions: [
          {
            type: 'mcq',
            question: 'Q?',
            options: ['a', 'b', 'c', 'd'],
            correctAnswer: 'a',
            explanation: 'because',
          },
        ],
      })
    );
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      llmClientFactory: () => ({ generate }),
    });

    await client.invoke(
      'revision',
      {
        chapterId: 'c1',
        learnerId: 'l1',
        gradeLevel: '5th',
        transcript: 'Some text.',
        difficulty: 'Easy',
        subject: 'Science',
      },
      'openai-key'
    );

    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects grammar requests without a transcript', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      llmClientFactory: () => ({ generate: jest.fn() }),
    });
    await expect(client.invoke('grammar', {}, 'key')).rejects.toThrow(/transcript/);
  });

  it('rejects explain requests when TTS/S3 are not configured', async () => {
    const client = new AIServiceClient({
      imageFetcher: fakeImageFetcher(),
      llmClientFactory: () => ({ generate: jest.fn() }),
    });
    await expect(
      client.invoke('explain', { pages: [{ pageNumber: 1, text: 'x' }] }, 'key')
    ).rejects.toThrow(/TTS client and S3 uploader/);
  });
});
