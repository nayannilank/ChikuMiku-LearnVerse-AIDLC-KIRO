/**
 * Environment configuration for the web client.
 *
 * Uses Vite environment variables (import.meta.env.VITE_*) to configure
 * the API base URL and other environment-specific settings.
 *
 * Validates: Requirements 19.1, 19.2
 */

export type Environment = 'development' | 'staging' | 'production';

interface EnvironmentConfig {
  apiBaseUrl: string;
  environment: Environment;
  /** Request timeout in milliseconds */
  requestTimeoutMs: number;
}

/**
 * Detect the current environment from Vite mode.
 */
function detectEnvironment(): Environment {
  const mode = import.meta.env.MODE;
  if (mode === 'staging') return 'staging';
  if (mode === 'production') return 'production';
  return 'development';
}

/**
 * Resolve the API base URL from environment variables with sensible defaults.
 *
 * In production, the CDK stack outputs the API Gateway URL which is set as
 * VITE_API_BASE_URL during the build process.
 * Format: https://{restApiId}.execute-api.{region}.amazonaws.com/v1/
 */
function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Remove trailing slash for consistency
    return envUrl.replace(/\/+$/, '');
  }

  // Fallback defaults per environment
  const env = detectEnvironment();
  switch (env) {
    case 'production':
      return 'https://api.chikumiku-learnverse.com/v1';
    case 'staging':
      return 'https://api-staging.chikumiku-learnverse.com/v1';
    default:
      return 'http://localhost:3000/v1';
  }
}

/** Current environment configuration */
export const environment: EnvironmentConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
  environment: detectEnvironment(),
  requestTimeoutMs: detectEnvironment() === 'development' ? 30000 : 10000,
};

/** Convenience export for the API base URL */
export const API_BASE_URL: string = environment.apiBaseUrl;
