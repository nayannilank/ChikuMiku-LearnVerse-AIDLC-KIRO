/**
 * Unit tests for the content AwsS3Client.
 *
 * Mocks the injected AWS SDK S3 client's send() and the presigner seam, so no
 * real S3 or network access occurs. Verifies the commands are built with the
 * right bucket/key/content-type and that URLs are returned as documented.
 */

import {
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { AwsS3Client, type Presigner } from './aws-s3-client';

/** A fake SDK S3 client whose send() is a jest.fn. */
function fakeSdkClient(sendImpl?: jest.Mock) {
  const send = sendImpl ?? jest.fn().mockResolvedValue({});
  // Cast through unknown: only send() is exercised by AwsS3Client.
  return { client: { send } as never, send };
}

const BUCKET = 'page-images-test';

describe('AwsS3Client', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.PAGE_IMAGES_BUCKET;
    delete process.env.AWS_REGION;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('constructor', () => {
    it('throws when no bucket is provided and PAGE_IMAGES_BUCKET is unset', () => {
      expect(() => new AwsS3Client()).toThrow(/bucket/i);
    });

    it('falls back to the PAGE_IMAGES_BUCKET env var', async () => {
      process.env.PAGE_IMAGES_BUCKET = 'env-bucket';
      const { client, send } = fakeSdkClient();
      const s3 = new AwsS3Client({ s3Client: client });

      await s3.uploadImage('pages/c-1/1_content.png', Buffer.from('x'), 'png');

      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input.Bucket).toBe('env-bucket');
    });
  });

  describe('uploadImage', () => {
    it('sends a PutObjectCommand with the correct key, body, and content type', async () => {
      const { client, send } = fakeSdkClient();
      const s3 = new AwsS3Client({ bucket: BUCKET, s3Client: client, region: 'us-west-2' });
      const data = Buffer.from('image-bytes');

      const url = await s3.uploadImage('pages/c-1/2_exercise.jpeg', data, 'jpeg');

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: BUCKET,
        Key: 'pages/c-1/2_exercise.jpeg',
        Body: data,
        ContentType: 'image/jpeg',
      });
      expect(url).toBe(
        `https://${BUCKET}.s3.us-west-2.amazonaws.com/pages/c-1/2_exercise.jpeg`
      );
    });

    it('maps png and heic formats to their content types', async () => {
      const { client, send } = fakeSdkClient();
      const s3 = new AwsS3Client({ bucket: BUCKET, s3Client: client });

      await s3.uploadImage('a.png', Buffer.from('a'), 'png');
      await s3.uploadImage('b.heic', Buffer.from('b'), 'heic');

      expect((send.mock.calls[0][0] as PutObjectCommand).input.ContentType).toBe('image/png');
      expect((send.mock.calls[1][0] as PutObjectCommand).input.ContentType).toBe('image/heic');
    });

    it('falls back to application/octet-stream for unknown formats', async () => {
      const { client, send } = fakeSdkClient();
      const s3 = new AwsS3Client({ bucket: BUCKET, s3Client: client });

      await s3.uploadImage('c.bin', Buffer.from('c'), 'tiff');

      expect((send.mock.calls[0][0] as PutObjectCommand).input.ContentType).toBe(
        'application/octet-stream'
      );
    });

    it('uses a custom urlBuilder when supplied', async () => {
      const { client } = fakeSdkClient();
      const s3 = new AwsS3Client({
        bucket: BUCKET,
        s3Client: client,
        urlBuilder: (bucket, key) => `https://cdn.example.com/${bucket}/${key}`,
      });

      const url = await s3.uploadImage('pages/c-1/1_content.png', Buffer.from('x'), 'png');

      expect(url).toBe(`https://cdn.example.com/${BUCKET}/pages/c-1/1_content.png`);
    });
  });

  describe('deleteImage', () => {
    it('sends a DeleteObjectCommand with the correct bucket and key', async () => {
      const { client, send } = fakeSdkClient();
      const s3 = new AwsS3Client({ bucket: BUCKET, s3Client: client });

      await s3.deleteImage('pages/c-1/3_content.png');

      expect(send).toHaveBeenCalledTimes(1);
      const command = send.mock.calls[0][0] as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: BUCKET,
        Key: 'pages/c-1/3_content.png',
      });
    });
  });

  describe('getSignedUrl', () => {
    it('presigns a GetObjectCommand with the configured expiry', async () => {
      const { client } = fakeSdkClient();
      const presigner = jest.fn().mockResolvedValue('https://signed.example/x') as jest.Mock &
        Presigner;
      const s3 = new AwsS3Client({
        bucket: BUCKET,
        s3Client: client,
        presigner,
        signedUrlExpirySeconds: 120,
      });

      const url = await s3.getSignedUrl('pages/c-1/1_content.png');

      expect(url).toBe('https://signed.example/x');
      expect(presigner).toHaveBeenCalledTimes(1);
      const [passedClient, command, options] = presigner.mock.calls[0];
      expect(passedClient).toBe(client);
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect((command as GetObjectCommand).input).toMatchObject({
        Bucket: BUCKET,
        Key: 'pages/c-1/1_content.png',
      });
      expect(options).toEqual({ expiresIn: 120 });
    });

    it('defaults the expiry to 900 seconds', async () => {
      const { client } = fakeSdkClient();
      const presigner = jest.fn().mockResolvedValue('https://signed.example/y') as jest.Mock &
        Presigner;
      const s3 = new AwsS3Client({ bucket: BUCKET, s3Client: client, presigner });

      await s3.getSignedUrl('k');

      expect(presigner.mock.calls[0][2]).toEqual({ expiresIn: 900 });
    });
  });
});
