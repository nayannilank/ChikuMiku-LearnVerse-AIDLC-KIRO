/**
 * Unit tests for AwsReportStorageClient.
 *
 * The AWS SDK client `send()` and the `s3-request-presigner` `getSignedUrl`
 * are mocked via the client's injectable seams, so no network or credentials
 * are needed.
 *
 * Requirements: 17.5, 20.4
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { AwsReportStorageClient } from './aws-report-storage-client';

describe('AwsReportStorageClient', () => {
  const bucket = 'export-files-test';
  const region = 'us-west-2';

  let send: jest.Mock;
  let s3Client: S3Client;
  let signer: jest.Mock;

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({});
    // Minimal S3Client stand-in exposing the mocked send().
    s3Client = { send } as unknown as S3Client;
    signer = jest.fn().mockResolvedValue('https://signed.example.com/report?sig=abc');
  });

  describe('constructor', () => {
    it('throws when no bucket is provided and EXPORT_FILES_BUCKET is unset', () => {
      const previous = process.env.EXPORT_FILES_BUCKET;
      delete process.env.EXPORT_FILES_BUCKET;
      try {
        expect(() => new AwsReportStorageClient({ s3Client, signer })).toThrow(
          /bucket/i
        );
      } finally {
        if (previous !== undefined) process.env.EXPORT_FILES_BUCKET = previous;
      }
    });

    it('falls back to the EXPORT_FILES_BUCKET environment variable', async () => {
      const previous = process.env.EXPORT_FILES_BUCKET;
      process.env.EXPORT_FILES_BUCKET = 'env-bucket';
      try {
        const client = new AwsReportStorageClient({ region, s3Client, signer });
        const url = await client.uploadReport('k', Buffer.from('x'), 'text/csv');
        expect(url).toBe('https://env-bucket.s3.us-west-2.amazonaws.com/k');
      } finally {
        if (previous === undefined) delete process.env.EXPORT_FILES_BUCKET;
        else process.env.EXPORT_FILES_BUCKET = previous;
      }
    });
  });

  describe('uploadReport', () => {
    it('sends a PutObjectCommand with the bucket, key, body, and content type', async () => {
      const client = new AwsReportStorageClient({ bucket, region, s3Client, signer });
      const content = Buffer.from('col1,col2\n1,2', 'utf-8');

      await client.uploadReport('exports/parent-1/report.csv', content, 'text/csv');

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: bucket,
        Key: 'exports/parent-1/report.csv',
        Body: content,
        ContentType: 'text/csv',
      });
    });

    it('returns the virtual-hosted-style object URL', async () => {
      const client = new AwsReportStorageClient({ bucket, region, s3Client, signer });

      const url = await client.uploadReport(
        'exports/parent-1/report.pdf',
        Buffer.from('pdf'),
        'application/pdf'
      );

      expect(url).toBe(
        'https://export-files-test.s3.us-west-2.amazonaws.com/exports/parent-1/report.pdf'
      );
    });
  });

  describe('getPresignedUrl', () => {
    it('signs a GetObjectCommand with the requested expiry and returns the URL', async () => {
      const client = new AwsReportStorageClient({ bucket, region, s3Client, signer });

      const url = await client.getPresignedUrl('exports/parent-1/report.csv', 3600);

      expect(url).toBe('https://signed.example.com/report?sig=abc');
      expect(signer).toHaveBeenCalledTimes(1);
      const [passedClient, command, opts] = signer.mock.calls[0];
      expect(passedClient).toBe(s3Client);
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({
        Bucket: bucket,
        Key: 'exports/parent-1/report.csv',
      });
      expect(opts).toEqual({ expiresIn: 3600 });
    });

    it('does not upload (send) when only generating a pre-signed URL', async () => {
      const client = new AwsReportStorageClient({ bucket, region, s3Client, signer });

      await client.getPresignedUrl('exports/parent-1/report.csv', 60);

      expect(send).not.toHaveBeenCalled();
    });
  });
});
