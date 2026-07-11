/**
 * Secrets Manager Client.
 * Retrieves API keys for external AI services from AWS Secrets Manager.
 *
 * Caches secrets in memory for the Lambda execution lifetime
 * to minimize Secrets Manager API calls.
 *
 * Requirements: 25.6
 */

/** Available secret key names for AI services. */
export type SecretName =
  | 'google-vision-api-key'
  | 'openai-api-key'
  | 'google-tts-api-key'
  | 'whisper-api-key';

/** Interface for the secrets manager client (dependency injection). */
export interface ISecretsManagerClient {
  getSecret(secretName: SecretName): Promise<string>;
}

/**
 * In-memory caching wrapper around Secrets Manager.
 * Caches fetched secrets to avoid repeated API calls within the same
 * Lambda invocation.
 */
export class CachingSecretsManager implements ISecretsManagerClient {
  private cache: Map<SecretName, string> = new Map();
  private readonly delegate: ISecretsManagerClient;

  constructor(delegate: ISecretsManagerClient) {
    this.delegate = delegate;
  }

  async getSecret(secretName: SecretName): Promise<string> {
    const cached = this.cache.get(secretName);
    if (cached) {
      return cached;
    }

    const value = await this.delegate.getSecret(secretName);
    this.cache.set(secretName, value);
    return value;
  }

  /** Clears the in-memory cache (useful for testing or key rotation). */
  clearCache(): void {
    this.cache.clear();
  }
}

/**
 * Maps AI request types to the secret key needed for that service.
 */
export function getSecretNameForService(
  serviceType: 'ocr' | 'explain' | 'qa' | 'grammar' | 'revision' | 'tts' | 'stt' | 'embed'
): SecretName {
  switch (serviceType) {
    case 'ocr':
      return 'google-vision-api-key';
    case 'tts':
      return 'google-tts-api-key';
    case 'stt':
      return 'whisper-api-key';
    case 'explain':
    case 'qa':
    case 'grammar':
    case 'revision':
    case 'embed':
      return 'openai-api-key';
  }
}
