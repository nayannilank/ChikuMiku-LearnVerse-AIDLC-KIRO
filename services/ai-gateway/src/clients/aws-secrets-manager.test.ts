/**
 * Unit tests for the concrete AWS Secrets Manager client.
 * Verifies SecretName -> JSON field mapping, single-fetch caching, and errors,
 * using an injected fake SDK client (no real AWS calls).
 */

import { AwsSecretsManagerClient } from './aws-secrets-manager';

// Minimal fake of the SDK client: records send() calls and returns a canned
// GetSecretValue response.
function createFakeSdkClient(secretString: string | undefined) {
  const send = jest.fn().mockResolvedValue({ SecretString: secretString });
  return { send } as unknown as import('@aws-sdk/client-secrets-manager').SecretsManagerClient & {
    send: jest.Mock;
  };
}

const VALID_BLOB = JSON.stringify({
  GOOGLE_VISION_API_KEY: 'vision-key',
  GOOGLE_TTS_API_KEY: 'tts-key',
  OPENAI_API_KEY: 'openai-key',
});

describe('AwsSecretsManagerClient', () => {
  it('maps each SecretName to the correct JSON field', async () => {
    const client = new AwsSecretsManagerClient({
      apiKeysSecretId: 'arn:secret',
      client: createFakeSdkClient(VALID_BLOB),
    });

    expect(await client.getSecret('google-vision-api-key')).toBe('vision-key');
    expect(await client.getSecret('google-tts-api-key')).toBe('tts-key');
    expect(await client.getSecret('openai-api-key')).toBe('openai-key');
  });

  it('maps whisper-api-key to the OpenAI key', async () => {
    const client = new AwsSecretsManagerClient({
      apiKeysSecretId: 'arn:secret',
      client: createFakeSdkClient(VALID_BLOB),
    });

    expect(await client.getSecret('whisper-api-key')).toBe('openai-key');
  });

  it('fetches the secret blob only once across multiple reads', async () => {
    const fake = createFakeSdkClient(VALID_BLOB);
    const client = new AwsSecretsManagerClient({ apiKeysSecretId: 'arn:secret', client: fake });

    await client.getSecret('google-vision-api-key');
    await client.getSecret('google-tts-api-key');
    await client.getSecret('openai-api-key');

    expect(fake.send).toHaveBeenCalledTimes(1);
  });

  it('throws when a mapped field is missing or empty', async () => {
    const client = new AwsSecretsManagerClient({
      apiKeysSecretId: 'arn:secret',
      client: createFakeSdkClient(JSON.stringify({ GOOGLE_VISION_API_KEY: '' })),
    });

    await expect(client.getSecret('google-vision-api-key')).rejects.toThrow(
      /GOOGLE_VISION_API_KEY.*missing or empty/
    );
  });

  it('throws when the secret has no SecretString', async () => {
    const client = new AwsSecretsManagerClient({
      apiKeysSecretId: 'arn:secret',
      client: createFakeSdkClient(undefined),
    });

    await expect(client.getSecret('openai-api-key')).rejects.toThrow(/no SecretString/);
  });

  it('throws when the secret is not valid JSON', async () => {
    const client = new AwsSecretsManagerClient({
      apiKeysSecretId: 'arn:secret',
      client: createFakeSdkClient('not-json'),
    });

    await expect(client.getSecret('openai-api-key')).rejects.toThrow(/not valid JSON/);
  });
});
