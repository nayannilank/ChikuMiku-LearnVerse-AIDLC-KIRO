/**
 * AWS Secrets Manager client (concrete ISecretsManagerClient).
 *
 * Reads the single `learnverse/third-party-api-keys` JSON blob once, then maps
 * the code's `SecretName` values to the JSON fields stored in that secret:
 *
 *   google-vision-api-key -> GOOGLE_VISION_API_KEY
 *   google-tts-api-key    -> GOOGLE_TTS_API_KEY
 *   openai-api-key        -> OPENAI_API_KEY
 *   whisper-api-key       -> OPENAI_API_KEY  (Whisper is an OpenAI API)
 *
 * The secret ARN is provided via the API_KEYS_SECRET_ARN environment variable
 * (wired by the AI Gateway CDK stack). Wrap this in `CachingSecretsManager` so
 * the blob is fetched at most once per Lambda execution.
 *
 * Requirements: 25.6
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import type { ISecretsManagerClient, SecretName } from './secrets-manager';

/** JSON shape of the third-party API keys secret. */
interface ApiKeysSecretJson {
  GOOGLE_VISION_API_KEY?: string;
  GOOGLE_TTS_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

/** Maps a logical SecretName to the field in the api-keys JSON blob. */
const SECRET_NAME_TO_FIELD: Record<SecretName, keyof ApiKeysSecretJson> = {
  'google-vision-api-key': 'GOOGLE_VISION_API_KEY',
  'google-tts-api-key': 'GOOGLE_TTS_API_KEY',
  'openai-api-key': 'OPENAI_API_KEY',
  // Whisper (speech-to-text) uses the same OpenAI credential.
  'whisper-api-key': 'OPENAI_API_KEY',
};

/** Options for constructing the AWS Secrets Manager client. */
export interface AwsSecretsManagerClientOptions {
  /** ARN or name of the third-party API keys secret. */
  apiKeysSecretId: string;
  /** Injectable underlying SDK client (defaults to a new client). */
  client?: SecretsManagerClient;
}

/**
 * Concrete Secrets Manager client that resolves AI-service API keys from the
 * shared JSON secret. Fetches the blob lazily on first access and caches the
 * parsed object for the lifetime of this instance.
 */
export class AwsSecretsManagerClient implements ISecretsManagerClient {
  private readonly client: SecretsManagerClient;
  private readonly apiKeysSecretId: string;
  private parsed: ApiKeysSecretJson | null = null;

  constructor(options: AwsSecretsManagerClientOptions) {
    this.apiKeysSecretId = options.apiKeysSecretId;
    this.client = options.client ?? new SecretsManagerClient({});
  }

  async getSecret(secretName: SecretName): Promise<string> {
    const blob = await this.loadApiKeys();
    const field = SECRET_NAME_TO_FIELD[secretName];
    const value = blob[field];

    if (!value) {
      throw new Error(
        `Secret field "${field}" (for "${secretName}") is missing or empty in ${this.apiKeysSecretId}`
      );
    }

    return value;
  }

  /** Fetches and parses the api-keys JSON blob once, then caches it. */
  private async loadApiKeys(): Promise<ApiKeysSecretJson> {
    if (this.parsed) {
      return this.parsed;
    }

    const response = await this.client.send(
      new GetSecretValueCommand({ SecretId: this.apiKeysSecretId })
    );

    if (!response.SecretString) {
      throw new Error(
        `Secret ${this.apiKeysSecretId} has no SecretString (binary secrets are not supported)`
      );
    }

    let parsed: ApiKeysSecretJson;
    try {
      parsed = JSON.parse(response.SecretString) as ApiKeysSecretJson;
    } catch {
      throw new Error(`Secret ${this.apiKeysSecretId} is not valid JSON`);
    }

    this.parsed = parsed;
    return parsed;
  }
}

/**
 * Reads a plain (non-JSON-mapped) secret string by ID — used for the Neon
 * database URL secret, which is consumed elsewhere. Returns the raw
 * SecretString. When the secret is a JSON blob, pass `field` to extract one
 * property (e.g. DATABASE_URL).
 */
export async function getRawSecret(
  secretId: string,
  field?: string,
  client: SecretsManagerClient = new SecretsManagerClient({})
): Promise<string> {
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  if (!response.SecretString) {
    throw new Error(`Secret ${secretId} has no SecretString`);
  }

  if (!field) {
    return response.SecretString;
  }

  const parsed = JSON.parse(response.SecretString) as Record<string, string>;
  const value = parsed[field];
  if (!value) {
    throw new Error(`Secret field "${field}" is missing or empty in ${secretId}`);
  }
  return value;
}
