/**
 * AWS-backed S3 client for the content service (concrete {@link S3Client}).
 *
 * Stores page images in the page-images bucket, deletes them on page removal,
 * and issues pre-signed GET URLs so the web/mobile clients can read images
 * directly without proxying bytes through the API.
 *
 * The bucket name comes from the constructor or the PAGE_IMAGES_BUCKET
 * environment variable (wired by the content CDK stack). The AWS SDK is
 * provided by the Lambda runtime and marked external in bundling
 * (`externalModules: ['@aws-sdk/*']`), so it is a runtime dependency rather
 * than something bundled into the artifact.
 *
 * Mirrors the ai-gateway S3 client pattern: an injectable `s3Client` seam for
 * unit testing and a virtual-hosted-style URL builder.
 */

import {
  S3Client as AwsSdkS3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { S3Client } from './s3-client';

/** Maps a page image format to its HTTP content type. */
const CONTENT_TYPE_BY_FORMAT: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

/** Fallback content type for unknown formats. */
const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/** Default pre-signed URL validity (15 minutes). */
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 900;

/**
 * Presigner seam. Matches the signature of `getSignedUrl` from
 * `@aws-sdk/s3-request-presigner` so it can be swapped out in tests.
 */
export type Presigner = (
  client: AwsSdkS3Client,
  command: GetObjectCommand,
  options?: { expiresIn?: number }
) => Promise<string>;

/** Options for constructing the AWS S3 client. */
export interface AwsS3ClientOptions {
  /** Target bucket. Defaults to the PAGE_IMAGES_BUCKET environment variable. */
  bucket?: string;
  /**
   * Optional AWS region, used to build a virtual-hosted-style URL when no
   * custom `urlBuilder` is supplied. Defaults to the ambient AWS_REGION.
   */
  region?: string;
  /** Injectable S3 client (defaults to a new client for the ambient region). */
  s3Client?: AwsSdkS3Client;
  /** Injectable presigner (defaults to the SDK's `getSignedUrl`). */
  presigner?: Presigner;
  /** Pre-signed URL validity in seconds. Defaults to 900 (15 minutes). */
  signedUrlExpirySeconds?: number;
  /**
   * Optional custom URL builder (e.g. for a CloudFront distribution). When
   * omitted, a virtual-hosted-style S3 URL is returned by `uploadImage`.
   */
  urlBuilder?: (bucket: string, key: string) => string;
}

/**
 * Stores, deletes, and pre-signs page images in S3.
 */
export class AwsS3Client implements S3Client {
  private readonly bucket: string;
  private readonly region: string;
  private readonly s3Client: AwsSdkS3Client;
  private readonly presigner: Presigner;
  private readonly signedUrlExpirySeconds: number;
  private readonly urlBuilder?: (bucket: string, key: string) => string;

  constructor(options: AwsS3ClientOptions = {}) {
    const bucket = options.bucket ?? process.env.PAGE_IMAGES_BUCKET;
    if (!bucket) {
      throw new Error(
        'AwsS3Client requires a bucket (constructor option or PAGE_IMAGES_BUCKET env var)'
      );
    }
    this.bucket = bucket;
    this.region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
    this.s3Client = options.s3Client ?? new AwsSdkS3Client({});
    this.presigner = options.presigner ?? getSignedUrl;
    this.signedUrlExpirySeconds =
      options.signedUrlExpirySeconds ?? DEFAULT_SIGNED_URL_EXPIRY_SECONDS;
    this.urlBuilder = options.urlBuilder;
  }

  async uploadImage(key: string, data: Buffer, format: string): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: CONTENT_TYPE_BY_FORMAT[format] ?? DEFAULT_CONTENT_TYPE,
      })
    );

    if (this.urlBuilder) {
      return this.urlBuilder(this.bucket, key);
    }

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async deleteImage(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return this.presigner(this.s3Client, command, {
      expiresIn: this.signedUrlExpirySeconds,
    });
  }
}
