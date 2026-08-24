/**
 * S3 upload client (concrete IS3Client).
 *
 * Uploads generated assets (e.g. TTS audio) to the audio-assets bucket and
 * returns a URL for the stored object. Used by the explanation and
 * pronunciation TTS paths.
 *
 * The bucket name is provided via the AUDIO_ASSETS_BUCKET environment variable
 * (wired by the AI Gateway CDK stack). The AWS SDK is provided by the Lambda
 * runtime and marked external in bundling (`externalModules: ['@aws-sdk/*']`).
 *
 * Requirements: 9.1, 10.2, 19.4
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { IS3Client } from '../services/explanation';

/** Options for constructing the S3 upload client. */
export interface S3UploadClientOptions {
  bucket: string;
  /**
   * Optional AWS region, used to build a virtual-hosted-style URL when no
   * custom `urlBuilder` is supplied. Defaults to the ambient AWS_REGION.
   */
  region?: string;
  /** Injectable S3 client (defaults to a new client for the ambient region). */
  s3Client?: S3Client;
  /**
   * Optional custom URL builder (e.g. for a CloudFront distribution). When
   * omitted, a virtual-hosted-style S3 URL is returned.
   */
  urlBuilder?: (bucket: string, key: string) => string;
}

/**
 * Uploads assets to S3 and returns their object URL.
 */
export class S3UploadClient implements IS3Client {
  private readonly bucket: string;
  private readonly region: string;
  private readonly s3Client: S3Client;
  private readonly urlBuilder?: (bucket: string, key: string) => string;

  constructor(options: S3UploadClientOptions) {
    this.bucket = options.bucket;
    this.region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
    this.s3Client = options.s3Client ?? new S3Client({});
    this.urlBuilder = options.urlBuilder;
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      })
    );

    if (this.urlBuilder) {
      return this.urlBuilder(this.bucket, key);
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
