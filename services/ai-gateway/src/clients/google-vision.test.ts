/**
 * Unit tests for the Google Cloud Vision OCR client.
 * Mocks the image fetcher and fetch to verify request shape, response
 * mapping, and error handling — without real API calls.
 */

import { GoogleVisionClient, mapVisionResponse, type ImageByteFetcher } from './google-vision';

// --- Test helpers ---

function createImageFetcher(bytes: Buffer = Buffer.from('fake-image-bytes')): ImageByteFetcher {
  return {
    getImageBytes: jest.fn().mockResolvedValue(bytes),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

// --- Tests ---

describe('GoogleVisionClient', () => {
  it('sends a base64 DOCUMENT_TEXT_DETECTION request with the API key', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        responses: [
          {
            fullTextAnnotation: {
              text: 'Hello world',
              pages: [
                {
                  confidence: 0.97,
                  property: { detectedLanguages: [{ languageCode: 'en', confidence: 0.99 }] },
                },
              ],
            },
          },
        ],
      })
    );

    const client = new GoogleVisionClient({
      imageFetcher: createImageFetcher(Buffer.from('abc')),
      fetchImpl,
    });

    const result = await client.detectText('pages/page-1.jpg', 'my-api-key');

    expect(result).toEqual({ text: 'Hello world', language: 'en', confidence: 0.97 });

    // Verify the request URL contains the key and the body is well-formed.
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toContain('key=my-api-key');
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body);
    expect(body.requests[0].features[0].type).toBe('DOCUMENT_TEXT_DETECTION');
    expect(body.requests[0].image.content).toBe(Buffer.from('abc').toString('base64'));
  });

  it('falls back to textAnnotations when fullTextAnnotation is absent', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        responses: [{ textAnnotations: [{ description: 'हिंदी पाठ', locale: 'hi' }] }],
      })
    );

    const client = new GoogleVisionClient({ imageFetcher: createImageFetcher(), fetchImpl });
    const result = await client.detectText('pages/hindi.jpg', 'key');

    expect(result.text).toBe('हिंदी पाठ');
    expect(result.language).toBe('hi');
  });

  it('throws an auth error for an empty API key without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const client = new GoogleVisionClient({ imageFetcher: createImageFetcher(), fetchImpl });

    await expect(client.detectText('pages/page-1.jpg', '')).rejects.toThrow(
      'Invalid API key: authentication failed'
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws an auth error on 403 responses', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 403));
    const client = new GoogleVisionClient({ imageFetcher: createImageFetcher(), fetchImpl });

    await expect(client.detectText('pages/page-1.jpg', 'bad-key')).rejects.toThrow(
      'Invalid API key: authentication failed'
    );
  });

  it('normalizes corrupt-image API errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        responses: [{ error: { code: 3, message: 'Bad image data: cannot decode' } }],
      })
    );
    const client = new GoogleVisionClient({ imageFetcher: createImageFetcher(), fetchImpl });

    await expect(client.detectText('pages/corrupt.jpg', 'key')).rejects.toThrow(
      'Image is corrupted or unreadable'
    );
  });

  it('wraps network failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const client = new GoogleVisionClient({ imageFetcher: createImageFetcher(), fetchImpl });

    await expect(client.detectText('pages/page-1.jpg', 'key')).rejects.toThrow(
      /Google Vision request failed: ECONNRESET/
    );
  });
});

describe('mapVisionResponse', () => {
  it('trims text and defaults language/confidence when missing', () => {
    const result = mapVisionResponse(
      { responses: [{ fullTextAnnotation: { text: '  spaced  ' } }] },
      'k.jpg'
    );
    expect(result).toEqual({ text: 'spaced', language: 'und', confidence: 0 });
  });

  it('throws when no response is present', () => {
    expect(() => mapVisionResponse({ responses: [] }, 'k.jpg')).toThrow(/No OCR response/);
  });
});
