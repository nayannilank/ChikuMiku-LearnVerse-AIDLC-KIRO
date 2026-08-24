/**
 * S3 image-byte fetcher.
 *
 * Concrete implementation of `ImageByteFetcher` (see clients/google-vision.ts)
 * that reads page images from S3 so they can be sent to Google Vision for OCR.
 *
 * The AWS SDK is provided by the Lambda runtime and is marked as an external
 * module in the CDK bundling config (`externalModules: ['@aws-sdk/*']`), so it
 * is a runtime dependency rather than something bundled into the artifact.
 *
 * Requirements: 8.1, 19.4
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { ImageByteFetcher } from './google-vision';

/** Options for constructing the S3 image fetcher. */
export interface S3ImageByteFetcherOptions {
  bucket: string;
  /** Injectable S3 client (defaults to a new client for the ambient region). */
  s3Client?: S3Client;
}

/**
 * Reads image bytes from S3 for OCR processing.
 */
export class S3ImageByteFetcher implements ImageByteFetcher {
  private readonly bucket: string;
  private readonly s3Client: S3Client;

  constructor(options: S3ImageByteFetcherOptions) {
    this.bucket = options.bucket;
    this.s3Client = options.s3Client ?? new S3Client({});
  }

  async getImageBytes(imageS3Key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: imageS3Key,
    });

    const response = await this.s3Client.send(command);

    if (!response.Body) {
      throw new Error(`S3 object has no body: ${imageS3Key}`);
    }

    // `Body` is a Node.js Readable stream in the Lambda runtime. The SDK also
    // exposes `transformToByteArray()` on the stream mixin.
    const body = response.Body as {
      transformToByteArray?: () => Promise<Uint8Array>;
    };

    if (typeof body.transformToByteArray === 'function') {
      const bytes = await body.transformToByteArray();
      return Buffer.from(bytes);
    }

    // Fallback: collect the async-iterable stream chunks.
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as unknown as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
