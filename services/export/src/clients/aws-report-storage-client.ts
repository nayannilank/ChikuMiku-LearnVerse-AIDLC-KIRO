/**
 * AWS S3-backed ReportStorageClient for the export service.
 *
 * Concrete implementation of `ReportStorageClient` (see
 * ../handlers/export-report.ts). Uploads generated progress reports (PDF/CSV)
 * to the export-files bucket and issues time-limited pre-signed GET URLs so
 * parents can download their report without the bucket being public.
 *
 * Follows the same conventions as the AI Gateway `S3UploadClient`: an
 * injectable `s3Client` test seam, `PutObjectCommand` for uploads, and a
 * virtual-hosted-style object URL. Pre-signed URLs are produced with
 * `@aws-sdk/s3-request-presigner`'s `getSignedUrl` over a `GetObjectCommand`.
 *
 * The bucket name comes from the constructor or the `EXPORT_FILES_BUCKET`
 * environment variable (wired by the export CDK stack). The AWS SDK is
 * provided by the Lambda runtime and marked external in bundling.
 *
 * Requirements: 17.5, 20.4
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ReportStorageClient } from '../handlers/export-report';

/** Options for constructing the AWS report storage client (test seam). */
export interface AwsReportStorageClientOptions {
  /**
   * Target S3 bucket. Defaults to the `EXPORT_FILES_BUCKET` environment
   * variable when omitted.
   */
  bucket?: string;
  /**
   * Optional AWS region, used to build a virtual-hosted-style URL from
   * `uploadReport`. Defaults to the ambient AWS_REGION.
   */
  region?: string;
  /** Injectable S3 client (defaults to a new client for the ambient region). */
  s3Client?: S3Client;
  /**
   * Injectable pre-signer, primarily for tests. Defaults to the AWS SDK's
   * `getSignedUrl`.
   */
  signer?: typeof getSignedUrl;
}

/**
 * Uploads reports to S3 and issues pre-signed download URLs.
 */
export class AwsReportStorageClient implements ReportStorageClient {
  private readonly bucket: string;
  private readonly region: string;
  private readonly s3Client: S3Client;
  private readonly signer: typeof getSignedUrl;

  constructor(options: AwsReportStorageClientOptions = {}) {
    const bucket = options.bucket ?? process.env.EXPORT_FILES_BUCKET;
    if (!bucket) {
      throw new Error(
        'AwsReportStorageClient requires a bucket (pass options.bucket or set EXPORT_FILES_BUCKET)'
      );
    }
    this.bucket = bucket;
    this.region = options.region ?? process.env.AWS_REGION ?? 'us-east-1';
    this.s3Client = options.s3Client ?? new S3Client({});
    this.signer = options.signer ?? getSignedUrl;
  }

  /**
   * Uploads a report buffer to S3 and returns its virtual-hosted-style object
   * URL. (The pre-signed download URL is produced separately via
   * `getPresignedUrl`.)
   */
  async uploadReport(
    key: string,
    content: Buffer,
    contentType: string
  ): Promise<string> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
      })
    );

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Generates a pre-signed GET URL for downloading a previously uploaded
   * report, valid for `expiresInSeconds`.
   */
  async getPresignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return this.signer(
      this.s3Client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds }
    );
  }
}
